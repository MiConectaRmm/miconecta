'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Ticket } from 'lucide-react'
import { ticketsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

export default function PortalTicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [novoTicket, setNovoTicket] = useState({ titulo: '', descricao: '', prioridade: 'media' })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [])

  const carregar = async () => {
    try {
      const { data } = await ticketsApi.listar()
      setTickets(data)
    } catch {}
    setCarregando(false)
  }

  const criar = async () => {
    try {
      await ticketsApi.criar({ ...novoTicket, origem: 'portal' })
      setShowModal(false)
      setNovoTicket({ titulo: '', descricao: '', prioridade: 'media' })
      carregar()
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus Chamados</h1>
          <p className="text-dark-400 text-sm mt-1">Acompanhe seus tickets de suporte</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Abrir Chamado
        </button>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum chamado aberto</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((t: any) => (
              <Link
                key={t.id}
                href={`/portal/tickets/${t.id}`}
                className="flex items-center justify-between p-4 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors"
              >
                <div>
                  <p className="text-white font-medium">{t.titulo}</p>
                  <p className="text-dark-500 text-xs mt-1">
                    {new Date(t.criadoEm).toLocaleDateString('pt-BR')}
                    {t.tecnicoAtribuido && ` · Técnico: ${t.tecnicoAtribuido.nome}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={t.prioridade} />
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Abrir Chamado">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Assunto</label>
            <input
              type="text"
              value={novoTicket.titulo}
              onChange={(e) => setNovoTicket({ ...novoTicket, titulo: e.target.value })}
              className="input w-full"
              placeholder="Resumo do problema"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Descrição</label>
            <textarea
              value={novoTicket.descricao}
              onChange={(e) => setNovoTicket({ ...novoTicket, descricao: e.target.value })}
              className="input w-full h-28 resize-none"
              placeholder="Descreva o problema..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Prioridade</label>
            <select
              value={novoTicket.prioridade}
              onChange={(e) => setNovoTicket({ ...novoTicket, prioridade: e.target.value })}
              className="input w-full"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={criar} className="btn-primary" disabled={!novoTicket.titulo || !novoTicket.descricao}>
              Enviar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
