'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Building2, ArrowLeft, Loader2, AlertCircle, Monitor, Users,
  AlertTriangle, Ticket, Terminal, Package, Wrench, MonitorSmartphone,
} from 'lucide-react'
import { tenantsApi, agentsApi, devicesApi, usersApi } from '@/lib/api'

// Tabs
import TabCadastro from './tabs/TabCadastro'
import TabUsuarios from './tabs/TabUsuarios'
import TabDispositivos from './tabs/TabDispositivos'
import TabAlertas from './tabs/TabAlertas'
import TabTickets from './tabs/TabTickets'
import TabScripts from './tabs/TabScripts'
import TabSoftware from './tabs/TabSoftware'
import TabPatches from './tabs/TabPatches'
import TabSessoes from './tabs/TabSessoes'

interface TenantDetail {
  id: string
  nome: string
  razaoSocial?: string
  slug: string
  cnpj?: string
  email?: string
  telefone?: string
  contatoPrincipal?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  endereco?: string
  inscricaoEstadual?: string
  atividadePrincipal?: string
  naturezaJuridica?: string
  porte?: string
  dataAbertura?: string
  situacaoCadastral?: string
  ativo: boolean
  plano: string
  statusContrato: string
  maxDispositivos: number
  maxUsuarios: number
  storageMaxMb: number
  storageUsadoMb: number
  retencaoMeses: number
  timezone: string
  provisionToken?: string
  provisionTokenExpires?: string
  logoUrl?: string
  criadoEm: string
  atualizadoEm: string
  organizacoes?: any[]
}

const TABS = [
  { id: 'cadastro', label: 'Cadastro', icon: Building2 },
  { id: 'usuarios', label: 'Usuários Portal', icon: Users },
  { id: 'dispositivos', label: 'Dispositivos', icon: Monitor },
  { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'scripts', label: 'Scripts', icon: Terminal },
  { id: 'software', label: 'Software', icon: Package },
  { id: 'patches', label: 'Patches', icon: Wrench },
  { id: 'sessoes', label: 'Sessões', icon: MonitorSmartphone },
] as const

type TabId = typeof TABS[number]['id']

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabId>('cadastro')
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [installationTokens, setInstallationTokens] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<TenantDetail>>({})

  // Resumo lateral
  const [deviceCount, setDeviceCount] = useState(0)
  const [devicesOnline, setDevicesOnline] = useState(0)
  const [portalContagem, setPortalContagem] = useState<any>(null)

  useEffect(() => {
    if (id) loadData()
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [tenantRes, agentRes] = await Promise.allSettled([
        tenantsApi.buscar(id),
        agentsApi.downloadInfo(),
      ])

      if (tenantRes.status === 'fulfilled') {
        setTenant(tenantRes.value.data)
        setEditData(tenantRes.value.data)
      }
      if (agentRes.status === 'fulfilled') {
        setAgentInfo(agentRes.value.data)
      }

      // Dados leves para resumo lateral
      try {
        const [tokensRes, devRes, contagemRes] = await Promise.allSettled([
          agentsApi.listarInstallationTokens(),
          devicesApi.listar({ tenantId: id }),
          usersApi.contagemPorTenant(id),
        ])
        if (tokensRes.status === 'fulfilled') setInstallationTokens(Array.isArray(tokensRes.value.data) ? tokensRes.value.data : [])
        if (devRes.status === 'fulfilled') {
          const devs = Array.isArray(devRes.value.data) ? devRes.value.data : devRes.value.data?.items || []
          setDeviceCount(devs.length)
          setDevicesOnline(devs.filter((d: any) => d.status === 'online').length)
        }
        if (contagemRes.status === 'fulfilled') setPortalContagem(contagemRes.value.data)
      } catch {}
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar cliente')
    } finally {
      setLoading(false)
    }
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
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400">{error || 'Cliente não encontrado'}</p>
        <button onClick={() => router.push('/dashboard/clients')} className="btn-primary">Voltar</button>
      </div>
    )
  }

  const storagePercent = tenant.storageMaxMb > 0 ? Math.round((tenant.storageUsadoMb / tenant.storageMaxMb) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/clients')} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-dark-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-500/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{tenant.nome}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-dark-400 text-sm">{tenant.slug}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tenant.ativo ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {tenant.ativo ? 'Ativo' : 'Suspenso'}
                </span>
                <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 rounded-full text-xs font-medium capitalize">
                  {tenant.plano}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Layout: Sidebar + Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Sidebar esquerda */}
        <div className="xl:col-span-1 space-y-4">
          {/* Resumo */}
          <div className="card">
            <h3 className="text-sm font-semibold text-dark-400 uppercase tracking-wider mb-3">Resumo</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-400">Dispositivos</span>
                  <span className="text-white">{deviceCount} / {tenant.maxDispositivos}</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-1.5">
                  <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (deviceCount / tenant.maxDispositivos) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-400">Storage</span>
                  <span className="text-white">{Math.round(tenant.storageUsadoMb / 1024 * 10) / 10} / {Math.round(tenant.storageMaxMb / 1024)} GB</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, storagePercent)}%` }} />
                </div>
              </div>
              <div className="pt-1 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Online</span>
                  <span className="text-green-400 font-medium">{devicesOnline}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Usuários</span>
                  <span className={`font-medium ${portalContagem?.atingiuLimite ? 'text-red-400' : 'text-white'}`}>
                    {portalContagem ? `${portalContagem.ativos}/${portalContagem.limite}` : `0/${tenant.maxUsuarios}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Retenção</span>
                  <span className="text-white">{tenant.retencaoMeses}m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Desde</span>
                  <span className="text-white">{new Date(tenant.criadoEm).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navegação vertical */}
          <nav className="card p-2">
            <div className="space-y-0.5">
              {TABS.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-500/15 text-brand-400'
                        : 'text-dark-300 hover:bg-dark-700/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </nav>
        </div>

        {/* Conteúdo da aba */}
        <div className="xl:col-span-3">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {(() => {
                const tab = TABS.find(t => t.id === activeTab)
                if (!tab) return null
                const Icon = tab.icon
                return <><Icon className="w-5 h-5 text-brand-400" /> {tab.label}</>
              })()}
            </h2>
          </div>

          {activeTab === 'cadastro' && (
            <TabCadastro
              tenant={tenant}
              setTenant={setTenant}
              editing={editing}
              setEditing={setEditing}
              editData={editData}
              setEditData={setEditData}
              agentInfo={agentInfo}
              installationTokens={installationTokens}
              onReload={loadData}
            />
          )}
          {activeTab === 'usuarios' && (
            <TabUsuarios tenantId={id} tenantNome={tenant.nome} maxUsuarios={tenant.maxUsuarios} />
          )}
          {activeTab === 'dispositivos' && <TabDispositivos tenantId={id} />}
          {activeTab === 'alertas' && <TabAlertas tenantId={id} />}
          {activeTab === 'tickets' && <TabTickets tenantId={id} />}
          {activeTab === 'scripts' && <TabScripts tenantId={id} />}
          {activeTab === 'software' && <TabSoftware tenantId={id} />}
          {activeTab === 'patches' && <TabPatches tenantId={id} />}
          {activeTab === 'sessoes' && <TabSessoes tenantId={id} />}
        </div>
      </div>
    </div>
  )
}