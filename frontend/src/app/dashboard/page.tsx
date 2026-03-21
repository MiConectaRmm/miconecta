'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Monitor, MonitorOff, AlertTriangle, CheckCircle2,
  Ticket, MessageSquare, Building2, Activity, Shield, Users, Eye,
  Inbox, ChevronRight, Clock, RefreshCw,
} from 'lucide-react'
import { devicesApi, alertsApi, ticketsApi, tenantsApi, techniciansApi } from '@/lib/api'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/stores/auth.store'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  const [empresas, setEmpresas] = useState(0)
  const [tecnicos, setTecnicos] = useState(0)
  const [resumo, setResumo] = useState({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [alertas, setAlertas] = useState({ ativos: 0, total: 0 })
  const [tickets, setTickets] = useState({ abertos: 0, emAtendimento: 0, total: 0 })
  const [clientesResumo, setClientesResumo] = useState<any[]>([])
  const [ticketsRecentes, setTicketsRecentes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const { on } = useSocket('/chat')

  const isSuperAdmin = ['super_admin', 'admin', 'admin_maginf'].includes(user?.role || '')

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const unsubNotification = on('notification:new', () => carregar())
    const unsubTicketUpdated = on('ticket:updated', () => carregar())
    const unsubMessage = on('message:new', () => carregar())
    return () => {
      unsubNotification()
      unsubTicketUpdated()
      unsubMessage()
    }
  }, [on])

  const carregar = async () => {
    try {
      const [tenantsRes, techRes, resumoRes, alertasRes, ticketsRes, ticketsListRes] = await Promise.allSettled([
        tenantsApi.listar(),
        techniciansApi.contagem(),
        devicesApi.resumo(),
        alertsApi.contagem(),
        ticketsApi.contagem(),
        ticketsApi.listar({ limit: 8 }),
      ])

      if (tenantsRes.status === 'fulfilled') {
        const d = tenantsRes.value.data
        const tenants = Array.isArray(d) ? d : d?.items || []
        setEmpresas(tenants.length)

        // Build resumo por cliente
        try {
          const clienteStats = await Promise.all(
            tenants.slice(0, 20).map(async (t: any) => {
              const [devRes, alertRes, tickRes] = await Promise.allSettled([
                devicesApi.listar({ tenantId: t.id }),
                alertsApi.listar({ tenantId: t.id, status: 'ativo' }),
                ticketsApi.listar({ tenantId: t.id, status: 'aberto', limit: 100 }),
              ])
              const devs = devRes.status === 'fulfilled' ? (Array.isArray(devRes.value.data) ? devRes.value.data : devRes.value.data?.items || []) : []
              const alts = alertRes.status === 'fulfilled' ? (Array.isArray(alertRes.value.data) ? alertRes.value.data : alertRes.value.data?.items || []) : []
              const tks = tickRes.status === 'fulfilled' ? (Array.isArray(tickRes.value.data) ? tickRes.value.data : tickRes.value.data?.items || []) : []

              const online = devs.filter((d: any) => d.status === 'online' || d.online).length
              const offline = devs.length - online
              const alertasAtivos = alts.length
              const ticketsAbertos = tks.length

              let status: 'ok' | 'atencao' | 'critico' = 'ok'
              if (offline > 0 || alertasAtivos > 0 || ticketsAbertos > 0) status = 'atencao'
              if (offline > devs.length * 0.3 || alertasAtivos > 2) status = 'critico'

              return {
                id: t.id,
                nome: t.nomeFantasia || t.razaoSocial || t.nome || 'N/A',
                dispositivos: devs.length,
                online,
                offline,
                alertas: alertasAtivos,
                ticketsAbertos,
                status,
              }
            })
          )

          // Ordenar: críticos primeiro
          const statusOrdem: Record<string, number> = { critico: 0, atencao: 1, ok: 2 }
          clienteStats.sort((a, b) => (statusOrdem[a.status] ?? 2) - (statusOrdem[b.status] ?? 2))
          setClientesResumo(clienteStats)
        } catch {}
      }

      if (techRes.status === 'fulfilled') {
        const c = techRes.value.data
        setTecnicos(typeof c?.total === 'number' ? c.total : typeof c?.ativos === 'number' ? c.ativos : 0)
      }
      if (resumoRes.status === 'fulfilled') setResumo(resumoRes.value.data)
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data)
      if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value.data)
      if (ticketsListRes.status === 'fulfilled') {
        const tl = ticketsListRes.value.data
        setTicketsRecentes(Array.isArray(tl) ? tl.slice(0, 8) : (tl?.items || []).slice(0, 8))
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setCarregando(false)
    }
  }

  function tempoRelativo(data: string): string {
    if (!data) return ''
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

  const statusCores: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    ok: { dot: 'bg-green-400', bg: 'bg-green-500/10', text: 'text-green-400', label: 'OK' },
    atencao: { dot: 'bg-yellow-400', bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Atenção' },
    critico: { dot: 'bg-red-400', bg: 'bg-red-500/10', text: 'text-red-400', label: 'Crítico' },
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Olá, {user?.nome?.split(' ')[0] || 'Admin'} 👋
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Visão geral da plataforma MIConecta RMM
          </p>
        </div>
        <button
          onClick={() => { setCarregando(true); carregar() }}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg hover:bg-dark-700 text-sm font-medium text-dark-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Clientes" value={empresas} icon={Building2} color="emerald" subtitle="empresas" />
        {isSuperAdmin && <StatCard title="Técnicos" value={tecnicos} icon={Users} color="purple" subtitle="Maginf" />}
        <StatCard title="Dispositivos" value={resumo.total} icon={Monitor} color="brand" subtitle={`${resumo.online} online`} />
        <StatCard title="Offline" value={resumo.offline} icon={MonitorOff} color="red" />
        <StatCard title="Alertas" value={alertas.ativos} icon={AlertTriangle} color="amber" subtitle="ativos" />
        <StatCard title="Tickets" value={tickets.abertos} icon={Ticket} color="blue" subtitle="abertos" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Saúde por cliente */}
        <div className="lg:col-span-2 card p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
            <h2 className="text-lg font-semibold text-white">Saúde por Cliente</h2>
            <Link href="/dashboard/clients" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {carregando ? (
            <div className="text-center py-12 text-dark-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Carregando...
            </div>
          ) : clientesResumo.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum cliente cadastrado</p>
            </div>
          ) : (
            <div className="divide-y divide-dark-800">
              {clientesResumo.slice(0, 10).map((cliente) => {
                const sc = statusCores[cliente.status] || statusCores.ok
                return (
                  <Link
                    key={cliente.id}
                    href={`/dashboard/clients/${cliente.id}`}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-dark-800/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{cliente.nome}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-dark-400">
                      <span className="flex items-center gap-1">
                        <Monitor className="w-3 h-3" />
                        {cliente.online}/{cliente.dispositivos}
                      </span>
                      {cliente.ticketsAbertos > 0 && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Ticket className="w-3 h-3" />
                          {cliente.ticketsAbertos}
                        </span>
                      )}
                      {cliente.offline > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <MonitorOff className="w-3 h-3" />
                          {cliente.offline}
                        </span>
                      )}
                      {cliente.alertas > 0 && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {cliente.alertas}
                        </span>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-dark-600" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          {/* Atividade recente */}
          <div className="card p-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
              <h2 className="text-lg font-semibold text-white">Atividade Recente</h2>
              <Link href="/dashboard/atendimento" className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
                Ver tudo <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            {ticketsRecentes.length === 0 ? (
              <div className="px-6 py-12 text-center text-dark-500">
                <Clock className="w-10 h-10 mx-auto mb-3" />
                <p className="text-sm">Nenhuma atividade recente</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-800">
                {ticketsRecentes.map((t: any) => (
                  <Link
                    key={t.id}
                    href={`/dashboard/tickets/${t.id}`}
                    className="flex items-start gap-3 px-6 py-3 hover:bg-dark-800/50 transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5 flex-shrink-0">
                      <Ticket className="w-3 h-3 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{t.titulo || t.assunto || 'Ticket'}</p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        {t.tenant?.nomeFantasia || t.tenant?.nome || 'N/A'} · {tempoRelativo(t.criadoEm || t.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Ações rápidas */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Ações Rápidas</h2>
            <div className="space-y-2">
              <Link
                href="/dashboard/atendimento"
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <Inbox className="w-4 h-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-200 group-hover:text-white">Central de Atendimento</p>
                  <p className="text-xs text-dark-500">Fila de tickets e alertas</p>
                </div>
              </Link>
              <Link
                href="/dashboard/clients"
                className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dark-200 group-hover:text-white">Clientes</p>
                  <p className="text-xs text-dark-500">Gerenciar empresas</p>
                </div>
              </Link>
              {isSuperAdmin && (
                <>
                  <Link
                    href="/dashboard/technicians"
                    className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-dark-200 group-hover:text-white">Técnicos</p>
                      <p className="text-xs text-dark-500">Equipe Maginf</p>
                    </div>
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-dark-200 group-hover:text-white">Configurações</p>
                      <p className="text-xs text-dark-500">Plataforma e segurança</p>
                    </div>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-refresh */}
      <p className="text-center text-xs text-dark-600 mt-6">
        Atualização automática a cada 30 segundos
      </p>
    </div>
  )
}
