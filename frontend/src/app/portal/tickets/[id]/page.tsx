'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Clock, MessageSquare, FileText, Paperclip } from 'lucide-react'
import { ticketsApi, chatApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAuthStore } from '@/stores/auth.store'

export default function PortalTicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [ticket, setTicket] = useState<any>(null)
  const [mensagens, setMensagens] = useState<any[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [novaMsg, setNovaMsg] = useState('')
  const [tab, setTab] = useState<'chat' | 'timeline'>('chat')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) return
    carregar()
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const carregar = async () => {
    try {
      const [tRes, mRes, tlRes] = await Promise.allSettled([
        ticketsApi.buscar(id),
        chatApi.mensagens(id, 200),
        ticketsApi.timeline(id, 200),
      ])
      if (tRes.status === 'fulfilled') setTicket(tRes.value.data)
      if (mRes.status === 'fulfilled') setMensagens(mRes.value.data || [])
      if (tlRes.status === 'fulfilled') setTimeline(tlRes.value.data || [])
    } catch {}
    setCarregando(false)
  }

  const enviarMensagem = async () => {
    if (!novaMsg.trim() || enviando) return
    setEnviando(true)
    try {
      await chatApi.enviar(id, novaMsg.trim())
      setNovaMsg('')
      const { data } = await chatApi.mensagens(id, 200)
      setMensagens(data || [])
    } catch {}
    setEnviando(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem()
    }
  }

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando...</div>
  if (!ticket) return <div className="text-center py-12 text-dark-400">Chamado não encontrado</div>

  return (
    <div>
      <Link href="/portal/tickets" className="flex items-center gap-2 text-dark-400 hover:text-white mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Voltar aos Chamados
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">{ticket.titulo}</h1>
          <p className="text-dark-400 text-sm mt-1">
            #{ticket.numero} · Aberto em {new Date(ticket.criadoEm).toLocaleDateString('pt-BR')}
            {ticket.tecnicoAtribuido && ` · Técnico: ${ticket.tecnicoAtribuido.nome}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={ticket.prioridade} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {ticket.descricao && (
        <div className="card mb-4">
          <p className="text-dark-300 text-sm whitespace-pre-wrap">{ticket.descricao}</p>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'chat' ? 'bg-brand-600/20 text-brand-400' : 'text-dark-400 hover:bg-dark-800'}`}>
          <MessageSquare className="w-4 h-4" /> Chat
        </button>
        <button onClick={() => setTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'timeline' ? 'bg-brand-600/20 text-brand-400' : 'text-dark-400 hover:bg-dark-800'}`}>
          <Clock className="w-4 h-4" /> Timeline ({timeline.length})
        </button>
      </div>

      {tab === 'chat' && (
        <div className="card flex flex-col" style={{ height: '500px' }}>
          <div className="flex-1 overflow-y-auto space-y-3 p-1 mb-3">
            {mensagens.length === 0 ? (
              <div className="text-center py-12 text-dark-500">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 text-dark-600" />
                <p>Nenhuma mensagem ainda. Inicie a conversa!</p>
              </div>
            ) : (
              mensagens.map((m: any) => {
                const isMe = m.remetenteId === user?.id
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isMe ? 'bg-brand-600 text-white' : 'bg-dark-800 text-dark-200'}`}>
                      {!isMe && <p className="text-xs font-medium mb-1 opacity-70">{m.remetenteNome}</p>}
                      {m.arquivoUrl ? (
                        <a href={m.arquivoUrl} target="_blank" rel="noopener" className="flex items-center gap-2 underline text-sm">
                          <Paperclip className="w-3.5 h-3.5" /> {m.arquivoNome || 'Arquivo'}
                        </a>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{m.conteudo}</p>
                      )}
                      <p className={`text-xs mt-1 ${isMe ? 'text-white/50' : 'text-dark-500'}`}>
                        {new Date(m.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {ticket.status !== 'fechado' && ticket.status !== 'cancelado' && (
            <div className="flex items-center gap-2 pt-3 border-t border-dark-700">
              <input
                type="text"
                value={novaMsg}
                onChange={(e) => setNovaMsg(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="input flex-1"
              />
              <button onClick={enviarMensagem} disabled={!novaMsg.trim() || enviando}
                className="btn-primary p-2.5 rounded-lg disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'timeline' && (
        <div className="card">
          {timeline.length === 0 ? (
            <div className="text-center py-8 text-dark-500">Nenhum evento na timeline</div>
          ) : (
            <div className="space-y-3">
              {timeline.map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-dark-900">
                  <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="w-3.5 h-3.5 text-dark-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-200">{ev.conteudo}</p>
                    <p className="text-xs text-dark-500 mt-1">
                      {ev.autorNome && <span className="font-medium text-dark-300">{ev.autorNome}</span>}
                      {' · '}{new Date(ev.timestamp).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
