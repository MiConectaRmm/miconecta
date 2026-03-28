'use client'

import { useEffect, useState, useCallback, useRef, Fragment } from 'react'
import {
  MessageSquare, Send, Search, User, Paperclip,
  Volume2, VolumeX, RefreshCw, CheckCircle2, MonitorPlay,
  Plus, MessagesSquare, Wifi, WifiOff, Pencil, Palette,
} from 'lucide-react'
import { ticketsApi, chatApi, conversationsApi, devicesApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'
import { useChatNotificationsStore } from '@/stores/chat-notifications.store'
import {
  INBOX_PALETTE,
  empresaLabel,
  getContactDisplayName,
  getInboxAlias,
  setInboxAlias,
  resolveInboxColor,
  setInboxColorAuto,
  setInboxColorPalette,
  setInboxColorHex,
  type ClientColor,
} from '@/lib/inbox-utils'

interface InboxItem {
  id: string
  kind: 'conversation' | 'ticket'
  conversationId?: string
  ticketId?: string
  ticketNumero?: number
  titulo: string
  status: string
  prioridade?: string
  cliente: string
  empresaNome?: string
  organizationId?: string
  tenantId?: string
  contatoLabel?: string
  deviceId?: string
  deviceHostname?: string
  rustdeskId?: string
  deviceStatus?: string
  criadoEm: string
  unread: number
  lastMessage?: string
  lastMessageAt?: string
}

interface ChatMessage {
  id: string
  content: string
  senderType: string
  senderName: string
  senderId?: string
  type?: string
  criadoEm: string
  arquivoUrl?: string
  arquivoNome?: string
}

const prioridadeEmoji: Record<string, string> = {
  critica: '🔴', urgente: '🔴', alta: '🟠', media: '🟡', baixa: '🟢',
}

function tempoRelativo(data: string): string {
  const diffMs = Date.now() - new Date(data).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function normalizeMessage(raw: any): ChatMessage {
  return {
    id: raw.id,
    content: raw.content || raw.conteudo || '',
    senderType: raw.senderType || raw.remetenteTipo || '',
    senderName: raw.senderName || raw.remetenteNome || '',
    senderId: raw.senderId || raw.senderUserId || raw.remetenteId,
    type: raw.type || raw.tipo,
    criadoEm: raw.criadoEm || raw.createdAt,
    arquivoUrl: raw.arquivoUrl,
    arquivoNome: raw.arquivoNome,
  }
}

function colorKeyForItem(item: InboxItem): string {
  return item.organizationId || item.deviceId || item.ticketId || item.conversationId || item.id
}

function pickClientColor(item: InboxItem): ClientColor {
  return resolveInboxColor(item.id, colorKeyForItem(item))
}

function resolveEmpresaNome(item: InboxItem, tenantNome?: string | null): string {
  return item.empresaNome || item.cliente || tenantNome || ''
}

type MessageGroup =
  | { kind: 'system'; items: ChatMessage[] }
  | { kind: 'user'; items: ChatMessage[]; isMine: boolean; senderLabel: string }

function senderGroupKey(msg: ChatMessage, userId?: string): string {
  if (msg.senderType === 'system' || msg.type === 'sistema') return '__system__'
  const mine = msg.senderType === 'technician' || msg.senderId === userId
  return `${mine ? 'M' : 'C'}|${msg.senderId || msg.senderName}|${msg.senderType}`
}

function buildMessageGroups(messages: ChatMessage[], userId?: string): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const msg of messages) {
    if (msg.senderType === 'system' || msg.type === 'sistema') {
      groups.push({ kind: 'system', items: [msg] })
      continue
    }
    const key = senderGroupKey(msg, userId)
    const isMine = msg.senderType === 'technician' || msg.senderId === userId
    const label = msg.senderName || (isMine ? 'Você' : 'Cliente')
    const last = groups[groups.length - 1]
    if (last?.kind === 'user' && senderGroupKey(last.items[0], userId) === key) {
      last.items.push(msg)
    } else {
      groups.push({ kind: 'user', items: [msg], isMine, senderLabel: label })
    }
  }
  return groups
}

export default function InboxPage() {
  const user = useAuthStore((s) => s.user)
  const [items, setItems] = useState<InboxItem[]>([])
  const [activeItem, setActiveItem] = useState<InboxItem | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [somAtivo, setSomAtivo] = useState(true)
  const [tab, setTab] = useState<'all' | 'conversations' | 'tickets'>('all')
  const [aliasBump, setAliasBump] = useState(0)
  const [aliasDraft, setAliasDraft] = useState('')
  const [nomeEditando, setNomeEditando] = useState(false)
  const [coresAbertas, setCoresAbertas] = useState(false)
  const [hexCustom, setHexCustom] = useState('#2EA3E6')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const joinedRoomsRef = useRef<Set<string>>(new Set())

  const { socket, emit, on } = useSocket('/chat')
  const setChatTotal = useChatNotificationsStore((s) => s.setTotal)
  const incrementUnread = useChatNotificationsStore((s) => s.increment)

  const playSound = useCallback(() => {
    if (!somAtivo) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 800; osc.type = 'sine'
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
    } catch {}
  }, [somAtivo])

  const carregarInbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [convsRes, ticketsAbertosRes, ticketsAndamentoRes] = await Promise.allSettled([
        conversationsApi.listar({ status: 'open' }),
        ticketsApi.listar({ status: 'aberto', limit: 200 }),
        ticketsApi.listar({ status: 'em_atendimento', limit: 200 }),
      ])

      const inboxItems: InboxItem[] = []

      if (convsRes.status === 'fulfilled') {
        const convs = Array.isArray(convsRes.value.data) ? convsRes.value.data : convsRes.value.data?.items || []
        convs.forEach((c: any) => {
          const contatoNames =
            c.participants
              ?.filter((p: any) => p.role !== 'technician' && p.role !== 'system')
              .map((p: any) => p.participantName)
              .filter(Boolean) || []
          const contatoLabel = contatoNames.length ? contatoNames.join(' · ') : '—'
          const tenantNome = c.tenant?.nomeFantasia || c.tenant?.nome
          inboxItems.push({
            id: `conv-${c.id}`,
            kind: 'conversation',
            conversationId: c.id,
            titulo: c.titulo || 'Conversa',
            status: c.status,
            cliente: contatoLabel !== '—' ? contatoLabel : 'N/A',
            contatoLabel,
            empresaNome: tenantNome,
            tenantId: c.tenantId,
            deviceId: c.deviceId,
            criadoEm: c.criadoEm,
            unread: 0,
            lastMessage: c.lastMessagePreview,
            lastMessageAt: c.lastMessageAt || c.criadoEm,
          })
        })
      }

      const extractTickets = (res: PromiseSettledResult<any>) => {
        if (res.status !== 'fulfilled') return []
        return Array.isArray(res.value.data) ? res.value.data : res.value.data?.items || []
      }

      const allTickets = [...extractTickets(ticketsAbertosRes), ...extractTickets(ticketsAndamentoRes)]
      allTickets.forEach((t: any) => {
        if (t.conversationId) {
          const existing = inboxItems.find((i) => i.conversationId === t.conversationId)
          if (existing) {
            const orgNome = t.organization?.nomeFantasia || t.tenant?.nomeFantasia || t.tenant?.nome
            existing.ticketId = t.id
            existing.ticketNumero = t.numero
            existing.prioridade = t.prioridade === 'urgente' ? 'critica' : (t.prioridade || 'media')
            existing.status = t.status
            existing.rustdeskId = t.device?.rustdeskId
            existing.deviceHostname = t.device?.hostname
            existing.deviceStatus = t.device?.status
            existing.deviceId = t.device?.id || t.deviceId
            existing.empresaNome = orgNome || existing.empresaNome
            existing.organizationId = t.organization?.id || existing.organizationId
          }
          return
        }

        const orgNomeTicket = t.organization?.nomeFantasia || t.tenant?.nomeFantasia || t.tenant?.nome
        inboxItems.push({
          id: `ticket-${t.id}`,
          kind: 'ticket',
          ticketId: t.id,
          ticketNumero: t.numero,
          titulo: t.titulo || t.assunto || 'Sem título',
          status: t.status,
          prioridade: t.prioridade === 'urgente' ? 'critica' : (t.prioridade || 'media'),
          cliente: orgNomeTicket || 'N/A',
          empresaNome: orgNomeTicket,
          organizationId: t.organization?.id,
          tenantId: t.tenantId,
          deviceId: t.device?.id || t.deviceId,
          deviceHostname: t.device?.hostname,
          rustdeskId: t.device?.rustdeskId,
          deviceStatus: t.device?.status,
          criadoEm: t.criadoEm || t.createdAt,
          unread: t.hasUnreadFromClient ? 1 : 0,
          lastMessageAt: t.atualizadoEm || t.criadoEm,
        })
      })

      inboxItems.sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1
        if (a.unread === 0 && b.unread > 0) return 1
        return new Date(b.lastMessageAt || b.criadoEm).getTime() - new Date(a.lastMessageAt || a.criadoEm).getTime()
      })

      setItems(inboxItems)

      const total = inboxItems.reduce((sum, i) => sum + i.unread, 0)
      setChatTotal(total)
    } catch (err) {
      console.error('Erro ao carregar inbox:', err)
    } finally {
      setLoading(false)
    }
  }, [setChatTotal])

  useEffect(() => { carregarInbox() }, [carregarInbox])

  useEffect(() => {
    if (!activeItem) {
      setAliasDraft('')
      setNomeEditando(false)
      setCoresAbertas(false)
      return
    }
    setAliasDraft(getInboxAlias(activeItem.id))
    setNomeEditando(false)
    setCoresAbertas(false)
  }, [activeItem?.id])

  useEffect(() => {
    if (!socket) return
    const handleConnect = () => { setWsConnected(true); emit('atendimento:join', {}) }
    const handleDisconnect = () => setWsConnected(false)
    if (socket.connected) { setWsConnected(true); emit('atendimento:join', {}) }
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => { socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect) }
  }, [socket, emit])

  useEffect(() => {
    if (!socket) return

    const offConvMsg = on('conversation:message:new', (raw: any) => {
      const msg = normalizeMessage(raw)
      const convId = raw.conversationId
      if (activeItem?.conversationId === convId) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      }
      setItems((prev) => prev.map((i) => {
        if (i.conversationId !== convId) return i
        const isActive = activeItem?.conversationId === convId
        return { ...i, unread: isActive ? i.unread : i.unread + 1, lastMessage: msg.content, lastMessageAt: msg.criadoEm }
      }))
      if (msg.senderId !== user?.id && activeItem?.conversationId !== convId) {
        playSound()
        incrementUnread(`conv-${convId}`)
      }
    })

    const offTicketMsg = on('message:new', (raw: any) => {
      const msg = normalizeMessage(raw)
      const ticketId = raw.ticketId
      if (activeItem?.ticketId === ticketId && activeItem?.kind === 'ticket') {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      }
      setItems((prev) => prev.map((i) => {
        if (i.ticketId !== ticketId) return i
        const isActive = activeItem?.ticketId === ticketId
        return { ...i, unread: isActive ? i.unread : i.unread + 1, lastMessage: msg.content, lastMessageAt: msg.criadoEm }
      }))
      if (msg.senderId !== user?.id && activeItem?.ticketId !== ticketId) {
        playSound()
        incrementUnread(`ticket-${ticketId}`)
      }
    })

    const offConvNew = on('conversation:new', () => { carregarInbox(true); playSound() })

    return () => { offConvMsg(); offTicketMsg(); offConvNew() }
  }, [socket, on, activeItem, user?.id, playSound, carregarInbox, incrementUnread])

  useEffect(() => {
    if (!socket?.connected) return
    items.forEach((i) => {
      if (i.conversationId && !joinedRoomsRef.current.has(`conv-${i.conversationId}`)) {
        emit('conversation:join', { conversationId: i.conversationId })
        joinedRoomsRef.current.add(`conv-${i.conversationId}`)
      }
      if (i.kind === 'ticket' && i.ticketId && !joinedRoomsRef.current.has(`ticket-${i.ticketId}`)) {
        emit('ticket:join', { ticketId: i.ticketId })
        joinedRoomsRef.current.add(`ticket-${i.ticketId}`)
      }
    })
  }, [items, socket, emit])

  const selecionarItem = async (item: InboxItem) => {
    setActiveItem(item)
    setLoadingMessages(true)
    setMessages([])
    try {
      if (item.conversationId) {
        const res = await conversationsApi.mensagens(item.conversationId, 100)
        const msgs = (Array.isArray(res.data) ? res.data : res.data?.items || []).map(normalizeMessage)
        setMessages(msgs)
        await conversationsApi.marcarLida(item.conversationId).catch(() => {})
      } else if (item.ticketId) {
        const res = await chatApi.mensagens(item.ticketId, 100)
        const msgs = (Array.isArray(res.data) ? res.data : res.data?.items || []).map(normalizeMessage)
        setMessages(msgs)
        await chatApi.marcarTodasLidas(item.ticketId).catch(() => {})
      }
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, unread: 0 } : i))

      if (item.deviceId && !item.rustdeskId) {
        try {
          const dres = await devicesApi.buscar(item.deviceId)
          const d = dres.data
          const rd = d?.rustdeskId
          const hn = d?.hostname
          if (rd || hn) {
            setActiveItem((cur) =>
              cur && cur.id === item.id
                ? { ...cur, rustdeskId: rd || cur.rustdeskId, deviceHostname: hn || cur.deviceHostname }
                : cur,
            )
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, rustdeskId: rd || i.rustdeskId, deviceHostname: hn || i.deviceHostname }
                  : i,
              ),
            )
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const enviarMensagem = async () => {
    if (!newMsg.trim() || !activeItem) return
    const content = newMsg.trim()
    setNewMsg('')
    try {
      if (activeItem.conversationId && socket?.connected) {
        emit('conversation:message', { conversationId: activeItem.conversationId, content })
      } else if (activeItem.conversationId) {
        await conversationsApi.enviarMensagem(activeItem.conversationId, { content })
      } else if (activeItem.ticketId && socket?.connected) {
        emit('message:send', { ticketId: activeItem.ticketId, content })
      } else if (activeItem.ticketId) {
        await chatApi.enviar(activeItem.ticketId, content)
      }
    } catch (err) {
      console.error('Erro ao enviar:', err)
    }
  }

  const novaConversa = async () => {
    try {
      const res = await conversationsApi.criar({ titulo: 'Nova conversa' })
      await carregarInbox(true)
      const newConv = res.data
      if (newConv?.id) {
        const item: InboxItem = {
          id: `conv-${newConv.id}`, kind: 'conversation', conversationId: newConv.id,
          titulo: newConv.titulo || 'Nova conversa', status: 'open', cliente: user?.nome || '',
          criadoEm: new Date().toISOString(), unread: 0,
        }
        selecionarItem(item)
      }
    } catch (err) {
      console.error('Erro ao criar conversa:', err)
    }
  }

  const conectarRemoto = () => {
    if (activeItem?.rustdeskId) {
      window.open(`rustdesk://connection/new/${activeItem.rustdeskId}`, '_blank')
    }
  }

  const salvarNomeContato = () => {
    if (!activeItem) return
    setInboxAlias(activeItem.id, aliasDraft)
    setAliasBump((n) => n + 1)
    setNomeEditando(false)
  }

  const encerrarAtendimento = async () => {
    if (!activeItem) return
    if (!window.confirm('Encerrar atendimento? O ticket será resolvido e a conversa fechada, se existirem.')) return
    try {
      if (activeItem.ticketId && !['resolvido', 'fechado', 'cancelado'].includes(activeItem.status)) {
        await ticketsApi.resolver(activeItem.ticketId)
      }
      if (activeItem.conversationId) {
        await conversationsApi.fechar(activeItem.conversationId).catch(() => {})
      }
      await carregarInbox(true)
      setActiveItem(null)
    } catch {
      alert('Não foi possível encerrar. Tente novamente.')
    }
  }

  const mostrarEncerrar =
    !!activeItem && Boolean(activeItem.ticketId || activeItem.conversationId)
  const mostrarConectar = !!activeItem?.rustdeskId

  useEffect(() => {
    const interval = setInterval(() => carregarInbox(true), 60000)
    return () => clearInterval(interval)
  }, [carregarInbox])

  const filteredItems = items.filter((i) => {
    if (tab === 'conversations' && i.kind !== 'conversation') return false
    if (tab === 'tickets' && i.kind !== 'ticket' && !i.ticketId) return false
    if (!busca) return true
    const b = busca.toLowerCase()
    return i.titulo.toLowerCase().includes(b) || i.cliente.toLowerCase().includes(b) ||
           (i.empresaNome || '').toLowerCase().includes(b) ||
           i.deviceHostname?.toLowerCase().includes(b) || i.ticketNumero?.toString().includes(b)
  })

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden -mx-6">
      {/* LEFT: Inbox list */}
      <div className="w-80 xl:w-96 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MessagesSquare className="w-5 h-5 text-brand-500" />
              Chat/Ticket
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={novaConversa} className="p-1.5 rounded-lg hover:bg-gray-100 text-brand-500" title="Nova conversa">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setSomAtivo(!somAtivo)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title={somAtivo ? 'Som ativado' : 'Som desativado'}>
                {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${wsConnected ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </span>
            </div>
          </div>

          <div className="flex gap-1 mb-3">
            {(['all', 'conversations', 'tickets'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${tab === t ? 'bg-brand-50 text-brand-600' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {t === 'all' ? 'Tudo' : t === 'conversations' ? 'Conversas' : 'Tickets'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">Nenhuma conversa</div>
          ) : (
            filteredItems.map((item) => {
              const cor = pickClientColor(item)
              const nomeLista = getContactDisplayName(item)
              return (
                <button
                  key={`${item.id}-${aliasBump}`}
                  onClick={() => selecionarItem(item)}
                  className={`w-full text-left py-3 pr-4 pl-3 border-b border-gray-100 hover:bg-gray-50 transition-colors border-l-4 ${
                    activeItem?.id === item.id ? 'bg-brand-50/80' : ''
                  } ${item.unread > 0 ? 'bg-blue-50/40' : ''}`}
                  style={{ borderLeftColor: cor.border }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {item.kind === 'conversation' && !item.ticketId ? (
                        <MessageSquare className="w-4 h-4 text-brand-500" />
                      ) : (
                        <span className="text-sm">{prioridadeEmoji[item.prioridade || 'media'] || '🟡'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${item.unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                          {item.ticketNumero ? `#${item.ticketNumero} · ` : ''}{nomeLista}
                        </p>
                        {item.unread > 0 && (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {item.unread > 9 ? '9+' : item.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {empresaLabel(resolveEmpresaNome(item, user?.tenant?.nome))}
                      </p>
                      {item.lastMessage && (
                        <p className={`text-xs mt-1 truncate ${item.unread > 0 ? 'text-gray-700' : 'text-gray-500'}`}>
                          {item.lastMessage}
                        </p>
                      )}
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        {tempoRelativo(item.lastMessageAt || item.criadoEm)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* CENTER: Chat */}
      <div className="flex-1 flex flex-col bg-white">
        {!activeItem ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessagesSquare className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600">Chat/Ticket</p>
            <p className="text-sm mt-1">Selecione uma conversa ou crie uma nova</p>
          </div>
        ) : (
          <>
            {/* Header estilo WhatsApp: nome + empresa + ações iguais em chat e ticket */}
            <div
              className="px-4 py-3 border-b border-gray-200"
              style={{ backgroundColor: pickClientColor(activeItem).soft }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {nomeEditando ? (
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <input
                        type="text"
                        value={aliasDraft}
                        onChange={(e) => setAliasDraft(e.target.value)}
                        placeholder="Nome para exibir"
                        className="flex-1 min-w-[140px] bg-white border border-gray-200 rounded-lg py-1.5 px-2 text-sm text-gray-800"
                      />
                      <button
                        type="button"
                        onClick={salvarNomeContato}
                        className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAliasDraft(getInboxAlias(activeItem.id))
                          setNomeEditando(false)
                        }}
                        className="text-xs text-gray-600 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-base font-semibold text-gray-900 truncate">
                        {getContactDisplayName(activeItem)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setNomeEditando(true)}
                        className="p-1 rounded-lg hover:bg-white/60 text-gray-500 shrink-0"
                        title="Nomear contato"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {empresaLabel(resolveEmpresaNome(activeItem, user?.tenant?.nome))}
                  </p>
                  {(activeItem.ticketNumero || activeItem.deviceHostname) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {activeItem.ticketNumero ? `Ticket #${activeItem.ticketNumero}` : ''}
                      {activeItem.ticketNumero && activeItem.deviceHostname ? ' · ' : ''}
                      {activeItem.deviceHostname ? `PC ${activeItem.deviceHostname}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCoresAbertas((v) => !v)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50"
                      title="Cor deste cliente"
                    >
                      <Palette className="w-3.5 h-3.5" /> Cor
                    </button>
                    {mostrarConectar && (
                      <button
                        type="button"
                        onClick={conectarRemoto}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <MonitorPlay className="w-3.5 h-3.5" /> Conectar
                      </button>
                    )}
                    {mostrarEncerrar && (
                      <button
                        type="button"
                        onClick={encerrarAtendimento}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Encerrar
                      </button>
                    )}
                  </div>
                  {coresAbertas && (
                    <div className="flex flex-wrap items-center justify-end gap-1.5 p-2 bg-white rounded-lg border border-gray-200 shadow-sm max-w-[min(100%,280px)]">
                      <button
                        type="button"
                        onClick={() => {
                          setInboxColorAuto(activeItem.id)
                          setAliasBump((n) => n + 1)
                        }}
                        className="text-[10px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Auto
                      </button>
                      {INBOX_PALETTE.map((c, i) => (
                        <button
                          key={i}
                          type="button"
                          title={`Cor ${i + 1}`}
                          className="w-7 h-7 rounded-full border-2 border-white shadow shrink-0"
                          style={{ backgroundColor: c.border }}
                          onClick={() => {
                            setInboxColorPalette(activeItem.id, i)
                            setAliasBump((n) => n + 1)
                          }}
                        />
                      ))}
                      <span className="w-full sm:w-auto flex items-center gap-1 mt-1 sm:mt-0">
                        <input
                          type="color"
                          value={hexCustom}
                          onChange={(e) => setHexCustom(e.target.value)}
                          className="h-7 w-10 rounded cursor-pointer border border-gray-200 p-0 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setInboxColorHex(activeItem.id, hexCustom)
                            setAliasBump((n) => n + 1)
                          }}
                          className="text-[10px] px-2 py-1 rounded-md bg-gray-800 text-white"
                        >
                          Hex
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mensagens agrupadas por remetente */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">Nenhuma mensagem ainda</div>
              ) : (
                <div className="space-y-4">
                  {buildMessageGroups(messages, user?.id).map((group, gi) => {
                    if (group.kind === 'system') {
                      return (
                        <Fragment key={`sys-${group.items[0]?.id ?? gi}`}>
                          {group.items.map((msg) => (
                            <div key={msg.id} className="flex justify-center">
                              <span className="text-[11px] text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                                {msg.content}
                              </span>
                            </div>
                          ))}
                        </Fragment>
                      )
                    }
                    const { isMine, items, senderLabel } = group
                    return (
                      <div
                        key={`g-${gi}-${items[0].id}`}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex flex-col max-w-[72%] ${isMine ? 'items-end' : 'items-start'}`}>
                          {!isMine && (
                            <p className="text-xs font-medium text-gray-600 mb-1 pl-1 flex items-center gap-1">
                              <User className="w-3 h-3 opacity-70" /> {senderLabel}
                            </p>
                          )}
                          <div className="flex flex-col gap-0.5 w-full">
                            {items.map((msg, mi) => {
                              const isFirst = mi === 0
                              const isLast = mi === items.length - 1
                              const roundMine =
                                items.length === 1
                                  ? 'rounded-2xl rounded-br-md'
                                  : isFirst
                                    ? 'rounded-2xl rounded-br-sm rounded-bl-2xl'
                                    : isLast
                                      ? 'rounded-2xl rounded-tr-sm rounded-br-md'
                                      : 'rounded-lg'
                              const roundThem =
                                items.length === 1
                                  ? 'rounded-2xl rounded-bl-md'
                                  : isFirst
                                    ? 'rounded-2xl rounded-bl-sm rounded-br-2xl'
                                    : isLast
                                      ? 'rounded-2xl rounded-tl-sm rounded-bl-md'
                                      : 'rounded-lg'
                              return (
                                <div
                                  key={msg.id}
                                  className={`px-3.5 py-2 ${
                                    isMine
                                      ? `bg-brand-500 text-white ${roundMine}`
                                      : `bg-white text-gray-800 shadow-sm border border-gray-100 ${roundThem}`
                                  }`}
                                >
                                  {msg.arquivoUrl && (
                                    <a
                                      href={msg.arquivoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-1.5 text-xs hover:underline mb-1 ${
                                        isMine ? 'text-brand-100' : 'text-brand-600'
                                      }`}
                                    >
                                      <Paperclip className="w-3 h-3" /> {msg.arquivoNome || 'Arquivo'}
                                    </a>
                                  )}
                                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                                  {isLast && (
                                    <p
                                      className={`text-[10px] mt-1 ${isMine ? 'text-brand-100' : 'text-gray-400'}`}
                                    >
                                      {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-200 bg-white">
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Digite sua mensagem..." value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <button onClick={enviarMensagem} disabled={!newMsg.trim()}
                  className="p-2.5 rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
