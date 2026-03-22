'use client'

import { useEffect, useState } from 'react'
import { Monitor, Search, Plus, ExternalLink, Download, Cpu, MemoryStick, HardDrive, RefreshCw } from 'lucide-react'
import { devicesApi, agentsApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import Link from 'next/link'

function MiniBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.min(Math.max(value || 0, 0), 100)
  const bg = color === 'red' ? 'bg-red-500' : color === 'amber' ? 'bg-amber-500' : 'bg-brand-500'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono w-8 text-right text-dark-300">{Math.round(clamped)}%</span>
      <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bg}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<any[]>([])
  const [resumo, setResumo] = useState<any>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [baixandoScript, setBaixandoScript] = useState(false)

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
      const [devRes, resumoRes] = await Promise.all([
        devicesApi.listar(params),
        devicesApi.resumo(),
      ])
      setDevices(Array.isArray(devRes.data) ? devRes.data : [])
      setResumo(resumoRes.data)
    } catch (err) {
      console.error('Erro ao carregar dispositivos:', err)
    } finally {
      setCarregando(false)
    }
  }

  const conectarRustDesk = (rustdeskId: string) => {
    window.open(`rustdesk://connection/new/${rustdeskId}`, '_blank')
  }

  const baixarScriptInstalacao = async () => {
    setBaixandoScript(true)
    try {
      const infoRes = await agentsApi.downloadInfo()
      const tenantId = infoRes.data.tenantId
      if (!tenantId) { alert('Tenant não identificado'); return }
      const scriptRes = await agentsApi.installScript(tenantId, 'ps1')
      const { filename, content } = scriptRes.data
      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erro ao baixar script:', err)
      alert('Erro ao gerar script de instalação')
    } finally {
      setBaixandoScript(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispositivos</h1>
          <p className="text-dark-400 mt-1">{devices.length} dispositivos registrados</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={carregarDispositivos}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={baixarScriptInstalacao}
            disabled={baixandoScript}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            {baixandoScript ? 'Gerando...' : 'Script de Instalação'}
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="card text-center">
            <p className="text-3xl font-bold text-white">{resumo.total ?? 0}</p>
            <p className="text-dark-400 text-sm mt-1">Total</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-emerald-400">{resumo.online ?? 0}</p>
            <p className="text-dark-400 text-sm mt-1">Online</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-red-400">{resumo.offline ?? 0}</p>
            <p className="text-dark-400 text-sm mt-1">Offline</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-amber-400">{resumo.alerta ?? 0}</p>
            <p className="text-dark-400 text-sm mt-1">Alerta</p>
          </div>
        </div>
      )}

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
        ) : devices.length === 0 ? (
          <div className="text-center py-16">
            <Monitor className="w-12 h-12 text-dark-600 mx-auto mb-4" />
            <p className="text-dark-400 text-lg font-medium">Nenhum dispositivo registrado</p>
            <p className="text-dark-500 text-sm mt-2">Baixe o script de instalação e execute nos dispositivos do cliente</p>
            <button
              onClick={baixarScriptInstalacao}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar Script de Instalação
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Hostname</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">IP Local</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">SO</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">
                    <div className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" />CPU</div>
                  </th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">
                    <div className="flex items-center gap-1"><MemoryStick className="w-3.5 h-3.5" />RAM</div>
                  </th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">
                    <div className="flex items-center gap-1"><HardDrive className="w-3.5 h-3.5" />Disco</div>
                  </th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Último Contato</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device: any) => {
                  const m = device.ultimaMetrica
                  const cpuHigh = m?.cpuPercent >= 90
                  const ramHigh = m?.ramPercent >= 90
                  return (
                    <tr key={device.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link href={`/dashboard/devices/${device.id}`} className="flex items-center gap-2 text-white font-medium hover:text-brand-400">
                          <Monitor className="w-4 h-4 text-dark-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{device.hostname}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-dark-300 font-mono text-xs">{device.ipLocal || '—'}</td>
                      <td className="py-3 px-4 text-dark-300 truncate max-w-[160px] text-xs">{device.versaoWindows || device.sistemaOperacional || '—'}</td>
                      <td className="py-3 px-4">
                        {m ? <MiniBar value={m.cpuPercent} color={cpuHigh ? 'red' : 'brand'} /> : <span className="text-dark-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {m ? <MiniBar value={m.ramPercent} color={ramHigh ? 'red' : 'brand'} /> : <span className="text-dark-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        {m ? <MiniBar value={m.discoPercent} color={m.discoPercent >= 90 ? 'red' : m.discoPercent >= 70 ? 'amber' : 'brand'} /> : <span className="text-dark-600 text-xs">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={
                          device.status === 'online' ? 'badge-online' :
                          device.status === 'alerta' ? 'badge-alerta' : 'badge-offline'
                        }>
                          {device.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-dark-400 text-xs whitespace-nowrap">{device.lastSeen ? timeAgo(device.lastSeen) : 'Nunca'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {device.rustdeskId && (
                            <button
                              onClick={() => conectarRustDesk(device.rustdeskId)}
                              className="bg-brand-500 hover:bg-brand-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors whitespace-nowrap"
                            >
                              CONECTAR
                            </button>
                          )}
                          <Link
                            href={`/dashboard/devices/${device.id}`}
                            className="text-dark-400 hover:text-brand-400 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
