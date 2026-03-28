'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Building2, Monitor, MonitorOff, AlertTriangle, CheckCircle2,
  ArrowRight, Activity, TrendingUp, Clock, RefreshCw,
} from 'lucide-react'
import { devicesApi, alertsApi, ticketsApi, tenantsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'

interface ClientCard {
  id: string
  nome: string
  dispositivos: number
  online: number
  offline: number
  alertas: number
  ticketsAbertos: number
  status: 'ok' | 'atencao' | 'critico'
  ultimaAtividade?: string
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const router = useRouter()

  const [clientes, setClientes] = useState<ClientCard[]>([])
  const [resumoGeral, setResumoGeral] = useState({ dispositivos: 0, online: 0, offline: 0, alertas: 0 })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 45000)
    return () => clearInterval(interval)
  }, [])

  const carregar = async () => {
    try {
      const [tenantsRes, resumoRes, alertasRes] = await Promise.allSettled([
        tenantsApi.listar(),
        devicesApi.resumo(),
        alertsApi.contagem(),
      ])

      if (resumoRes.status === 'fulfilled') {
        const r = resumoRes.value.data
        setResumoGeral({
          dispositivos: r.total || 0,
          online: r.online || 0,
          offline: r.offline || 0,
          alertas: 0,
        })
      }
      
      if (alertasRes.status === 'fulfilled') {
        setResumoGeral(prev => ({ ...prev, alertas: alertasRes.value.data.ativos || 0 }))
      }

      if (tenantsRes.status === 'fulfilled') {
        const tenants = Array.isArray(tenantsRes.value.data) 
          ? tenantsRes.value.data 
          : tenantsRes.value.data?.items || []

        const clienteStats = await Promise.all(
          tenants.slice(0, 50).map(async (t: any) => {
            const [devRes, alertRes, tickRes] = await Promise.allSettled([
              devicesApi.listar({ tenantId: t.id }),
              alertsApi.listar({ tenantId: t.id, status: 'ativo' }),
              ticketsApi.listar({ tenantId: t.id, status: 'aberto', limit: 100 }),
            ])

            const devs = devRes.status === 'fulfilled' 
              ? (Array.isArray(devRes.value.data) ? devRes.value.data : devRes.value.data?.items || [])
              : []
            const alts = alertRes.status === 'fulfilled'
              ? (Array.isArray(alertRes.value.data) ? alertRes.value.data : alertRes.value.data?.items || [])
              : []
            const tks = tickRes.status === 'fulfilled'
              ? (Array.isArray(tickRes.value.data) ? tickRes.value.data : tickRes.value.data?.items || [])
              : []

            const online = devs.filter((d: any) => d.status === 'online' || d.online).length
            const offline = devs.length - online
            const alertasAtivos = alts.length
            const ticketsAbertos = tks.length

            let status: 'ok' | 'atencao' | 'critico' = 'ok'
            if (offline > 0 || alertasAtivos > 0 || ticketsAbertos > 0) status = 'atencao'
            if (offline > devs.length * 0.3 || alertasAtivos > 2 || ticketsAbertos > 3) status = 'critico'

            return {
              id: t.id,
              nome: t.nomeFantasia || t.razaoSocial || t.nome || 'Cliente',
              dispositivos: devs.length,
              online,
              offline,
              alertas: alertasAtivos,
              ticketsAbertos,
              status,
              ultimaAtividade: devs[0]?.ultimaConexao,
            }
          })
        )

        clienteStats.sort((a, b) => {
          const ordem: Record<'critico' | 'atencao' | 'ok', number> = { critico: 0, atencao: 1, ok: 2 }
          return (ordem[a.status as keyof typeof ordem] ?? 2) - (ordem[b.status as keyof typeof ordem] ?? 2)
        })

        setClientes(clienteStats)
      }
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setCarregando(false)
    }
  }

  const statusStyles = {
    ok: { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    atencao: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    critico: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Olá, {user?.nome?.split(' ')[0] || 'Admin'}
          </h1>
          <p className="text-gray-600 mt-1">
            Visão geral dos seus clientes
          </p>
        </div>
        <button
          onClick={() => { setCarregando(true); carregar() }}
          disabled={carregando}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <Monitor className="w-5 h-5 text-brand-500" />
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{resumoGeral.dispositivos}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Dispositivos</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{resumoGeral.online}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Online</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <MonitorOff className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{resumoGeral.offline}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Offline</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-800">{resumoGeral.alertas}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Alertas ativos</p>
        </div>
      </div>

      {/* Título da seção */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Seus Clientes</h2>
        <p className="text-sm text-gray-500 mt-1">
          {clientes.length} {clientes.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
        </p>
      </div>

      {/* Grid de clientes */}
      {carregando ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : clientes.length === 0 ? (
        <div className="card text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Nenhum cliente cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clientes.map((cliente) => {
            const style = statusStyles[cliente.status]
            return (
              <Link
                key={cliente.id}
                href={`/dashboard/clients/${cliente.id}`}
                className="card hover:shadow-md hover:border-brand-200 transition-all group cursor-pointer"
              >
                {/* Header do card */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-800 truncate group-hover:text-brand-600 transition-colors">
                      {cliente.nome}
                    </h3>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${style.dot} flex-shrink-0 mt-1.5`} />
                </div>

                {/* Indicadores */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <Monitor className="w-4 h-4" />
                      Dispositivos
                    </span>
                    <span className="font-semibold text-gray-800">{cliente.dispositivos}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Online
                    </span>
                    <span className="font-semibold text-green-600">{cliente.online}</span>
                  </div>

                  {cliente.offline > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <MonitorOff className="w-4 h-4 text-red-500" />
                        Offline
                      </span>
                      <span className="font-semibold text-red-600">{cliente.offline}</span>
                    </div>
                  )}

                  {cliente.alertas > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Alertas
                      </span>
                      <span className="font-semibold text-amber-600">{cliente.alertas}</span>
                    </div>
                  )}

                  {cliente.ticketsAbertos > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-blue-500" />
                        Tickets
                      </span>
                      <span className="font-semibold text-blue-600">{cliente.ticketsAbertos}</span>
                    </div>
                  )}
                </div>

                {/* Footer com status */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
                    {cliente.status === 'ok' ? 'OK' : cliente.status === 'atencao' ? 'Atenção' : 'Crítico'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Footer com auto-refresh */}
      <p className="text-center text-xs text-gray-400 mt-8">
        Atualização automática a cada 45 segundos
      </p>
    </div>
  )
}
