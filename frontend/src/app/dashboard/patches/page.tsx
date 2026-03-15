'use client'

import { useEffect, useState } from 'react'
import { Shield, Download, Calendar } from 'lucide-react'
import { patchesApi } from '@/lib/api'

const severidadeCor: Record<string, string> = {
  critico: 'text-red-400 bg-red-500/10',
  importante: 'text-amber-400 bg-amber-500/10',
  moderado: 'text-blue-400 bg-blue-500/10',
  baixo: 'text-dark-400 bg-dark-700',
}

export default function PatchesPage() {
  const [resumo, setResumo] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarResumo()
  }, [])

  const carregarResumo = async () => {
    try {
      const { data } = await patchesApi.resumo()
      setResumo(data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  // Agrupar por status
  const grupos = resumo.reduce((acc: any, item: any) => {
    if (!acc[item.status]) acc[item.status] = []
    acc[item.status].push(item)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Patch Management</h1>
        <p className="text-dark-400 mt-1">Gerencie atualizações de segurança e patches</p>
      </div>

      {carregando ? (
        <div className="card text-center py-12 text-dark-400">Carregando resumo de patches...</div>
      ) : resumo.length === 0 ? (
        <div className="card text-center py-12">
          <Shield className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-dark-300 text-lg font-medium">Todos os dispositivos estão atualizados</p>
          <p className="text-dark-500 text-sm mt-1">Nenhum patch pendente encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(grupos).map(([status, items]: [string, any]) => {
            const total = items.reduce((sum: number, i: any) => sum + parseInt(i.total), 0)
            return (
              <div key={status} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-dark-300 font-medium capitalize">{status}</h3>
                  <span className="text-2xl font-bold text-white">{total}</span>
                </div>
                <div className="space-y-1">
                  {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${severidadeCor[item.severidade] || 'text-dark-400 bg-dark-700'}`}>
                        {item.severidade}
                      </span>
                      <span className="text-dark-400">{item.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
