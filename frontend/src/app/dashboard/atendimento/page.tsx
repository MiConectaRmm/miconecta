'use client'

import { useEffect, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { ticketsApi, alertsApi } from '@/lib/api'

interface AtendimentoItem {
  id: string
  tipo: 'ticket' | 'alerta'
  titulo: string
  cliente: string
  clienteId: string
  prioridade: 'critica' | 'alta' | 'media' | 'baixa'
  status: string
  criadoEm: string
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

  const carregarDados = useCallback(async () => {
    setLoading(true)
    try {
      const atendimentoItems: AtendimentoItem[] = []

      // Carregar tickets abertos e em andamento
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
        })
      })

      // Carregar alertas ativos
      try {
        const alertasRes = await alertsApi.listar({ status: 'ativo', limit: 200 })
        const alertas = Array.isArray(alertasRes.data) ? alertasRes.data : alertasRes.data?.items || []
        alertas.forEach((a: any) => {
          atendimentoItems.push({
            id: a.id,
            tipo: 'alerta',
            titulo: a.titulo || a.mensagem || a.tipo || 'Alerta',
            cliente: a.device?.tenant?.nomeFantasia || a.device?.tenant?.nome || 'N/A',
            clienteId: a.device?.tenantId || a.tenantId || '',
            prioridade: a.severidade === 'critico' ? 'critica' : a.severidade === 'alto' ? 'alta' : 'media',
            status: a.status,
            criadoEm: a.criadoEm || a.createdAt,
          })
        })
      } catch {}

      // Ordenar: crítica primeiro, depois por tempo
      const prioridadeOrdem: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3 }
      atendimentoItems.sort((a, b) => {
        const pa = prioridadeOrdem[a.prioridade] ?? 2
        const pb = prioridadeOrdem[b.prioridade] ?? 2
        if (pa !== pb) return pa - pb
        return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
      })

      setItems(atendimentoItems)
    } catch (err) {
      console.error('Erro ao carregar central de atendimento:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDados()
    const interval = setInterval(carregarDados, 30000)
    return () => clearInterval(interval)
  }, [carregarDados])

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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Inbox className="w-7 h-7 text-brand-400" />
            Central de Atendimento
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Fila unificada de tickets e alertas de todos os clientes
          </p>
        </div>
        <button
          onClick={carregarDados}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 text-sm font-medium text-dark-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Busca */}
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

          {/* Filtro tipo */}
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

          {/* Filtro prioridade */}
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
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-dark-800/50 transition-colors text-left"
                >
                  {/* Prioridade */}
                  <span className="text-lg flex-shrink-0">{prioridadeIcones[item.prioridade]}</span>

                  {/* Tipo */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tipoInfo.cor}`}>
                    <TipoIcon className="w-4 h-4" />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {item.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Building2 className="w-3 h-3 text-dark-500" />
                      <span className="text-xs text-dark-400">{item.cliente}</span>
                      <span className="text-xs text-dark-600">·</span>
                      <span className="text-xs text-dark-500 capitalize">{item.status?.replace('_', ' ')}</span>
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

      {/* Auto-refresh */}
      <p className="text-center text-xs text-dark-600 mt-4">
        Atualização automática a cada 30 segundos
      </p>
    </div>
  )
}
