'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Ticket, Search, User, AlertTriangle } from 'lucide-react'
import { ticketsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'

export default function TicketsPage() {
  const user = useAuthStore((s) => s.user)
  const [tickets, setTickets] = useState<any[]>([])
  const [contagem, setContagem] = useState({
    abertos: 0,
    emAtendimento: 0,
    aguardando: 0,
    resolvidos: 0,
    total: 0,
    urgentes: 0,
    comNovaMensagem: 0,
    fechadosHoje: 0,
  })
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroPrioridade, setFiltroPrioridade] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [apenasMeus, setApenasMeus] = useState(false)
  const [semResponsavel, setSemResponsavel] = useState(false)
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [novoTicket, setNovoTicket] = useState({ titulo: '', descricao: '', prioridade: 'media', categoriaId: '' })
  const [carregando, setCarregando] = useState(true)
  const { on } = useSocket('/chat')

  const isTechnician = user?.userType === 'technician' && user?.role === 'tecnico'

  useEffect(() => { carregar() }, [filtroStatus, filtroPrioridade, filtroCategoria, apenasMeus, semResponsavel])

  useEffect(() => {
    const unsubMessage = on('message:new', () => carregar())
    const unsubTicketUpdated = on('ticket:updated', () => carregar())
    const unsubNotification = on('notification:new', () => carregar())
    return () => {
      unsubMessage()
      unsubTicketUpdated()
      unsubNotification()
    }
  }, [on])

  const carregar = async () => {
    try {
      const filtros: Record<string, string> = {}
      if (filtroStatus) filtros.status = filtroStatus
      if (filtroPrioridade) filtros.prioridade = filtroPrioridade
      if (filtroCategoria) filtros.categoriaId = filtroCategoria
      if (apenasMeus && user?.id) filtros.atribuidoA = user.id
      if (semResponsavel) filtros.atribuidoA = 'none'

      const [ticketsRes, contagemRes] = await Promise.all([
        ticketsApi.listar(Object.keys(filtros).length ? filtros : undefined),
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
      setNovoTicket({ titulo: '', descricao: '', prioridade: 'media', categoriaId: '' })
      carregar()
    } catch (err) {
      console.error('Erro ao criar ticket:', err)
    }
  }

  const filtrados = tickets.filter(t => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return (
      t.titulo?.toLowerCase().includes(b) ||
      String(t.numero).includes(b) ||
      t.criadoPorNome?.toLowerCase().includes(b)
    )
  })

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

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Abertos', value: contagem.abertos, filter: 'aberto', color: 'text-blue-400' },
          { label: 'Atendimento', value: contagem.emAtendimento, filter: 'em_atendimento', color: 'text-amber-400' },
          { label: 'Aguardando cliente', value: contagem.aguardando, filter: 'aguardando_cliente', color: 'text-purple-400' },
          { label: 'Urgentes', value: contagem.urgentes, filter: '', color: 'text-red-400' },
          { label: 'Nova mensagem', value: contagem.comNovaMensagem, filter: '', color: 'text-emerald-400' },
          { label: 'Fechados hoje', value: contagem.fechadosHoje, filter: '', color: 'text-slate-300' },
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Buscar por #, título ou cliente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              className="input w-32"
            >
              <option value="">Todas prioridades</option>
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="input w-40"
            >
              <option value="">Todas categorias</option>
              <option value="suporte_tecnico">Suporte técnico</option>
              <option value="email">E-mail</option>
              <option value="rede">Rede</option>
              <option value="impressora">Impressora</option>
              <option value="servidor">Servidor</option>
              <option value="backup">Backup</option>
              <option value="acesso">Acesso</option>
              <option value="financeiro">Financeiro</option>
              <option value="solicitacao">Solicitação</option>
              <option value="incidente">Incidente</option>
            </select>
            <button
              onClick={() => { setApenasMeus(!apenasMeus); setSemResponsavel(false) }}
              className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1 ${
                apenasMeus ? 'border-brand-500 text-brand-400 bg-brand-500/10' : 'border-dark-700 text-dark-300'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Meus
            </button>
            <button
              onClick={() => { setSemResponsavel(!semResponsavel); setApenasMeus(false) }}
              className={`px-3 py-1.5 rounded-lg border text-xs ${
                semResponsavel ? 'border-amber-500 text-amber-400 bg-amber-500/10' : 'border-dark-700 text-dark-300'
              }`}
            >
              Sem responsável
            </button>
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
            {filtrados.map((ticket: any) => {
              // Para técnico: link vai para página do cliente com ticket específico
              const href = isTechnician 
                ? `/dashboard/clientes/${ticket.tenantId}?ticket=${ticket.id}`
                : `/dashboard/tickets/${ticket.id}`
              
              return (
                <Link
                  key={ticket.id}
                  href={href}
                  className={`flex items-center justify-between p-4 rounded-lg bg-dark-900 hover:bg-dark-700 transition-colors group border ${
                    ticket.prioridade === 'urgente'
                      ? 'border-red-500/70'
                      : ticket.prioridade === 'alta'
                        ? 'border-amber-500/40'
                        : 'border-transparent'
                  }`}
                >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-white font-medium group-hover:text-brand-400 truncate">{ticket.titulo}</p>
                    <StatusBadge status={ticket.prioridade} />
                    {ticket.categoriaId && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-dark-800 text-dark-300 uppercase tracking-wide">
                        {ticket.categoriaId.replace('_', ' ')}
                      </span>
                    )}
                    {ticket.hasUnreadFromClient && (
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                        <AlertTriangle className="w-3 h-3" /> Nova mensagem
                      </span>
                    )}
                  </div>
                  <p className="text-dark-500 text-xs mt-1">
                    #{ticket.numero} · {ticket.criadoPorNome} · {new Date(ticket.criadoEm).toLocaleDateString('pt-BR')}
                    {ticket.tecnicoAtribuido
                      ? ` · Técnico: ${ticket.tecnicoAtribuido.nome}`
                      : ' · Sem responsável'}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </Link>
            )})}
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
