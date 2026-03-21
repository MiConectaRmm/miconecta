'use client'

import { useEffect, useState } from 'react'
import { Shield, Calendar } from 'lucide-react'
import { patchesApi, devicesApi } from '@/lib/api'

const severidadeCor: Record<string, string> = {
  critico: 'text-red-400 bg-red-500/10',
  importante: 'text-amber-400 bg-amber-500/10',
  moderado: 'text-blue-400 bg-blue-500/10',
  baixo: 'text-dark-400 bg-dark-700',
}

interface Props {
  tenantId: string
}

export default function TabPatches({ tenantId }: Props) {
  const [devices, setDevices] = useState<any[]>([])
  const [patchesPorDevice, setPatchesPorDevice] = useState<Record<string, any[]>>({})
  const [deviceSel, setDeviceSel] = useState<string>('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregarDevices() }, [tenantId])

  const carregarDevices = async () => {
    try {
      const { data } = await devicesApi.listar({ tenantId })
      const devs = Array.isArray(data) ? data : data?.items || []
      setDevices(devs)
      if (devs.length > 0) {
        setDeviceSel(devs[0].id)
        carregarPatches(devs[0].id)
      }
    } catch {} finally { setCarregando(false) }
  }

  const carregarPatches = async (deviceId: string) => {
    if (patchesPorDevice[deviceId]) return
    try {
      const { data } = await patchesApi.listar(deviceId)
      setPatchesPorDevice(prev => ({ ...prev, [deviceId]: Array.isArray(data) ? data : [] }))
    } catch {}
  }

  const selectDevice = (deviceId: string) => {
    setDeviceSel(deviceId)
    carregarPatches(deviceId)
  }

  const patches = patchesPorDevice[deviceSel] || []
  const pendentes = patches.filter(p => p.status === 'pendente' || p.status === 'disponivel')
  const instalados = patches.filter(p => p.status === 'instalado')

  const instalar = async (patchId: string) => {
    try {
      await patchesApi.instalar(patchId)
      setPatchesPorDevice(prev => ({ ...prev, [deviceSel]: undefined as any }))
      carregarPatches(deviceSel)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro')
    }
  }

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando...</div>

  if (devices.length === 0) {
    return (
      <div className="card text-center py-12">
        <Shield className="w-12 h-12 text-dark-600 mx-auto mb-3" />
        <p className="text-dark-400">Nenhum dispositivo neste cliente</p>
      </div>
    )
  }

  return (
    <div>
      {/* Seletor de dispositivo */}
      <div className="card mb-4">
        <label className="block text-sm font-medium text-dark-300 mb-2">Dispositivo</label>
        <select value={deviceSel} onChange={(e) => selectDevice(e.target.value)} className="input w-full md:w-80">
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.hostname} ({d.status})</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-amber-400">{pendentes.length}</p>
          <p className="text-dark-500 text-xs">Pendentes</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-green-400">{instalados.length}</p>
          <p className="text-dark-500 text-xs">Instalados</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{patches.length}</p>
          <p className="text-dark-500 text-xs">Total</p>
        </div>
      </div>

      {/* Lista */}
      {patches.length === 0 ? (
        <div className="card text-center py-12">
          <Shield className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-dark-300">Dispositivo atualizado — sem patches pendentes</p>
        </div>
      ) : (
        <div className="space-y-2">
          {patches.map((patch: any) => (
            <div key={patch.id} className="card flex items-center justify-between p-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{patch.titulo || patch.kbId}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                  {patch.kbId && <span>KB{patch.kbId}</span>}
                  <span className={`px-2 py-0.5 rounded-full ${severidadeCor[patch.severidade] || 'text-dark-400 bg-dark-700'}`}>
                    {patch.severidade}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    patch.status === 'instalado' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>{patch.status}</span>
                </div>
              </div>
              {(patch.status === 'pendente' || patch.status === 'disponivel') && (
                <button onClick={() => instalar(patch.id)} className="btn-primary text-xs py-1 px-3 ml-2">Instalar</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
