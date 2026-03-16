'use client'

import { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { reportsApi } from '@/lib/api'

export default function PortalReportsPage() {
  const [report, setReport] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    reportsApi.executivo()
      .then(({ data }) => setReport(data))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Relatórios</h1>
        <p className="text-dark-400 text-sm mt-1">Resumo do seu ambiente</p>
      </div>

      {report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-12">
          <BarChart3 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Relatório não disponível</p>
        </div>
      )}
    </div>
  )
}
