'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Monitor, Cpu, HardDrive, Wifi, Clock, AlertTriangle, Package } from 'lucide-react'
import { devicesApi, metricsApi, alertsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'

export default function PortalDeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [device, setDevice] = useState<any>(null)
  const [inventario, setInventario] = useState<any[]>([])
  const [metricas, setMetricas] = useState<any>(null)
  const [alertas, setAlertas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tab, setTab] = useState<'info' | 'inventario' | 'alertas'>('info')

  useEffect(() => {
    if (!id) return
    Promise.allSettled([
      devicesApi.buscar(id),
      devicesApi.inventario(id),
      metricsApi.ultima(id),
      alertsApi.listar({ deviceId: id, limit: 20 }),
    ]).then(([dRes, iRes, mRes, aRes]) => {
      if (dRes.status === 'fulfilled') setDevice(dRes.value.data)
      if (iRes.status === 'fulfilled') setInventario(iRes.value.data || [])
      if (mRes.status === 'fulfilled') setMetricas(mRes.value.data)
      if (aRes.status === 'fulfilled') setAlertas(Array.isArray(aRes.value.data) ? aRes.value.data : [])
    }).finally(() => setCarregando(false))
  }, [id])

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando...</div>
  if (!device) return <div className="text-center py-12 text-dark-400">Dispositivo não encontrado</div>

  const tabs = [
    { key: 'info', label: 'Informações' },
    { key: 'inventario', label: `Inventário (${inventario.length})` },
    { key: 'alertas', label: `Alertas (${alertas.length})` },
  ]

  return (
    <div>
      <Link href="/portal/devices" className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Inventário
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center">
          <Monitor className="w-6 h-6 text-brand-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{device.hostname}</h1>
          <p className="text-dark-400 text-sm">{device.sistemaOperacional} · {device.ipLocal}</p>
        </div>
        <StatusBadge status={device.status} />
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-brand-500/20 text-brand-400' : 'text-dark-400 hover:bg-dark-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-white font-semibold mb-4">Hardware</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-dark-400">CPU</span><span className="text-white">{device.cpu || '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">RAM</span><span className="text-white">{device.ramTotalMb ? `${Math.round(device.ramTotalMb / 1024)} GB` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Disco Total</span><span className="text-white">{device.discoTotalGb ? `${device.discoTotalGb} GB` : '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">IP Local</span><span className="text-white font-mono">{device.ipLocal || '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">IP Externo</span><span className="text-white font-mono">{device.ipExterno || '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">MAC</span><span className="text-white font-mono">{device.macAddress || '—'}</span></div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-white font-semibold mb-4">Status</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-dark-400">Status</span><StatusBadge status={device.status} /></div>
              <div className="flex justify-between"><span className="text-dark-400">Último Heartbeat</span><span className="text-white">{device.lastSeen ? new Date(device.lastSeen).toLocaleString('pt-BR') : '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Versão Agente</span><span className="text-white">{device.agenteVersao || '—'}</span></div>
              <div className="flex justify-between"><span className="text-dark-400">Domínio</span><span className="text-white">{device.dominio || '—'}</span></div>
            </div>
          </div>

          {metricas && (
            <div className="card md:col-span-2">
              <h3 className="text-white font-semibold mb-4">Métricas Recentes</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-dark-900 rounded-lg text-center">
                  <Cpu className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{metricas.cpuPercent?.toFixed(0)}%</p>
                  <p className="text-dark-500 text-xs">CPU</p>
                </div>
                <div className="p-3 bg-dark-900 rounded-lg text-center">
                  <HardDrive className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{metricas.ramPercent?.toFixed(0)}%</p>
                  <p className="text-dark-500 text-xs">RAM</p>
                </div>
                <div className="p-3 bg-dark-900 rounded-lg text-center">
                  <HardDrive className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{metricas.discoPercent?.toFixed(0)}%</p>
                  <p className="text-dark-500 text-xs">Disco</p>
                </div>
                <div className="p-3 bg-dark-900 rounded-lg text-center">
                  <Clock className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-white">{metricas.uptimeSegundos ? Math.round(metricas.uptimeSegundos / 3600) + 'h' : '—'}</p>
                  <p className="text-dark-500 text-xs">Uptime</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'inventario' && (
        <div className="card">
          {inventario.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum item no inventário</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Nome</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Versão</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Tipo</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Fabricante</th>
                  </tr>
                </thead>
                <tbody>
                  {inventario.map((item: any) => (
                    <tr key={item.id} className="border-b border-dark-800/50">
                      <td className="py-2.5 px-3 text-white">{item.nome}</td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs">{item.versao || '—'}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={item.tipo} /></td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs">{item.fabricante || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'alertas' && (
        <div className="card">
          {alertas.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum alerta</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alertas.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-900">
                  <div>
                    <p className="text-white text-sm font-medium">{a.titulo}</p>
                    <p className="text-dark-500 text-xs mt-0.5">{new Date(a.criadoEm).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.severidade} />
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
