'use client'

import { useEffect, useState } from 'react'
import {
  Monitor, MonitorOff, AlertTriangle, CheckCircle2,
  Cpu, HardDrive, MemoryStick, Activity,
} from 'lucide-react'
import { devicesApi, alertsApi } from '@/lib/api'

interface Resumo {
  total: number
  online: number
  offline: number
  alerta: number
}

interface ContagemAlertas {
  ativos: number
  total: number
}

export default function DashboardPage() {
  const [resumo, setResumo] = useState<Resumo>({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [alertas, setAlertas] = useState<ContagemAlertas>({ ativos: 0, total: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarDados()
    const interval = setInterval(carregarDados, 30000)
    return () => clearInterval(interval)
  }, [])

  const carregarDados = async () => {
    try {
      const [resumoRes, alertasRes, devicesRes] = await Promise.all([
        devicesApi.resumo(),
        alertsApi.contagem(),
        devicesApi.listar(),
      ])
      setResumo(resumoRes.data)
      setAlertas(alertasRes.data)
      setDevices(devicesRes.data)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setCarregando(false)
    }
  }

  const cards = [
    {
      titulo: 'Total de Dispositivos',
      valor: resumo.total,
      icon: Monitor,
      cor: 'text-brand-400',
      bg: 'bg-brand-500/10',
    },
    {
      titulo: 'Online',
      valor: resumo.online,
      icon: CheckCircle2,
      cor: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      titulo: 'Offline',
      valor: resumo.offline,
      icon: MonitorOff,
      cor: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      titulo: 'Alertas Ativos',
      valor: alertas.ativos,
      icon: AlertTriangle,
      cor: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 mt-1">Visão geral da infraestrutura</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.titulo} className="card flex items-center gap-4">
              <div className={`w-12 h-12 ${card.bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${card.cor}`} />
              </div>
              <div>
                <p className="text-dark-400 text-sm">{card.titulo}</p>
                <p className="text-2xl font-bold text-white">{card.valor}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Lista de Dispositivos */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Dispositivos Recentes</h2>
          <a href="/dashboard/devices" className="text-brand-400 hover:text-brand-300 text-sm font-medium">
            Ver todos →
          </a>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : devices.length === 0 ? (
          <div className="text-center py-12">
            <Monitor className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum dispositivo registrado</p>
            <p className="text-dark-500 text-sm mt-1">Instale o agente MIConectaRMM nos dispositivos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Hostname</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">IP</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">SO</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-dark-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {devices.slice(0, 10).map((device: any) => (
                  <tr key={device.id} className="border-b border-dark-800 hover:bg-dark-800/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4 text-dark-400" />
                        <span className="text-white font-medium">{device.hostname}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-dark-300">{device.ipLocal}</td>
                    <td className="py-3 px-4 text-dark-300 truncate max-w-[200px]">{device.versaoWindows || device.sistemaOperacional}</td>
                    <td className="py-3 px-4">
                      <span className={
                        device.status === 'online' ? 'badge-online' :
                        device.status === 'alerta' ? 'badge-alerta' : 'badge-offline'
                      }>
                        {device.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/dashboard/devices/${device.id}`}
                          className="text-brand-400 hover:text-brand-300 text-xs font-medium"
                        >
                          Detalhes
                        </a>
                        {device.rustdeskId && (
                          <button
                            onClick={() => window.open(`rustdesk://connection/new/${device.rustdeskId}`, '_blank')}
                            className="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                          >
                            CONECTAR
                          </button>
                        )}
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
