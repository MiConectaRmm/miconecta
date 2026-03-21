'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { alertsApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

const severidadeCorMap: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/10',
  aviso: 'text-amber-400 bg-amber-500/10',
  critico: 'text-red-400 bg-red-500/10',
  emergencia: 'text-red-300 bg-red-600/20',
}

const statusIconMap: Record<string, any> = {
  ativo: AlertTriangle,
  reconhecido: Clock,
  resolvido: CheckCircle2,
}

interface Props {
  tenantId: string
}

export default function TabAlertas({ tenantId }: Props) {
  const [alertas, setAlertas] = useState<any[]>([])
  const [filtroStatus, setFiltroStatus] = useState('ativo')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [tenantId, filtroStatus])

  useEffect(() => {
    const interval = setInterval(carregar, 15000)
    return () => clearInterval(interval)
  }, [tenantId, filtroStatus])

  const carregar = async () => {
    try {
      const params: any = { tenantId }
      if (filtroStatus) params.status = filtroStatus
      const { data } = await alertsApi.listar(params)
      setAlertas(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Erro ao carregar alertas:', err)
    } finally {
      setCarregando(false)
    }
  }

  const reconhecer = async (id: string) => {
    try { await alertsApi.reconhecer(id); carregar() } catch {}
  }

  const resolver = async (id: string) => {
    try { await alertsApi.resolver(id); carregar() } catch {}
  }

  const ativos = alertas.filter(a => a.status === 'ativo').length
  const reconhecidos = alertas.filter(a => a.status === 'reconhecido').length

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-red-400">{ativos}</p>
          <p className="text-dark-500 text-xs">Ativos</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-amber-400">{reconhecidos}</p>
          <p className="text-dark-500 text-xs">Reconhecidos</p>
        </div>
        <div className="card text-center py-3">
          <p className="text-2xl font-bold text-white">{alertas.length}</p>
          <p className="text-dark-500 text-xs">Total</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {['ativo', 'reconhecido', 'resolvido', ''].map((status) => (
          <button key={status} onClick={() => setFiltroStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filtroStatus === status ? 'bg-brand-600 text-white' : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
            }`}>
            {status || 'Todos'}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {carregando ? (
          <div className="card text-center py-12 text-dark-400">Carregando alertas...</div>
        ) : alertas.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <p className="text-dark-300">Nenhum alerta encontrado</p>
          </div>
        ) : (
          alertas.map((alerta: any) => {
            const StatusIcon = statusIconMap[alerta.status] || AlertTriangle
            const corSeveridade = severidadeCorMap[alerta.severidade] || 'text-dark-400 bg-dark-700'

            return (
              <div key={alerta.id} className="card flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${corSeveridade}`}>
                  <StatusIcon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-white font-medium">{alerta.titulo}</h3>
                      <p className="text-dark-400 text-sm mt-0.5">{alerta.descricao}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-dark-500">
                        <span>{alerta.device?.hostname || 'Dispositivo'}</span>
                        <span>•</span>
                        <span className={`px-2 py-0.5 rounded-full ${corSeveridade}`}>{alerta.severidade}</span>
                        <span>•</span>
                        <span>{timeAgo(alerta.criadoEm)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alerta.status === 'ativo' && (
                        <>
                          <button onClick={() => reconhecer(alerta.id)} className="btn-secondary text-xs py-1 px-3">Reconhecer</button>
                          <button onClick={() => resolver(alerta.id)} className="btn-primary text-xs py-1 px-3">Resolver</button>
                        </>
                      )}
                      {alerta.status === 'reconhecido' && (
                        <button onClick={() => resolver(alerta.id)} className="btn-primary text-xs py-1 px-3">Resolver</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
