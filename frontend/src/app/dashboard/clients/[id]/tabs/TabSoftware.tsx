'use client'

import { useEffect, useState } from 'react'
import { Package, Upload, Rocket } from 'lucide-react'
import { softwareApi, devicesApi } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

interface Props {
  tenantId: string
}

export default function TabSoftware({ tenantId }: Props) {
  const [pacotes, setPacotes] = useState<any[]>([])
  const [deploys, setDeploys] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [tab, setTab] = useState<'pacotes' | 'deploys'>('pacotes')
  const [carregando, setCarregando] = useState(true)
  const [deployModal, setDeployModal] = useState<any>(null)
  const [devicesSel, setDevicesSel] = useState<string[]>([])

  useEffect(() => { carregar() }, [tenantId])

  const carregar = async () => {
    try {
      const [pRes, dRes, devRes] = await Promise.allSettled([
        softwareApi.listarPacotes(),
        softwareApi.listarDeploys(),
        devicesApi.listar({ tenantId }),
      ])
      if (pRes.status === 'fulfilled') setPacotes(pRes.value.data)
      if (dRes.status === 'fulfilled') setDeploys(dRes.value.data)
      if (devRes.status === 'fulfilled') {
        const d = devRes.value.data
        setDevices(Array.isArray(d) ? d : d?.items || [])
      }
    } catch {} finally { setCarregando(false) }
  }

  const deployPacote = async () => {
    if (!deployModal || devicesSel.length === 0) return
    try {
      await softwareApi.deploy(deployModal.id, devicesSel)
      alert(`Deploy iniciado em ${devicesSel.length} dispositivo(s)`)
      setDeployModal(null)
      setDevicesSel([])
      carregar()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro no deploy')
    }
  }

  const devicesOnline = devices.filter(d => d.status === 'online')

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando software...</div>

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('pacotes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pacotes' ? 'bg-brand-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
          }`}>
          Pacotes ({pacotes.length})
        </button>
        <button onClick={() => setTab('deploys')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'deploys' ? 'bg-brand-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
          }`}>
          Deploys ({deploys.length})
        </button>
      </div>

      {tab === 'pacotes' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pacotes.length === 0 ? (
            <div className="col-span-full card text-center py-12">
              <Package className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum pacote cadastrado</p>
            </div>
          ) : (
            pacotes.map((p: any) => (
              <div key={p.id} className="card">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="w-5 h-5 text-brand-400" />
                  <h3 className="text-white font-medium">{p.nome}</h3>
                </div>
                <p className="text-dark-400 text-sm mb-2">{p.descricao || 'Sem descrição'}</p>
                <div className="flex items-center gap-3 text-xs text-dark-500 mb-3">
                  <span>v{p.versao}</span>
                  <span>{formatBytes(p.tamanhoBytes || 0)}</span>
                </div>
                <button onClick={() => { setDeployModal(p); setDevicesSel([]) }}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                  <Rocket className="w-3.5 h-3.5" /> Deploy
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {deploys.length === 0 ? (
            <div className="card text-center py-12">
              <Rocket className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">Nenhum deploy registrado</p>
            </div>
          ) : (
            deploys.map((d: any) => (
              <div key={d.id} className="card flex items-center justify-between p-3">
                <div>
                  <p className="text-white text-sm font-medium">{d.package?.nome || 'Pacote'} v{d.package?.versao}</p>
                  <p className="text-dark-500 text-xs mt-0.5">{d.device?.hostname || d.deviceId} · {new Date(d.criadoEm).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  d.status === 'sucesso' ? 'bg-green-500/10 text-green-400' : d.status === 'erro' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                }`}>{d.status}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal deploy */}
      <Modal isOpen={!!deployModal} onClose={() => setDeployModal(null)} title={`Deploy: ${deployModal?.nome || ''}`} size="lg">
        <div className="space-y-4">
          <p className="text-dark-400 text-sm">Selecione os dispositivos online:</p>
          {devicesOnline.length === 0 ? (
            <p className="text-dark-500 text-sm text-center py-4">Nenhum dispositivo online</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {devicesOnline.map(d => (
                <label key={d.id} className="flex items-center gap-3 p-2 bg-dark-800/50 rounded-lg hover:bg-dark-700/50 cursor-pointer">
                  <input type="checkbox" checked={devicesSel.includes(d.id)}
                    onChange={(e) => setDevicesSel(e.target.checked ? [...devicesSel, d.id] : devicesSel.filter(x => x !== d.id))}
                    className="rounded border-dark-600" />
                  <span className="text-sm text-white">{d.hostname}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button onClick={() => setDeployModal(null)} className="btn-secondary">Cancelar</button>
            <button onClick={deployPacote} className="btn-primary" disabled={devicesSel.length === 0}>
              Iniciar Deploy em {devicesSel.length} dispositivo(s)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
