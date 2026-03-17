'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2, ArrowLeft, Copy, CheckCircle2, RefreshCw, Download,
  Monitor, Users, Mail, Phone, MapPin, FileText, Shield, Settings,
  Globe, Calendar, Loader2, AlertCircle, Edit2, Save, X, Terminal,
} from 'lucide-react'
import { tenantsApi, agentsApi, devicesApi } from '@/lib/api'

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

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [agentInfo, setAgentInfo] = useState<any>(null)
  const [devices, setDevices] = useState<any[]>([])
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<TenantDetail>>({})
  const [saving, setSaving] = useState(false)
  const [scriptLoading, setScriptLoading] = useState<string | null>(null)

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

      try {
        const devRes = await devicesApi.listar({ tenantId: id })
        setDevices(Array.isArray(devRes.data) ? devRes.data : devRes.data?.items || [])
      } catch {}
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar cliente')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSave = async () => {
    if (!tenant) return
    setSaving(true)
    try {
      const { data } = await tenantsApi.atualizar(id, editData)
      setTenant(data)
      setEditing(false)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const downloadScript = async (format: 'bat' | 'ps1') => {
    setScriptLoading(format)
    try {
      const { data } = await agentsApi.installScript(id, format)
      const blob = new Blob([data.content], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao gerar script')
    } finally {
      setScriptLoading(null)
    }
  }

  const regenerateToken = async () => {
    try {
      await agentsApi.provision()
      await loadData()
    } catch {}
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

  const tokenExpDate = tenant.provisionTokenExpires ? new Date(tenant.provisionTokenExpires) : null
  const isTokenExpired = tokenExpDate ? tokenExpDate < new Date() : true
  const daysRemaining = tokenExpDate ? Math.max(0, Math.ceil((tokenExpDate.getTime() - Date.now()) / 86400000)) : 0
  const storagePercent = tenant.storageMaxMb > 0 ? Math.round((tenant.storageUsadoMb / tenant.storageMaxMb) * 100) : 0
  const devicesOnline = devices.filter((d: any) => d.status === 'online').length

  const enderecoCompleto = [tenant.logradouro, tenant.numero, tenant.complemento, tenant.bairro, tenant.cidade, tenant.uf, tenant.cep]
    .filter(Boolean).join(', ') || tenant.endereco || 'Não informado'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard/clients')} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-dark-400" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-600/20 rounded-xl flex items-center justify-center">
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
        <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-2">
                <X className="w-4 h-4" /> Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> Editar
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-2 space-y-6">

          {/* Dados da Empresa */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-400" /> Dados da Empresa
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome / Fantasia" value={tenant.nome} editing={editing} field="nome" editData={editData} setEditData={setEditData} />
              <Field label="Razão Social" value={tenant.razaoSocial} editing={editing} field="razaoSocial" editData={editData} setEditData={setEditData} />
              <Field label="CNPJ" value={formatCnpj(tenant.cnpj)} editing={editing} field="cnpj" editData={editData} setEditData={setEditData} />
              <Field label="Email" value={tenant.email} editing={editing} field="email" editData={editData} setEditData={setEditData} icon={<Mail className="w-3.5 h-3.5" />} />
              <Field label="Telefone" value={tenant.telefone} editing={editing} field="telefone" editData={editData} setEditData={setEditData} icon={<Phone className="w-3.5 h-3.5" />} />
              <Field label="Contato Principal" value={tenant.contatoPrincipal} editing={editing} field="contatoPrincipal" editData={editData} setEditData={setEditData} />
              <Field label="Atividade Principal" value={tenant.atividadePrincipal} editing={editing} field="atividadePrincipal" editData={editData} setEditData={setEditData} />
              <Field label="Natureza Jurídica" value={tenant.naturezaJuridica} editing={editing} field="naturezaJuridica" editData={editData} setEditData={setEditData} />
              <Field label="Porte" value={tenant.porte} editing={editing} field="porte" editData={editData} setEditData={setEditData} />
              <Field label="Situação Cadastral" value={tenant.situacaoCadastral} editing={editing} field="situacaoCadastral" editData={editData} setEditData={setEditData} />
              <Field label="Data de Abertura" value={tenant.dataAbertura ? new Date(tenant.dataAbertura).toLocaleDateString('pt-BR') : undefined} editing={editing} field="dataAbertura" editData={editData} setEditData={setEditData} icon={<Calendar className="w-3.5 h-3.5" />} />
              <Field label="I.E." value={tenant.inscricaoEstadual} editing={editing} field="inscricaoEstadual" editData={editData} setEditData={setEditData} />
            </div>
          </div>

          {/* Endereço */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-400" /> Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="CEP" value={tenant.cep} editing={editing} field="cep" editData={editData} setEditData={setEditData} />
              <Field label="Logradouro" value={tenant.logradouro} editing={editing} field="logradouro" editData={editData} setEditData={setEditData} />
              <Field label="Número" value={tenant.numero} editing={editing} field="numero" editData={editData} setEditData={setEditData} />
              <Field label="Complemento" value={tenant.complemento} editing={editing} field="complemento" editData={editData} setEditData={setEditData} />
              <Field label="Bairro" value={tenant.bairro} editing={editing} field="bairro" editData={editData} setEditData={setEditData} />
              <Field label="Cidade" value={tenant.cidade} editing={editing} field="cidade" editData={editData} setEditData={setEditData} />
              <Field label="UF" value={tenant.uf} editing={editing} field="uf" editData={editData} setEditData={setEditData} />
            </div>
          </div>

          {/* Configuração do Agente (Info Técnica) */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-400" /> Configuração do Agente
            </h3>
            <p className="text-dark-400 text-sm mb-4">Informações necessárias para instalar ou reconfigurar o agente neste cliente.</p>

            <div className="space-y-3">
              <CopyField label="Tenant ID" value={tenant.id} copied={copied} onCopy={copyToClipboard} fieldId="tid" />
              <CopyField label="Server URL" value={agentInfo?.serverUrl || 'Carregando...'} copied={copied} onCopy={copyToClipboard} fieldId="surl" />
              {tenant.provisionToken && (
                <CopyField label="Provision Token" value={tenant.provisionToken} copied={copied} onCopy={copyToClipboard} fieldId="ptoken" />
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm">
                {isTokenExpired ? (
                  <span className="text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Token expirado
                  </span>
                ) : (
                  <span className="text-dark-400">
                    Token expira em <span className="text-white font-medium">{daysRemaining} dias</span>
                  </span>
                )}
              </div>
              <button onClick={regenerateToken} className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Regenerar Token
              </button>
            </div>
          </div>

          {/* Download do Agente (por cliente) */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-brand-400" /> Instalação do Agente
            </h3>
            <div className="mb-4">
              {agentInfo?.downloadUrl ? (
                <a
                  href={agentInfo.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar MSI do Agente
                </a>
              ) : (
                <p className="text-xs text-dark-500">
                  URL do MSI não configurada. Defina <code className="text-brand-400">AGENT_DOWNLOAD_URL</code> no backend.
                </p>
              )}
            </div>

            <p className="text-dark-400 text-sm mb-4">
              Baixe o script de instalação já configurado para <span className="text-white font-medium">{tenant.nome}</span>.
              O técnico só precisa colocar o MSI e o script na mesma pasta e executar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => downloadScript('bat')}
                disabled={scriptLoading === 'bat'}
                className="flex items-center justify-center gap-2 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors text-white font-medium"
              >
                {scriptLoading === 'bat' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4 text-green-400" />}
                Baixar Script .bat
              </button>
              <button
                onClick={() => downloadScript('ps1')}
                disabled={scriptLoading === 'ps1'}
                className="flex items-center justify-center gap-2 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors text-white font-medium"
              >
                {scriptLoading === 'ps1' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4 text-blue-400" />}
                Baixar Script .ps1
              </button>
            </div>

            <div className="p-3 bg-dark-950 border border-dark-700 rounded-lg">
              <p className="text-xs text-dark-500 mb-1">Ou instale manualmente via CMD (como Admin):</p>
              <div className="relative">
                <code className="text-xs text-green-400 font-mono break-all">
                  msiexec /i MIConectaRMMSetup.msi /qn SERVER_URL={agentInfo?.serverUrl || '...'} TENANT_ID={tenant.id} PROVISION_TOKEN={tenant.provisionToken || '...'}
                </code>
                <button
                  onClick={() => copyToClipboard(
                    `msiexec /i MIConectaRMMSetup.msi /qn SERVER_URL=${agentInfo?.serverUrl || ''} TENANT_ID=${tenant.id} PROVISION_TOKEN=${tenant.provisionToken || ''}`,
                    'cmd'
                  )}
                  className="absolute top-0 right-0 p-1 hover:bg-dark-800 rounded"
                >
                  {copied === 'cmd' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-dark-500" />}
                </button>
              </div>
            </div>
          </div>

          {/* Organizações */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-brand-400" /> Organizações
              </h3>
              <span className="text-dark-400 text-sm">{tenant.organizacoes?.length || 0} organizações</span>
            </div>
            {tenant.organizacoes && tenant.organizacoes.length > 0 ? (
              <div className="space-y-2">
                {tenant.organizacoes.map((org: any) => (
                  <div key={org.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium text-sm">{org.nome}</p>
                      {org.endereco && <p className="text-dark-400 text-xs mt-0.5">{org.endereco}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-dark-400 text-xs flex items-center gap-1">
                        <Monitor className="w-3 h-3" /> {org.dispositivos?.length || 0}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${org.ativo ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {org.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-500 text-sm text-center py-4">Nenhuma organização cadastrada</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Resumo */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Resumo</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-400">Dispositivos</span>
                  <span className="text-white">{devices.length} / {tenant.maxDispositivos}</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (devices.length / tenant.maxDispositivos) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-dark-400">Storage</span>
                  <span className="text-white">{Math.round(tenant.storageUsadoMb / 1024 * 10) / 10} / {Math.round(tenant.storageMaxMb / 1024)} GB</span>
                </div>
                <div className="w-full bg-dark-700 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${storagePercent > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, storagePercent)}%` }} />
                </div>
              </div>

              <div className="pt-2 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Online agora</span>
                  <span className="text-green-400 font-medium">{devicesOnline} dispositivos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Max Usuários</span>
                  <span className="text-white">{tenant.maxUsuarios}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Retenção de dados</span>
                  <span className="text-white">{tenant.retencaoMeses} meses</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Timezone</span>
                  <span className="text-white text-xs">{tenant.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Cliente desde</span>
                  <span className="text-white">{new Date(tenant.criadoEm).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dispositivos */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Monitor className="w-5 h-5 text-brand-400" /> Dispositivos
              </h3>
              <span className="text-dark-400 text-sm">{devices.length}</span>
            </div>
            {devices.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {devices.slice(0, 20).map((device: any) => (
                  <Link key={device.id} href={`/dashboard/devices`} className="flex items-center justify-between p-2 bg-dark-800/50 rounded-lg hover:bg-dark-700/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${device.status === 'online' ? 'bg-green-400' : 'bg-red-400'}`} />
                      <span className="text-sm text-dark-200 truncate">{device.hostname}</span>
                    </div>
                    <span className="text-xs text-dark-500 flex-shrink-0 ml-2">{device.sistemaOperacional || 'Windows'}</span>
                  </Link>
                ))}
                {devices.length > 20 && (
                  <p className="text-center text-dark-500 text-xs pt-2">+{devices.length - 20} dispositivos</p>
                )}
              </div>
            ) : (
              <p className="text-dark-500 text-sm text-center py-4">Nenhum dispositivo registrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, value, editing, field, editData, setEditData, icon,
}: {
  label: string
  value?: string
  editing: boolean
  field: string
  editData: any
  setEditData: (d: any) => void
  icon?: React.ReactNode
}) {
  if (editing) {
    return (
      <div>
        <label className="text-xs text-dark-500 mb-1 block">{label}</label>
        <input
          type="text"
          value={(editData as any)[field] || ''}
          onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
          className="input w-full text-sm"
          placeholder={label}
        />
      </div>
    )
  }

  return (
    <div>
      <label className="text-xs text-dark-500 mb-1 block">{label}</label>
      <p className="text-sm text-dark-200 flex items-center gap-1.5">
        {icon}
        {value || <span className="text-dark-600">Não informado</span>}
      </p>
    </div>
  )
}

function CopyField({
  label, value, copied, onCopy, fieldId,
}: {
  label: string
  value: string
  copied: string | null
  onCopy: (text: string, field: string) => void
  fieldId: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-dark-500 w-28 flex-shrink-0">{label}</span>
      <code className="flex-1 bg-dark-950 border border-dark-700 rounded px-2 py-1.5 text-xs text-dark-200 font-mono truncate">
        {value}
      </code>
      <button onClick={() => onCopy(value, fieldId)} className="p-1.5 hover:bg-dark-700 rounded flex-shrink-0">
        {copied === fieldId ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-dark-400" />}
      </button>
    </div>
  )
}

function formatCnpj(cnpj?: string): string | undefined {
  if (!cnpj) return undefined
  const clean = cnpj.replace(/[^\d]/g, '')
  if (clean.length !== 14) return cnpj
  return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12,14)}`
}
