'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Inbox,
  Ticket,
  MessageSquare,
  AlertTriangle,
  Clock,
  Building2,
  Search,
  RefreshCw,
  ChevronRight,
  Filter,
  Wifi,
  WifiOff,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { ticketsApi, alertsApi } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'

interface AtendimentoItem {
  id: string
  tipo: 'ticket' | 'alerta'
  titulo: string
  cliente: string
  clienteId: string
  prioridade: 'critica' | 'alta' | 'media' | 'baixa'
  status: string
  criadoEm: string
  hasUnreadFromClient?: boolean
  isNew?: boolean
}

interface ToastNotification {
  id: string
  message: string
  type: 'ticket' | 'alerta' | 'info'
  timestamp: Date
}

const prioridadeCores: Record<string, string> = {
  critica: 'bg-red-500/10 text-red-400 border-red-500/20',
  alta: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  media: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  baixa: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const prioridadeIcones: Record<string, string> = {
  critica: '🔴',
  alta: '🟠',
  media: '🟡',
  baixa: '🟢',
}

const tipoIcones: Record<string, { icon: any; cor: string }> = {
  ticket: { icon: Ticket, cor: 'bg-blue-500/20 text-blue-400' },
  alerta: { icon: AlertTriangle, cor: 'bg-red-500/20 text-red-400' },
}

function tempoRelativo(data: string): string {
  const agora = new Date()
  const criado = new Date(data)
  const diffMs = agora.getTime() - criado.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHoras = Math.floor(diffMin / 60)
  const diffDias = Math.floor(diffHoras / 24)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  if (diffHoras < 24) return `${diffHoras}h`
  return `${diffDias}d`
}

export default function CentralAtendimentoPage() {
  const router = useRouter()
  const [items, setItems] = useState<AtendimentoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas')
  const [busca, setBusca] = useState('')
  const [wsConnected, setWsConnected] = useState(false)
  const [pendingUpdates, setPendingUpdates] = useState(0)
  const [toasts, setToasts] = useState<ToastNotification[]>([])
  const [somAtivo, setSomAtivo] = useState(true)
  const lastLoadRef = useRef<number>(0)

  const { socket, emit, on } = useSocket('/chat')

  // ── Tocar som de notificação ──
  const playNotificationSound = useCallback(() => {
    if (!somAtivo) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 800
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch {}
  }, [somAtivo])

  // ── Adicionar toast ──
  const addToast = useCallback((message: string, type: ToastNotification['type']) => {
    const toast: ToastNotification = {
      id: Date.now().toString() + Math.random(),
      message,
      type,
      timestamp: new Date(),
    }
    setToasts((prev) => [toast, ...prev].slice(0, 5))
    // Auto-remove after 8s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 8000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // ── Carregar dados via API ──
  const carregarDados = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const atendimentoItems: AtendimentoItem[] = []

      const [abertosRes, andamentoRes] = await Promise.allSettled([
        ticketsApi.listar({ status: 'aberto', limit: 200 }),
        ticketsApi.listar({ status: 'em_andamento', limit: 200 }),
      ])

      const ticketsAbertos = abertosRes.status === 'fulfilled'
        ? (Array.isArray(abertosRes.value.data) ? abertosRes.value.data : abertosRes.value.data?.items || [])
        : []
      const ticketsAndamento = andamentoRes.status === 'fulfilled'
        ? (Array.isArray(andamentoRes.value.data) ? andamentoRes.value.data : andamentoRes.value.data?.items || [])
        : []

      ;[...ticketsAbertos, ...ticketsAndamento].forEach((t: any) => {
        atendimentoItems.push({
          id: t.id,
          tipo: 'ticket',
          titulo: t.titulo || t.assunto || t.title || 'Sem título',
          cliente: t.tenant?.nomeFantasia || t.tenant?.razaoSocial || t.tenant?.nome || 'N/A',
          clienteId: t.tenantId,
          prioridade: (t.prioridade || 'media') as AtendimentoItem['prioridade'],
          status: t.status,
          criadoEm: t.criadoEm || t.createdAt,
          hasUnreadFromClient: t.hasUnreadFromClient,
        })
      })

      try {
        const alertasRes = await alertsApi.listar({ status: 'ativo', limit: 200 })
        const alertas = Array.isArray(alertasRes.data) ? alertasRes.data : alertasRes.data?.items || []
        alertas.forEach((a: any) => {
          atendimentoItems.push({
            id: a.id,
            tipo: 'alerta',
            titulo: a.titulo || a.tipo || 'Alerta',
            cliente: a.device?.tenant?.nomeFantasia || a.device?.tenant?.nome || 'N/A',
            clienteId: a.device?.tenantId || a.tenantId || '',
            prioridade: a.severidade === 'critico' ? 'critica' : a.severidade === 'alto' ? 'alta' : 'media',
            status: a.status,
            criadoEm: a.criadoEm || a.createdAt,
          })
        })
      } catch {}

      const prioridadeOrdem: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }
      atendimentoItems.sort((a, b) => {
        const pa = prioridadeOrdem[a.prioridade] ?? 2
        const pb = prioridadeOrdem[b.prioridade] ?? 2
        if (pa !== pb) return pa - pb
        return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
      })

      setItems(atendimentoItems)
      setPendingUpdates(0)
      lastLoadRef.current = Date.now()
    } catch (err) {
      console.error('Erro ao carregar central de atendimento:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Carregar dados na montagem ──
  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // ── WebSocket: entrar na sala atendimento + ouvir eventos ──
  useEffect(() => {
    if (!socket) return

    const handleConnect = () => {
      setWsConnected(true)
      emit('atendimento:join', {})
    }
    const handleDisconnect = () => setWsConnected(false)

    if (socket.connected) {
      setWsConnected(true)
      emit('atendimento:join', {})
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    // ── Eventos da Central de Atendimento ──

    // Novo ticket ou mensagem → recarregar lista
    const offUpdate = on('atendimento:update', (data: any) => {
      const type = data?.type
      const now = Date.now()
      const timeSinceLoad = now - lastLoadRef.current

      if (type === 'ticket_created') {
        addToast(`Novo ticket: ${data.titulo || 'Sem título'}`, 'ticket')
        playNotificationSound()
        // Reload se mais de 3s desde último load
        if (timeSinceLoad > 3000) carregarDados(true)
        else setPendingUpdates((p) => p + 1)
      } else if (type === 'ticket_message') {
        addToast(`Nova mensagem no ticket`, 'ticket')
        // Mark ticket as having unread
        setItems((prev) =>
          prev.map((item) =>
            item.tipo === 'ticket' && item.id === data.ticketId
              ? { ...item, hasUnreadFromClient: true, isNew: true }
              : item
          )
        )
      } else if (type === 'alert_created') {
        addToast(`Novo alerta: ${data.titulo || data.severidade || 'Alerta'}`, 'alerta')
        playNotificationSound()
        if (timeSinceLoad > 3000) carregarDados(true)
        else setPendingUpdates((p) => p + 1)
      } else if (type === 'alert_acknowledged' || type === 'alert_resolved') {
        // Alerta saiu da fila — reload silencioso
        if (timeSinceLoad > 3000) carregarDados(true)
        else setPendingUpdates((p) => p + 1)
      }
    })

    // Ticket mudou status/prioridade
    const offTicketUpdated = on('atendimento:ticket_updated', (data: any) => {
      const timeSinceLoad = Date.now() - lastLoadRef.current
      if (data?.status === 'resolvido' || data?.status === 'fechado') {
        // Ticket saiu da fila
        setItems((prev) => prev.filter((item) => !(item.tipo === 'ticket' && item.id === data.ticketId)))
        addToast('Ticket resolvido/fechado', 'info')
      } else {
        // Mudou prioridade ou status — reload
        if (timeSinceLoad > 3000) carregarDados(true)
        else setPendingUpdates((p) => p + 1)
      }
    })

    return () => {
      emit('atendimento:leave', {})
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      offUpdate()
      offTicketUpdated()
    }
  }, [socket, emit, on, carregarDados, addToast, playNotificationSound])

  // ── Fallback: polling a cada 60s (backup do WS) ──
  useEffect(() => {
    const interval = setInterval(() => carregarDados(true), 60000)
    return () => clearInterval(interval)
  }, [carregarDados])

  // ── Filtros ──
  const itensFiltrados = items.filter((item) => {
    if (filtroTipo !== 'todos' && item.tipo !== filtroTipo) return false
    if (filtroPrioridade !== 'todas' && item.prioridade !== filtroPrioridade) return false
    if (busca) {
      const b = busca.toLowerCase()
      return item.titulo.toLowerCase().includes(b) || item.cliente.toLowerCase().includes(b)
    }
    return true
  })

  const contadores = {
    todos: items.length,
    ticket: items.filter((i) => i.tipo === 'ticket').length,
    alerta: items.filter((i) => i.tipo === 'alerta').length,
    criticas: items.filter((i) => i.prioridade === 'critica').length,
    unread: items.filter((i) => i.hasUnreadFromClient).length,
  }

  const abrirCliente = (clienteId: string, tipo: string, itemId: string) => {
    if (!clienteId) return
    if (tipo === 'ticket') {
      router.push(`/dashboard/tickets/${itemId}`)
    } else {
      router.push(`/dashboard/clients/${clienteId}`)
    }
  }

  return (
    <div className="relative">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in-right ${
                toast.type === 'alerta'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : toast.type === 'ticket'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  : 'bg-dark-800 border-dark-700 text-dark-300'
              }`}
            >
              {toast.type === 'alerta' ? (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              ) : toast.type === 'ticket' ? (
                <Ticket className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Bell className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="text-sm flex-1">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="text-dark-500 hover:text-white">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Inbox className="w-7 h-7 text-brand-400" />
            Central de Atendimento
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-dark-400 text-sm">
              Fila unificada de tickets e alertas de todos os clientes
            </p>
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              wsConnected
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {wsConnected ? 'Tempo real' : 'Desconectado'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle som */}
          <button
            onClick={() => setSomAtivo(!somAtivo)}
            className={`p-2 rounded-lg border transition-colors ${
              somAtivo
                ? 'bg-dark-800 border-dark-700 text-dark-300 hover:bg-dark-700'
                : 'bg-dark-800 border-dark-700 text-dark-600 hover:bg-dark-700'
            }`}
            title={somAtivo ? 'Som ativado' : 'Som desativado'}
          >
            {somAtivo ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Pending updates badge */}
          {pendingUpdates > 0 && (
            <button
              onClick={() => carregarDados(true)}
              className="flex items-center gap-2 px-3 py-2 bg-brand-600/20 border border-brand-500/30 rounded-lg text-sm font-medium text-brand-400 hover:bg-brand-600/30 transition-colors animate-pulse"
            >
              <BellRing className="w-4 h-4" />
              {pendingUpdates} {pendingUpdates === 1 ? 'atualização' : 'atualizações'}
            </button>
          )}

          <button
            onClick={() => carregarDados()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 text-sm font-medium text-dark-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
            <Inbox className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{contadores.todos}</p>
            <p className="text-xs text-dark-400">Total na fila</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{contadores.ticket}</p>
            <p className="text-xs text-dark-400">Tickets</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{contadores.alerta}</p>
            <p className="text-xs text-dark-400">Alertas</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
            <span className="text-lg">🔴</span>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{contadores.criticas}</p>
            <p className="text-xs text-dark-400">Críticas</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{contadores.unread}</p>
            <p className="text-xs text-dark-400">Não lidas</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Buscar por título ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input w-full pl-10"
            />
          </div>

          <div className="flex gap-2">
            {[
              { key: 'todos', label: 'Todos' },
              { key: 'ticket', label: 'Tickets' },
              { key: 'alerta', label: 'Alertas' },
            ].map((tipo) => (
              <button
                key={tipo.key}
                onClick={() => setFiltroTipo(tipo.key)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filtroTipo === tipo.key
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'bg-dark-800 text-dark-400 hover:bg-dark-700'
                }`}
              >
                {tipo.label}
              </button>
            ))}
          </div>

          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value)}
            className="input"
          >
            <option value="todas">Todas prioridades</option>
            <option value="critica">🔴 Crítica</option>
            <option value="alta">🟠 Alta</option>
            <option value="media">🟡 Média</option>
            <option value="baixa">🟢 Baixa</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-dark-500">
            <Inbox className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium">Nenhum item na fila</p>
            <p className="text-sm mt-1">Todos os atendimentos foram resolvidos! 🎉</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-800">
            {itensFiltrados.map((item) => {
              const tipoInfo = tipoIcones[item.tipo] || tipoIcones.ticket
              const TipoIcon = tipoInfo.icon
              return (
                <button
                  key={`${item.tipo}-${item.id}`}
                  onClick={() => abrirCliente(item.clienteId, item.tipo, item.id)}
                  className={`w-full flex items-center gap-4 px-6 py-4 hover:bg-dark-800/50 transition-all text-left ${
                    item.isNew ? 'bg-brand-600/5 border-l-2 border-l-brand-500' : ''
                  } ${item.hasUnreadFromClient ? 'bg-yellow-500/5' : ''}`}
                >
                  {/* Prioridade */}
                  <span className="text-lg flex-shrink-0">{prioridadeIcones[item.prioridade]}</span>

                  {/* Tipo */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tipoInfo.cor}`}>
                    <TipoIcon className="w-4 h-4" />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {item.titulo}
                      </p>
                      {item.hasUnreadFromClient && (
                        <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0 animate-pulse" />
                      )}
                      {item.isNew && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 text-brand-400 flex-shrink-0">
                          NOVO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Building2 className="w-3 h-3 text-dark-500" />
                      <span className="text-xs text-dark-400">{item.cliente}</span>
                      <span className="text-xs text-dark-600">·</span>
                      <span className="text-xs text-dark-500 capitalize">{item.status?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  {/* Prioridade badge */}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${prioridadeCores[item.prioridade]}`}>
                    {item.prioridade}
                  </span>

                  {/* Tempo */}
                  <div className="flex items-center gap-1 text-xs text-dark-500 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{tempoRelativo(item.criadoEm)}</span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-dark-600 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-dark-600">
          {wsConnected
            ? '⚡ Atualizações em tempo real via WebSocket'
            : '🔄 Polling a cada 60 segundos (WebSocket desconectado)'}
        </p>
        <p className="text-xs text-dark-600">
          {itensFiltrados.length} {itensFiltrados.length === 1 ? 'item' : 'itens'} na fila
        </p>
      </div>
    </div>
  )
}
