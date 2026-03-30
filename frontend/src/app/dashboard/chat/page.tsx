'use client'

import { useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react'
import {
  MessageSquare, Send, Search, User, Paperclip,
  Volume2, VolumeX, RefreshCw, CheckCircle2, MonitorPlay,
  Plus, MessagesSquare, Wifi, WifiOff, Pencil, Palette,
  Bell, X,
} from 'lucide-react'
import { ticketsApi, chatApi, conversationsApi, devicesApi, parseTicketMessagesPage } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'
import { useChatNotificationsStore } from '@/stores/chat-notifications.store'
import {
  INBOX_PALETTE,
  empresaLabel,
  getContactDisplayName,
  getContactAliasForItem,
  setContactAliasForItem,
  resolveInboxColor,
  setInboxColorAuto,
  setInboxColorPalette,
  setInboxColorHex,
  mergeInboxByContact,
  type ClientColor,
} from '@/lib/inbox-utils'
import {
  handleRemoteConnectRequestNotification,
  isRemoteConnectRequestPayload,
  type RemoteConnectToastType,
} from '@/lib/remote-connect-ws'

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
  /** Várias threads do mesmo contacto fundidas numa linha (lista estilo WhatsApp). */
  mergedThreads?: InboxItem[]
}

interface ChatRemoteToast {
  id: string
  message: string
  variant: 'info' | 'ticket'
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
  /** sent | delivered | read */
  deliveryStatus?: string
  read?: boolean
}

const TICKET_MSG_PAGE = 40

function messageTicksClass(ds?: string) {
  const s = (ds || 'sent').toLowerCase()
  if (s === 'read') return 'text-sky-200'
  if (s === 'delivered') return 'text-emerald-100'
  return 'text-white/70'
}

function MessageDeliveryTicks({ status }: { status?: string }) {
  const s = (status || 'sent').toLowerCase()
  if (s === 'read') return <span className={messageTicksClass(status)} aria-label="Lida">✓✓</span>
  if (s === 'delivered') return <span className={messageTicksClass(status)} aria-label="Entregue">✓✓</span>
  return <span className={messageTicksClass(status)} aria-label="Enviada">✓</span>
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
  const st = raw.senderType || raw.remetenteTipo || ''
  const ds =
    raw.deliveryStatus ||
    (String(raw.status || '').toUpperCase() === 'READ' || raw.read || raw.lido
      ? 'read'
      : String(raw.status || '').toUpperCase() === 'DELIVERED'
        ? 'delivered'
        : 'sent')
  return {
    id: raw.id,
    content: raw.content || raw.conteudo || '',
    senderType: st,
    senderName: raw.senderName || raw.remetenteNome || '',
    senderId: raw.senderId || raw.senderUserId || raw.remetenteId,
    type: raw.type || raw.tipo,
    criadoEm: raw.criadoEm || raw.createdAt,
    arquivoUrl: raw.arquivoUrl,
    arquivoNome: raw.arquivoNome,
    deliveryStatus: typeof ds === 'string' ? ds.toLowerCase() : 'sent',
    read: Boolean(raw.read ?? raw.lido),
  }
}

function colorKeyForItem(item: InboxItem): string {
  if (item.mergedThreads?.length) {
    const d = item.mergedThreads.find((t) => t.deviceId)
    return (
      d?.deviceId ||
      item.mergedThreads[0].organizationId ||
      item.mergedThreads[0].ticketId ||
      item.mergedThreads[0].conversationId ||
      item.id
    )
  }
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

function isMineMessage(msg: ChatMessage, userId?: string): boolean {
  if (msg.senderType === 'system' || msg.type === 'sistema' || msg.type === 'SYSTEM') return false
  return (
    msg.senderType === 'technician' ||
    msg.senderType === 'TECH' ||
    msg.senderType === 'TECHNICIAN' ||
    msg.senderId === userId
  )
}

function senderGroupKey(msg: ChatMessage, userId?: string): string {
  if (msg.senderType === 'system' || msg.type === 'sistema' || msg.type === 'SYSTEM') return '__system__'
  const mine = isMineMessage(msg, userId)
  return `${mine ? 'M' : 'C'}|${msg.senderId || msg.senderName}|${msg.senderType}`
}

function buildMessageGroups(messages: ChatMessage[], userId?: string): MessageGroup[] {
  const groups: MessageGroup[] = []
  for (const msg of messages) {
    if (msg.senderType === 'system' || msg.type === 'sistema' || msg.type === 'SYSTEM') {
      groups.push({ kind: 'system', items: [msg] })
      continue
    }
    const key = senderGroupKey(msg, userId)
    const isMine = isMineMessage(msg, userId)
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

/** Junta blocos consecutivos do mesmo lado (você / cliente) se estiverem próximos no tempo — estilo WhatsApp. */
function mergeAdjacentSameSideByTime(groups: MessageGroup[], maxGapMs: number): MessageGroup[] {
  const out: MessageGroup[] = []
  for (const g of groups) {
    if (g.kind === 'system') {
      out.push(g)
      continue
    }
    const prev = out[out.length - 1]
    if (prev?.kind === 'user' && prev.isMine === g.isMine) {
      const prevLast = prev.items[prev.items.length - 1]
      const curFirst = g.items[0]
      const gap =
        new Date(curFirst.criadoEm).getTime() - new Date(prevLast.criadoEm).getTime()
      if (gap >= 0 && gap <= maxGapMs) {
        prev.items.push(...g.items)
        continue
      }
    }
    out.push({ ...g, items: [...g.items] })
  }
  return out
}

function buildMessageGroupsWhatsApp(messages: ChatMessage[], userId?: string): MessageGroup[] {
  const base = buildMessageGroups(messages, userId)
  return mergeAdjacentSameSideByTime(base, 8 * 60 * 1000)
}

function primaryThreadForSend(item: InboxItem): InboxItem {
  const threads = item.mergedThreads?.length ? item.mergedThreads : [item]
  const openTicket = threads.find((t) => {
    if (!t.ticketId) return false
    if (!t.status) return true
    return !['resolvido', 'fechado', 'cancelado'].includes(t.status)
  })
  if (openTicket) return openTicket
  const withConv = threads.find((t) => t.conversationId)
  return withConv || threads[0]
}

function groupMatchesTab(item: InboxItem, t: 'all' | 'conversations' | 'tickets'): boolean {
  const threads = item.mergedThreads?.length ? item.mergedThreads : [item]
  if (t === 'all') return true
  if (t === 'conversations') return threads.some((x) => x.kind === 'conversation')
  return threads.some((x) => Boolean(x.ticketId) || x.kind === 'ticket')
}

function groupMatchesBusca(item: InboxItem, b: string): boolean {
  const threads = item.mergedThreads?.length ? item.mergedThreads : [item]
  return threads.some(
    (i) =>
      i.titulo.toLowerCase().includes(b) ||
      i.cliente.toLowerCase().includes(b) ||
      (i.empresaNome || '').toLowerCase().includes(b) ||
      (i.deviceHostname || '').toLowerCase().includes(b) ||
      (i.ticketNumero?.toString().includes(b) ?? false),
  )
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
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set())
  const [typingByTicket, setTypingByTicket] = useState<Record<string, string | null>>({})
  const [peerPortalUserId, setPeerPortalUserId] = useState<string | null>(null)
  const [chatRemoteToasts, setChatRemoteToasts] = useState<ChatRemoteToast[]>([])
  const [remoteConnecting, setRemoteConnecting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const joinedRoomsRef = useRef<Set<string>>(new Set())
  const ticketMsgCursorsRef = useRef<Record<string, { next: { createdAt: string; id: string } | null; hasMore: boolean }>>({})
  const loadingOlderRef = useRef(false)
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const remoteAwaitRef = useRef<{ ticketId: string; timeoutId: ReturnType<typeof setTimeout> } | null>(null)
  const lastRemoteConnectToastRef = useRef<{ key: string; at: number } | null>(null)

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

  const addChatRemoteToast = useCallback((message: string, type: RemoteConnectToastType) => {
    const id = `${Date.now()}-${Math.random()}`
    const variant: ChatRemoteToast['variant'] = type === 'ticket' ? 'ticket' : 'info'
    setChatRemoteToasts((prev) => [{ id, message, variant }, ...prev].slice(0, 5))
    setTimeout(() => {
      setChatRemoteToasts((prev) => prev.filter((x) => x.id !== id))
    }, 8000)
  }, [])

  const removeChatRemoteToast = useCallback((id: string) => {
    setChatRemoteToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const clearRemoteConnectFallback = useCallback(() => {
    const r = remoteAwaitRef.current
    if (r) {
      clearTimeout(r.timeoutId)
      remoteAwaitRef.current = null
    }
  }, [])

  useEffect(() => () => clearRemoteConnectFallback(), [clearRemoteConnectFallback])

  const showRemoteConnectFeedback = useCallback(
    (ticketId: string, agentOnline: boolean) => {
      const key = `${ticketId}-${agentOnline}`
      const now = Date.now()
      const prev = lastRemoteConnectToastRef.current
      if (prev && prev.key === key && now - prev.at < 2500) return
      lastRemoteConnectToastRef.current = { key, at: now }
      handleRemoteConnectRequestNotification(
        { type: 'remote_connect_request', ticketId, agentOnline },
        { addToast: addChatRemoteToast, playSound: somAtivo ? playSound : undefined },
      )
    },
    [addChatRemoteToast, somAtivo, playSound],
  )

  useEffect(() => {
    if (!socket) return
    const off = on('atendimento:update', (data: unknown) => {
      if (!isRemoteConnectRequestPayload(data)) return
      const tid = data.ticketId
      if (!tid) return
      if (remoteAwaitRef.current?.ticketId === tid) {
        clearTimeout(remoteAwaitRef.current.timeoutId)
        remoteAwaitRef.current = null
      }
      showRemoteConnectFeedback(tid, data.agentOnline === true)
    })
    return () => off()
  }, [socket, on, showRemoteConnectFeedback])

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

      const ticketIdsForUnread = new Set<string>()
      inboxItems.forEach((i) => {
        const th = i.mergedThreads?.length ? i.mergedThreads : [i]
        th.forEach((x) => {
          if (x.ticketId) ticketIdsForUnread.add(x.ticketId)
        })
      })
      const unreadList = Array.from(ticketIdsForUnread).slice(0, 200)
      let unreadMap: Record<string, number> = {}
      if (unreadList.length) {
        try {
          const res = await chatApi.unreadSummary(unreadList)
          unreadMap = (res.data?.counts as Record<string, number>) || {}
        } catch {
          /* ignore */
        }
      }
      const applyUnread = (it: InboxItem) => {
        if (it.ticketId && unreadMap[it.ticketId] !== undefined) {
          it.unread = unreadMap[it.ticketId]
        }
      }
      inboxItems.forEach((i) => {
        applyUnread(i)
        i.mergedThreads?.forEach(applyUnread)
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
    setAliasDraft(getContactAliasForItem(activeItem))
    setNomeEditando(false)
    setCoresAbertas(false)
  }, [activeItem?.id, activeItem?.deviceId, activeItem?.mergedThreads?.length])

  useEffect(() => {
    if (!socket) return
    const handleConnect = () => {
      setWsConnected(true)
      emit('atendimento:join', {})
      socket.emit('presence:list', {}, (res: unknown) => {
        const r = res as { onlineUserIds?: string[] }
        if (Array.isArray(r?.onlineUserIds)) {
          setOnlineUserIds(new Set(r.onlineUserIds))
        }
      })
    }
    const handleDisconnect = () => setWsConnected(false)
    if (socket.connected) {
      setWsConnected(true)
      emit('atendimento:join', {})
      socket.emit('presence:list', {}, (res: unknown) => {
        const r = res as { onlineUserIds?: string[] }
        if (Array.isArray(r?.onlineUserIds)) {
          setOnlineUserIds(new Set(r.onlineUserIds))
        }
      })
    }
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    return () => { socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect) }
  }, [socket, emit])

  useEffect(() => {
    if (!socket) return

    const activeThreads = activeItem?.mergedThreads?.length
      ? activeItem.mergedThreads
      : activeItem
        ? [activeItem]
        : []
    const convActive = (id: string) => activeThreads.some((t) => t.conversationId === id)
    const ticketActive = (id: string) => activeThreads.some((t) => t.ticketId === id)

    const offConvMsg = on('conversation:message:new', (raw: any) => {
      const msg = normalizeMessage(raw)
      const convId = raw.conversationId
      if (convActive(convId)) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      }
      setItems((prev) => prev.map((i) => {
        if (i.conversationId !== convId) return i
        const isActive = convActive(convId)
        return { ...i, unread: isActive ? i.unread : i.unread + 1, lastMessage: msg.content, lastMessageAt: msg.criadoEm }
      }))
      if (msg.senderId !== user?.id && !convActive(convId)) {
        playSound()
        incrementUnread(`conv-${convId}`)
      }
    })

    const offTicketMsg = on('message:new', (raw: any) => {
      const msg = normalizeMessage(raw)
      const ticketId = raw.ticketId
      if (ticketActive(ticketId)) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      }
      setItems((prev) => prev.map((i) => {
        if (i.ticketId !== ticketId) return i
        const isActive = ticketActive(ticketId)
        return { ...i, unread: isActive ? i.unread : i.unread + 1, lastMessage: msg.content, lastMessageAt: msg.criadoEm }
      }))
      if (msg.senderId !== user?.id && !ticketActive(ticketId)) {
        playSound()
        incrementUnread(`ticket-${ticketId}`)
      }
    })

    const offConvNew = on('conversation:new', () => { carregarInbox(true); playSound() })

    const offMsgStatus = on('message:status', (raw: any) => {
      const ticketId = raw?.ticketId
      const messageIds: string[] = Array.isArray(raw?.messageIds) ? raw.messageIds : []
      const deliveryStatus = raw?.deliveryStatus ? String(raw.deliveryStatus).toLowerCase() : ''
      if (!ticketId || !messageIds.length || !deliveryStatus) return
      if (!ticketActive(ticketId)) return
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m.id) ? { ...m, deliveryStatus } : m)),
      )
    })

    const offInboxTouch = on('tickets:inbox_touch', (raw: any) => {
      const ticketId = raw?.ticketId
      if (!ticketId) return
      const preview = String(raw?.lastMessage ?? '')
      const at = raw?.lastMessageAt || new Date().toISOString()
      setItems((prev) =>
        prev.map((i) => {
          const th = i.mergedThreads?.length ? i.mergedThreads : [i]
          const hit = th.some((x) => x.ticketId === ticketId)
          if (!hit) return i
          return {
            ...i,
            lastMessage: preview || i.lastMessage,
            lastMessageAt: at,
            unread: ticketActive(ticketId) ? i.unread : i.unread + 1,
          }
        }),
      )
    })

    const offTicketUpd = on('atendimento:ticket_updated', (raw: any) => {
      const ticketId = raw?.ticketId
      if (!ticketId) return
      setItems((prev) =>
        prev.map((i) =>
          i.ticketId === ticketId
            ? { ...i, status: raw?.status ?? i.status, prioridade: raw?.prioridade ?? i.prioridade }
            : i,
        ),
      )
    })

    const offTicketRead = on('ticket:read', (raw: any) => {
      const ticketId = raw?.ticketId
      const readerId = raw?.userId
      if (!ticketId || !ticketActive(ticketId) || readerId === user?.id) return
      setMessages((prev) =>
        prev.map((m) =>
          isMineMessage(m, user?.id) ? { ...m, deliveryStatus: 'read', read: true } : m,
        ),
      )
    })

    const offTyping = on('typing', (raw: any) => {
      const ticketId = raw?.ticketId
      if (!ticketId || raw?.userId === user?.id) return
      if (!raw?.isTyping) {
        setTypingByTicket((prev) => {
          const next = { ...prev }
          delete next[ticketId]
          return next
        })
        return
      }
      setTypingByTicket((prev) => ({ ...prev, [ticketId]: String(raw?.nome || 'Alguém') }))
    })

    return () => {
      offConvMsg()
      offTicketMsg()
      offConvNew()
      offMsgStatus()
      offInboxTouch()
      offTicketUpd()
      offTicketRead()
      offTyping()
    }
  }, [socket, on, activeItem, user?.id, playSound, carregarInbox, incrementUnread])

  useEffect(() => {
    if (!socket) return
    const onOn = (p: { userId?: string }) => {
      if (!p?.userId) return
      setOnlineUserIds((s) => new Set(s).add(p.userId!))
    }
    const onOff = (p: { userId?: string }) => {
      if (!p?.userId) return
      setOnlineUserIds((s) => {
        const n = new Set(s)
        n.delete(p.userId!)
        return n
      })
    }
    socket.on('presence:online', onOn)
    socket.on('presence:offline', onOff)
    return () => {
      socket.off('presence:online', onOn)
      socket.off('presence:offline', onOff)
    }
  }, [socket])

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

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlderRef.current || !activeItem) return
    const threads = activeItem.mergedThreads?.length ? activeItem.mergedThreads : [activeItem]
    const ticketThreads = threads.filter((t) => t.ticketId)
    if (!ticketThreads.length) return
    const anyMore = ticketThreads.some((t) => ticketMsgCursorsRef.current[t.ticketId!]?.hasMore)
    if (!anyMore) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    const el = messagesScrollRef.current
    const prevH = el?.scrollHeight ?? 0
    try {
      const prepend: ChatMessage[] = []
      for (const t of ticketThreads) {
        const tid = t.ticketId!
        const cur = ticketMsgCursorsRef.current[tid]
        if (!cur?.hasMore || !cur.next) continue
        const res = await chatApi.mensagens(tid, TICKET_MSG_PAGE, cur.next)
        const page = parseTicketMessagesPage(res.data)
        ticketMsgCursorsRef.current[tid] = {
          next: page.nextOlderCursor,
          hasMore: page.hasMoreOlder,
        }
        for (const raw of page.items) {
          prepend.push(normalizeMessage(raw as any))
        }
      }
      if (prepend.length) {
        setMessages((prev) => {
          const byId = new Map<string, ChatMessage>()
          for (const m of [...prepend, ...prev]) byId.set(m.id, m)
          return Array.from(byId.values()).sort(
            (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime(),
          )
        })
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevH
        })
      }
    } catch {
      /* ignore */
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [activeItem])

  const onMessagesScroll = useCallback(() => {
    const el = messagesScrollRef.current
    if (!el || loadingOlderRef.current) return
    if (el.scrollTop <= 56) {
      void loadOlderMessages()
    }
  }, [loadOlderMessages])

  const selecionarItem = async (item: InboxItem) => {
    setActiveItem(item)
    setLoadingMessages(true)
    setMessages([])
    ticketMsgCursorsRef.current = {}
    setPeerPortalUserId(null)
    const threads = item.mergedThreads?.length ? item.mergedThreads : [item]
    try {
      if (threads.length === 1 && threads[0].ticketId) {
        try {
          const tr = await ticketsApi.buscar(threads[0].ticketId)
          const c = tr.data
          if (c?.criadoPorTipo === 'client_user' && c?.criadoPorId) {
            setPeerPortalUserId(String(c.criadoPorId))
          }
        } catch {
          /* ignore */
        }
      }
      const seen = new Set<string>()
      const allMsgs: ChatMessage[] = []
      for (const t of threads) {
        if (t.conversationId) {
          const res = await conversationsApi.mensagens(t.conversationId, 150)
          const msgs = (Array.isArray(res.data) ? res.data : res.data?.items || []).map(normalizeMessage)
          for (const m of msgs) {
            if (!seen.has(m.id)) {
              seen.add(m.id)
              allMsgs.push(m)
            }
          }
          await conversationsApi.marcarLida(t.conversationId).catch(() => {})
        }
        if (t.ticketId) {
          const res = await chatApi.mensagens(t.ticketId, TICKET_MSG_PAGE)
          const page = parseTicketMessagesPage(res.data)
          ticketMsgCursorsRef.current[t.ticketId] = {
            next: page.nextOlderCursor,
            hasMore: page.hasMoreOlder,
          }
          const msgs = page.items.map((raw) => normalizeMessage(raw as any))
          for (const m of msgs) {
            if (!seen.has(m.id)) {
              seen.add(m.id)
              allMsgs.push(m)
            }
          }
          await chatApi.marcarTodasLidas(t.ticketId).catch(() => {})
        }
      }
      allMsgs.sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())
      setMessages(allMsgs)

      const flatIds = new Set(threads.map((x) => x.id))
      setItems((prev) => prev.map((i) => (flatIds.has(i.id) ? { ...i, unread: 0 } : i)))

      const probe = threads.find((x) => x.deviceId && !x.rustdeskId) || threads[0]
      if (probe?.deviceId && !probe.rustdeskId) {
        try {
          const dres = await devicesApi.buscar(probe.deviceId)
          const d = dres.data
          const rd = d?.rustdeskId
          const hn = d?.hostname
          if (rd || hn) {
            setActiveItem((cur) => {
              if (!cur || cur.id !== item.id) return cur
              const patch = { rustdeskId: rd || cur.rustdeskId, deviceHostname: hn || cur.deviceHostname }
              if (!cur.mergedThreads?.length) return { ...cur, ...patch }
              return {
                ...cur,
                ...patch,
                mergedThreads: cur.mergedThreads.map((x) =>
                  x.deviceId === probe.deviceId ? { ...x, ...patch } : x,
                ),
              }
            })
            setItems((prev) =>
              prev.map((i) =>
                i.deviceId === probe.deviceId
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

  useEffect(() => {
    if (loadingOlder) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loadingOlder])

  useEffect(() => {
    if (!activeItem || !socket?.connected) return
    const target = primaryThreadForSend(activeItem)
    if (!target.ticketId) return
    const tid = target.ticketId
    if (!newMsg.trim()) return
    emit('chat:typing', {
      ticketId: tid,
      userId: user?.id,
      nome: user?.nome,
      isTyping: true,
    })
    if (typingStopRef.current) clearTimeout(typingStopRef.current)
    typingStopRef.current = setTimeout(() => {
      emit('chat:typing', {
        ticketId: tid,
        userId: user?.id,
        nome: user?.nome,
        isTyping: false,
      })
    }, 1500)
    return () => {
      if (typingStopRef.current) clearTimeout(typingStopRef.current)
      emit('chat:typing', {
        ticketId: tid,
        userId: user?.id,
        nome: user?.nome,
        isTyping: false,
      })
    }
  }, [newMsg, activeItem, socket, emit, user?.id, user?.nome])

  const enviarMensagem = async () => {
    if (!newMsg.trim() || !activeItem) return
    const target = primaryThreadForSend(activeItem)
    const content = newMsg.trim()
    setNewMsg('')
    try {
      if (target.conversationId && socket?.connected) {
        emit('conversation:message', { conversationId: target.conversationId, content })
      } else if (target.conversationId) {
        await conversationsApi.enviarMensagem(target.conversationId, { content })
      } else if (target.ticketId && socket?.connected) {
        emit('message:send', { ticketId: target.ticketId, content })
      } else if (target.ticketId) {
        await chatApi.enviar(target.ticketId, content)
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

  const conectarRemoto = async () => {
    const threads = activeItem?.mergedThreads?.length ? activeItem.mergedThreads : activeItem ? [activeItem] : []
    const ticketThread = threads.find((t) => t.ticketId && (t.rustdeskId || t.deviceId))
    const rustdeskFallback =
      activeItem?.mergedThreads?.find((t) => t.rustdeskId)?.rustdeskId || activeItem?.rustdeskId

    try {
      if (ticketThread?.ticketId) {
        clearRemoteConnectFallback()
        setRemoteConnecting(true)
        try {
          const { data } = await ticketsApi.solicitarRemoteSession(ticketThread.ticketId)
          const rd =
            (data as { rustdeskId?: string | null }).rustdeskId || ticketThread.rustdeskId || rustdeskFallback
          const agentOnline = Boolean((data as { agentOnline?: boolean }).agentOnline)
          const tid = ticketThread.ticketId
          remoteAwaitRef.current = {
            ticketId: tid,
            timeoutId: setTimeout(() => {
              const cur = remoteAwaitRef.current
              if (!cur || cur.ticketId !== tid) return
              remoteAwaitRef.current = null
              showRemoteConnectFeedback(tid, agentOnline)
            }, 4000),
          }
          if (rd) window.open(`rustdesk://connection/new/${rd}`, '_blank')
          else alert('RustDesk não configurado neste dispositivo.')
        } finally {
          setRemoteConnecting(false)
        }
        return
      }
      if (rustdeskFallback) window.open(`rustdesk://connection/new/${rustdeskFallback}`, '_blank')
    } catch (err) {
      console.error(err)
      clearRemoteConnectFallback()
      setRemoteConnecting(false)
      alert('Não foi possível preparar a sessão remota.')
    }
  }

  const salvarNomeContato = () => {
    if (!activeItem) return
    setContactAliasForItem(activeItem, aliasDraft)
    setAliasBump((n) => n + 1)
    setNomeEditando(false)
  }

  const encerrarAtendimento = async () => {
    if (!activeItem) return
    if (!window.confirm('Encerrar atendimento? O ticket será resolvido e a conversa fechada, se existirem.')) return
    const threads = activeItem.mergedThreads?.length ? activeItem.mergedThreads : [activeItem]
    try {
      for (const t of threads) {
        if (t.ticketId && t.status && !['resolvido', 'fechado', 'cancelado'].includes(t.status)) {
          await ticketsApi.resolver(t.ticketId)
        }
        if (t.conversationId) {
          await conversationsApi.fechar(t.conversationId).catch(() => {})
        }
      }
      await carregarInbox(true)
      setActiveItem(null)
    } catch {
      alert('Não foi possível encerrar. Tente novamente.')
    }
  }

  const threadsAtivos = activeItem
    ? activeItem.mergedThreads?.length
      ? activeItem.mergedThreads
      : [activeItem]
    : []
  const mostrarEncerrar = threadsAtivos.some((t) => Boolean(t.ticketId || t.conversationId))
  const rustdeskAtivo =
    activeItem?.mergedThreads?.find((t) => t.rustdeskId)?.rustdeskId || activeItem?.rustdeskId
  const mostrarConectar = Boolean(rustdeskAtivo)

  const primaryTicketForUi = activeItem ? primaryThreadForSend(activeItem).ticketId : null
  const typingNome = primaryTicketForUi ? typingByTicket[primaryTicketForUi] : null
  const peerOnline = Boolean(peerPortalUserId && onlineUserIds.has(peerPortalUserId))

  useEffect(() => {
    const interval = setInterval(() => carregarInbox(true), 120000)
    return () => clearInterval(interval)
  }, [carregarInbox])

  const displayItems = useMemo(() => mergeInboxByContact(items) as InboxItem[], [items])

  useEffect(() => {
    if (!activeItem?.id) return
    const next = displayItems.find((d) => d.id === activeItem.id)
    if (!next) return
    if (
      next.lastMessageAt !== activeItem.lastMessageAt ||
      next.unread !== activeItem.unread ||
      next.lastMessage !== activeItem.lastMessage ||
      (next.mergedThreads?.length || 0) !== (activeItem.mergedThreads?.length || 0)
    ) {
      setActiveItem(next)
    }
  }, [displayItems, activeItem?.id])

  const filteredItems = displayItems.filter((i) => {
    if (!groupMatchesTab(i, tab)) return false
    if (!busca) return true
    return groupMatchesBusca(i, busca.toLowerCase())
  })

  return (
    <div className="relative flex h-[calc(100vh-120px)] overflow-hidden -mx-6">
      {chatRemoteToasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
          {chatRemoteToasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in-right ${
                t.variant === 'ticket'
                  ? 'bg-sky-50 border-sky-200 text-sky-900'
                  : 'bg-white border-gray-200 text-gray-800'
              }`}
            >
              {t.variant === 'ticket' ? (
                <MonitorPlay className="w-4 h-4 flex-shrink-0 text-sky-600" />
              ) : (
                <Bell className="w-4 h-4 flex-shrink-0 text-gray-500" />
              )}
              <span className="text-sm flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => removeChatRemoteToast(t.id)}
                className="text-gray-400 hover:text-gray-700 p-0.5"
                aria-label="Fechar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
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
                          {item.mergedThreads && item.mergedThreads.length > 1 ? (
                            <span className="ml-1 text-[10px] font-normal text-gray-400 whitespace-nowrap">
                              ({item.mergedThreads.length} chats)
                            </span>
                          ) : null}
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
                          setAliasDraft(getContactAliasForItem(activeItem))
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
                  {(typingNome || peerPortalUserId) && (
                    <p className="text-xs mt-0.5 min-h-[1rem]">
                      {typingNome ? (
                        <span className="text-brand-600 font-medium">{typingNome} está digitando…</span>
                      ) : peerOnline ? (
                        <span className="text-green-600 inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden /> online
                        </span>
                      ) : (
                        <span className="text-gray-400 inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" aria-hidden /> offline
                        </span>
                      )}
                    </p>
                  )}
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
                        onClick={() => void conectarRemoto()}
                        disabled={remoteConnecting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 disabled:pointer-events-none text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        {remoteConnecting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Conectando…
                          </>
                        ) : (
                          <>
                            <MonitorPlay className="w-3.5 h-3.5" /> Conectar
                          </>
                        )}
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
            <div
              ref={messagesScrollRef}
              onScroll={onMessagesScroll}
              className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
            >
              {loadingOlder && (
                <div className="flex justify-center py-2 text-xs text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Carregando mensagens anteriores…
                </div>
              )}
              {loadingMessages ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">Nenhuma mensagem ainda</div>
              ) : (
                <div className="space-y-2">
                  {buildMessageGroupsWhatsApp(messages, user?.id).map((group, gi) => {
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
                            <p className="text-xs font-medium text-gray-600 mb-0.5 pl-1 flex items-center gap-1">
                              <User className="w-3 h-3 opacity-70" /> {senderLabel}
                            </p>
                          )}
                          <div className="flex flex-col gap-px w-full">
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
                                    <div
                                      className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMine ? 'text-brand-100' : 'text-gray-400'}`}
                                    >
                                      <span>
                                        {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      {isMine && (
                                        <span className="pl-0.5 text-[11px] leading-none">
                                          <MessageDeliveryTicks status={msg.deliveryStatus} />
                                        </span>
                                      )}
                                    </div>
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
