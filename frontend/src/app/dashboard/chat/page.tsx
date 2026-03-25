'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  MessageSquare, Send, Search, Clock, Building2,
  Wifi, WifiOff, ChevronLeft, User, Paperclip,
  Bell, Volume2, VolumeX, RefreshCw,
} from 'lucide-react'
import { ticketsApi, chatApi, storageApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'
import StatusBadge from '@/components/ui/StatusBadge'

interface ChatTicket {
  id: string
  numero?: number
  titulo: string
  status: string
  prioridade: string
  cliente: string
  deviceHostname?: string
  criadoEm: string
  unread: number
  lastMessage?: string
  lastMessageAt?: string
}

interface ChatMessage {
  id: string
  conteudo: string
  remetenteTipo: string
  remetenteNome: string
  remetenteId?: string
  tipo?: string
  criadoEm: string
  arquivoUrl?: string
  arquivoNome?: string
}

const prioridadeEmoji: Record<string, string> = {
  critica: '🔴', alta: '🟠', media: '🟡', baixa: '🟢',
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

export default function MultiChatPage() {
  const user = useAuthStore((s) => s.user)
  const [tickets, setTickets] = useState<ChatTicket[]>([])
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [somAtivo, setSomAtivo] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const joinedTicketsRef = useRef<Set<string>>(new Set())

  const { socket, emit, on } = useSocket('/chat')

  // ── Som de notificação ──
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

  // ── Carregar tickets com chat ativo ──
  const carregarTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [abertosRes, andamentoRes] = await Promise.allSettled([
        ticketsApi.listar({ status: 'aberto', limit: 200 }),
        ticketsApi.listar({ status: 'em_atendimento', limit: 200 }),
      ])
      const abertos = abertosRes.status === 'fulfilled'
        ? (Array.isArray(abertosRes.value.data) ? abertosRes.value.data : abertosRes.value.data?.items || [])
        : []
      const andamento = andamentoRes.status === 'fulfilled'
        ? (Array.isArray(andamentoRes.value.data) ? andamentoRes.value.data : andamentoRes.value.data?.items || [])
        : []

      const all = [...abertos, ...andamento]
      const chatTickets: ChatTicket[] = all.map((t: any) => ({
        id: t.id,
        numero: t.numero,
        titulo: t.titulo || t.assunto || 'Sem título',
        status: t.status,
        prioridade: t.prioridade === 'urgente' ? 'critica' : (t.prioridade || 'media'),
        cliente: t.tenant?.nomeFantasia || t.tenant?.razaoSocial || t.tenant?.nome || t.criadoPorNome || 'N/A',
        deviceHostname: t.device?.hostname,
        criadoEm: t.criadoEm || t.createdAt,
        unread: t.unreadCount || 0,
        lastMessage: t.lastMessageContent,
        lastMessageAt: t.lastMessageAt || t.atualizadoEm || t.criadoEm,
      }))

      // Sort: unread first, then by last message date
      chatTickets.sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1
        if (a.unread === 0 && b.unread > 0) return 1
        return new Date(b.lastMessageAt || b.criadoEm).getTime() - new Date(a.lastMessageAt || a.criadoEm).getTime()
      })

      setTickets(chatTickets)
    } catch (err) {
      console.error('Erro ao carregar tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregarTickets() }, [carregarTickets])

  // ── WebSocket ──
  useEffect(() => {
    if (!socket) return
    const handleConnect = () => {
      setWsConnected(true)
      emit('atendimento:join', {})
    }
    const handleDisconnect = () => setWsConnected(false)

    if (socket.connected) { setWsConnected(true); emit('atendimento:join', {}) }
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [socket, emit])

  // ── Receber mensagens em tempo real (todos os tickets joined) ──
  useEffect(() => {
    if (!socket) return

    const offNewMsg = on('message:new', (raw: any) => {
      const msg: ChatMessage = {
        id: raw.id,
        conteudo: raw.conteudo || raw.content || '',
        remetenteTipo: raw.remetenteTipo || raw.senderType || '',
        remetenteNome: raw.remetenteNome || raw.senderName || '',
        remetenteId: raw.remetenteId || raw.senderId,
        tipo: raw.tipo || raw.type,
        criadoEm: raw.criadoEm || raw.createdAt,
        arquivoUrl: raw.arquivoUrl,
        arquivoNome: raw.arquivoNome,
      }

      const ticketId = raw.ticketId
      if (ticketId === activeTicketId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
      }

      // Update unread count + last message in sidebar
      setTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t
          const isActive = ticketId === activeTicketId
          return {
            ...t,
            unread: isActive ? t.unread : t.unread + 1,
            lastMessage: msg.conteudo,
            lastMessageAt: msg.criadoEm,
          }
        })
      )

      // Play sound if not from self and not active ticket
      if (msg.remetenteId !== user?.id && ticketId !== activeTicketId) {
        playSound()
      }
    })

    // Novo ticket chegou
    const offNewTicket = on('ticket:new', () => {
      carregarTickets(true)
      playSound()
    })

    const offNotification = on('notification:new', (data: any) => {
      if (data?.type === 'ticket_message') {
        // Already handled by message:new for joined tickets
        // But for tickets not yet joined, update sidebar
        const ticketId = data.ticketId
        if (!joinedTicketsRef.current.has(ticketId)) {
          setTickets((prev) =>
            prev.map((t) => t.id === ticketId ? { ...t, unread: t.unread + 1 } : t)
          )
        }
      }
    })

    return () => { offNewMsg(); offNewTicket(); offNotification() }
  }, [socket, on, activeTicketId, user?.id, playSound, carregarTickets])

  // ── Join todos os tickets para receber mensagens ──
  useEffect(() => {
    if (!socket?.connected) return
    tickets.forEach((t) => {
      if (!joinedTicketsRef.current.has(t.id)) {
        emit('ticket:join', { ticketId: t.id })
        joinedTicketsRef.current.add(t.id)
      }
    })
  }, [tickets, socket, emit])

  // ── Selecionar ticket ──
  const selecionarTicket = async (ticketId: string) => {
    setActiveTicketId(ticketId)
    setLoadingMessages(true)
    setMessages([])
    try {
      const res = await chatApi.mensagens(ticketId, 100)
      const msgs = (Array.isArray(res.data) ? res.data : res.data?.items || []).map((m: any) => ({
        id: m.id,
        conteudo: m.conteudo || m.content || '',
        remetenteTipo: m.remetenteTipo || m.senderType || '',
        remetenteNome: m.remetenteNome || m.senderName || '',
        remetenteId: m.remetenteId || m.senderId,
        tipo: m.tipo || m.type,
        criadoEm: m.criadoEm || m.createdAt,
        arquivoUrl: m.arquivoUrl,
        arquivoNome: m.arquivoNome,
      }))
      setMessages(msgs)
      // Mark as read
      await chatApi.marcarTodasLidas(ticketId).catch(() => {})
      setTickets((prev) => prev.map((t) => t.id === ticketId ? { ...t, unread: 0 } : t))
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  // ── Scroll to bottom ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Enviar mensagem ──
  const enviarMensagem = async () => {
    if (!newMsg.trim() || !activeTicketId) return
    const content = newMsg.trim()
    setNewMsg('')
    try {
      if (socket?.connected) {
        emit('message:send', { ticketId: activeTicketId, content })
      } else {
        await chatApi.enviar(activeTicketId, content)
      }
    } catch (err) {
      console.error('Erro ao enviar:', err)
    }
  }

  // ── Polling fallback ──
  useEffect(() => {
    const interval = setInterval(() => carregarTickets(true), 60000)
    return () => clearInterval(interval)
  }, [carregarTickets])

  const activeTicket = tickets.find((t) => t.id === activeTicketId)
  const ticketsFiltrados = tickets.filter((t) => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return t.titulo.toLowerCase().includes(b) || t.cliente.toLowerCase().includes(b) ||
           (t.deviceHostname?.toLowerCase().includes(b)) || (t.numero?.toString().includes(b))
  })

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -m-6">
      {/* ═══ Sidebar: Lista de tickets ═══ */}
      <div className="w-80 xl:w-96 flex-shrink-0 border-r border-dark-800 flex flex-col bg-dark-950">
        {/* Header sidebar */}
        <div className="p-4 border-b border-dark-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-400" />
              Chat Multi
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setSomAtivo(!somAtivo)} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400" title={somAtivo ? 'Som ativado' : 'Som desativado'}>
                {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                wsConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Buscar ticket, cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
            </div>
          ) : ticketsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-dark-500 text-sm">
              Nenhum ticket ativo
            </div>
          ) : (
            ticketsFiltrados.map((t) => (
              <button
                key={t.id}
                onClick={() => selecionarTicket(t.id)}
                className={`w-full text-left px-4 py-3 border-b border-dark-800/50 hover:bg-dark-900 transition-colors ${
                  activeTicketId === t.id ? 'bg-dark-800/80 border-l-2 border-l-brand-500' : ''
                } ${t.unread > 0 ? 'bg-brand-500/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-sm">{prioridadeEmoji[t.prioridade] || '🟡'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${t.unread > 0 ? 'font-bold text-white' : 'font-medium text-dark-200'}`}>
                        {t.numero ? `#${t.numero} ` : ''}{t.titulo}
                      </p>
                      {t.unread > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">
                          {t.unread > 9 ? '9+' : t.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3 h-3 text-dark-500 flex-shrink-0" />
                      <span className="text-xs text-dark-400 truncate">{t.cliente}</span>
                      {t.deviceHostname && (
                        <>
                          <span className="text-dark-600 text-xs">·</span>
                          <span className="text-xs text-dark-500 truncate">{t.deviceHostname}</span>
                        </>
                      )}
                    </div>
                    {t.lastMessage && (
                      <p className={`text-xs mt-1 truncate ${t.unread > 0 ? 'text-dark-300' : 'text-dark-500'}`}>
                        {t.lastMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[10px] text-dark-500">{tempoRelativo(t.lastMessageAt || t.criadoEm)}</span>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══ Main: Chat area ═══ */}
      <div className="flex-1 flex flex-col bg-dark-950">
        {!activeTicketId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-dark-500">
            <MessageSquare className="w-16 h-16 mb-4 text-dark-700" />
            <p className="text-lg font-medium">Selecione um chamado</p>
            <p className="text-sm mt-1">Escolha um ticket na lista para iniciar o chat</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-dark-800 flex items-center gap-3 bg-dark-900/50">
              <div className="text-lg">{prioridadeEmoji[activeTicket?.prioridade || 'media']}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {activeTicket?.numero ? `#${activeTicket.numero} ` : ''}{activeTicket?.titulo}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-dark-400">{activeTicket?.cliente}</span>
                  {activeTicket?.deviceHostname && (
                    <>
                      <span className="text-xs text-dark-600">·</span>
                      <span className="text-xs text-dark-500">{activeTicket.deviceHostname}</span>
                    </>
                  )}
                  <span className="text-xs text-dark-600">·</span>
                  <StatusBadge status={activeTicket?.status || ''} />
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 text-brand-400 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-dark-500 text-sm">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.remetenteTipo === 'technician' || msg.remetenteId === user?.id
                  const isSystem = msg.remetenteTipo === 'system' || msg.tipo === 'sistema'

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-[11px] text-dark-500 bg-dark-900 px-3 py-1 rounded-full">
                          {msg.conteudo}
                        </span>
                      </div>
                    )
                  }

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        isMine
                          ? 'bg-brand-500/20 text-brand-100 rounded-br-md'
                          : 'bg-dark-800 text-dark-200 rounded-bl-md'
                      }`}>
                        {!isMine && (
                          <p className="text-[10px] font-semibold text-dark-400 mb-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {msg.remetenteNome}
                          </p>
                        )}
                        {msg.arquivoUrl && (
                          <a href={msg.arquivoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline mb-1">
                            <Paperclip className="w-3 h-3" /> {msg.arquivoNome || 'Arquivo'}
                          </a>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
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
                <input
                  type="text"
                  placeholder="Digite sua mensagem..."
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem() } }}
                  className="flex-1 bg-dark-800 border border-dark-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500/50"
                />
                <button
                  onClick={enviarMensagem}
                  disabled={!newMsg.trim()}
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
