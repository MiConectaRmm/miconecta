'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Monitor, Cpu, HardDrive, MemoryStick,
  Globe, Clock, Wifi, Shield, Terminal,
} from 'lucide-react'
import { devicesApi, metricsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'

export default function DeviceDetailPage() {
  const { id } = useParams() as { id: string }
  const [device, setDevice] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
    const interval = setInterval(() => carregarMetricas(), 30000)
    return () => clearInterval(interval)
  }, [id])

  const carregar = async () => {
    try {
      const [deviceRes] = await Promise.all([devicesApi.buscar(id)])
      setDevice(deviceRes.data)
      carregarMetricas()
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  const carregarMetricas = async () => {
    try {
      const res = await metricsApi.ultima(id)
      setMetrics(res.data)
    } catch {}
  }

  if (carregando) {
    return <div className="text-center py-12 text-dark-400">Carregando...</div>
  }

  if (!device) {
    return <div className="text-center py-12 text-dark-400">Dispositivo não encontrado</div>
  }

  const infoItems = [
    { label: 'Hostname', value: device.hostname, icon: Monitor },
    { label: 'Sistema Operacional', value: device.sistemaOperacional || device.versaoWindows, icon: Monitor },
    { label: 'CPU', value: device.cpu, icon: Cpu },
    { label: 'RAM Total', value: device.ramTotalMb ? `${Math.round(device.ramTotalMb / 1024)} GB` : '—', icon: MemoryStick },
    { label: 'Disco Total', value: device.discoTotalMb ? `${Math.round(device.discoTotalMb / 1024)} GB` : '—', icon: HardDrive },
    { label: 'IP Local', value: device.ipLocal, icon: Wifi },
    { label: 'IP Externo', value: device.ipExterno, icon: Globe },
    { label: 'Modelo', value: device.modeloMaquina, icon: Monitor },
    { label: 'Nº Série', value: device.numeroSerie, icon: Shield },
    { label: 'Agente', value: device.agentVersion, icon: Terminal },
    { label: 'Última Comunicação', value: device.lastSeen ? new Date(device.lastSeen).toLocaleString('pt-BR') : '—', icon: Clock },
  ]

  return (
    <div>
      <Link href="/dashboard/devices" className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar para dispositivos
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center">
            <Monitor className="w-7 h-7 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{device.hostname}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusBadge status={device.status} />
              <span className="text-dark-500 text-sm">{device.ipLocal}</span>
            </div>
          </div>
        </div>
        {device.rustdeskId && (
          <button
            onClick={() => window.open(`rustdesk://connection/new/${device.rustdeskId}`, '_blank')}
            className="btn-primary"
          >
            Acesso Remoto
          </button>
        )}
      </div>

      {/* Métricas em tempo real */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricGauge label="CPU" value={metrics.cpuPercent} unit="%" color="brand" />
          <MetricGauge label="RAM" value={metrics.ramPercent} unit="%" color="blue" />
          <MetricGauge label="Disco" value={metrics.discoPercent} unit="%" color="amber" />
          <MetricGauge label="Uptime" value={metrics.uptimeSegundos ? Math.floor(metrics.uptimeSegundos / 3600) : 0} unit="h" color="emerald" />
        </div>
      )}

      {/* Informações do dispositivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Informações</h2>
          <div className="space-y-3">
            {infoItems.map(item => {
              if (!item.value) return null
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-dark-500" />
                    <span className="text-dark-400 text-sm">{item.label}</span>
                  </div>
                  <span className="text-dark-200 text-sm font-medium">{item.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Segurança</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-dark-800">
              <span className="text-dark-400 text-sm">Antivírus</span>
              <span className="text-dark-200 text-sm">{device.antivirusNome || 'Não detectado'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-800">
              <span className="text-dark-400 text-sm">Status Antivírus</span>
              <span className="text-dark-200 text-sm">{device.antivirusStatus || '—'}</span>
            </div>
            {device.tags && device.tags.length > 0 && (
              <div className="pt-2">
                <span className="text-dark-400 text-sm">Tags</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {device.tags.map((tag: string) => (
                    <span key={tag} className="bg-dark-700 text-dark-300 px-2 py-0.5 rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricGauge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const colorMap: Record<string, string> = {
    brand: 'text-brand-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
  }
  const bgMap: Record<string, string> = {
    brand: 'bg-brand-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }
  const pct = unit === '%' ? Math.min(value, 100) : 100

  return (
    <div className="card text-center">
      <p className="text-dark-500 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>
        {Math.round(value)}<span className="text-sm font-normal ml-0.5">{unit}</span>
      </p>
      {unit === '%' && (
        <div className="w-full h-1.5 bg-dark-700 rounded-full mt-2">
          <div
            className={`h-full rounded-full ${bgMap[color]} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
