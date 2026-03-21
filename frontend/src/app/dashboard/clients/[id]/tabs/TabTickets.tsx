'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Ticket, Search, AlertTriangle } from 'lucide-react'
import { ticketsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

interface Props {
  tenantId: string
}

export default function TabTickets({ tenantId }: Props) {
  const [tickets, setTickets] = useState<any[]>([])
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [novoTicket, setNovoTicket] = useState({ titulo: '', descricao: '', prioridade: 'media' })
  const [carregando, setCarregando] = useState(true)
  const [contagem, setContagem] = useState({ abertos: 0, emAtendimento: 0, aguardando: 0, urgentes: 0, total: 0 })

  useEffect(() => { carregar() }, [tenantId, filtroStatus, filtroPrioridade])

  const carregar = async () => {
    try {
      const filtros: Record<string, string> = { tenantId }
      if (filtroStatus) filtros.status = filtroStatus
      if (filtroPrioridade) filtros.prioridade = filtroPrioridade
      const [ticketsRes, contagemRes] = await Promise.allSettled([
        ticketsApi.listar(filtros),
        ticketsApi.contagem(),
      ])
      if (ticketsRes.status === 'fulfilled') {
        const d = ticketsRes.value.data
        setTickets(Array.isArray(d) ? d : d?.items || [])
      }
      if (contagemRes.status === 'fulfilled') setContagem(contagemRes.value.data)
    } catch {} finally { setCarregando(false) }
  }

  const criarTicket = async () => {
    try {
      await ticketsApi.criar({ ...novoTicket, tenantId })
      setShowModal(false)
      setNovoTicket({ titulo: '', descricao: '', prioridade: 'media' })
      carregar()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao criar ticket')
    }
  }

  const filtrados = tickets.filter(t => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return t.titulo?.toLowerCase().includes(b) || String(t.numero).includes(b) || t.criadoPorNome?.toLowerCase().includes(b)
  })

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: 'Abertos', value: contagem.abertos, color: 'text-blue-400' },
          { label: 'Atendimento', value: contagem.emAtendimento, color: 'text-amber-400' },
          { label: 'Aguardando', value: contagem.aguardando, color: 'text-purple-400' },
          { label: 'Urgentes', value: contagem.urgentes, color: 'text-red-400' },
          { label: 'Total', value: contagem.total, color: 'text-white' },
        ].map(item => (
          <div key={item.label} className="card text-center py-3">
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
            <p className="text-dark-500 text-xs">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros + botão */}
      <div className="card mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input type="text" placeholder="Buscar por #, título ou cliente..." value={busca}
              onChange={(e) => setBusca(e.target.value)} className="input w-full pl-9" />
          </div>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="input w-40">
            <option value="">Todos status</option>
            <option value="aberto">Aberto</option>
            <option value="em_atendimento">Em Atendimento</option>
            <option value="aguardando_cliente">Aguard. Cliente</option>
            <option value="resolvido">Resolvido</option>
            <option value="fechado">Fechado</option>
          </select>
          <select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)} className="input w-36">
            <option value="">Prioridade</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Novo Ticket
          </button>
        </div>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="card text-center py-12 text-dark-400">Carregando tickets...</div>
      ) : filtrados.length === 0 ? (
        <div className="card text-center py-12">
          <Ticket className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">Nenhum ticket encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map((ticket: any) => (
            <Link key={ticket.id} href={`/dashboard/tickets/${ticket.id}`}
              className={`card flex items-center justify-between p-4 hover:bg-dark-700 transition-colors group border ${
                ticket.prioridade === 'urgente' ? 'border-red-500/70' : ticket.prioridade === 'alta' ? 'border-amber-500/40' : 'border-transparent'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <p className="text-white font-medium group-hover:text-brand-400 truncate">{ticket.titulo}</p>
                  <StatusBadge status={ticket.prioridade} />
                  {ticket.hasUnreadFromClient && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                      <AlertTriangle className="w-3 h-3" /> Nova msg
                    </span>
                  )}
                </div>
                <p className="text-dark-500 text-xs mt-1">
                  #{ticket.numero} · {ticket.criadoPorNome} · {new Date(ticket.criadoEm).toLocaleDateString('pt-BR')}
                  {ticket.tecnicoAtribuido ? ` · ${ticket.tecnicoAtribuido.nome}` : ' · Sem responsável'}
                </p>
              </div>
              <StatusBadge status={ticket.status} />
            </Link>
          ))}
        </div>
      )}

      {/* Modal criar ticket */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Ticket" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Título</label>
            <input type="text" value={novoTicket.titulo} onChange={(e) => setNovoTicket({ ...novoTicket, titulo: e.target.value })} className="input w-full" placeholder="Resumo do problema" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Descrição</label>
            <textarea value={novoTicket.descricao} onChange={(e) => setNovoTicket({ ...novoTicket, descricao: e.target.value })} className="input w-full h-32 resize-none" placeholder="Descreva o problema..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Prioridade</label>
            <select value={novoTicket.prioridade} onChange={(e) => setNovoTicket({ ...novoTicket, prioridade: e.target.value })} className="input w-full">
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={criarTicket} className="btn-primary" disabled={!novoTicket.titulo || !novoTicket.descricao}>Criar Ticket</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
