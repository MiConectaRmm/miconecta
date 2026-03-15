'use client'

import { useEffect, useState } from 'react'
import { FileText, User, Clock } from 'lucide-react'
import { auditApi } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarLogs()
  }, [])

  const carregarLogs = async () => {
    try {
      const { data } = await auditApi.listar()
      setLogs(data)
    } catch (err) {
      console.error('Erro ao carregar logs:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Auditoria</h1>
        <p className="text-dark-400 mt-1">Registro de atividades na plataforma</p>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum registro de auditoria</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {logs.map((log: any) => (
              <div key={log.id} className="py-4 flex items-start gap-4">
                <div className="w-9 h-9 bg-dark-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-dark-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm">
                    <span className="font-medium">{log.usuarioNome || 'Sistema'}</span>
                    {' '}{log.acao}{' '}
                    <span className="text-dark-400">{log.recurso}</span>
                    {log.recursoId && <span className="text-dark-500"> ({log.recursoId})</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(log.criadoEm)}
                    </span>
                    {log.ip && <span>IP: {log.ip}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
