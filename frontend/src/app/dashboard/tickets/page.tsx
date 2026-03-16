'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Ticket, Filter, Search } from 'lucide-react'
import { ticketsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import StatCard from '@/components/ui/StatCard'
import Modal from '@/components/ui/Modal'

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [contagem, setContagem] = useState({ abertos: 0, emAtendimento: 0, aguardando: 0, resolvidos: 0, total: 0 })
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [novoTicket, setNovoTicket] = useState({ titulo: '', descricao: '', prioridade: 'media' })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [filtroStatus])

  const carregar = async () => {
    try {
      const [ticketsRes, contagemRes] = await Promise.all([
        ticketsApi.listar(filtroStatus ? { status: filtroStatus } : undefined),
        ticketsApi.contagem(),
      ])
      setTickets(ticketsRes.data)
      setContagem(contagemRes.data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  const criarTicket = async () => {
    try {
      await ticketsApi.criar(novoTicket)
      setShowModal(false)
      setNovoTicket({ titulo: '', descricao: '', prioridade: 'media' })
      carregar()
    } catch (err) {
      console.error('Erro ao criar ticket:', err)
    }
  }

  const filtrados = tickets.filter(t =>
    !busca || t.titulo?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets</h1>
          <p className="text-dark-400 text-sm mt-1">Help desk e chamados de suporte</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Ticket
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Abertos', value: contagem.abertos, filter: 'aberto', color: 'text-blue-400' },
          { label: 'Atendimento', value: contagem.emAtendimento, filter: 'em_atendimento', color: 'text-amber-400' },
          { label: 'Aguardando', value: contagem.aguardando, filter: 'aguardando_cliente', color: 'text-purple-400' },
          { label: 'Resolvidos', value: contagem.resolvidos, filter: 'resolvido', color: 'text-emerald-400' },
          { label: 'Total', value: contagem.total, filter: '', color: 'text-dark-300' },
        ].map(item => (
          <button
            key={item.label}
            onClick={() => setFiltroStatus(item.filter)}
            className={`card text-center cursor-pointer transition-colors ${filtroStatus === item.filter ? 'ring-1 ring-brand-500' : 'hover:bg-dark-700'}`}
          >
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-dark-500 text-xs mt-1">{item.label}</p>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Buscar tickets..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
        </div>

        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum ticket encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((ticket: any) => (
              <Link
                key={ticket.id}
                href={`/dashboard/tickets/${ticket.id}`}
                className="flex items-center justify-between p-4 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-medium group-hover:text-brand-400 truncate">{ticket.titulo}</p>
                    <StatusBadge status={ticket.prioridade} />
                  </div>
                  <p className="text-dark-500 text-xs mt-1">
                    {ticket.criadoPorNome} · {new Date(ticket.criadoEm).toLocaleDateString('pt-BR')}
                    {ticket.tecnicoAtribuido && ` · Atribuído: ${ticket.tecnicoAtribuido.nome}`}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Ticket" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Título</label>
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
              className="input w-full h-32 resize-none"
              placeholder="Descreva o problema em detalhes..."
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
            <button onClick={criarTicket} className="btn-primary" disabled={!novoTicket.titulo || !novoTicket.descricao}>
              Criar Ticket
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
