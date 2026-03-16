'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Monitor, CheckCircle2, MonitorOff, Ticket, AlertTriangle, Radio } from 'lucide-react'
import { devicesApi, ticketsApi, alertsApi, sessionsApi } from '@/lib/api'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAuthStore } from '@/stores/auth.store'

export default function PortalDashboard() {
  const { user } = useAuthStore()
  const [resumo, setResumo] = useState({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [tickets, setTickets] = useState<any>({ abertos: 0, emAtendimento: 0, resolvidos: 0, total: 0 })
  const [alertas, setAlertas] = useState(0)
  const [sessoes, setSessoes] = useState<any>({ total: 0, ativas: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [recentTickets, setRecentTickets] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const canViewSessions = user?.role === 'admin_cliente' || user?.role === 'gestor'

  useEffect(() => { carregar() }, [])

  const carregar = async () => {
    try {
      const promises: Promise<any>[] = [
        devicesApi.resumo(),
        devicesApi.listar(),
        ticketsApi.contagem(),
        ticketsApi.listar(),
      ]
      if (canViewSessions) {
        promises.push(sessionsApi.estatisticas())
        promises.push(alertsApi.contagem())
      }
      const results = await Promise.allSettled(promises)
      if (results[0].status === 'fulfilled') setResumo(results[0].value.data)
      if (results[1].status === 'fulfilled') setDevices(results[1].value.data)
      if (results[2].status === 'fulfilled') setTickets(results[2].value.data)
      if (results[3].status === 'fulfilled') setRecentTickets(results[3].value.data?.slice(0, 5) || [])
      if (canViewSessions && results[4]?.status === 'fulfilled') setSessoes(results[4].value.data)
      if (canViewSessions && results[5]?.status === 'fulfilled') setAlertas(results[5].value.data?.total || 0)
    } catch {}
    setCarregando(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
        <p className="text-dark-400 text-sm mt-1">Seu parque tecnológico</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title="Dispositivos" value={resumo.total} icon={Monitor} color="brand" />
        <StatCard title="Online" value={resumo.online} icon={CheckCircle2} color="emerald" />
        <StatCard title="Offline" value={resumo.offline} icon={MonitorOff} color="red" />
        <StatCard title="Chamados Abertos" value={tickets.abertos || 0} icon={Ticket} color="blue" />
      </div>

      {canViewSessions && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard title="Em Atendimento" value={tickets.emAtendimento || 0} icon={Ticket} color="amber" />
          <StatCard title="Sessões Ativas" value={sessoes.ativas || 0} icon={Radio} color="purple" />
          <StatCard title="Alertas" value={alertas} icon={AlertTriangle} color="red" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Dispositivos</h2>
            <Link href="/portal/devices" className="text-brand-400 hover:text-brand-300 text-sm">Ver todos →</Link>
          </div>
          {carregando ? (
            <div className="text-center py-8 text-dark-400">Carregando...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-dark-500">Nenhum dispositivo</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Hostname</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">SO</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.slice(0, 8).map((d: any) => (
                    <tr key={d.id} className="border-b border-dark-800/50 hover:bg-dark-800/50">
                      <td className="py-2.5 px-3">
                        <Link href={`/portal/devices/${d.id}`} className="text-white font-medium hover:text-brand-400">{d.hostname}</Link>
                      </td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs">{d.sistemaOperacional}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Chamados Recentes</h2>
            <Link href="/portal/tickets" className="text-brand-400 hover:text-brand-300 text-sm">Ver todos →</Link>
          </div>
          {recentTickets.length === 0 ? (
            <div className="text-center py-8 text-dark-500">Nenhum chamado</div>
          ) : (
            <div className="space-y-2">
              {recentTickets.map((t: any) => (
                <Link key={t.id} href={`/portal/tickets/${t.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{t.titulo}</p>
                    <p className="text-dark-500 text-xs mt-0.5">{new Date(t.criadoEm).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
