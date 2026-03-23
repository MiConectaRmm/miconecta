'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Monitor, Cpu, HardDrive, MemoryStick,
  Globe, Clock, Wifi, Shield, Terminal, MonitorPlay,
  Loader2, CheckCircle2, XCircle, AlertTriangle, History,
} from 'lucide-react'
import { devicesApi, metricsApi, sessionsApi } from '@/lib/api'
import { useSocket } from '@/hooks/useSocket'
import StatusBadge from '@/components/ui/StatusBadge'

type SessionStatus =
  | 'idle'
  | 'solicitando'
  | 'aguardando_consentimento'
  | 'conectando'
  | 'ativa'
  | 'recusada'
  | 'erro'

export default function DeviceDetailPage() {
  const { id } = useParams() as { id: string }
  const [device, setDevice] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [carregando, setCarregando] = useState(true)

  // ── Sessão remota ──
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionMsg, setSessionMsg] = useState('')
  const [motivo, setMotivo] = useState('')
  const [showMotivoModal, setShowMotivoModal] = useState(false)
  const [historico, setHistorico] = useState<any[]>([])
  const [showHistorico, setShowHistorico] = useState(false)
  const consentTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { on } = useSocket('/rmm')

  useEffect(() => {
    carregar()
    const interval = setInterval(() => carregarMetricas(), 30000)
    return () => clearInterval(interval)
  }, [id])

  // Escuta eventos de sessão via WebSocket
  useEffect(() => {
    const offStarted = on('session:started', (data: any) => {
      if (data.sessionId !== sessionId && data.deviceId !== id) return
      if (consentTimeout.current) clearTimeout(consentTimeout.current)
      setSessionStatus('conectando')
      setSessionMsg('Consentimento aprovado! Abrindo RustDesk...')
      // Notifica backend que a sessão iniciou
      if (data.sessionId) sessionsApi.iniciar(data.sessionId)
      // Abre o RustDesk client do técnico
      setTimeout(() => {
        if (data.rustdeskId || device?.rustdeskId) {
          window.open(`rustdesk://connection/new/${data.rustdeskId || device.rustdeskId}`, '_blank')
        }
        setSessionStatus('ativa')
        setSessionMsg('Sessão ativa. Feche quando terminar.')
      }, 800)
    })

    const offDenied = on('session:denied', (data: any) => {
      if (data.sessionId !== sessionId && data.deviceId !== id) return
      if (consentTimeout.current) clearTimeout(consentTimeout.current)
      setSessionStatus('recusada')
      setSessionMsg('Acesso remoto recusado pelo usuário do dispositivo.')
    })

    const offUpdated = on('session:updated', (data: any) => {
      if (!sessionId || data.id !== sessionId) return
      if (data.status === 'CONSENTIMENTO_PENDENTE') {
        setSessionStatus('aguardando_consentimento')
        setSessionMsg('Aguardando aprovação do usuário no dispositivo...')
      }
    })

    return () => {
      offStarted()
      offDenied()
      offUpdated()
    }
  }, [on, sessionId, id, device])

  const carregar = async () => {
    try {
      const [deviceRes] = await Promise.all([devicesApi.buscar(id)])
      setDevice(deviceRes.data)
      carregarMetricas()
      carregarHistorico()
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  const carregarMetricas = async () => {
    try {
      const res = await metricsApi.ultima(id)
      setMetrics(res.data)
    } catch {}
  }

  const carregarHistorico = async () => {
    try {
      const res = await sessionsApi.historicoDevice(id)
      setHistorico(Array.isArray(res.data) ? res.data.slice(0, 5) : [])
    } catch {}
  }

  const iniciarSessao = async () => {
    if (!device?.rustdeskId) {
      setSessionStatus('erro')
      setSessionMsg('RustDesk ID não disponível. O agente pode estar offline ou o RustDesk não está instalado neste dispositivo.')
      return
    }
    if (device.status !== 'online') {
      setSessionStatus('erro')
      setSessionMsg('Dispositivo está offline. Não é possível iniciar uma sessão remota.')
      return
    }
    setShowMotivoModal(true)
  }

  const confirmarSolicitacao = async () => {
    setShowMotivoModal(false)
    setSessionStatus('solicitando')
    setSessionMsg('Enviando solicitação para o dispositivo...')

    try {
      const res = await sessionsApi.solicitar({
        deviceId: id,
        motivo: motivo || 'Suporte técnico',
      })
      const sess = res.data
      setSessionId(sess.id)

      // Se não exige consentimento (policy AUTO), vai direto
      if (sess.status === 'CONSENTIDA' || sess.status === 'ATIVA') {
        setSessionStatus('conectando')
        setSessionMsg('Abrindo RustDesk...')
        await sessionsApi.iniciar(sess.id)
        window.open(`rustdesk://connection/new/${device.rustdeskId}`, '_blank')
        setSessionStatus('ativa')
        setSessionMsg('Sessão ativa. Feche quando terminar.')
        return
      }

      // Aguarda consentimento via WebSocket (timeout 2 min)
      setSessionStatus('aguardando_consentimento')
      setSessionMsg('Aguardando aprovação do usuário no dispositivo...')
      consentTimeout.current = setTimeout(() => {
        if (sessionStatus !== 'ativa') {
          setSessionStatus('erro')
          setSessionMsg('Tempo esgotado. O usuário não respondeu em 2 minutos.')
        }
      }, 120_000)
    } catch (err: any) {
      setSessionStatus('erro')
      setSessionMsg(err?.response?.data?.message || 'Erro ao solicitar sessão remota.')
    }
  }

  const encerrarSessao = async () => {
    if (sessionId) {
      try {
        await sessionsApi.finalizar(sessionId, { resumo: 'Encerrado pelo técnico' })
      } catch {}
    }
    setSessionStatus('idle')
    setSessionId(null)
    setSessionMsg('')
    setMotivo('')
    carregarHistorico()
  }

  const resetarSessao = () => {
    if (consentTimeout.current) clearTimeout(consentTimeout.current)
    if (sessionId && (sessionStatus === 'aguardando_consentimento' || sessionStatus === 'solicitando')) {
      sessionsApi.cancelar(sessionId, 'Cancelado pelo técnico').catch(() => {})
    }
    setSessionStatus('idle')
    setSessionId(null)
    setSessionMsg('')
    setMotivo('')
  }

  if (carregando) {
    return <div className="text-center py-12 text-dark-400">Carregando...</div>
  }

  if (!device) {
    return <div className="text-center py-12 text-dark-400">Dispositivo não encontrado</div>
  }

  const infoItems = [
    { label: 'Tenant ID', value: device.tenantId, icon: Globe },
    { label: 'Device ID', value: device.id, icon: Shield },
    { label: 'Agent ID', value: device.agentId, icon: Terminal },
    { label: 'Hostname', value: device.hostname, icon: Monitor },
    { label: 'Sistema Operacional', value: device.sistemaOperacional || device.versaoWindows, icon: Monitor },
    { label: 'CPU', value: device.cpu, icon: Cpu },
    { label: 'RAM Total', value: device.ramTotalMb ? `${Math.round(device.ramTotalMb / 1024)} GB` : '—', icon: MemoryStick },
    { label: 'Disco Total', value: device.discoTotalMb ? `${Math.round(device.discoTotalMb / 1024)} GB` : '—', icon: HardDrive },
    { label: 'IP Local', value: device.ipLocal, icon: Wifi },
    { label: 'IP Externo', value: device.ipExterno, icon: Globe },
    { label: 'Modelo', value: device.modeloMaquina, icon: Monitor },
    { label: 'Nº Série', value: device.numeroSerie, icon: Shield },
    { label: 'Agente', value: device.agentVersion, icon: Terminal },
    { label: 'Última Comunicação', value: device.lastSeen ? new Date(device.lastSeen).toLocaleString('pt-BR') : '—', icon: Clock },
    { label: 'Último Check-in', value: device.lastCheckin ? new Date(device.lastCheckin).toLocaleString('pt-BR') : '—', icon: Clock },
    { label: 'RustDesk ID', value: device.rustdeskId, icon: Shield },
  ]

  return (
    <div>
      <Link href="/dashboard/devices" className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar para dispositivos
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-dark-800 border border-dark-700 flex items-center justify-center">
            <Monitor className="w-7 h-7 text-brand-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{device.hostname}</h1>
            <div className="flex items-center gap-3 mt-1">
              <StatusBadge status={device.status} />
              <span className="text-dark-500 text-sm">{device.ipLocal}</span>
            </div>
          </div>
        </div>

        {/* Painel de Acesso Remoto */}
        <div className="flex items-center gap-3">
          {historico.length > 0 && (
            <button
              onClick={() => setShowHistorico(!showHistorico)}
              className="flex items-center gap-1.5 text-dark-400 hover:text-dark-200 text-sm border border-dark-700 rounded-lg px-3 py-2"
            >
              <History className="w-4 h-4" />
              Histórico
            </button>
          )}

          {sessionStatus === 'idle' && (
            <button
              onClick={iniciarSessao}
              disabled={!device.rustdeskId || device.status !== 'online'}
              className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title={!device.rustdeskId ? 'RustDesk não disponível neste dispositivo' : device.status !== 'online' ? 'Dispositivo offline' : ''}
            >
              <MonitorPlay className="w-4 h-4" />
              Acesso Remoto
            </button>
          )}

          {(sessionStatus === 'solicitando' || sessionStatus === 'aguardando_consentimento' || sessionStatus === 'conectando') && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-dark-300 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2 max-w-xs">
                <Loader2 className="w-4 h-4 animate-spin text-brand-400 shrink-0" />
                <span className="truncate">{sessionMsg}</span>
              </div>
              <button onClick={resetarSessao} className="text-dark-400 hover:text-red-400 text-sm">
                Cancelar
              </button>
            </div>
          )}

          {sessionStatus === 'ativa' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Sessão ativa
              </div>
              <button
                onClick={encerrarSessao}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Encerrar
              </button>
            </div>
          )}

          {sessionStatus === 'recusada' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
                <XCircle className="w-4 h-4 shrink-0" />
                Acesso recusado
              </div>
              <button onClick={resetarSessao} className="text-dark-400 hover:text-dark-200 text-sm">
                Fechar
              </button>
            </div>
          )}

          {sessionStatus === 'erro' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 max-w-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="truncate">{sessionMsg}</span>
              </div>
              <button onClick={resetarSessao} className="text-dark-400 hover:text-dark-200 text-sm">
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de motivo */}
      {showMotivoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
                <MonitorPlay className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Iniciar Acesso Remoto</h3>
                <p className="text-dark-400 text-sm">{device.hostname}</p>
              </div>
            </div>

            <div className="bg-dark-800 rounded-lg p-3 mb-4 text-xs text-dark-400">
              <p>⚠️ O usuário no dispositivo receberá uma notificação e precisará <strong className="text-dark-200">autorizar</strong> o acesso. Esta sessão será registrada conforme a LGPD.</p>
            </div>

            <div className="mb-4">
              <label className="block text-dark-400 text-sm mb-1.5">Motivo (opcional)</label>
              <input
                type="text"
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ex: Instalação de software, suporte ticket #123..."
                className="w-full bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-dark-200 text-sm focus:outline-none focus:border-brand-500"
                onKeyDown={e => e.key === 'Enter' && confirmarSolicitacao()}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowMotivoModal(false)}
                className="flex-1 py-2 rounded-lg border border-dark-700 text-dark-400 hover:text-dark-200 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarSolicitacao}
                className="flex-1 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-colors"
              >
                Solicitar Acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de sessões */}
      {showHistorico && historico.length > 0 && (
        <div className="card mb-6">
          <h3 className="text-sm font-semibold text-dark-300 mb-3 flex items-center gap-2">
            <History className="w-4 h-4" /> Últimas sessões remotas
          </h3>
          <div className="space-y-2">
            {historico.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-dark-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${s.status === 'FINALIZADA' ? 'bg-emerald-500' : s.status === 'RECUSADA' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-dark-300">{s.technician?.nome || '—'}</span>
                  {s.motivo && <span className="text-dark-500 truncate max-w-xs">— {s.motivo}</span>}
                </div>
                <div className="flex items-center gap-3 text-dark-500">
                  {s.duracaoSegundos && <span>{Math.round(s.duracaoSegundos / 60)}min</span>}
                  <span>{s.criadoEm ? new Date(s.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas em tempo real */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <MetricGauge label="CPU" value={metrics.cpuPercent} unit="%" color="brand" />
          <MetricGauge label="RAM" value={metrics.ramPercent} unit="%" color="blue" />
          <MetricGauge label="Disco" value={metrics.discoPercent} unit="%" color="amber" />
          <MetricGauge label="Uptime" value={metrics.uptimeSegundos ? Math.floor(metrics.uptimeSegundos / 3600) : 0} unit="h" color="emerald" />
        </div>
      )}

      {/* Informações do dispositivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Informações</h2>
          <div className="space-y-3">
            {infoItems.map(item => {
              if (!item.value) return null
              const Icon = item.icon
              return (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-dark-800 last:border-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-dark-500" />
                    <span className="text-dark-400 text-sm">{item.label}</span>
                  </div>
                  <span className="text-dark-200 text-sm font-medium">{item.value}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-4">Segurança</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-dark-800">
              <span className="text-dark-400 text-sm">Antivírus</span>
              <span className="text-dark-200 text-sm">{device.antivirusNome || 'Não detectado'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-800">
              <span className="text-dark-400 text-sm">Status Antivírus</span>
              <span className="text-dark-200 text-sm">{device.antivirusStatus || '—'}</span>
            </div>
            {device.tags && device.tags.length > 0 && (
              <div className="pt-2">
                <span className="text-dark-400 text-sm">Tags</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {device.tags.map((tag: string) => (
                    <span key={tag} className="bg-dark-700 text-dark-300 px-2 py-0.5 rounded text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricGauge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const colorMap: Record<string, string> = {
    brand: 'text-brand-400',
    blue: 'text-blue-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
  }
  const bgMap: Record<string, string> = {
    brand: 'bg-brand-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }
  const pct = unit === '%' ? Math.min(value, 100) : 100

  return (
    <div className="card text-center">
      <p className="text-dark-500 text-xs mb-2">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>
        {Math.round(value)}<span className="text-sm font-normal ml-0.5">{unit}</span>
      </p>
      {unit === '%' && (
        <div className="w-full h-1.5 bg-dark-700 rounded-full mt-2">
          <div
            className={`h-full rounded-full ${bgMap[color]} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
