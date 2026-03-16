'use client'

import { useEffect, useState } from 'react'
import { History, Clock } from 'lucide-react'
import { auditApi } from '@/lib/api'

export default function PortalHistoryPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    auditApi.listar({ limit: 50 })
      .then(({ data }) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Histórico</h1>
        <p className="text-dark-400 text-sm mt-1">Atividades recentes na sua conta</p>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhuma atividade registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-dark-900">
                <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-dark-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-dark-200">
                    <span className="font-medium text-white">{log.usuarioNome || 'Sistema'}</span>
                    {' '}{log.acao}{' '}
                    {log.recurso && <span className="text-dark-400">{log.recurso}</span>}
                  </p>
                  <p className="text-xs text-dark-500 mt-0.5">
                    {new Date(log.criadoEm).toLocaleString('pt-BR')}
                    {log.ip && ` · ${log.ip}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
