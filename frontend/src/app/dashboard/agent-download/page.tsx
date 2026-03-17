'use client'

import { useEffect, useState } from 'react'
import {
  Download,
  Monitor,
  Copy,
  CheckCircle2,
  RefreshCw,
  Shield,
  HardDrive,
  Cpu,
  AlertCircle,
  ExternalLink,
  Terminal,
  Loader2,
} from 'lucide-react'
import { agentsApi } from '@/lib/api'

interface DownloadInfo {
  downloadUrl: string | null
  agentVersion: string
  serverUrl: string
  tenantId: string
  tenantNome: string
  provisionToken: string
  provisionExpires: string
  systemRequirements: {
    os: string
    runtime: string
    minRam: string
    minDisk: string
  }
}

export default function AgentDownloadPage() {
  const [info, setInfo] = useState<DownloadInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const fetchInfo = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await agentsApi.downloadInfo()
      setInfo(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar informações do agente')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfo()
  }, [])

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  const regenerateToken = async () => {
    setRegenerating(true)
    try {
      await agentsApi.provision()
      await fetchInfo()
    } catch {
      setError('Erro ao regenerar token')
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400 text-lg">{error}</p>
        <button onClick={fetchInfo} className="btn-primary">
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!info) return null

  const tokenExpDate = new Date(info.provisionExpires)
  const isTokenExpired = tokenExpDate < new Date()
  const daysRemaining = Math.max(0, Math.ceil((tokenExpDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  const installCommand = [
    `MIConectaRMMSetup.exe`,
    `/VERYSILENT`,
    `/SUPPRESSMSGBOXES`,
    `/ServerUrl="${info.serverUrl}"`,
    `/TenantId="${info.tenantId}"`,
    `/ProvisionToken="${info.provisionToken}"`,
  ].join(' ')

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Download do Agente</h1>
        <p className="text-dark-400 mt-1">
          Baixe e instale o agente MIConecta RMM nos dispositivos dos seus clientes
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Download Card */}
        <div className="xl:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-brand-600/20 rounded-xl flex items-center justify-center">
                  <Monitor className="w-7 h-7 text-brand-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">MIConecta RMM Agent</h2>
                  <p className="text-dark-400 text-sm mt-0.5">
                    Versão {info.agentVersion} &bull; Windows x64
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">
                Estável
              </span>
            </div>

            {info.downloadUrl ? (
              <a
                href={info.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors text-lg"
              >
                <Download className="w-6 h-6" />
                Baixar Agente (.exe)
              </a>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-dark-600 rounded-xl">
                <Download className="w-8 h-8 text-dark-500" />
                <p className="text-dark-400 text-sm text-center">
                  URL de download ainda não configurada.
                  <br />
                  <span className="text-dark-500 text-xs">
                    Configure a variável <code className="text-brand-400">AGENT_DOWNLOAD_URL</code> no backend.
                  </span>
                </p>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                <Shield className="w-5 h-5 text-blue-400 mx-auto mb-1.5" />
                <p className="text-xs text-dark-300">Assinado</p>
              </div>
              <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                <HardDrive className="w-5 h-5 text-purple-400 mx-auto mb-1.5" />
                <p className="text-xs text-dark-300">~25 MB</p>
              </div>
              <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                <Cpu className="w-5 h-5 text-green-400 mx-auto mb-1.5" />
                <p className="text-xs text-dark-300">.NET 8</p>
              </div>
              <div className="text-center p-3 bg-dark-800/50 rounded-lg">
                <Monitor className="w-5 h-5 text-orange-400 mx-auto mb-1.5" />
                <p className="text-xs text-dark-300">Win 10/11+</p>
              </div>
            </div>
          </div>

          {/* Provision Token */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Token de Provisionamento</h3>
              <button
                onClick={regenerateToken}
                disabled={regenerating}
                className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerar
              </button>
            </div>

            <p className="text-dark-400 text-sm mb-4">
              Este token é usado pelo instalador para registrar automaticamente os dispositivos na sua conta.
            </p>

            <div className="space-y-3">
              <CopyField
                label="Provision Token"
                value={info.provisionToken}
                copied={copied}
                onCopy={copyToClipboard}
                fieldId="token"
              />
              <CopyField
                label="Server URL"
                value={info.serverUrl}
                copied={copied}
                onCopy={copyToClipboard}
                fieldId="server"
              />
              <CopyField
                label="Tenant ID"
                value={info.tenantId}
                copied={copied}
                onCopy={copyToClipboard}
                fieldId="tenant"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              {isTokenExpired ? (
                <span className="text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  Token expirado - clique em Regenerar
                </span>
              ) : (
                <span className="text-dark-400">
                  Expira em <span className="text-white font-medium">{daysRemaining} dias</span>
                  {' '}({tokenExpDate.toLocaleDateString('pt-BR')})
                </span>
              )}
            </div>
          </div>

          {/* Silent Install */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Terminal className="w-5 h-5 text-brand-400" />
              <h3 className="text-lg font-semibold text-white">Instalação Silenciosa (Deploy em massa)</h3>
            </div>
            <p className="text-dark-400 text-sm mb-3">
              Use este comando para instalar o agente via GPO, script ou RMM:
            </p>
            <div className="relative">
              <pre className="bg-dark-950 border border-dark-700 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {installCommand}
              </pre>
              <button
                onClick={() => copyToClipboard(installCommand, 'cmd')}
                className="absolute top-3 right-3 p-1.5 bg-dark-800 hover:bg-dark-700 rounded-md transition-colors"
                title="Copiar comando"
              >
                {copied === 'cmd' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-dark-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Steps */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Como instalar</h3>
            <ol className="space-y-4">
              {[
                { step: 1, text: 'Baixe o instalador clicando no botão acima' },
                { step: 2, text: 'Execute como Administrador no dispositivo do cliente' },
                { step: 3, text: 'Informe o Server URL, Tenant ID e Provision Token quando solicitado' },
                { step: 4, text: 'O agente será instalado como serviço do Windows e iniciará automaticamente' },
                { step: 5, text: 'O dispositivo aparecerá na lista de Dispositivos em até 1 minuto' },
              ].map((item) => (
                <li key={item.step} className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-brand-600/20 text-brand-400 rounded-full flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </span>
                  <p className="text-dark-300 text-sm pt-0.5">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* System Requirements */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">Requisitos do Sistema</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-dark-400">Sistema Operacional</span>
                <span className="text-dark-200 text-right">{info.systemRequirements.os}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-dark-400">Runtime</span>
                <span className="text-dark-200">{info.systemRequirements.runtime}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-dark-700">
                <span className="text-dark-400">RAM Mínima</span>
                <span className="text-dark-200">{info.systemRequirements.minRam}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-dark-400">Disco Mínimo</span>
                <span className="text-dark-200">{info.systemRequirements.minDisk}</span>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="card">
            <h3 className="text-lg font-semibold text-white mb-4">O que o agente faz</h3>
            <ul className="space-y-2.5 text-sm text-dark-300">
              {[
                'Monitoramento de CPU, RAM e Disco',
                'Inventário de hardware e software',
                'Heartbeat automático a cada 60s',
                'Execução remota de scripts',
                'Integração com RustDesk (acesso remoto)',
                'Fila offline (SQLite) quando sem rede',
                'Auto-atualização',
                'Roda como serviço do Windows',
              ].map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
  fieldId,
}: {
  label: string
  value: string
  copied: string | null
  onCopy: (text: string, field: string) => void
  fieldId: string
}) {
  return (
    <div>
      <label className="text-xs text-dark-500 mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-sm text-dark-200 font-mono truncate">
          {value}
        </code>
        <button
          onClick={() => onCopy(value, fieldId)}
          className="p-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition-colors flex-shrink-0"
          title={`Copiar ${label}`}
        >
          {copied === fieldId ? (
            <CheckCircle2 className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-dark-400" />
          )}
        </button>
      </div>
    </div>
  )
}
