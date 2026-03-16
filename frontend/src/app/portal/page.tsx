'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Monitor, CheckCircle2, MonitorOff, Ticket, AlertTriangle } from 'lucide-react'
import { devicesApi, ticketsApi, alertsApi } from '@/lib/api'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'

export default function PortalDashboard() {
  const [resumo, setResumo] = useState({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [tickets, setTickets] = useState({ abertos: 0, emAtendimento: 0, total: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    try {
      const [rRes, dRes, tRes] = await Promise.allSettled([
        devicesApi.resumo(),
        devicesApi.listar(),
        ticketsApi.contagem(),
      ])
      if (rRes.status === 'fulfilled') setResumo(rRes.value.data)
      if (dRes.status === 'fulfilled') setDevices(dRes.value.data)
      if (tRes.status === 'fulfilled') setTickets(tRes.value.data)
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
        <StatCard title="Chamados Abertos" value={tickets.abertos} icon={Ticket} color="blue" />
      </div>

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
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">IP</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.slice(0, 10).map((d: any) => (
                  <tr key={d.id} className="border-b border-dark-800/50 hover:bg-dark-800/50">
                    <td className="py-2.5 px-3 text-white font-medium">{d.hostname}</td>
                    <td className="py-2.5 px-3 text-dark-400 text-xs">{d.sistemaOperacional}</td>
                    <td className="py-2.5 px-3 text-dark-400 text-xs font-mono">{d.ipLocal}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
