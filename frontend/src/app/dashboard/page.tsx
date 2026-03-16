'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Monitor, MonitorOff, AlertTriangle, CheckCircle2,
  Ticket, MessageSquare, Building2, Activity,
} from 'lucide-react'
import { devicesApi, alertsApi, ticketsApi, tenantsApi } from '@/lib/api'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'

export default function DashboardPage() {
  const [resumo, setResumo] = useState({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [alertas, setAlertas] = useState({ ativos: 0, total: 0 })
  const [tickets, setTickets] = useState({ abertos: 0, emAtendimento: 0, total: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarDados()
    const interval = setInterval(carregarDados, 30000)
    return () => clearInterval(interval)
  }, [])

  const carregarDados = async () => {
    try {
      const [resumoRes, alertasRes, devicesRes, ticketsRes] = await Promise.allSettled([
        devicesApi.resumo(),
        alertsApi.contagem(),
        devicesApi.listar(),
        ticketsApi.contagem(),
      ])
      if (resumoRes.status === 'fulfilled') setResumo(resumoRes.value.data)
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data)
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.data)
      if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value.data)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 text-sm mt-1">Visão geral da infraestrutura e operações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Dispositivos" value={resumo.total} icon={Monitor} color="brand" subtitle={`${resumo.online} online`} />
        <StatCard title="Online" value={resumo.online} icon={CheckCircle2} color="emerald" />
        <StatCard title="Offline" value={resumo.offline} icon={MonitorOff} color="red" />
        <StatCard title="Alertas Ativos" value={alertas.ativos} icon={AlertTriangle} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Tickets Abertos" value={tickets.abertos} icon={Ticket} color="blue" />
        <StatCard title="Em Atendimento" value={tickets.emAtendimento} icon={MessageSquare} color="purple" />
        <StatCard title="Total Tickets" value={tickets.total} icon={Activity} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Dispositivos</h2>
            <Link href="/dashboard/devices" className="text-brand-400 hover:text-brand-300 text-sm">Ver todos →</Link>
          </div>

          {carregando ? (
            <div className="text-center py-12 text-dark-400">Carregando...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum dispositivo registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Hostname</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">IP</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">SO</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.slice(0, 8).map((device: any) => (
                    <tr key={device.id} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <Link href={`/dashboard/devices/${device.id}`} className="text-white hover:text-brand-400 font-medium">
                          {device.hostname}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs font-mono">{device.ipLocal}</td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs truncate max-w-[150px]">{device.sistemaOperacional}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={device.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Ações Rápidas</h2>
          </div>
          <div className="space-y-2">
            <Link href="/dashboard/tickets" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Novo Ticket</p>
                <p className="text-xs text-dark-500">Abrir chamado de suporte</p>
              </div>
            </Link>
            <Link href="/dashboard/devices" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <Monitor className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Dispositivos</p>
                <p className="text-xs text-dark-500">Gerenciar parque</p>
              </div>
            </Link>
            <Link href="/dashboard/clients" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Clientes</p>
                <p className="text-xs text-dark-500">Gerenciar tenants</p>
              </div>
            </Link>
            <Link href="/dashboard/reports" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Relatórios</p>
                <p className="text-xs text-dark-500">Resumo executivo</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
