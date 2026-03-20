'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Monitor, MonitorOff, AlertTriangle, CheckCircle2,
  Ticket, MessageSquare, Building2, Activity, Shield, Users, Eye,
} from 'lucide-react'
import { devicesApi, alertsApi, ticketsApi, tenantsApi, techniciansApi } from '@/lib/api'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/stores/auth.store'

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const isFieldTechnician =
    user?.userType === 'technician' &&
    ['tecnico', 'tecnico_senior', 'visualizador'].includes(user?.role || '')
  const isSuperAdmin = user?.role === 'super_admin'

  if (isSuperAdmin) {
    return <DashboardSuperAdmin />
  }
  if (isFieldTechnician) {
    return <DashboardTechnician />
  }

  return <DashboardAdmin />
}

function DashboardTechnician() {
  const [clientes, setClientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    try {
      const { data } = await tenantsApi.listar()
      
      const clientesComStats = await Promise.all(
        data.map(async (cliente: any) => {
          try {
            const [ticketsRes, devicesRes, alertasRes] = await Promise.allSettled([
              ticketsApi.listar({ tenantId: cliente.id, limit: 100 }),
              devicesApi.listar({ tenantId: cliente.id }),
              alertsApi.listar({ tenantId: cliente.id, status: 'ativo' }),
            ])

            const tickets = ticketsRes.status === 'fulfilled' ? ticketsRes.value.data : []
            const devices = devicesRes.status === 'fulfilled' ? devicesRes.value.data : []
            const alertas = alertasRes.status === 'fulfilled' ? alertasRes.value.data : []

            return {
              ...cliente,
              ticketsAtivos: tickets.filter((t: any) => ['aberto', 'em_andamento'].includes(t.status)).length,
              totalDispositivos: devices.length,
              dispositivosOnline: devices.filter((d: any) => d.online).length,
              alertasAtivos: alertas.length,
            }
          } catch {
            return { ...cliente, ticketsAtivos: 0, totalDispositivos: 0, dispositivosOnline: 0, alertasAtivos: 0 }
          }
        })
      )

      setClientes(clientesComStats)
    } catch (err) {
      console.error('Erro ao carregar:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 text-sm mt-1">Panorama geral dos clientes</p>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-dark-400">Carregando...</div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Nenhum cliente encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map((cliente: any) => (
            <Link
              key={cliente.id}
              href={`/dashboard/clientes/${cliente.id}`}
              className="card hover:border-brand-600 transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
                    {cliente.nome}
                  </h3>
                  <p className="text-xs text-dark-400 mt-1">{cliente.cnpj}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-dark-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Ticket className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-dark-400">Tickets</span>
                  </div>
                  <p className="text-xl font-bold text-white">{cliente.ticketsAtivos}</p>
                </div>

                <div className="p-3 rounded-lg bg-dark-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Monitor className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-dark-400">Dispositivos</span>
                  </div>
                  <p className="text-xl font-bold text-white">
                    {cliente.dispositivosOnline}/{cliente.totalDispositivos}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-dark-900 col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-dark-400">Alertas Ativos</span>
                  </div>
                  <p className="text-xl font-bold text-white">{cliente.alertasAtivos}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardSuperAdmin() {
  const [empresas, setEmpresas] = useState(0)
  const [tecnicos, setTecnicos] = useState(0)
  const [resumo, setResumo] = useState({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [alertas, setAlertas] = useState({ ativos: 0, total: 0 })
  const [tickets, setTickets] = useState({ abertos: 0, emAtendimento: 0, total: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const { on } = useSocket('/chat')

  useEffect(() => {
    carregar()
    const interval = setInterval(carregar, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const unsubNotification = on('notification:new', () => carregar())
    const unsubTicketUpdated = on('ticket:updated', () => carregar())
    const unsubMessage = on('message:new', () => carregar())
    return () => {
      unsubNotification()
      unsubTicketUpdated()
      unsubMessage()
    }
  }, [on])

  const carregar = async () => {
    try {
      const [tenantsRes, techRes, resumoRes, alertasRes, devicesRes, ticketsRes] = await Promise.allSettled([
        tenantsApi.listar(),
        techniciansApi.contagem(),
        devicesApi.resumo(),
        alertsApi.contagem(),
        devicesApi.listar(),
        ticketsApi.contagem(),
      ])
      if (tenantsRes.status === 'fulfilled') {
        const d = tenantsRes.value.data
        setEmpresas(Array.isArray(d) ? d.length : 0)
      }
      if (techRes.status === 'fulfilled') {
        const c = techRes.value.data
        setTecnicos(typeof c?.total === 'number' ? c.total : typeof c?.ativos === 'number' ? c.ativos : 0)
      }
      if (resumoRes.status === 'fulfilled') setResumo(resumoRes.value.data)
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data)
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.data)
      if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value.data)
    } catch (err) {
      console.error('Erro ao carregar dashboard super admin:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-amber-400" />
            <h1 className="text-2xl font-bold text-white">Super Admin</h1>
          </div>
          <p className="text-dark-400 text-sm mt-1">
            Visão global da plataforma: empresas cadastradas, operações e segurança.
          </p>
        </div>
        <Link
          href="/dashboard/clients"
          className="btn-primary text-center sm:inline-block px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Nova empresa
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="Empresas" value={empresas} icon={Building2} color="emerald" subtitle="tenants" />
        <StatCard title="Técnicos Maginf" value={tecnicos} icon={Users} color="purple" subtitle="cadastrados" />
        <StatCard title="Dispositivos" value={resumo.total} icon={Monitor} color="brand" subtitle={`${resumo.online} online`} />
        <StatCard title="Alertas ativos" value={alertas.ativos} icon={AlertTriangle} color="amber" />
        <StatCard title="Tickets abertos" value={tickets.abertos} icon={Ticket} color="blue" />
        <StatCard title="Total tickets" value={tickets.total} icon={Activity} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Dispositivos (global)</h2>
            <Link href="/dashboard/devices" className="text-brand-400 hover:text-brand-300 text-sm">
              Ver todos →
            </Link>
          </div>
          {carregando ? (
            <div className="text-center py-12 text-dark-400">Carregando...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum dispositivo registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Hostname</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">IP</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">SO</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.slice(0, 8).map((device: any) => (
                    <tr key={device.id} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <Link href={`/dashboard/devices/${device.id}`} className="text-white hover:text-brand-400 font-medium">
                          {device.hostname}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs font-mono">{device.ipLocal}</td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs truncate max-w-[150px]">{device.sistemaOperacional}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={device.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Administração</h2>
          <div className="space-y-2">
            <Link
              href="/dashboard/clients"
              className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Empresas (cadastro)</p>
                <p className="text-xs text-dark-500">CNPJ, contrato, portal</p>
              </div>
            </Link>
            <Link
              href="/dashboard/clientes"
              className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Usuários do portal</p>
                <p className="text-xs text-dark-500">Acesso cliente ao parque / tickets</p>
              </div>
            </Link>
            <Link
              href="/dashboard/technicians"
              className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Técnicos Maginf</p>
                <p className="text-xs text-dark-500">Equipe interna</p>
              </div>
            </Link>
            <Link
              href="/dashboard/audit"
              className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Eye className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Auditoria</p>
                <p className="text-xs text-dark-500">Trilhas e conformidade</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardAdmin() {
  const [resumo, setResumo] = useState({ total: 0, online: 0, offline: 0, alerta: 0 })
  const [alertas, setAlertas] = useState({ ativos: 0, total: 0 })
  const [tickets, setTickets] = useState({ abertos: 0, emAtendimento: 0, total: 0 })
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const { on } = useSocket('/chat')

  useEffect(() => {
    carregarDados()
    const interval = setInterval(carregarDados, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const unsubNotification = on('notification:new', () => carregarDados())
    const unsubTicketUpdated = on('ticket:updated', () => carregarDados())
    const unsubMessage = on('message:new', () => carregarDados())
    return () => {
      unsubNotification()
      unsubTicketUpdated()
      unsubMessage()
    }
  }, [on])

  const carregarDados = async () => {
    try {
      const [resumoRes, alertasRes, devicesRes, ticketsRes] = await Promise.allSettled([
        devicesApi.resumo(),
        alertsApi.contagem(),
        devicesApi.listar(),
        ticketsApi.contagem(),
      ])
      if (resumoRes.status === 'fulfilled') setResumo(resumoRes.value.data)
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data)
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.data)
      if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value.data)
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 text-sm mt-1">Visão geral da infraestrutura e operações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Dispositivos" value={resumo.total} icon={Monitor} color="brand" subtitle={`${resumo.online} online`} />
        <StatCard title="Online" value={resumo.online} icon={CheckCircle2} color="emerald" />
        <StatCard title="Offline" value={resumo.offline} icon={MonitorOff} color="red" />
        <StatCard title="Alertas Ativos" value={alertas.ativos} icon={AlertTriangle} color="amber" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Tickets Abertos" value={tickets.abertos} icon={Ticket} color="blue" />
        <StatCard title="Em Atendimento" value={tickets.emAtendimento} icon={MessageSquare} color="purple" />
        <StatCard title="Total Tickets" value={tickets.total} icon={Activity} color="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Dispositivos</h2>
            <Link href="/dashboard/devices" className="text-brand-400 hover:text-brand-300 text-sm">Ver todos →</Link>
          </div>

          {carregando ? (
            <div className="text-center py-12 text-dark-400">Carregando...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum dispositivo registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Hostname</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">IP</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">SO</th>
                    <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.slice(0, 8).map((device: any) => (
                    <tr key={device.id} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <Link href={`/dashboard/devices/${device.id}`} className="text-white hover:text-brand-400 font-medium">
                          {device.hostname}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs font-mono">{device.ipLocal}</td>
                      <td className="py-2.5 px-3 text-dark-400 text-xs truncate max-w-[150px]">{device.sistemaOperacional}</td>
                      <td className="py-2.5 px-3"><StatusBadge status={device.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Ações Rápidas</h2>
          </div>
          <div className="space-y-2">
            <Link href="/dashboard/tickets" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Ticket className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Novo Ticket</p>
                <p className="text-xs text-dark-500">Abrir chamado de suporte</p>
              </div>
            </Link>
            <Link href="/dashboard/devices" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <Monitor className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Dispositivos</p>
                <p className="text-xs text-dark-500">Gerenciar parque</p>
              </div>
            </Link>
            <Link href="/dashboard/clients" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Empresas</p>
                <p className="text-xs text-dark-500">Cadastro empresarial e portal</p>
              </div>
            </Link>
            <Link href="/dashboard/clientes" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Usuários do portal</p>
                <p className="text-xs text-dark-500">Acesso cliente</p>
              </div>
            </Link>
            <Link href="/dashboard/reports" className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-dark-200 group-hover:text-white">Relatórios</p>
                <p className="text-xs text-dark-500">Resumo executivo</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
