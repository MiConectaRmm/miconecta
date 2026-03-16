'use client'

import { useEffect, useState } from 'react'
import { Radio, Clock, User, Monitor } from 'lucide-react'
import { sessionsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'

export default function PortalSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    sessionsApi.listar()
      .then(({ data }) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const formatDuracao = (seg: number | null) => {
    if (!seg) return '—'
    if (seg < 60) return `${seg}s`
    if (seg < 3600) return `${Math.round(seg / 60)}min`
    return `${Math.round(seg / 3600)}h ${Math.round((seg % 3600) / 60)}min`
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sessões Remotas</h1>
        <p className="text-dark-400 text-sm mt-1">Histórico de acessos remotos aos seus dispositivos</p>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <Radio className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhuma sessão remota registrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Dispositivo</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Técnico</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Duração</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Data</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Consentimento</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => (
                  <tr key={s.id} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-dark-500" />
                        <span className="text-white font-medium">{s.device?.hostname || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-dark-500" />
                        <span className="text-dark-300">{s.technician?.nome || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3"><StatusBadge status={s.status} /></td>
                    <td className="py-2.5 px-3 text-dark-400">{formatDuracao(s.duracaoSegundos)}</td>
                    <td className="py-2.5 px-3 text-dark-400 text-xs">{new Date(s.criadoEm).toLocaleString('pt-BR')}</td>
                    <td className="py-2.5 px-3">
                      {s.consentidoPor ? (
                        <span className="text-emerald-400 text-xs">{s.consentidoPor}</span>
                      ) : s.status === 'recusada' ? (
                        <span className="text-red-400 text-xs">Recusado</span>
                      ) : (
                        <span className="text-dark-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
