'use client'

import { useEffect, useState } from 'react'
import { Package, Upload, Rocket, Trash2 } from 'lucide-react'
import { softwareApi } from '@/lib/api'
import { formatBytes } from '@/lib/utils'

export default function SoftwarePage() {
  const [pacotes, setPacotes] = useState<any[]>([])
  const [deploys, setDeploys] = useState<any[]>([])
  const [tab, setTab] = useState<'pacotes' | 'deploys'>('pacotes')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarDados()
  }, [])

  const carregarDados = async () => {
    try {
      const [pacotesRes, deploysRes] = await Promise.all([
        softwareApi.listarPacotes(),
        softwareApi.listarDeploys(),
      ])
      setPacotes(pacotesRes.data)
      setDeploys(deploysRes.data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Software</h1>
          <p className="text-dark-400 mt-1">Gerencie pacotes e deploys de software</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('pacotes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pacotes' ? 'bg-brand-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
          }`}
        >
          Pacotes ({pacotes.length})
        </button>
        <button
          onClick={() => setTab('deploys')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'deploys' ? 'bg-brand-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
          }`}
        >
          Deploys ({deploys.length})
        </button>
      </div>

      {carregando ? (
        <div className="card text-center py-12 text-dark-400">Carregando...</div>
      ) : tab === 'pacotes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pacotes.length === 0 ? (
            <div className="col-span-full card text-center py-12">
              <Package className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum pacote cadastrado</p>
            </div>
          ) : (
            pacotes.map((pacote: any) => (
              <div key={pacote.id} className="card">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="w-5 h-5 text-brand-400" />
                  <h3 className="text-white font-medium">{pacote.nome}</h3>
                </div>
                <p className="text-dark-400 text-sm mb-2">{pacote.descricao || 'Sem descrição'}</p>
                <div className="flex items-center gap-3 text-xs text-dark-500">
                  <span>v{pacote.versao}</span>
                  {pacote.arquivoTamanho && <span>{formatBytes(pacote.arquivoTamanho)}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700">
                <th className="text-left py-3 px-4 text-dark-400 font-medium">Pacote</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium">Dispositivo</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium">Solicitado por</th>
              </tr>
            </thead>
            <tbody>
              {deploys.map((deploy: any) => (
                <tr key={deploy.id} className="border-b border-dark-800">
                  <td className="py-3 px-4 text-white">{deploy.softwarePackage?.nome || '-'}</td>
                  <td className="py-3 px-4 text-dark-300">{deploy.device?.hostname || '-'}</td>
                  <td className="py-3 px-4">
                    <span className={
                      deploy.status === 'sucesso' ? 'badge-online' :
                      deploy.status === 'erro' ? 'badge-offline' : 'badge-alerta'
                    }>
                      {deploy.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-dark-400">{deploy.solicitadoPor || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
