'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, Loader2, AlertCircle, Monitor, Server,
  MonitorOff, CheckCircle2, MessageSquare, Ticket, MonitorPlay,
  AlertTriangle, Cpu, HardDrive, Activity, Download, FileCode2, Terminal, Copy, Check,
} from 'lucide-react'
import { tenantsApi, devicesApi, alertsApi, ticketsApi, conversationsApi, agentsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { AGENT_MSI_DOWNLOAD_URL } from '@/lib/public-config'

interface Device {
  id: string
  hostname: string
  status: string
  osName?: string
  cpuUsage?: number
  ramUsed?: number
  ramTotal?: number
  diskUsage?: number
  rustdeskId?: string
  alertsCount?: number
  isServer?: boolean
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const id = params.id as string

  const [tenant, setTenant] = useState<any>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pcs' | 'servers'>('all')
  const [creatingTicket, setCreatingTicket] = useState<string | null>(null)
  const [creatingChat, setCreatingChat] = useState<string | null>(null)
  const [downloadingScript, setDownloadingScript] = useState<'bat' | 'ps1' | null>(null)
  const [copied, setCopied] = useState(false)

  const [kpis, setKpis] = useState({
    totalPCs: 0,
    totalServers: 0,
    online: 0,
    offline: 0,
    alertas: 0,
  })

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tenantRes, devicesRes, alertsRes] = await Promise.allSettled([
        tenantsApi.buscar(id),
        devicesApi.listar({ tenantId: id }),
        alertsApi.listar({ tenantId: id, status: 'ativo' }),
      ])

      if (tenantRes.status === 'fulfilled') {
        setTenant(tenantRes.value.data)
      }

      if (devicesRes.status === 'fulfilled') {
        const devs: Device[] = Array.isArray(devicesRes.value.data)
          ? devicesRes.value.data
          : devicesRes.value.data?.items || []

        const enriched = devs.map((d: any) => ({
          id: d.id,
          hostname: d.hostname || 'Sem nome',
          status: d.status || 'offline',
          osName: d.osName,
          cpuUsage: d.cpuUsage,
          ramUsed: d.ramUsed,
          ramTotal: d.ramTotal,
          diskUsage: d.diskUsage,
          rustdeskId: d.rustdeskId,
          isServer: d.osName?.toLowerCase().includes('server'),
          alertsCount: 0,
        }))

        setDevices(enriched)

        const totalPCs = enriched.filter(d => !d.isServer).length
        const totalServers = enriched.filter(d => d.isServer).length
        const online = enriched.filter(d => d.status === 'online').length
        const offline = enriched.length - online

        setKpis({ totalPCs, totalServers, online, offline, alertas: 0 })
      }

      if (alertsRes.status === 'fulfilled') {
        const alts = Array.isArray(alertsRes.value.data)
          ? alertsRes.value.data
          : alertsRes.value.data?.items || []
        setKpis(prev => ({ ...prev, alertas: alts.length }))
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar cliente')
    } finally {
      setLoading(false)
    }
  }

  const handleChat = async (device: Device) => {
    setCreatingChat(device.id)
    try {
      const { data } = await conversationsApi.criar({
        titulo: `Chat - ${device.hostname}`,
        deviceId: device.id,
      })
      router.push(`/dashboard/chat?conversation=${data.id}`)
    } catch (err) {
      alert('Erro ao criar conversa')
    } finally {
      setCreatingChat(null)
    }
  }

  const handleTicket = async (device: Device) => {
    setCreatingTicket(device.id)
    try {
      const { data } = await ticketsApi.criar({
        titulo: `Suporte - ${device.hostname}`,
        descricao: `Ticket criado para ${device.hostname}`,
        deviceId: device.id,
        origem: 'painel',
      })
      router.push(`/dashboard/chat?ticket=${data.id}`)
    } catch (err) {
      alert('Erro ao criar ticket')
    } finally {
      setCreatingTicket(null)
    }
  }

  const handleConectar = (device: Device) => {
    if (!device.rustdeskId) {
      alert('RustDesk ID não configurado neste dispositivo')
      return
    }
    if (device.status !== 'online') {
      if (!confirm('Dispositivo pode estar offline. Tentar conectar mesmo assim?')) return
    }
    window.open(`rustdesk://connection/new/${device.rustdeskId}`, '_blank')
  }

  const downloadScript = async (format: 'bat' | 'ps1') => {
    setDownloadingScript(format)
    try {
      const res = await agentsApi.installScript(id, format)
      const blob = new Blob([res.data.content], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Erro ao gerar script')
    } finally {
      setDownloadingScript(null)
    }
  }

  const copyMsiUrl = () => {
    navigator.clipboard.writeText(AGENT_MSI_DOWNLOAD_URL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (error || !tenant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-red-600">{error || 'Cliente não encontrado'}</p>
        <button onClick={() => router.push('/dashboard')} className="btn-primary">
          Voltar
        </button>
      </div>
    )
  }

  const filteredDevices = devices.filter(d => {
    if (filter === 'pcs') return !d.isServer
    if (filter === 'servers') return d.isServer
    return true
  })

  return (
    <div>
      {/* Breadcrumb + Nome */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{tenant.nome}</h1>
          <p className="text-sm text-gray-500">Parque tecnológico</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PCs</p>
          <p className="text-2xl font-bold text-gray-800">{kpis.totalPCs}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Servidores</p>
          <p className="text-2xl font-bold text-gray-800">{kpis.totalServers}</p>
        </div>
        <div className="card bg-green-50 border-green-200">
          <p className="text-xs text-green-700 uppercase tracking-wide mb-1">Online</p>
          <p className="text-2xl font-bold text-green-700">{kpis.online}</p>
        </div>
        <div className="card bg-red-50 border-red-200">
          <p className="text-xs text-red-700 uppercase tracking-wide mb-1">Offline</p>
          <p className="text-2xl font-bold text-red-700">{kpis.offline}</p>
        </div>
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-xs text-amber-700 uppercase tracking-wide mb-1">Alertas</p>
          <p className="text-2xl font-bold text-amber-700">{kpis.alertas}</p>
        </div>
      </div>

      {/* Seção Download Agente */}
      <div className="card bg-gradient-to-r from-brand-50 to-purple-50 border-brand-200 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Instalar Agente</h3>
            <p className="text-sm text-gray-600">
              Scripts personalizados para instalar o agente nos dispositivos deste cliente
            </p>
          </div>
          <Download className="w-6 h-6 text-brand-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => downloadScript('bat')}
            disabled={downloadingScript === 'bat'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            {downloadingScript === 'bat' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Terminal className="w-4 h-4 text-amber-600" />
            )}
            Script .BAT (CMD)
          </button>

          <button
            onClick={() => downloadScript('ps1')}
            disabled={downloadingScript === 'ps1'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-brand-300 hover:bg-brand-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50"
          >
            {downloadingScript === 'ps1' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCode2 className="w-4 h-4 text-blue-600" />
            )}
            Script .PS1 (PowerShell)
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>MSI Oficial:</span>
          <code className="px-2 py-1 bg-white rounded text-brand-600 font-mono text-[10px]">
            {AGENT_MSI_DOWNLOAD_URL}
          </code>
          <button
            onClick={copyMsiUrl}
            className="p-1 hover:bg-white rounded transition-colors"
            title="Copiar URL"
          >
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-500" />}
          </button>
        </div>
      </div>

      {/* Filtro Computadores/Servidores */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Todos ({devices.length})
          </button>
          <button
            onClick={() => setFilter('pcs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pcs'
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Monitor className="w-4 h-4 inline mr-1.5" />
            Computadores ({kpis.totalPCs})
          </button>
          <button
            onClick={() => setFilter('servers')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'servers'
                ? 'bg-brand-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Server className="w-4 h-4 inline mr-1.5" />
            Servidores ({kpis.totalServers})
          </button>
        </div>
      </div>

      {/* Grid de máquinas */}
      {filteredDevices.length === 0 ? (
        <div className="card text-center py-12">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Nenhum dispositivo encontrado</p>
          <p className="text-sm text-gray-500 mt-1">
            Instale o agente usando os scripts acima
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDevices.map((device) => (
            <div key={device.id} className="card hover:shadow-md transition-all">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {device.isServer ? (
                    <Server className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  ) : (
                    <Monitor className="w-5 h-5 text-brand-500 flex-shrink-0" />
                  )}
                  <h3 className="text-sm font-semibold text-gray-800 truncate">
                    {device.hostname}
                  </h3>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
                  device.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                }`} />
              </div>

              {/* Status e OS */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  device.status === 'online'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {device.status === 'online' ? 'Online' : 'Offline'}
                </span>
                {device.osName && (
                  <span className="text-xs text-gray-500 truncate">
                    {device.osName}
                  </span>
                )}
              </div>

              {/* Métricas */}
              {device.status === 'online' && (
                <div className="space-y-1.5 mb-3 pb-3 border-b border-gray-100">
                  {device.cpuUsage != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> CPU
                      </span>
                      <span className="font-medium text-gray-800">{device.cpuUsage}%</span>
                    </div>
                  )}
                  {device.ramUsed != null && device.ramTotal != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> RAM
                      </span>
                      <span className="font-medium text-gray-800">
                        {device.ramUsed.toFixed(1)}/{device.ramTotal}GB
                      </span>
                    </div>
                  )}
                  {device.diskUsage != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 flex items-center gap-1">
                        <HardDrive className="w-3 h-3" /> Disco
                      </span>
                      <span className="font-medium text-gray-800">{device.diskUsage}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Alertas */}
              {device.alertsCount && device.alertsCount > 0 && (
                <div className="flex items-center gap-1.5 mb-3 px-2 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                  <span className="text-xs font-medium text-red-700">
                    {device.alertsCount} {device.alertsCount === 1 ? 'alerta' : 'alertas'}
                  </span>
                </div>
              )}

              {/* Botões de ação */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleChat(device)}
                  disabled={creatingChat === device.id}
                  className="flex flex-col items-center gap-1 px-2 py-2 bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg transition-colors disabled:opacity-50 text-xs font-medium"
                  title="Iniciar conversa"
                >
                  {creatingChat === device.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  Chat
                </button>

                <button
                  onClick={() => handleTicket(device)}
                  disabled={creatingTicket === device.id}
                  className="flex flex-col items-center gap-1 px-2 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors disabled:opacity-50 text-xs font-medium"
                  title="Criar ticket"
                >
                  {creatingTicket === device.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Ticket className="w-4 h-4" />
                  )}
                  Ticket
                </button>

                <button
                  onClick={() => handleConectar(device)}
                  disabled={!device.rustdeskId}
                  className="flex flex-col items-center gap-1 px-2 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-400 text-xs font-medium"
                  title={device.rustdeskId ? 'Conectar via RustDesk' : 'RustDesk não configurado'}
                >
                  <MonitorPlay className="w-4 h-4" />
                  Conectar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
