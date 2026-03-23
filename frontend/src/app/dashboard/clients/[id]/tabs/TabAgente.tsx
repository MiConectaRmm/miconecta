'use client'

import { useState } from 'react'
import { Download, FileCode2, Terminal, Key, Copy, Check, RefreshCw, Loader2, Info, AlertCircle } from 'lucide-react'
import { agentsApi } from '@/lib/api'

interface TabAgenteProps {
  tenantId: string
  tenantNome: string
}

export default function TabAgente({ tenantId, tenantNome }: TabAgenteProps) {
  const [downloadingBat, setDownloadingBat] = useState(false)
  const [downloadingPs1, setDownloadingPs1] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')

  const downloadScript = async (format: 'bat' | 'ps1') => {
    const setter = format === 'bat' ? setDownloadingBat : setDownloadingPs1
    setter(true)
    setError('')
    try {
      const res = await agentsApi.installScript(tenantId, format)
      const data = res.data

      // Cria blob e dispara download
      const blob = new Blob([data.content], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.response?.data?.message || `Erro ao gerar script ${format.toUpperCase()}`)
    } finally {
      setter(false)
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const msiUrl = 'https://miconecta-backend.fly.dev/agents/download'

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-lg font-semibold text-white">Instalar Agente</h2>
        <p className="text-sm text-dark-400 mt-1">
          Baixe o script de instalação personalizado para <span className="text-white font-medium">{tenantNome}</span>.
          O script já contém o token de provisionamento e a URL do servidor configurados.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Cards de download */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* .BAT */}
        <div className="card border border-dark-700 hover:border-brand-500/40 transition-colors">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Terminal className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Script .BAT</h3>
              <p className="text-xs text-dark-400 mt-0.5">Prompt de Comando (CMD)</p>
            </div>
          </div>
          <p className="text-sm text-dark-300 mb-4">
            Coloque o <code className="text-yellow-400 bg-dark-700 px-1 rounded">.bat</code> na mesma pasta do MSI e execute como Administrador.
          </p>
          <button
            onClick={() => downloadScript('bat')}
            disabled={downloadingBat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloadingBat ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
            ) : (
              <><Download className="w-4 h-4" /> Baixar instalar-{tenantNome.toLowerCase().replace(/\s+/g, '-')}.bat</>
            )}
          </button>
        </div>

        {/* .PS1 */}
        <div className="card border border-dark-700 hover:border-brand-500/40 transition-colors">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileCode2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Script .PS1</h3>
              <p className="text-xs text-dark-400 mt-0.5">PowerShell (recomendado)</p>
            </div>
          </div>
          <p className="text-sm text-dark-300 mb-4">
            Coloque o <code className="text-blue-400 bg-dark-700 px-1 rounded">.ps1</code> na mesma pasta do MSI e execute como Administrador.
          </p>
          <button
            onClick={() => downloadScript('ps1')}
            disabled={downloadingPs1}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 font-medium text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloadingPs1 ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
            ) : (
              <><Download className="w-4 h-4" /> Baixar instalar-{tenantNome.toLowerCase().replace(/\s+/g, '-')}.ps1</>
            )}
          </button>
        </div>
      </div>

      {/* Instruções */}
      <div className="card bg-dark-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-white">Como instalar</h3>
        </div>
        <ol className="space-y-2 text-sm text-dark-300 list-none">
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>Baixe o instalador MSI mais recente em <span className="text-white">installer/output/MIConectaSetup.msi</span></span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>Coloque o <code className="text-yellow-400 bg-dark-700 px-1 rounded">.bat</code> ou <code className="text-blue-400 bg-dark-700 px-1 rounded">.ps1</code> na mesma pasta do MSI</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>Clique com botão direito no script → <strong className="text-white">Executar como Administrador</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 bg-brand-500/20 text-brand-400 rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span>O agente será instalado como serviço Windows e o dispositivo aparecerá no dashboard em até 1 minuto</span>
          </li>
        </ol>
      </div>

      {/* Token de provisionamento manual */}
      <div className="card bg-dark-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Key className="w-4 h-4 text-dark-400" />
          <h3 className="text-sm font-semibold text-white">Instalação manual (avançado)</h3>
        </div>
        <p className="text-sm text-dark-400 mb-3">
          Se preferir executar o MSI diretamente via linha de comando, use os parâmetros abaixo:
        </p>
        <div className="bg-dark-900 rounded-lg p-3 font-mono text-xs text-dark-300 overflow-x-auto">
          <span className="text-green-400">msiexec</span>
          {' '}<span className="text-white">/i MIConectaRMMSetup.msi /qn</span>
          {' '}<span className="text-yellow-400">SERVER_URL=</span>
          <span className="text-blue-300">https://miconecta-backend.fly.dev/api/v1</span>
          {' '}<span className="text-yellow-400">TENANT_ID=</span>
          <span className="text-blue-300">{tenantId}</span>
          {' '}<span className="text-yellow-400">PROVISION_TOKEN=</span>
          <span className="text-purple-300">&lt;ver no script .bat&gt;</span>
        </div>
        <p className="text-xs text-dark-500 mt-2">
          💡 O token de provisionamento é gerado automaticamente e fica embutido no script baixado acima. Válido por 30 dias.
        </p>
      </div>
    </div>
  )
}
