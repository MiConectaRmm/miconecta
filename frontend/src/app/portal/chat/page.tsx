'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  MessageSquare, Send, Search, User, Paperclip,
  Plus, RefreshCw, Wifi, WifiOff, Volume2, VolumeX,
} from 'lucide-react'
import { ticketsApi, chatApi, conversationsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'
import StatusBadge from '@/components/ui/StatusBadge'

interface PortalChatItem {
  id: string
  kind: 'conversation' | 'ticket'
  conversationId?: string
  ticketId?: string
  titulo: string
  status: string
  tecnico?: string
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

function tempoRelativo(data: string): string {
  const diffMs = Date.now() - new Date(data).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function normalizeMsg(raw: any): ChatMessage {
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

export default function PortalChatPage() {
  const user = useAuthStore((s) => s.user)
  const [items, setItems] = useState<PortalChatItem[]>([])
  const [active, setActive] = useState<PortalChatItem | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [somAtivo, setSomAtivo] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const joinedRef = useRef<Set<string>>(new Set())

  const { socket, emit, on } = useSocket('/chat')

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

  // ── Carregar conversas + tickets do cliente ──
  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [convsRes, ticketsRes] = await Promise.allSettled([
        conversationsApi.listar({ status: 'open' }),
        ticketsApi.listar(),
      ])

      const result: PortalChatItem[] = []
      const convTicketIds = new Set<string>()

      // Conversations
      if (convsRes.status === 'fulfilled') {
        const convs = Array.isArray(convsRes.value.data) ? convsRes.value.data : convsRes.value.data?.items || []
        convs.forEach((c: any) => {
          result.push({
            id: `conv-${c.id}`,
            kind: 'conversation',
            conversationId: c.id,
            titulo: c.titulo || 'Conversa com suporte',
            status: c.status,
            criadoEm: c.criadoEm,
            unread: 0,
            lastMessage: c.lastMessagePreview,
            lastMessageAt: c.lastMessageAt || c.criadoEm,
          })
        })
      }

      // Tickets
      if (ticketsRes.status === 'fulfilled') {
        const tickets = Array.isArray(ticketsRes.value.data) ? ticketsRes.value.data : ticketsRes.value.data?.items || []
        tickets
          .filter((t: any) => t.status !== 'fechado' && t.status !== 'cancelado')
          .forEach((t: any) => {
            if (t.conversationId) {
              convTicketIds.add(t.conversationId)
              const existing = result.find((i) => i.conversationId === t.conversationId)
              if (existing) {
                existing.ticketId = t.id
                existing.titulo = t.titulo || existing.titulo
                existing.status = t.status
                existing.tecnico = t.tecnicoAtribuido?.nome
              }
              return
            }
            result.push({
              id: `ticket-${t.id}`,
              kind: 'ticket',
              ticketId: t.id,
              titulo: t.titulo || 'Sem título',
              status: t.status,
              tecnico: t.tecnicoAtribuido?.nome,
              criadoEm: t.criadoEm || t.createdAt,
              unread: 0,
              lastMessageAt: t.atualizadoEm || t.criadoEm,
            })
          })
      }

      result.sort((a, b) => {
        if (a.unread > 0 && b.unread === 0) return -1
        if (a.unread === 0 && b.unread > 0) return 1
        return new Date(b.lastMessageAt || b.criadoEm).getTime() - new Date(a.lastMessageAt || a.criadoEm).getTime()
      })

      setItems(result)
    } catch (err) {
      console.error('Erro ao carregar:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── WS connect ──
  useEffect(() => {
    if (!socket) return
    const handleConnect = () => setWsConnected(true)
    const handleDisconnect = () => setWsConnected(false)
    if (socket.connected) setWsConnected(true)
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => { socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect) }
  }, [socket])

  // ── WS: mensagens ──
  useEffect(() => {
    if (!socket) return

    const offConvMsg = on('conversation:message:new', (raw: any) => {
      const msg = normalizeMsg(raw)
      const convId = raw.conversationId
      if (active?.conversationId === convId) {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      }
      setItems((prev) => prev.map((i) => {
        if (i.conversationId !== convId) return i
        return { ...i, unread: active?.conversationId === convId ? i.unread : i.unread + 1, lastMessage: msg.content, lastMessageAt: msg.criadoEm }
      }))
      if (msg.senderId !== user?.id && active?.conversationId !== convId) playSound()
    })

    const offTicketMsg = on('message:new', (raw: any) => {
      const msg = normalizeMsg(raw)
      const ticketId = raw.ticketId
      if (active?.ticketId === ticketId && active?.kind === 'ticket') {
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
      }
      setItems((prev) => prev.map((i) => {
        if (i.ticketId !== ticketId) return i
        return { ...i, unread: active?.ticketId === ticketId ? i.unread : i.unread + 1, lastMessage: msg.content, lastMessageAt: msg.criadoEm }
      }))
      if (msg.senderId !== user?.id && active?.ticketId !== ticketId) playSound()
    })

    return () => { offConvMsg(); offTicketMsg() }
  }, [socket, on, active, user?.id, playSound])

  // ── Join rooms ──
  useEffect(() => {
    if (!socket?.connected) return
    items.forEach((i) => {
      if (i.conversationId && !joinedRef.current.has(`conv-${i.conversationId}`)) {
        emit('conversation:join', { conversationId: i.conversationId })
        joinedRef.current.add(`conv-${i.conversationId}`)
      }
      if (i.kind === 'ticket' && i.ticketId && !joinedRef.current.has(`ticket-${i.ticketId}`)) {
        emit('ticket:join', { ticketId: i.ticketId })
        joinedRef.current.add(`ticket-${i.ticketId}`)
      }
    })
  }, [items, socket, emit])

  // ── Selecionar ──
  const selecionar = async (item: PortalChatItem) => {
    setActive(item)
    setLoadingMsgs(true)
    setMessages([])
    try {
      if (item.conversationId) {
        const res = await conversationsApi.mensagens(item.conversationId, 100)
        setMessages((Array.isArray(res.data) ? res.data : res.data?.items || []).map(normalizeMsg))
        await conversationsApi.marcarLida(item.conversationId).catch(() => {})
      } else if (item.ticketId) {
        const res = await chatApi.mensagens(item.ticketId, 100)
        setMessages((Array.isArray(res.data) ? res.data : res.data?.items || []).map(normalizeMsg))
        await chatApi.marcarTodasLidas(item.ticketId).catch(() => {})
      }
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, unread: 0 } : i))
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setLoadingMsgs(false)
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Enviar ──
  const enviar = async () => {
    if (!newMsg.trim() || !active) return
    const content = newMsg.trim()
    setNewMsg('')
    try {
      if (active.conversationId && socket?.connected) {
        emit('conversation:message', { conversationId: active.conversationId, content })
      } else if (active.conversationId) {
        await conversationsApi.enviarMensagem(active.conversationId, { content })
      } else if (active.ticketId && socket?.connected) {
        emit('message:send', { ticketId: active.ticketId, content })
      } else if (active.ticketId) {
        await chatApi.enviar(active.ticketId, content)
      }
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  // ── Nova conversa (sem ticket) ──
  const novaConversa = async () => {
    try {
      const res = await conversationsApi.criar({ titulo: 'Falar com suporte' })
      await carregar(true)
      const c = res.data
      if (c?.id) {
        selecionar({
          id: `conv-${c.id}`, kind: 'conversation', conversationId: c.id,
          titulo: c.titulo || 'Falar com suporte', status: 'open',
          criadoEm: new Date().toISOString(), unread: 0,
        })
      }
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  // ── Polling ──
  useEffect(() => {
    const iv = setInterval(() => carregar(true), 60000)
    return () => clearInterval(iv)
  }, [carregar])

  const filtered = items.filter((i) => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return i.titulo.toLowerCase().includes(b) || i.tecnico?.toLowerCase().includes(b)
  })

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden -m-6">
      {/* ═══ Sidebar ═══ */}
      <div className="w-72 xl:w-80 flex-shrink-0 border-r border-dark-800 flex flex-col bg-dark-950">
        <div className="p-4 border-b border-dark-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-brand-400" /> Chat
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={novaConversa} className="p-1.5 rounded-lg hover:bg-dark-800 text-brand-400" title="Nova conversa">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setSomAtivo(!somAtivo)} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400">
                {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${wsConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              </span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input type="text" placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500/50"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-brand-400 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-10 h-10 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-500 text-sm">Nenhuma conversa</p>
              <button onClick={novaConversa} className="mt-3 text-brand-400 text-sm font-medium hover:underline">Iniciar conversa</button>
            </div>
          ) : (
            filtered.map((item) => (
              <button key={item.id} onClick={() => selecionar(item)}
                className={`w-full text-left px-4 py-3 border-b border-dark-800/50 hover:bg-dark-900 transition-colors ${
                  active?.id === item.id ? 'bg-dark-800/80 border-l-2 border-l-brand-500' : ''
                } ${item.unread > 0 ? 'bg-brand-500/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageSquare className="w-4 h-4 text-brand-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${item.unread > 0 ? 'font-bold text-white' : 'font-medium text-dark-200'}`}>{item.titulo}</p>
                      {item.unread > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center">{item.unread > 9 ? '9+' : item.unread}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.tecnico && <span className="text-xs text-dark-400 truncate">{item.tecnico}</span>}
                      {item.ticketId && <StatusBadge status={item.status} />}
                      {!item.ticketId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400">Chat</span>}
                    </div>
                    {item.lastMessage && (
                      <p className={`text-xs mt-1 truncate ${item.unread > 0 ? 'text-dark-300' : 'text-dark-500'}`}>{item.lastMessage}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-dark-500 flex-shrink-0">{tempoRelativo(item.lastMessageAt || item.criadoEm)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ═══ Chat area ═══ */}
      <div className="flex-1 flex flex-col bg-dark-950">
        {!active ? (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-500">
            <MessageSquare className="w-16 h-16 mb-4 text-dark-700" />
            <p className="text-lg font-medium">Chat com Suporte</p>
            <p className="text-sm mt-1">Selecione uma conversa ou inicie uma nova</p>
            <button onClick={novaConversa} className="mt-4 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors">
              <Plus className="w-4 h-4 inline mr-1.5" /> Nova Conversa
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-dark-800 bg-dark-900/50">
              <p className="text-sm font-bold text-white truncate">{active.titulo}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {active.tecnico && <span className="text-xs text-dark-400">Técnico: {active.tecnico}</span>}
                {active.ticketId ? <StatusBadge status={active.status} /> : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-medium">Chat aberto</span>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center py-20"><RefreshCw className="w-6 h-6 text-brand-400 animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-dark-500 text-sm">Nenhuma mensagem ainda. Envie a primeira!</div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderType === 'client_user' || msg.senderId === user?.id
                  const isSystem = msg.senderType === 'system' || msg.type === 'system' || msg.type === 'sistema'
                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-[11px] text-dark-500 bg-dark-900 px-3 py-1 rounded-full">{msg.content}</span>
                      </div>
                    )
                  }
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine ? 'bg-brand-500/20 text-brand-100 rounded-br-md' : 'bg-dark-800 text-dark-200 rounded-bl-md'}`}>
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  className="flex-1 bg-dark-800 border border-dark-700 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500/50"
                />
                <button onClick={enviar} disabled={!newMsg.trim()}
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
