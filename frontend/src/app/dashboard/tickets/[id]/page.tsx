'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Send, ArrowLeft, Clock, User, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { ticketsApi, chatApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import { useChatSocket } from '@/hooks/useSocket'
import StatusBadge from '@/components/ui/StatusBadge'

export default function TicketDetailPage() {
  const { id } = useParams() as { id: string }
  const user = useAuthStore((s) => s.user)
  const [ticket, setTicket] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [tab, setTab] = useState<'chat' | 'timeline'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { on, sendMessage } = useChatSocket(id)

  useEffect(() => {
    carregar()
  }, [id])

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
      carregar()
    } catch (err) {
      console.error('Erro:', err)
    }
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
              <StatusBadge status={ticket.status} size="md" />
              <StatusBadge status={ticket.prioridade} />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">{ticket.titulo}</h1>
            <p className="text-dark-400 text-sm">{ticket.descricao}</p>

            <div className="mt-4 space-y-3 border-t border-dark-700 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Criado por</span>
                <span className="text-dark-200">{ticket.criadoPorNome}</span>
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
              {ticket.slaResolucaoEm && (
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">SLA Resolução</span>
                  <span className="text-dark-200">{new Date(ticket.slaResolucaoEm).toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              {ticket.status !== 'resolvido' && ticket.status !== 'fechado' && (
                <button onClick={() => handleAction('resolver')} className="btn-primary text-xs py-1.5">Resolver</button>
              )}
              {ticket.status === 'resolvido' && (
                <button onClick={() => handleAction('fechar')} className="btn-secondary text-xs py-1.5">Fechar</button>
              )}
              {(ticket.status === 'resolvido' || ticket.status === 'fechado') && (
                <button onClick={() => handleAction('reabrir')} className="btn-secondary text-xs py-1.5">Reabrir</button>
              )}
            </div>
          </div>
        </div>

        {/* Chat + Timeline */}
        <div className="lg:col-span-2 card flex flex-col" style={{ height: '70vh' }}>
          <div className="flex gap-4 border-b border-dark-700 pb-3 mb-3">
            <button
              onClick={() => setTab('chat')}
              className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 transition-colors ${tab === 'chat' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-dark-200'}`}
            >
              <MessageSquare className="w-4 h-4" /> Chat
            </button>
            <button
              onClick={() => setTab('timeline')}
              className={`flex items-center gap-2 text-sm font-medium pb-1 border-b-2 transition-colors ${tab === 'timeline' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-dark-200'}`}
            >
              <Clock className="w-4 h-4" /> Timeline
            </button>
          </div>

          {tab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
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
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3">
              {timeline.map((event: any, i: number) => (
                <div key={event.id || i} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {event.autorTipo === 'system' ? (
                      <Clock className="w-3.5 h-3.5 text-dark-400" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-dark-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-dark-200">{event.conteudo}</p>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {event.autorNome} · {new Date(event.criadoEm).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
