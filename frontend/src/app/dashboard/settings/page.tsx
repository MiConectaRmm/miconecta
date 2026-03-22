'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings, Server, Key, Bell, Globe, Code2, Shield, Link2, Palette,
  Plus, Pencil, Trash2, Play, Clock, FileText, CheckCircle2, XCircle,
  AlertTriangle, Database, RefreshCw, Eye, Download, Loader2
} from 'lucide-react'
import { scriptsApi, patchesApi, lgpdApi, auditApi } from '@/lib/api'

/* ────────────────────────────── types ────────────────────────────── */
interface Script {
  id: string
  nome: string
  descricao?: string
  linguagem: string
  conteudo: string
  global: boolean
  criadoEm: string
  atualizadoEm?: string
}

interface LgpdRequest {
  id: string
  tipo: string
  status: string
  solicitanteNome: string
  solicitanteEmail: string
  justificativa?: string
  criadoEm: string
  processadoEm?: string
}

interface ConsentRecord {
  id: string
  tipo: string
  concedenteNome: string
  consentido: boolean
  criadoEm: string
}

/* ────────────────────────────── tabs ─────────────────────────────── */
type TabId = 'geral' | 'scripts' | 'patches' | 'lgpd' | 'integracoes'

const tabs: { id: TabId; label: string; icon: any }[] = [
  { id: 'geral', label: 'Geral', icon: Settings },
  { id: 'scripts', label: 'Biblioteca de Scripts', icon: Code2 },
  { id: 'patches', label: 'Políticas de Patch', icon: Shield },
  { id: 'lgpd', label: 'LGPD', icon: Database },
  { id: 'integracoes', label: 'Integrações', icon: Link2 },
]

/* ════════════════════════════ PAGE ════════════════════════════════ */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('geral')

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-dark-400 mt-1">Configurações gerais, scripts, patches, LGPD e integrações</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-dark-900 rounded-lg p-1 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-brand-500/20 text-brand-400'
                  : 'text-dark-400 hover:text-white hover:bg-dark-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'geral' && <TabGeral />}
      {activeTab === 'scripts' && <TabScripts />}
      {activeTab === 'patches' && <TabPatches />}
      {activeTab === 'lgpd' && <TabLGPD />}
      {activeTab === 'integracoes' && <TabIntegracoes />}
    </div>
  )
}

/* ═══════════════════════════ TAB GERAL ═══════════════════════════ */
function TabGeral() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">API Backend</h2>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="URL Base" value={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'} mono />
            <InfoRow label="WebSocket" value={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'} mono />
            <InfoRow label="Versão" value="v2.0.0" />
          </div>
        </div>

        {/* Segurança */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Segurança</h2>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="Autenticação" value="JWT Bearer Token" />
            <InfoRow label="Controle de Acesso" value="RBAC (Role-Based)" />
            <InfoRow label="Auditoria" badge="Ativa" badgeClass="badge-online" />
          </div>
        </div>

        {/* Notificações */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Notificações</h2>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="E-mail (SMTP)" value="Configurar no .env" dim />
            <InfoRow label="Alertas em tempo real" badge="WebSocket" badgeClass="badge-online" />
            <InfoRow label="Motor de alertas" badge="Ativo" badgeClass="badge-online" />
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Palette className="w-5 h-5 text-brand-400" />
          <h2 className="text-lg font-semibold text-white">Branding</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <span className="text-dark-400 block mb-1">Empresa</span>
            <span className="text-white font-medium">Maginf Tecnologia</span>
          </div>
          <div>
            <span className="text-dark-400 block mb-1">Produto</span>
            <span className="text-white font-medium">MIConecta Enterprise</span>
          </div>
          <div>
            <span className="text-dark-400 block mb-1">Cor primária</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-brand-500 rounded" />
              <span className="text-white font-mono">#3B82F6</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ TAB SCRIPTS ═════════════════════════ */
function TabScripts() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Script | null>(null)
  const [preview, setPreview] = useState<Script | null>(null)

  const carregar = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await scriptsApi.listar()
      setScripts(Array.isArray(data) ? data : [])
    } catch { setScripts([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este script?')) return
    try { await scriptsApi.remover(id); carregar() } catch {}
  }

  const langColor: Record<string, string> = {
    powershell: 'text-blue-400 bg-blue-400/10',
    bat: 'text-yellow-400 bg-yellow-400/10',
    bash: 'text-green-400 bg-green-400/10',
    python: 'text-emerald-400 bg-emerald-400/10',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Biblioteca de Scripts</h2>
          <p className="text-dark-400 text-sm mt-0.5">Scripts globais e templates reutilizáveis</p>
        </div>
        <div className="flex gap-2">
          <button onClick={carregar} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button
            onClick={() => { setEditing(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Novo Script
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-dark-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-16 text-dark-500">
          <Code2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum script cadastrado</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {scripts.map((s) => (
            <div key={s.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`px-2 py-1 rounded text-xs font-mono ${langColor[s.linguagem] || 'text-dark-400 bg-dark-800'}`}>
                  {s.linguagem}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium truncate">{s.nome}</span>
                    {s.global && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 font-medium">GLOBAL</span>
                    )}
                  </div>
                  {s.descricao && <p className="text-dark-400 text-xs truncate mt-0.5">{s.descricao}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4 shrink-0">
                <button onClick={() => setPreview(s)} className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-white" title="Ver código">
                  <Eye className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditing(s); setShowModal(true) }} className="p-1.5 rounded hover:bg-dark-800 text-dark-400 hover:text-white" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-900/30 text-dark-400 hover:text-red-400" title="Remover">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <Modal title={preview.nome} onClose={() => setPreview(null)} wide>
          <div className="text-xs font-mono bg-dark-950 rounded p-4 overflow-auto max-h-96 text-green-400 whitespace-pre">
            {preview.conteudo}
          </div>
        </Modal>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <ScriptFormModal
          script={editing}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={carregar}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════ TAB PATCHES ═════════════════════════ */
function TabPatches() {
  const [resumo, setResumo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await patchesApi.resumo()
        setResumo(Array.isArray(data) ? data : [])
      } catch { setResumo([]) } finally { setLoading(false) }
    })()
  }, [])

  // Aggregate by status
  const byStatus: Record<string, number> = {}
  const bySeveridade: Record<string, number> = {}
  resumo.forEach((r) => {
    const count = Number(r.total) || 0
    byStatus[r.status] = (byStatus[r.status] || 0) + count
    bySeveridade[r.severidade] = (bySeveridade[r.severidade] || 0) + count
  })
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)

  const statusIcon: Record<string, any> = {
    pendente: Clock,
    instalando: RefreshCw,
    instalado: CheckCircle2,
    falha: XCircle,
    agendado: Clock,
  }
  const statusColor: Record<string, string> = {
    pendente: 'text-yellow-400',
    instalando: 'text-blue-400',
    instalado: 'text-green-400',
    falha: 'text-red-400',
    agendado: 'text-cyan-400',
  }
  const sevColor: Record<string, string> = {
    critica: 'text-red-400 bg-red-400/10',
    importante: 'text-orange-400 bg-orange-400/10',
    moderada: 'text-yellow-400 bg-yellow-400/10',
    baixa: 'text-green-400 bg-green-400/10',
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Políticas de Patch</h2>
        <p className="text-dark-400 text-sm mt-0.5">Resumo global de patches Windows em todos os clientes</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-dark-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : total === 0 ? (
        <div className="text-center py-16 text-dark-500">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum dado de patch disponível</p>
        </div>
      ) : (
        <>
          {/* Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(byStatus).map(([status, count]) => {
              const Icon = statusIcon[status] || FileText
              const color = statusColor[status] || 'text-dark-400'
              return (
                <div key={status} className="card text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-dark-400 text-xs capitalize">{status}</div>
                </div>
              )
            })}
          </div>

          {/* Severidade breakdown */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Distribuição por Severidade</h3>
            <div className="space-y-2">
              {Object.entries(bySeveridade).sort((a, b) => b[1] - a[1]).map(([sev, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded capitalize ${sevColor[sev] || 'text-dark-400 bg-dark-800'}`}>
                      {sev}
                    </span>
                    <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-white text-sm w-16 text-right">{count} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Policies info */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Janelas de Manutenção</h3>
            <div className="space-y-3 text-sm">
              <InfoRow label="Verificação automática" badge="Via Agente" badgeClass="badge-online" />
              <InfoRow label="Janela padrão" value="Sáb/Dom 02:00–06:00" />
              <InfoRow label="Reinício automático" value="Desativado" dim />
              <InfoRow label="Aprovação manual" badge="Recomendado" badgeClass="badge-alerta" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════ TAB LGPD ════════════════════════════ */
function TabLGPD() {
  const [solicitacoes, setSolicitacoes] = useState<LgpdRequest[]>([])
  const [consentimentos, setConsentimentos] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const [sol, con] = await Promise.all([lgpdApi.solicitacoes(), lgpdApi.consentimentos()])
        setSolicitacoes(Array.isArray(sol.data) ? sol.data : [])
        setConsentimentos(Array.isArray(con.data) ? con.data : [])
      } catch {} finally { setLoading(false) }
    })()
  }, [])

  const tipoLabel: Record<string, string> = {
    acesso: 'Acesso a dados',
    retificacao: 'Retificação',
    exclusao: 'Exclusão',
    portabilidade: 'Portabilidade',
    revogacao: 'Revogação de consentimento',
  }
  const statusBadge: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'badge-alerta' },
    em_andamento: { label: 'Em andamento', cls: 'text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-xs' },
    concluida: { label: 'Concluída', cls: 'badge-online' },
    negada: { label: 'Negada', cls: 'badge-offline' },
  }

  const retentionPolicies = [
    { entidade: 'Logs de auditoria', dias: 365, descricao: '1 ano' },
    { entidade: 'Métricas de dispositivos', dias: 90, descricao: '90 dias' },
    { entidade: 'Notificações', dias: 90, descricao: '90 dias' },
    { entidade: 'Logs de sessão remota', dias: 180, descricao: '6 meses' },
    { entidade: 'Mensagens de chat', dias: 365, descricao: '1 ano' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">LGPD — Proteção de Dados</h2>
        <p className="text-dark-400 text-sm mt-0.5">Solicitações DSAR, consentimentos e políticas de retenção</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-dark-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : (
        <>
          {/* Retention policies */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-400" /> Políticas de Retenção
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700">
                    <th className="text-left text-dark-400 pb-2 font-medium">Entidade</th>
                    <th className="text-left text-dark-400 pb-2 font-medium">Período</th>
                    <th className="text-left text-dark-400 pb-2 font-medium">Limpeza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-800">
                  {retentionPolicies.map((p) => (
                    <tr key={p.entidade}>
                      <td className="py-2 text-white">{p.entidade}</td>
                      <td className="py-2 text-dark-300">{p.descricao}</td>
                      <td className="py-2"><span className="badge-online">Automática (03h)</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DSAR requests */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-400" /> Solicitações DSAR
              <span className="text-dark-400 font-normal ml-auto">{solicitacoes.length} registros</span>
            </h3>
            {solicitacoes.length === 0 ? (
              <p className="text-dark-500 text-sm py-4 text-center">Nenhuma solicitação DSAR registrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left text-dark-400 pb-2 font-medium">Tipo</th>
                      <th className="text-left text-dark-400 pb-2 font-medium">Solicitante</th>
                      <th className="text-left text-dark-400 pb-2 font-medium">Data</th>
                      <th className="text-left text-dark-400 pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {solicitacoes.slice(0, 20).map((s) => {
                      const badge = statusBadge[s.status] || { label: s.status, cls: 'text-dark-400' }
                      return (
                        <tr key={s.id}>
                          <td className="py-2 text-white">{tipoLabel[s.tipo] || s.tipo}</td>
                          <td className="py-2 text-dark-300">{s.solicitanteNome}</td>
                          <td className="py-2 text-dark-400">{new Date(s.criadoEm).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2"><span className={badge.cls}>{badge.label}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Consent records */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-400" /> Registros de Consentimento
              <span className="text-dark-400 font-normal ml-auto">{consentimentos.length} registros</span>
            </h3>
            {consentimentos.length === 0 ? (
              <p className="text-dark-500 text-sm py-4 text-center">Nenhum consentimento registrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dark-700">
                      <th className="text-left text-dark-400 pb-2 font-medium">Tipo</th>
                      <th className="text-left text-dark-400 pb-2 font-medium">Concedente</th>
                      <th className="text-left text-dark-400 pb-2 font-medium">Data</th>
                      <th className="text-left text-dark-400 pb-2 font-medium">Decisão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-800">
                    {consentimentos.slice(0, 20).map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 text-white capitalize">{c.tipo?.replace(/_/g, ' ')}</td>
                        <td className="py-2 text-dark-300">{c.concedenteNome}</td>
                        <td className="py-2 text-dark-400">{new Date(c.criadoEm).toLocaleDateString('pt-BR')}</td>
                        <td className="py-2">
                          {c.consentido
                            ? <span className="badge-online">Concedido</span>
                            : <span className="badge-offline">Recusado</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════ TAB INTEGRACOES ═════════════════════ */
function TabIntegracoes() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Integrações</h2>
        <p className="text-dark-400 text-sm mt-0.5">Serviços externos e configurações de conectividade</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RustDesk */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">Acesso Remoto (RustDesk)</h2>
            <span className="badge-online ml-auto">Configurado</span>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="Servidor" value="136.248.114.218" mono />
            <InfoRow label="Domínio" value="remoto.maginf.com.br" mono />
            <InfoRow label="Portas" value="21115-21119" mono />
            <InfoRow label="Protocolo" value="TCP/UDP" />
          </div>
        </div>

        {/* E-mail / SMTP */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">E-mail (SMTP)</h2>
            <span className="badge-alerta ml-auto">Pendente</span>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="Host SMTP" value="Configurar no .env" dim />
            <InfoRow label="Porta" value="—" dim />
            <InfoRow label="TLS" value="—" dim />
            <InfoRow label="Remetente" value="—" dim />
          </div>
          <p className="text-dark-500 text-xs mt-3">
            Configure SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS no arquivo .env do backend.
          </p>
        </div>

        {/* Agente Windows */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">Agente Windows</h2>
            <span className="badge-online ml-auto">v2.0.0</span>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="Runtime" value=".NET 8 (Windows Service)" />
            <InfoRow label="Protocolo" value="HTTPS + WebSocket" />
            <InfoRow label="Heartbeat" value="30 segundos" />
            <InfoRow label="Auto-update" badge="Ativo" badgeClass="badge-online" />
          </div>
        </div>

        {/* Storage / S3 */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-semibold text-white">Storage (S3/R2)</h2>
            <span className="badge-online ml-auto">Configurado</span>
          </div>
          <div className="space-y-3 text-sm">
            <InfoRow label="Provider" value="Cloudflare R2" />
            <InfoRow label="Upload" value="Presigned URL" />
            <InfoRow label="Limite arquivo" value="50 MB" />
            <InfoRow label="Tipos permitidos" value="Imagem, PDF, ZIP, EXE, MSI" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ SHARED COMPONENTS ═══════════════════ */

function InfoRow({ label, value, badge, badgeClass, mono, dim }: {
  label: string; value?: string; badge?: string; badgeClass?: string; mono?: boolean; dim?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
      <span className="text-dark-400">{label}</span>
      {badge ? (
        <span className={badgeClass}>{badge}</span>
      ) : (
        <span className={`${dim ? 'text-dark-500' : 'text-white'} ${mono ? 'font-mono text-xs' : ''}`}>
          {value}
        </span>
      )}
    </div>
  )
}

function Modal({ title, onClose, children, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-dark-900 rounded-xl border border-dark-700 p-6 ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-dark-400 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ScriptFormModal({ script, onClose, onSaved }: {
  script: Script | null; onClose: () => void; onSaved: () => void
}) {
  const [nome, setNome] = useState(script?.nome || '')
  const [descricao, setDescricao] = useState(script?.descricao || '')
  const [linguagem, setLinguagem] = useState(script?.linguagem || 'powershell')
  const [conteudo, setConteudo] = useState(script?.conteudo || '')
  const [global, setGlobal] = useState(script?.global ?? true)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!nome.trim() || !conteudo.trim()) return
    setSaving(true)
    try {
      const dados = { nome, descricao, linguagem, conteudo, global }
      if (script) {
        await scriptsApi.atualizar(script.id, dados)
      } else {
        await scriptsApi.criar(dados)
      }
      onSaved()
      onClose()
    } catch {} finally { setSaving(false) }
  }

  return (
    <Modal title={script ? 'Editar Script' : 'Novo Script'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-dark-400 mb-1">Nome *</label>
            <input className="input w-full" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Limpar Temp Files" />
          </div>
          <div>
            <label className="block text-sm text-dark-400 mb-1">Linguagem</label>
            <select className="input w-full" value={linguagem} onChange={(e) => setLinguagem(e.target.value)}>
              <option value="powershell">PowerShell</option>
              <option value="bat">Batch (.bat)</option>
              <option value="bash">Bash</option>
              <option value="python">Python</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm text-dark-400 mb-1">Descrição</label>
          <input className="input w-full" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição do que faz" />
        </div>
        <div>
          <label className="block text-sm text-dark-400 mb-1">Código *</label>
          <textarea
            className="input w-full font-mono text-sm h-48 resize-y"
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="# Seu script aqui..."
          />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="global-chk" checked={global} onChange={(e) => setGlobal(e.target.checked)} className="accent-brand-500" />
          <label htmlFor="global-chk" className="text-sm text-dark-300">Script global (visível para todos os tenants)</label>
        </div>
        <div className="flex justify-end gap-3 mt-2">
          <button onClick={onClose} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !nome.trim() || !conteudo.trim()} className="btn-primary text-sm flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {script ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
