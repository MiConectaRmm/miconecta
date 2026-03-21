'use client'

import { useEffect, useState } from 'react'
import { MonitorSmartphone, Clock, Video, ExternalLink } from 'lucide-react'
import { sessionsApi, devicesApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'
import Modal from '@/components/ui/Modal'

interface Props {
  tenantId: string
}

export default function TabSessoes({ tenantId }: Props) {
  const [sessoes, setSessoes] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novaModal, setNovaModal] = useState(false)
  const [deviceSel, setDeviceSel] = useState('')
  const [motivo, setMotivo] = useState('')

  useEffect(() => { carregar() }, [tenantId])

  const carregar = async () => {
    try {
      const [sessRes, devRes] = await Promise.allSettled([
        sessionsApi.listar({ tenantId }),
        devicesApi.listar({ tenantId }),
      ])
      if (sessRes.status === 'fulfilled') setSessoes(Array.isArray(sessRes.value.data) ? sessRes.value.data : [])
      if (devRes.status === 'fulfilled') {
        const d = devRes.value.data
        setDevices(Array.isArray(d) ? d : d?.items || [])
      }
    } catch {} finally { setCarregando(false) }
  }

  const solicitar = async () => {
    if (!deviceSel) return
    try {
      await sessionsApi.solicitar({ deviceId: deviceSel, motivo: motivo || undefined })
      setNovaModal(false)
      setDeviceSel('')
      setMotivo('')
      carregar()
      alert('Sessão solicitada com sucesso!')
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao solicitar sessão')
    }
  }

  const statusCor: Record<string, string> = {
    ativa: 'bg-green-500/10 text-green-400',
    aguardando_consentimento: 'bg-amber-500/10 text-amber-400',
    finalizada: 'bg-dark-700 text-dark-300',
    cancelada: 'bg-red-500/10 text-red-400',
    erro: 'bg-red-500/10 text-red-400',
  }

  const devicesOnline = devices.filter(d => d.status === 'online')

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando sessões...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-dark-400 text-sm">Sessões remotas para dispositivos deste cliente</p>
        <button onClick={() => setNovaModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <MonitorSmartphone className="w-4 h-4" /> Nova Sessão
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-green-400">{sessoes.filter(s => s.status === 'ativa').length}</p>
          <p className="text-dark-500 text-xs">Ativas</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-amber-400">{sessoes.filter(s => s.status === 'aguardando_consentimento').length}</p>
          <p className="text-dark-500 text-xs">Aguardando</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{sessoes.length}</p>
          <p className="text-dark-500 text-xs">Total</p>
        </div>
      </div>

      {sessoes.length === 0 ? (
        <div className="card text-center py-12">
          <MonitorSmartphone className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Nenhuma sessão remota registrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessoes.map((s: any) => (
            <div key={s.id} className="card flex items-center justify-between p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-white text-sm font-medium">{s.device?.hostname || s.deviceId}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusCor[s.status] || 'bg-dark-700 text-dark-300'}`}>
                    {s.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                  {s.tecnico?.nome && <span>Técnico: {s.tecnico.nome}</span>}
                  {s.motivo && <span>· {s.motivo}</span>}
                  <span>· {timeAgo(s.criadoEm)}</span>
                  {s.duracao && <span>· <Clock className="w-3 h-3 inline" /> {Math.round(s.duracao / 60)}min</span>}
                </div>
              </div>
              {s.device?.rustdeskId && s.status === 'ativa' && (
                <button onClick={() => window.open(`rustdesk://connection/new/${s.device.rustdeskId}`, '_blank')}
                  className="btn-primary text-xs py-1 px-3 ml-2">
                  Conectar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nova sessão */}
      <Modal isOpen={novaModal} onClose={() => setNovaModal(false)} title="Nova Sessão Remota" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Dispositivo *</label>
            <select value={deviceSel} onChange={(e) => setDeviceSel(e.target.value)} className="input w-full">
              <option value="">Selecione...</option>
              {devicesOnline.map(d => (
                <option key={d.id} value={d.id}>{d.hostname} ({d.ipLocal})</option>
              ))}
            </select>
            {devicesOnline.length === 0 && (
              <p className="text-xs text-dark-500 mt-1">Nenhum dispositivo online no momento</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Motivo</label>
            <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input w-full" placeholder="Manutenção preventiva..." />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button onClick={() => setNovaModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={solicitar} className="btn-primary" disabled={!deviceSel}>Solicitar Sessão</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
