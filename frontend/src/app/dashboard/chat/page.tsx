'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  MessageSquare, Send, Search, Building2,
  Wifi, WifiOff, User, Paperclip,
  Volume2, VolumeX, RefreshCw, CheckCircle2, MonitorPlay,
  Plus, Ticket, Link2, Terminal, X, MessagesSquare,
} from 'lucide-react'
import { ticketsApi, chatApi, conversationsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'
import StatusBadge from '@/components/ui/StatusBadge'

// ── Types ──

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
  const [showActions, setShowActions] = useState(false)
  const [tab, setTab] = useState<'all' | 'conversations' | 'tickets'>('all')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const joinedRoomsRef = useRef<Set<string>>(new Set())

  const { socket, emit, on } = useSocket('/chat')

  // ── Som ──
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

  // ── Carregar inbox (conversas + tickets legados) ──
  const carregarInbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [convsRes, ticketsAbertosRes, ticketsAndamentoRes] = await Promise.allSettled([
        conversationsApi.listar({ status: 'open' }),
        ticketsApi.listar({ status: 'aberto', limit: 200 }),
        ticketsApi.listar({ status: 'em_atendimento', limit: 200 }),
      ])

      const inboxItems: InboxItem[] = []
      const conversationTicketIds = new Set<string>()

      // Conversations
      if (convsRes.status === 'fulfilled') {
        const convs = Array.isArray(convsRes.value.data) ? convsRes.value.data : convsRes.value.data?.items || []
        convs.forEach((c: any) => {
          inboxItems.push({
            id: `conv-${c.id}`,
            kind: 'conversation',
            conversationId: c.id,
            titulo: c.titulo || 'Conversa',
            status: c.status,
            cliente: c.participants?.map((p: any) => p.participantName).filter((n: string) => n !== user?.nome).join(', ') || 'N/A',
            deviceId: c.deviceId,
            criadoEm: c.criadoEm,
            unread: 0,
            lastMessage: c.lastMessagePreview,
            lastMessageAt: c.lastMessageAt || c.criadoEm,
          })
        })
      }

      // Tickets (legados sem conversation)
      const extractTickets = (res: PromiseSettledResult<any>) => {
        if (res.status !== 'fulfilled') return []
        return Array.isArray(res.value.data) ? res.value.data : res.value.data?.items || []
      }

      const allTickets = [...extractTickets(ticketsAbertosRes), ...extractTickets(ticketsAndamentoRes)]
      allTickets.forEach((t: any) => {
        // Se o ticket tem conversationId, não duplicar — já veio via conversations
        if (t.conversationId) {
          conversationTicketIds.add(t.conversationId)
          // Enriquecer o item de conversation com dados do ticket
          const existing = inboxItems.find((i) => i.conversationId === t.conversationId)
          if (existing) {
            existing.ticketId = t.id
            existing.ticketNumero = t.numero
            existing.prioridade = t.prioridade === 'urgente' ? 'critica' : (t.prioridade || 'media')
            existing.status = t.status
            existing.rustdeskId = t.device?.rustdeskId
            existing.deviceHostname = t.device?.hostname
            existing.deviceStatus = t.device?.status
            existing.deviceId = t.device?.id || t.deviceId
            existing.cliente = t.tenant?.nomeFantasia || t.tenant?.razaoSocial || t.tenant?.nome || t.criadoPorNome || existing.cliente
          }
          return
        }

        // Ticket legado (sem conversation)
        inboxItems.push({
          id: `ticket-${t.id}`,
          kind: 'ticket',
          ticketId: t.id,
          ticketNumero: t.numero,
          titulo: t.titulo || t.assunto || 'Sem título',
          status: t.status,
          prioridade: t.prioridade === 'urgente' ? 'critica' : (t.prioridade || 'media'),
          cliente: t.tenant?.nomeFantasia || t.tenant?.razaoSocial || t.tenant?.nome || t.criadoPorNome || 'N/A',
          deviceId: t.device?.id || t.deviceId,
          deviceHostname: t.device?.hostname,
          rustdeskId: t.device?.rustdeskId,
          deviceStatus: t.device?.status,
          criadoEm: t.criadoEm || t.createdAt,
          unread: t.hasUnreadFromClient ? 1 : 0,
          lastMessage: undefined,
          lastMessageAt: t.atualizadoEm || t.criadoEm,
        })
      })

      // Sort
      inboxItems.sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1
        if (a.unread === 0 && b.unread > 0) return 1
        return new Date(b.lastMessageAt || b.criadoEm).getTime() - new Date(a.lastMessageAt || a.criadoEm).getTime()
      })

      setItems(inboxItems)
    } catch (err) {
      console.error('Erro ao carregar inbox:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.nome])

  useEffect(() => { carregarInbox() }, [carregarInbox])

  // ── WebSocket connect ──
  useEffect(() => {
    if (!socket) return
    const handleConnect = () => { setWsConnected(true); emit('atendimento:join', {}) }
    const handleDisconnect = () => setWsConnected(false)
    if (socket.connected) { setWsConnected(true); emit('atendimento:join', {}) }
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => { socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect) }
  }, [socket, emit])

  // ── WS: receber mensagens de conversations ──
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
      if (msg.senderId !== user?.id && activeItem?.conversationId !== convId) playSound()
    })

    // Legacy ticket messages
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
      if (msg.senderId !== user?.id && activeItem?.ticketId !== ticketId) playSound()
    })

    const offConvNew = on('conversation:new', () => { carregarInbox(true); playSound() })
    const offNotification = on('notification:new', (data: any) => {
      if (data?.type === 'conversation_message' || data?.type === 'ticket_message') {
        carregarInbox(true)
      }
    })

    return () => { offConvMsg(); offTicketMsg(); offConvNew(); offNotification() }
  }, [socket, on, activeItem, user?.id, playSound, carregarInbox])

  // ── Join rooms ──
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

  // ── Selecionar item ──
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
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  // ── Scroll ──
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Enviar mensagem ──
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

  // ── Nova conversa ──
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

  // ── Concluir ticket ──
  const concluirTicket = async () => {
    if (!activeItem?.ticketId) return
    if (!confirm('Deseja finalizar este chamado?')) return
    try {
      await ticketsApi.resolver(activeItem.ticketId)
      setItems((prev) => prev.filter((i) => i.id !== activeItem.id))
      setActiveItem(null)
      setMessages([])
    } catch (err) {
      console.error('Erro ao concluir:', err)
    }
  }

  // ── Conectar remoto ──
  const conectarRemoto = () => {
    if (activeItem?.rustdeskId) {
      window.open(`rustdesk://connection/new/${activeItem.rustdeskId}`, '_blank')
    }
  }

  // ── Polling ──
  useEffect(() => {
    const interval = setInterval(() => carregarInbox(true), 60000)
    return () => clearInterval(interval)
  }, [carregarInbox])

  // ── Filtro ──
  const filteredItems = items.filter((i) => {
    if (tab === 'conversations' && i.kind !== 'conversation') return false
    if (tab === 'tickets' && i.kind !== 'ticket' && !i.ticketId) return false
    if (!busca) return true
    const b = busca.toLowerCase()
    return i.titulo.toLowerCase().includes(b) || i.cliente.toLowerCase().includes(b) ||
           i.deviceHostname?.toLowerCase().includes(b) || i.ticketNumero?.toString().includes(b)
  })

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -m-6">
      {/* ═══ LEFT: Inbox list ═══ */}
      <div className="w-80 xl:w-96 flex-shrink-0 border-r border-dark-800 flex flex-col bg-dark-950">
        <div className="p-4 border-b border-dark-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <MessagesSquare className="w-5 h-5 text-brand-400" />
              Inbox
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={novaConversa} className="p-1.5 rounded-lg hover:bg-dark-800 text-brand-400" title="Nova conversa">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setSomAtivo(!somAtivo)} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400" title={somAtivo ? 'Som ativado' : 'Som desativado'}>
                {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${wsConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            {(['all', 'conversations', 'tickets'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${tab === t ? 'bg-brand-500/20 text-brand-400' : 'text-dark-400 hover:bg-dark-800'}`}
              >
                {t === 'all' ? 'Tudo' : t === 'conversations' ? 'Conversas' : 'Tickets'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input type="text" placeholder="Buscar conversa, cliente..." value={busca} onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-dark-500 text-sm">Nenhuma conversa</div>
          ) : (
            filteredItems.map((item) => (
              <button key={item.id} onClick={() => selecionarItem(item)}
                className={`w-full text-left px-4 py-3 border-b border-dark-800/50 hover:bg-dark-900 transition-colors ${
                  activeItem?.id === item.id ? 'bg-dark-800/80 border-l-2 border-l-brand-500' : ''
                } ${item.unread > 0 ? 'bg-brand-500/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.kind === 'conversation' && !item.ticketId ? (
                      <MessageSquare className="w-4 h-4 text-brand-400" />
                    ) : (
                      <span className="text-sm">{prioridadeEmoji[item.prioridade || 'media'] || '🟡'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${item.unread > 0 ? 'font-bold text-white' : 'font-medium text-dark-200'}`}>
                        {item.ticketNumero ? `#${item.ticketNumero} ` : ''}{item.titulo}
                      </p>
                      {item.unread > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {item.unread > 9 ? '9+' : item.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3 h-3 text-dark-500 flex-shrink-0" />
                      <span className="text-xs text-dark-400 truncate">{item.cliente}</span>
                      {item.deviceHostname && (
                        <><span className="text-dark-600 text-xs">·</span><span className="text-xs text-dark-500 truncate">{item.deviceHostname}</span></>
                      )}
                    </div>
                    {item.lastMessage && (
                      <p className={`text-xs mt-1 truncate ${item.unread > 0 ? 'text-dark-300' : 'text-dark-500'}`}>{item.lastMessage}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-dark-500">{tempoRelativo(item.lastMessageAt || item.criadoEm)}</span>
                    {item.ticketId ? <StatusBadge status={item.status} /> : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">Chat</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══ CENTER: Chat ═══ */}
      <div className="flex-1 flex flex-col bg-dark-950">
        {!activeItem ? (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-500">
            <MessagesSquare className="w-16 h-16 mb-4 text-dark-700" />
            <p className="text-lg font-medium">Inbox</p>
            <p className="text-sm mt-1">Selecione uma conversa ou crie uma nova</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-dark-800 flex items-center gap-3 bg-dark-900/50">
              {activeItem.prioridade && <div className="text-lg">{prioridadeEmoji[activeItem.prioridade] || '🟡'}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {activeItem.ticketNumero ? `#${activeItem.ticketNumero} ` : ''}{activeItem.titulo}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-dark-400">{activeItem.cliente}</span>
                  {activeItem.deviceHostname && (
                    <><span className="text-xs text-dark-600">·</span><span className="text-xs text-dark-500">{activeItem.deviceHostname}</span></>
                  )}
                  <span className="text-xs text-dark-600">·</span>
                  {activeItem.ticketId ? <StatusBadge status={activeItem.status} /> : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">Chat aberto</span>
                  )}
                </div>
              </div>
              {activeItem.rustdeskId && (
                <button onClick={conectarRemoto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 text-xs font-semibold transition-colors"
                  title={activeItem.deviceStatus === 'online' ? 'Conectar via RustDesk' : 'Dispositivo pode estar offline'}
                >
                  <MonitorPlay className="w-3.5 h-3.5" /> Conectar
                </button>
              )}
              {activeItem.ticketId && !['resolvido', 'fechado', 'cancelado'].includes(activeItem.status) && (
                <button onClick={concluirTicket}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-500 text-xs font-semibold transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar
                </button>
              )}
              <button onClick={() => setShowActions(!showActions)}
                className={`p-1.5 rounded-lg transition-colors ${showActions ? 'bg-brand-500/20 text-brand-400' : 'hover:bg-dark-800 text-dark-400'}`}
                title="Ações"
              >
                <Terminal className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-brand-400 animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-dark-500 text-sm">Nenhuma mensagem ainda</div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderType === 'technician' || msg.senderId === user?.id
                  const isSystem = msg.senderType === 'system' || msg.type === 'sistema' || msg.type === 'system'
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-[11px] text-dark-500 bg-dark-900 px-3 py-1 rounded-full">{msg.content}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-brand-500/20 text-brand-100 rounded-br-md' : 'bg-dark-800 text-dark-200 rounded-bl-md'}`}>
                        {!isMine && (
                          <p className="text-[10px] font-semibold text-dark-400 mb-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" /> {msg.senderName}
                          </p>
                        )}
                        {msg.arquivoUrl && (
                          <a href={msg.arquivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline mb-1">
                            <Paperclip className="w-3 h-3" /> {msg.arquivoNome || 'Arquivo'}
                          </a>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-brand-400/60' : 'text-dark-600'}`}>
                          {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-dark-800 bg-dark-900/50">
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Digite sua mensagem..." value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                  className="flex-1 bg-dark-800 border border-dark-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500/50"
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

      {/* ═══ RIGHT: Actions panel ═══ */}
      {showActions && activeItem && (
        <div className="w-72 flex-shrink-0 border-l border-dark-800 bg-dark-950 flex flex-col">
          <div className="p-4 border-b border-dark-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Ações</h2>
            <button onClick={() => setShowActions(false)} className="p-1 rounded hover:bg-dark-800 text-dark-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            {!activeItem.ticketId && (
              <button
                onClick={async () => {
                  try {
                    const res = await ticketsApi.criar({
                      titulo: activeItem.titulo || 'Ticket via conversa',
                      descricao: `Criado a partir da conversa`,
                      origem: 'painel',
                      deviceId: activeItem.deviceId,
                    })
                    await carregarInbox(true)
                    alert(`Ticket #${res.data?.numero || ''} criado!`)
                  } catch (err) { console.error(err) }
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-700 text-sm text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <Ticket className="w-4 h-4 text-brand-400" /> Criar Ticket
              </button>
            )}
            {activeItem.ticketId && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-700 text-sm text-dark-400">
                <Link2 className="w-4 h-4 text-green-400" />
                <span>Ticket <strong className="text-white">#{activeItem.ticketNumero}</strong> vinculado</span>
              </div>
            )}
            {activeItem.rustdeskId && (
              <button onClick={conectarRemoto}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-700 text-sm text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <MonitorPlay className="w-4 h-4 text-purple-400" /> Acesso Remoto
                <span className={`ml-auto w-2 h-2 rounded-full ${activeItem.deviceStatus === 'online' ? 'bg-green-400' : 'bg-dark-600'}`} />
              </button>
            )}
            {activeItem.deviceId && (
              <button
                onClick={() => window.open(`/dashboard/devices/${activeItem.deviceId}`, '_blank')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-dark-900 border border-dark-700 text-sm text-dark-200 hover:bg-dark-800 hover:text-white transition-colors"
              >
                <Terminal className="w-4 h-4 text-amber-400" /> Ver Dispositivo
              </button>
            )}

            {/* Info */}
            <div className="mt-4 pt-4 border-t border-dark-800 space-y-2">
              <p className="text-[10px] uppercase text-dark-500 font-semibold tracking-wider">Detalhes</p>
              <div className="text-xs text-dark-400 space-y-1">
                <p><span className="text-dark-500">Tipo:</span> {activeItem.kind === 'conversation' ? 'Conversa' : 'Ticket'}</p>
                {activeItem.cliente && <p><span className="text-dark-500">Cliente:</span> {activeItem.cliente}</p>}
                {activeItem.deviceHostname && <p><span className="text-dark-500">Dispositivo:</span> {activeItem.deviceHostname}</p>}
                <p><span className="text-dark-500">Criado:</span> {new Date(activeItem.criadoEm).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
