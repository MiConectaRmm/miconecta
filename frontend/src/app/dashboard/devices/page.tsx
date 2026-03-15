'use client'

import { useEffect, useState } from 'react'
import { Monitor, Search, Filter, Plus, ExternalLink } from 'lucide-react'
import { devicesApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarDispositivos()
    const interval = setInterval(carregarDispositivos, 15000)
    return () => clearInterval(interval)
  }, [filtroStatus])

  const carregarDispositivos = async () => {
    try {
      const params: any = {}
      if (filtroStatus) params.status = filtroStatus
      if (busca) params.busca = busca
      const { data } = await devicesApi.listar(params)
      setDevices(data)
    } catch (err) {
      console.error('Erro ao carregar dispositivos:', err)
    } finally {
      setCarregando(false)
    }
  }

  const conectarRustDesk = (rustdeskId: string) => {
    window.open(`rustdesk://connection/new/${rustdeskId}`, '_blank')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispositivos</h1>
          <p className="text-dark-400 mt-1">{devices.length} dispositivos registrados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarDispositivos()}
              placeholder="Buscar por hostname ou IP..."
              className="input w-full pl-10"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="input"
          >
            <option value="">Todos os status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="alerta">Alerta</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando dispositivos...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Hostname</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Organização</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">IP Local</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">SO</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">CPU</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">RAM</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Último Contato</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device: any) => (
                  <tr key={device.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <a href={`/dashboard/devices/${device.id}`} className="flex items-center gap-2 text-white font-medium hover:text-brand-400">
                        <Monitor className="w-4 h-4 text-dark-400" />
                        {device.hostname}
                      </a>
                    </td>
                    <td className="py-3 px-4 text-dark-300">{device.organization?.nome || '-'}</td>
                    <td className="py-3 px-4 text-dark-300 font-mono text-xs">{device.ipLocal}</td>
                    <td className="py-3 px-4 text-dark-300 truncate max-w-[180px]">{device.versaoWindows || '-'}</td>
                    <td className="py-3 px-4 text-dark-300 truncate max-w-[150px]">{device.cpu || '-'}</td>
                    <td className="py-3 px-4 text-dark-300">{device.ramTotalMb ? `${Math.round(device.ramTotalMb / 1024)} GB` : '-'}</td>
                    <td className="py-3 px-4">
                      <span className={
                        device.status === 'online' ? 'badge-online' :
                        device.status === 'alerta' ? 'badge-alerta' : 'badge-offline'
                      }>
                        {device.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-dark-400 text-xs">{device.lastSeen ? timeAgo(device.lastSeen) : 'Nunca'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {device.rustdeskId && (
                          <button
                            onClick={() => conectarRustDesk(device.rustdeskId)}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
                          >
                            CONECTAR
                          </button>
                        )}
                        <a
                          href={`/dashboard/devices/${device.id}`}
                          className="text-dark-400 hover:text-brand-400 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
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
