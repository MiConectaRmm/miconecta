'use client'

import { useEffect, useState } from 'react'
import {
  Download, Monitor, Shield, HardDrive, Cpu,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'
import { agentsApi } from '@/lib/api'

export default function AgentDownloadPage() {
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    agentsApi.downloadInfo()
      .then(({ data }) => setInfo(data))
      .catch((err: any) => setError(err.response?.data?.message || 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Download do Agente</h1>
        <p className="text-dark-400 mt-1">
          MSI genérico do MIConecta Agent. Para scripts de instalação por cliente, acesse o detalhe do cliente.
        </p>
      </div>

      <div className="card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-500/20 rounded-xl flex items-center justify-center">
              <Monitor className="w-7 h-7 text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">MIConecta Agent</h2>
              <p className="text-dark-400 text-sm mt-0.5">
                Versão {info.agentVersion} &bull; Windows x64 &bull; MSI
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
            className="flex items-center justify-center gap-3 w-full py-4 bg-brand-500 hover:bg-brand-500 text-white font-semibold rounded-xl transition-colors text-lg"
          >
            <Download className="w-6 h-6" />
            Baixar MSI
          </a>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-dark-600 rounded-xl">
            <Download className="w-8 h-8 text-dark-500" />
            <p className="text-dark-400 text-sm text-center">
              URL de download ainda não configurada.
              <br />
              <span className="text-dark-500 text-xs">
                Configure <code className="text-brand-400">AGENT_DOWNLOAD_URL</code> no backend.
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
            <p className="text-xs text-dark-300">~8 MB</p>
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

      {/* Requisitos e Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Requisitos</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Sistema</span>
              <span className="text-dark-200 text-right">Windows 10/11, Server 2016+</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Runtime</span>
              <span className="text-dark-200">.NET 8 (incluso)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">RAM</span>
              <span className="text-dark-200">128 MB</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-dark-400">Disco</span>
              <span className="text-dark-200">100 MB</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-4">Funcionalidades</h3>
          <ul className="space-y-2.5 text-sm text-dark-300">
            {[
              'Monitoramento de CPU, RAM e Disco',
              'Inventário de hardware e software',
              'Heartbeat automático (60s)',
              'Execução remota de scripts',
              'Integração RustDesk',
              'Fila offline (SQLite)',
              'Auto-atualização',
              'Serviço Windows',
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-dark-500 text-xs text-center mt-6">
        Para instalar em clientes específicos, acesse <strong>Clientes &gt; Detalhe do Cliente &gt; Instalação do Agente</strong>
      </p>
    </div>
  )
}
