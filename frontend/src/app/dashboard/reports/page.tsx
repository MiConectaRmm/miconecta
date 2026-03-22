'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Download, FileText, Monitor, Ticket, Radio, Package, Shield } from 'lucide-react'
import { reportsApi } from '@/lib/api'
import StatCard from '@/components/ui/StatCard'

const exportOptions = [
  { key: 'dispositivos', label: 'Dispositivos', icon: Monitor, fn: reportsApi.exportDispositivos },
  { key: 'tickets', label: 'Tickets', icon: Ticket, fn: reportsApi.exportTickets },
  { key: 'sessoes', label: 'Sessões Remotas', icon: Radio, fn: reportsApi.exportSessoes },
  { key: 'inventario', label: 'Inventário', icon: Package, fn: reportsApi.exportInventario },
  { key: 'audit', label: 'Auditoria', icon: Shield, fn: reportsApi.exportAudit },
]

export default function DashboardReportsPage() {
  const [executivo, setExecutivo] = useState<any>(null)
  const [tecnico, setTecnico] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [exportando, setExportando] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      reportsApi.executivo(),
      reportsApi.tecnico(),
    ]).then(([eRes, tRes]) => {
      if (eRes.status === 'fulfilled') setExecutivo(eRes.value.data)
      if (tRes.status === 'fulfilled') setTecnico(tRes.value.data)
    }).finally(() => setCarregando(false))
  }, [])

  const handleExport = async (key: string, formato: 'csv' | 'json') => {
    setExportando(key)
    try {
      const opt = exportOptions.find(o => o.key === key)
      if (!opt) return
      const response = await opt.fn(formato)
      if (formato === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${key}_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${key}_${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {}
    setExportando(null)
  }

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando relatórios...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <p className="text-dark-400 text-sm mt-1">Indicadores executivos e técnicos do ambiente</p>
      </div>

      {executivo && (
        <>
          <h2 className="text-lg font-semibold text-white mb-4">Resumo Executivo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Dispositivos" value={executivo.dispositivos?.total} icon={Monitor} color="brand" />
            <StatCard title="Online" value={`${executivo.dispositivos?.percentualOnline}%`} icon={Monitor} color="emerald" />
            <StatCard title="Tickets Abertos" value={executivo.tickets?.abertos} icon={Ticket} color="blue" />
            <StatCard title="Sessões" value={executivo.sessoes?.total} icon={Radio} color="purple" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard title="Em Atendimento" value={executivo.tickets?.emAtendimento} icon={Ticket} color="amber" />
            <StatCard title="Resolvidos" value={executivo.tickets?.resolvidos} icon={Ticket} color="emerald" />
            <StatCard title="TMA (min)" value={executivo.tickets?.tempoMedioAtendimentoMinutos || 0} icon={BarChart3} color="blue" />
            <StatCard title="Alertas Ativos" value={executivo.alertas?.ativos} icon={Shield} color="red" />
          </div>
        </>
      )}

      {tecnico && (
        <>
          <h2 className="text-lg font-semibold text-white mb-4">Relatório Técnico (30 dias)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <h3 className="text-white font-semibold mb-3">Inventário</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-dark-400">Software</span><span className="text-white font-bold">{tecnico.inventario?.softwareTotal}</span></div>
                <div className="flex justify-between"><span className="text-dark-400">Hardware</span><span className="text-white font-bold">{tecnico.inventario?.hardwareTotal}</span></div>
              </div>
            </div>
            <div className="card">
              <h3 className="text-white font-semibold mb-3">Últimos 30 dias</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-dark-400">Alertas</span><span className="text-white font-bold">{tecnico.ultimos30dias?.alertas}</span></div>
                <div className="flex justify-between"><span className="text-dark-400">Sessões</span><span className="text-white font-bold">{tecnico.ultimos30dias?.sessoes}</span></div>
              </div>
            </div>
            <div className="card">
              <h3 className="text-white font-semibold mb-3">Sessões por Técnico</h3>
              <div className="space-y-2 text-sm">
                {tecnico.sessoesPorTecnico?.length === 0 && <p className="text-dark-500">Nenhuma sessão</p>}
                {tecnico.sessoesPorTecnico?.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-dark-400 truncate">{s.technicianId?.slice(0, 8)}...</span>
                    <span className="text-white font-bold">{s.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <h2 className="text-lg font-semibold text-white mb-4">Exportações</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportOptions.map(opt => {
          const Icon = opt.icon
          const isExporting = exportando === opt.key
          return (
            <div key={opt.key} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-brand-400" />
                </div>
                <span className="text-white font-medium">{opt.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport(opt.key, 'csv')}
                  disabled={isExporting}
                  className="px-3 py-1.5 text-xs font-medium bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-700 hover:text-white transition-colors disabled:opacity-50"
                >
                  {isExporting ? '...' : 'CSV'}
                </button>
                <button
                  onClick={() => handleExport(opt.key, 'json')}
                  disabled={isExporting}
                  className="px-3 py-1.5 text-xs font-medium bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-700 hover:text-white transition-colors disabled:opacity-50"
                >
                  JSON
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
