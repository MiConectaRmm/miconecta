'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Send, ArrowLeft, Clock, User, MessageSquare, FileText,
  Monitor, Shield, Terminal, Paperclip, Star, AlertTriangle,
  CheckCircle, XCircle, Play, Square, BarChart3, StickyNote
} from 'lucide-react'
import Link from 'next/link'
import { ticketsApi, chatApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useChatSocket } from '@/hooks/useSocket'
import StatusBadge from '@/components/ui/StatusBadge'

const TIMELINE_ICONS: Record<string, any> = {
  ticket_criado: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ticket_atribuido: { icon: User, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ticket_status_alterado: { icon: CheckCircle, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ticket_avaliado: { icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ticket_sla_breach: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  chat_mensagem: { icon: MessageSquare, color: 'text-brand-400', bg: 'bg-brand-500/10' },
  chat_arquivo: { icon: Paperclip, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  chat_imagem: { icon: Paperclip, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  chat_sistema: { icon: Monitor, color: 'text-dark-400', bg: 'bg-dark-700' },
  nota_interna: { icon: StickyNote, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  comentario: { icon: MessageSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
  sessao_solicitada: { icon: Monitor, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  sessao_consentida: { icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
  sessao_recusada: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  sessao_iniciada: { icon: Play, color: 'text-green-400', bg: 'bg-green-500/10' },
  sessao_finalizada: { icon: Square, color: 'text-dark-400', bg: 'bg-dark-700' },
  script_executado: { icon: Terminal, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  anexo_adicionado: { icon: Paperclip, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  sistema: { icon: Clock, color: 'text-dark-400', bg: 'bg-dark-700' },
}

export default function TicketDetailPage() {
  const { id } = useParams() as { id: string }
  const user = useAuthStore((s) => s.user)
  const [ticket, setTicket] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [resumo, setResumo] = useState<any>(null)
  const [newMsg, setNewMsg] = useState('')
  const [tab, setTab] = useState<'chat' | 'timeline' | 'resumo'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { on, sendMessage } = useChatSocket(id)

  useEffect(() => { carregar() }, [id])

  useEffect(() => {
    const unsub = on('chat:new_message', (msg: any) => {
      setMessages((prev) => [...prev, msg])
    })
    return unsub
  }, [on])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const carregar = async () => {
    try {
      const [ticketRes, timelineRes, chatRes] = await Promise.all([
        ticketsApi.buscar(id),
        ticketsApi.timeline(id),
        chatApi.mensagens(id),
      ])
      setTicket(ticketRes.data)
      setTimeline(timelineRes.data)
      setMessages(chatRes.data)
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  const carregarResumo = async () => {
    try {
      const res = await ticketsApi.resumo(id)
      setResumo(res.data)
    } catch (err) {
      console.error('Erro ao carregar resumo:', err)
    }
  }

  const enviarMensagem = async () => {
    if (!newMsg.trim() || !user) return
    try {
      await chatApi.enviar(id, newMsg)
      sendMessage(newMsg, user.id, user.nome, user.userType)
      setNewMsg('')
    } catch (err) {
      console.error('Erro ao enviar:', err)
    }
  }

  const handleAction = async (action: string) => {
    try {
      if (action === 'resolver') await ticketsApi.resolver(id)
      if (action === 'fechar') await ticketsApi.fechar(id)
      if (action === 'reabrir') await ticketsApi.reabrir(id)
      if (action === 'cancelar') await ticketsApi.cancelar(id)
      carregar()
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  const getTimelineIcon = (tipo: string) => {
    const config = TIMELINE_ICONS[tipo] || TIMELINE_ICONS.sistema
    const Icon = config.icon
    return (
      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
      </div>
    )
  }

  if (!ticket) {
    return <div className="text-center py-12 text-dark-400">Carregando...</div>
  }

  return (
    <div>
      <Link href="/dashboard/tickets" className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar para tickets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info do ticket */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-dark-500 text-xs">#{ticket.numero}</span>
              <div className="flex items-center gap-2">
                <StatusBadge status={ticket.prioridade} />
                <StatusBadge status={ticket.status} size="md" />
              </div>
            </div>
            <h1 className="text-lg font-bold text-white mb-2">{ticket.titulo}</h1>
            <p className="text-dark-400 text-sm">{ticket.descricao}</p>

            <div className="mt-4 space-y-2.5 border-t border-dark-700 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Criado por</span>
                <span className="text-dark-200">{ticket.criadoPorNome}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Origem</span>
                <span className="text-dark-200 capitalize">{ticket.origem}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Data</span>
                <span className="text-dark-200">{new Date(ticket.criadoEm).toLocaleString('pt-BR')}</span>
              </div>
              {ticket.tecnicoAtribuido && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">Técnico</span>
                  <span className="text-dark-200">{ticket.tecnicoAtribuido.nome}</span>
                </div>
              )}
              {ticket.device && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">Dispositivo</span>
                  <span className="text-dark-200">{ticket.device.hostname}</span>
                </div>
              )}
              {ticket.slaResolucaoEm && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">SLA Resolução</span>
                  <span className={`${new Date(ticket.slaResolucaoEm) < new Date() && ticket.status !== 'resolvido' && ticket.status !== 'fechado' ? 'text-red-400' : 'text-dark-200'}`}>
                    {new Date(ticket.slaResolucaoEm).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
              {ticket.avaliacaoNota && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">Avaliação</span>
                  <span className="text-amber-400">{'★'.repeat(ticket.avaliacaoNota)}{'☆'.repeat(5 - ticket.avaliacaoNota)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              {ticket.status !== 'resolvido' && ticket.status !== 'fechado' && ticket.status !== 'cancelado' && (
                <button onClick={() => handleAction('resolver')} className="btn-primary text-xs py-1.5">Resolver</button>
              )}
              {ticket.status === 'resolvido' && (
                <button onClick={() => handleAction('fechar')} className="btn-secondary text-xs py-1.5">Fechar</button>
              )}
              {(ticket.status === 'resolvido' || ticket.status === 'fechado') && (
                <button onClick={() => handleAction('reabrir')} className="btn-secondary text-xs py-1.5">Reabrir</button>
              )}
              {ticket.status !== 'cancelado' && ticket.status !== 'fechado' && (
                <button onClick={() => handleAction('cancelar')} className="text-xs py-1.5 px-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">Cancelar</button>
              )}
            </div>
          </div>
        </div>

        {/* Chat + Timeline + Resumo */}
        <div className="lg:col-span-2 card flex flex-col" style={{ height: '70vh' }}>
          <div className="flex gap-4 border-b border-dark-700 pb-3 mb-3">
            <button
              onClick={() => setTab('chat')}
              className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 transition-colors ${tab === 'chat' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-dark-200'}`}
            >
              <MessageSquare className="w-4 h-4" /> Chat
              {messages.length > 0 && <span className="text-[10px] bg-dark-700 px-1.5 py-0.5 rounded-full">{messages.length}</span>}
            </button>
            <button
              onClick={() => setTab('timeline')}
              className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 transition-colors ${tab === 'timeline' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-dark-200'}`}
            >
              <Clock className="w-4 h-4" /> Timeline
            </button>
            <button
              onClick={() => { setTab('resumo'); carregarResumo() }}
              className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 transition-colors ${tab === 'resumo' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-dark-200'}`}
            >
              <BarChart3 className="w-4 h-4" /> Resumo
            </button>
          </div>

          {tab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-dark-500 text-sm">Nenhuma mensagem ainda</div>
                )}
                {messages.map((msg: any, i: number) => {
                  const isOwn = msg.remetenteId === user?.id
                  return (
                    <div key={msg.id || i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                        msg.remetenteTipo === 'system'
                          ? 'bg-dark-700 text-dark-400 text-xs text-center w-full max-w-full'
                          : isOwn
                            ? 'bg-brand-600 text-white'
                            : 'bg-dark-700 text-dark-100'
                      }`}>
                        {msg.remetenteTipo !== 'system' && !isOwn && (
                          <p className="text-xs font-medium text-dark-400 mb-1">{msg.remetenteNome}</p>
                        )}
                        {msg.arquivoUrl && (
                          <a href={msg.arquivoUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs underline mb-1 opacity-80">
                            <Paperclip className="w-3 h-3" /> {msg.arquivoNome || 'Arquivo'}
                          </a>
                        )}
                        <p className="text-sm">{msg.conteudo}</p>
                        <p className="text-[10px] opacity-60 mt-1">
                          {new Date(msg.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-dark-700">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
                  className="input flex-1"
                  placeholder="Digite sua mensagem..."
                />
                <button onClick={enviarMensagem} className="btn-primary px-4" disabled={!newMsg.trim()}>
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : tab === 'timeline' ? (
            <div className="flex-1 overflow-y-auto space-y-1 pr-2">
              {timeline.length === 0 && (
                <div className="text-center py-8 text-dark-500 text-sm">Nenhum evento na timeline</div>
              )}
              {timeline.map((event: any, i: number) => (
                <div key={event.id || i} className="flex gap-3 py-2 hover:bg-dark-900/50 rounded-lg px-2 transition-colors">
                  {getTimelineIcon(event.tipo)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-dark-200 truncate">{event.conteudo}</p>
                      {event.tipo === 'nota_interna' && (
                        <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded flex-shrink-0">interno</span>
                      )}
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {event.autorNome} · {new Date(event.timestamp).toLocaleString('pt-BR')}
                      <span className="text-dark-600 ml-1">({event.fonte})</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2">
              {!resumo ? (
                <div className="text-center py-8 text-dark-500 text-sm">Carregando resumo...</div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-dark-900 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-brand-400">{resumo.totalMensagensChat}</p>
                      <p className="text-[10px] text-dark-500 mt-1">Mensagens</p>
                    </div>
                    <div className="bg-dark-900 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-indigo-400">{resumo.totalSessoesRemotas}</p>
                      <p className="text-[10px] text-dark-500 mt-1">Sessões</p>
                    </div>
                    <div className="bg-dark-900 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-emerald-400">{resumo.totalScriptsExecutados}</p>
                      <p className="text-[10px] text-dark-500 mt-1">Scripts</p>
                    </div>
                    <div className="bg-dark-900 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-white">{resumo.duracaoMinutos < 60 ? `${resumo.duracaoMinutos}m` : `${Math.floor(resumo.duracaoMinutos / 60)}h`}</p>
                      <p className="text-[10px] text-dark-500 mt-1">Duração</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {resumo.slaRespostaCumprido !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        {resumo.slaRespostaCumprido ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-dark-300">SLA Resposta: {resumo.slaRespostaCumprido ? 'Cumprido' : 'Violado'}</span>
                        {resumo.tempoRespostaMinutos !== null && (
                          <span className="text-dark-500 text-xs">({resumo.tempoRespostaMinutos} min)</span>
                        )}
                      </div>
                    )}
                    {resumo.slaResolucaoCumprido !== null && (
                      <div className="flex items-center gap-2 text-sm">
                        {resumo.slaResolucaoCumprido ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-dark-300">SLA Resolução: {resumo.slaResolucaoCumprido ? 'Cumprido' : 'Violado'}</span>
                      </div>
                    )}
                  </div>

                  {resumo.participantes?.length > 0 && (
                    <div>
                      <h4 className="text-xs text-dark-500 uppercase mb-2">Participantes</h4>
                      <div className="space-y-1.5">
                        {resumo.participantes.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-dark-900 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-dark-500" />
                              <span className="text-sm text-dark-200">{p.nome}</span>
                              <span className="text-[10px] text-dark-600 capitalize">{p.tipo}</span>
                            </div>
                            <span className="text-xs text-dark-400">{p.mensagens} msg</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs text-dark-500 uppercase mb-2">Resumo do Atendimento</h4>
                    <pre className="bg-dark-900 rounded-lg p-3 text-sm text-dark-300 whitespace-pre-wrap font-sans">{resumo.resumoTexto}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
