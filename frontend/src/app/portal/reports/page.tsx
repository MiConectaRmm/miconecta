'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Download, Monitor, Ticket, Package } from 'lucide-react'
import { reportsApi } from '@/lib/api'

export default function PortalReportsPage() {
  const [report, setReport] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)
  const [exportando, setExportando] = useState<string | null>(null)

  useEffect(() => {
    reportsApi.executivo()
      .then(({ data }) => setReport(data))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const handleExport = async (tipo: string, formato: 'csv' | 'json') => {
    setExportando(tipo)
    try {
      const fns: Record<string, any> = {
        dispositivos: reportsApi.exportDispositivos,
        tickets: reportsApi.exportTickets,
        inventario: reportsApi.exportInventario,
      }
      const response = await fns[tipo](formato)
      const blob = new Blob([formato === 'csv' ? response.data : JSON.stringify(response.data, null, 2)],
        { type: formato === 'csv' ? 'text/csv' : 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tipo}_${Date.now()}.${formato}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    setExportando(null)
  }

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <p className="text-dark-400 text-sm mt-1">Resumo do seu ambiente</p>
      </div>

      {report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Dispositivos</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-dark-400">Total</span><span className="text-white font-bold">{report.dispositivos?.total}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Online</span><span className="text-emerald-400 font-bold">{report.dispositivos?.online}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Offline</span><span className="text-red-400 font-bold">{report.dispositivos?.offline}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Disponibilidade</span><span className="text-brand-400 font-bold">{report.dispositivos?.percentualOnline}%</span></div>
            </div>
          </div>
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Tickets</h2>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-dark-400">Total</span><span className="text-white font-bold">{report.tickets?.total}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Abertos</span><span className="text-blue-400 font-bold">{report.tickets?.abertos}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Em Atendimento</span><span className="text-amber-400 font-bold">{report.tickets?.emAtendimento}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Resolvidos</span><span className="text-emerald-400 font-bold">{report.tickets?.resolvidos}</span></div>
              {report.tickets?.tempoMedioAtendimentoMinutos > 0 && (
                <div className="flex justify-between"><span className="text-dark-400">TMA</span><span className="text-brand-400 font-bold">{report.tickets.tempoMedioAtendimentoMinutos} min</span></div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12 mb-8">
          <BarChart3 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Relatório não disponível</p>
        </div>
      )}

      <h2 className="text-lg font-semibold text-white mb-4">Exportações</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { key: 'dispositivos', label: 'Dispositivos', icon: Monitor },
          { key: 'tickets', label: 'Tickets', icon: Ticket },
          { key: 'inventario', label: 'Inventário', icon: Package },
        ].map(opt => {
          const Icon = opt.icon
          return (
            <div key={opt.key} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-brand-400" />
                <span className="text-white font-medium">{opt.label}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleExport(opt.key, 'csv')} disabled={exportando === opt.key}
                  className="px-3 py-1.5 text-xs bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-700 hover:text-white disabled:opacity-50">
                  CSV
                </button>
                <button onClick={() => handleExport(opt.key, 'json')} disabled={exportando === opt.key}
                  className="px-3 py-1.5 text-xs bg-dark-800 text-dark-300 rounded-lg hover:bg-dark-700 hover:text-white disabled:opacity-50">
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
