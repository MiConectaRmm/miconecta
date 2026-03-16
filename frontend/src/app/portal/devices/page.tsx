'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Monitor, Search } from 'lucide-react'
import { devicesApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'

export default function PortalDevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    devicesApi.listar()
      .then(({ data }) => setDevices(data))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const filtrados = devices.filter(d =>
    !busca || d.hostname?.toLowerCase().includes(busca.toLowerCase()) ||
    d.ipLocal?.includes(busca)
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Inventário</h1>
        <p className="text-dark-400 text-sm mt-1">Parque tecnológico da sua empresa</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Buscar por hostname ou IP..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
          <span className="text-dark-500 text-sm">{filtrados.length} dispositivos</span>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum dispositivo encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Hostname</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">SO</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">CPU</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">RAM</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">IP</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((d: any) => (
                  <tr key={d.id} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
                    <td className="py-2.5 px-3"><Link href={`/portal/devices/${d.id}`} className="text-white font-medium hover:text-brand-400">{d.hostname}</Link></td>
                    <td className="py-2.5 px-3 text-dark-400 text-xs">{d.sistemaOperacional}</td>
                    <td className="py-2.5 px-3 text-dark-400 text-xs truncate max-w-[150px]">{d.cpu}</td>
                    <td className="py-2.5 px-3 text-dark-400 text-xs">{d.ramTotalMb ? `${Math.round(d.ramTotalMb / 1024)} GB` : '—'}</td>
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
