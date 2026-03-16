'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { ticketsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'

export default function PortalChatPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    ticketsApi.listar()
      .then(({ data }) => setTickets(data.filter((t: any) => t.status !== 'fechado' && t.status !== 'cancelado')))
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Chat</h1>
        <p className="text-dark-400 text-sm mt-1">Converse com o suporte nos seus chamados ativos</p>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum chamado ativo para conversar</p>
            <Link href="/portal/tickets" className="btn-primary mt-4 inline-block">Abrir Chamado</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((t: any) => (
              <Link
                key={t.id}
                href={`/portal/tickets/${t.id}`}
                className="flex items-center justify-between p-4 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium group-hover:text-brand-400">{t.titulo}</p>
                    <p className="text-dark-500 text-xs mt-0.5">
                      {t.tecnicoAtribuido ? `Técnico: ${t.tecnicoAtribuido.nome}` : 'Aguardando atribuição'}
                    </p>
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
