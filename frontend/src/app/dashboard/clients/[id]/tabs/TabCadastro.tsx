'use client'

import { useState } from 'react'
import {
  Building2, Mail, Phone, MapPin, Calendar, Copy, CheckCircle2,
  Settings, Shield, Download, Terminal, Loader2, AlertCircle, RefreshCw, Globe,
} from 'lucide-react'
import { tenantsApi, agentsApi } from '@/lib/api'

interface Props {
  tenant: any
  setTenant: (t: any) => void
  editing: boolean
  setEditing: (e: boolean) => void
  editData: any
  setEditData: (d: any) => void
  agentInfo: any
  installationTokens: any[]
  onReload: () => void
}

export default function TabCadastro({
  tenant, setTenant, editing, setEditing, editData, setEditData,
  agentInfo, installationTokens, onReload,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [scriptLoading, setScriptLoading] = useState<string | null>(null)
  const [newTokenDescription, setNewTokenDescription] = useState('')
  const [newTokenExpiresAt, setNewTokenExpiresAt] = useState('')

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data } = await tenantsApi.atualizar(tenant.id, editData)
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
      const { data } = await agentsApi.installScript(tenant.id, format)
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
      onReload()
    } catch {}
  }

  const createInstallationToken = async () => {
    try {
      await agentsApi.criarInstallationToken({
        descricao: newTokenDescription || undefined,
        expiresAt: newTokenExpiresAt || undefined,
      })
      setNewTokenDescription('')
      setNewTokenExpiresAt('')
      onReload()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao criar token')
    }
  }

  const revokeInstallationToken = async (tokenId: string) => {
    try {
      await agentsApi.revogarInstallationToken(tokenId)
      onReload()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao revogar token')
    }
  }

  const tokenExpDate = tenant.provisionTokenExpires ? new Date(tenant.provisionTokenExpires) : null
  const isTokenExpired = tokenExpDate ? tokenExpDate < new Date() : true
  const daysRemaining = tokenExpDate ? Math.max(0, Math.ceil((tokenExpDate.getTime() - Date.now()) / 86400000)) : 0

  return (
    <div className="space-y-6">
      {/* Ações de edição */}
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button onClick={() => setEditing(false)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-secondary text-sm">Editar Dados</button>
        )}
      </div>

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
                <span className={`px-2 py-0.5 rounded-full text-xs ${org.ativo ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {org.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-dark-500 text-sm text-center py-4">Nenhuma organização cadastrada</p>
        )}
      </div>

      {/* Configuração do Agente */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-400" /> Configuração do Agente
        </h3>
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
              <span className="text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Token expirado</span>
            ) : (
              <span className="text-dark-400">Token expira em <span className="text-white font-medium">{daysRemaining} dias</span></span>
            )}
          </div>
          <button onClick={regenerateToken} className="text-sm text-brand-400 hover:text-brand-300 flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Regenerar
          </button>
        </div>
      </div>

      {/* Instalação do Agente */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-brand-400" /> Instalação do Agente
        </h3>
        {agentInfo?.downloadUrl && (
          <div className="mb-4">
            <a href={agentInfo.downloadUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors">
              <Download className="w-4 h-4" /> Baixar MSI do Agente
            </a>
          </div>
        )}
        <p className="text-dark-400 text-sm mb-4">
          Scripts de instalação configurados para <span className="text-white font-medium">{tenant.nome}</span>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button onClick={() => downloadScript('bat')} disabled={scriptLoading === 'bat'}
            className="flex items-center justify-center gap-2 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors text-white font-medium">
            {scriptLoading === 'bat' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4 text-green-400" />}
            Baixar Script .bat
          </button>
          <button onClick={() => downloadScript('ps1')} disabled={scriptLoading === 'ps1'}
            className="flex items-center justify-center gap-2 py-3 bg-dark-800 hover:bg-dark-700 border border-dark-600 rounded-lg transition-colors text-white font-medium">
            {scriptLoading === 'ps1' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4 text-blue-400" />}
            Baixar Script .ps1
          </button>
        </div>
        <div className="p-3 bg-dark-950 border border-dark-700 rounded-lg">
          <p className="text-xs text-dark-500 mb-1">Instalação manual via CMD (Admin):</p>
          <div className="relative">
            <code className="text-xs text-green-400 font-mono break-all">
              msiexec /i MIConectaRMMSetup.msi /qn SERVER_URL={agentInfo?.serverUrl || '...'} TENANT_ID={tenant.id} PROVISION_TOKEN={tenant.provisionToken || '...'}
            </code>
            <button onClick={() => copyToClipboard(
              `msiexec /i MIConectaRMMSetup.msi /qn SERVER_URL=${agentInfo?.serverUrl || ''} TENANT_ID=${tenant.id} PROVISION_TOKEN=${tenant.provisionToken || ''}`, 'cmd'
            )} className="absolute top-0 right-0 p-1 hover:bg-dark-800 rounded">
              {copied === 'cmd' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-dark-500" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tokens de Instalação */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-400" /> Tokens de Instalação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input className="input" placeholder="Descrição opcional" value={newTokenDescription} onChange={(e) => setNewTokenDescription(e.target.value)} />
          <input className="input" type="datetime-local" value={newTokenExpiresAt} onChange={(e) => setNewTokenExpiresAt(e.target.value)} />
        </div>
        <button onClick={createInstallationToken} className="btn-primary mb-4">Gerar token</button>
        <div className="space-y-2">
          {installationTokens.length === 0 ? (
            <p className="text-sm text-dark-500">Nenhum token criado.</p>
          ) : installationTokens.map((token) => (
            <div key={token.id} className="border border-dark-700 rounded-lg p-3 bg-dark-900/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-white font-medium">{token.descricao || 'Sem descrição'}</p>
                  <p className="text-xs text-dark-500">Preview: {token.tokenPreview} · {token.status}</p>
                  <p className="text-xs text-dark-500">Expira: {token.expiresAt ? new Date(token.expiresAt).toLocaleString('pt-BR') : 'Sem expiração'}</p>
                </div>
                <button onClick={() => revokeInstallationToken(token.id)} className="text-xs text-red-400 hover:text-red-300">Revogar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sub-componentes ──

function Field({ label, value, editing, field, editData, setEditData, icon }: {
  label: string; value?: string; editing: boolean; field: string; editData: any; setEditData: (d: any) => void; icon?: React.ReactNode
}) {
  if (editing) {
    return (
      <div>
        <label className="text-xs text-dark-500 mb-1 block">{label}</label>
        <input type="text" value={(editData as any)[field] || ''} onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
          className="input w-full text-sm" placeholder={label} />
      </div>
    )
  }
  return (
    <div>
      <label className="text-xs text-dark-500 mb-1 block">{label}</label>
      <p className="text-sm text-dark-200 flex items-center gap-1.5">{icon}{value || <span className="text-dark-600">Não informado</span>}</p>
    </div>
  )
}

function CopyField({ label, value, copied, onCopy, fieldId }: {
  label: string; value: string; copied: string | null; onCopy: (text: string, field: string) => void; fieldId: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-dark-500 w-28 flex-shrink-0">{label}</span>
      <code className="flex-1 bg-dark-950 border border-dark-700 rounded px-2 py-1.5 text-xs text-dark-200 font-mono truncate">{value}</code>
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
