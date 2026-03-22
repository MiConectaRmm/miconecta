'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Send, ArrowLeft, Clock, User, MessageSquare, FileText,
  Monitor, Shield, Terminal, Paperclip, Star, AlertTriangle,
  CheckCircle, XCircle, Play, Square, BarChart3, StickyNote
} from 'lucide-react'
import Link from 'next/link'
import { ticketsApi, chatApi, storageApi } from '@/lib/api'
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
  const [ia, setIa] = useState<any>(null)
  const [newMsg, setNewMsg] = useState('')
  const [newNote, setNewNote] = useState('')
  const [internalFiles, setInternalFiles] = useState<File[]>([])
  const [chatFiles, setChatFiles] = useState<File[]>([])
  const [attachmentsByComment, setAttachmentsByComment] = useState<Record<string, any[]>>({})
  const [chatAttachments, setChatAttachments] = useState<any[]>([])
  const [tab, setTab] = useState<'chat' | 'timeline' | 'resumo'>('chat')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { socket, on, sendMessage, sendFile } = useChatSocket(id)

  const normalizeIncomingMessage = (msg: any) => ({
    ...msg,
    remetenteId: msg.remetenteId ?? msg.senderId,
    remetenteNome: msg.remetenteNome ?? msg.senderName,
    remetenteTipo: msg.remetenteTipo ?? msg.senderType,
    conteudo: msg.conteudo ?? msg.content,
    criadoEm: msg.criadoEm ?? msg.createdAt,
  })

  useEffect(() => { carregar() }, [id])

  useEffect(() => {
    const unsub = on('message:new', (msg: any) => {
      const normalized = normalizeIncomingMessage(msg)
      setMessages((prev) => {
        if (normalized?.id && prev.some((item: any) => item.id === normalized.id)) {
          return prev
        }
        return [...prev, normalized]
      })
    })
    return () => {
      unsub()
    }
  }, [on])

  useEffect(() => {
    const unsubTicketUpdated = on('ticket:updated', () => {
      carregar()
    })
    const unsubTicketRead = on('ticket:read', (payload: any) => {
      if (payload?.ticketId === id) {
        carregar()
      }
    })
    return () => {
      unsubTicketUpdated()
      unsubTicketRead()
    }
  }, [on, id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const notes = timeline.filter((event: any) => event.tipo === 'nota_interna')
    if (notes.length === 0) {
      setAttachmentsByComment({})
      return
    }
    Promise.all(
      notes.map(async (note: any) => {
        const { data } = await storageApi.listarPorEntidade('ticket_comment', note.id)
        return [note.id, data] as const
      }),
    ).then((entries) => {
      const next: Record<string, any[]> = {}
      entries.forEach(([noteId, files]) => {
        next[noteId] = files
      })
      setAttachmentsByComment(next)
    }).catch(() => {
      setAttachmentsByComment({})
    })
  }, [timeline])

  useEffect(() => {
    storageApi.listarPorEntidade('ticket_chat', id)
      .then(({ data }) => setChatAttachments(data))
      .catch(() => setChatAttachments([]))
  }, [id, messages])

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
      await chatApi.marcarTodasLidas(id)
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

  const carregarIA = async () => {
    try {
      const res = await ticketsApi.sugestaoIA(id)
      setIa(res.data)
    } catch (err) {
      console.error('Erro ao carregar sugestão de IA:', err)
    }
  }

  const enviarMensagem = async () => {
    if (!newMsg.trim()) return
    try {
      let arquivoUrl: string | undefined
      let arquivoNome: string | undefined
      let arquivoTamanho: number | undefined
      if (chatFiles[0]) {
        const upload = await storageApi.upload(chatFiles[0], 'ticket_chat', id)
        const signed = await storageApi.getUrl(upload.data.id)
        arquivoUrl = signed.data.url
        arquivoNome = upload.data.nomeOriginal
        arquivoTamanho = upload.data.tamanhoBytes
      }
      if (socket?.connected && chatFiles.length === 0) {
        sendMessage(newMsg)
      } else if (socket?.connected && chatFiles[0]) {
        sendFile({
          arquivoUrl: arquivoUrl!,
          arquivoNome: arquivoNome!,
          arquivoTamanho: arquivoTamanho!,
          conteudo: newMsg,
        })
      } else {
        await chatApi.enviar(id, newMsg, arquivoUrl, arquivoNome, arquivoTamanho)
      }
      setNewMsg('')
      setChatFiles([])
    } catch (err) {
      console.error('Erro ao enviar:', err)
    }
  }

  const criarNotaInterna = async () => {
    if (!newNote.trim()) return
    try {
      const note = await ticketsApi.notaInterna(id, newNote)
      if (internalFiles.length > 0) {
        await Promise.all(
          internalFiles.map(async (file) => {
            await storageApi.upload(file, 'ticket_comment', note.data.id)
          }),
        )
      }
      setNewNote('')
      setInternalFiles([])
      carregar()
    } catch (err) {
      console.error('Erro ao criar nota interna:', err)
    }
  }

  const handleAction = async (action: string) => {
    try {
      if (action === 'resolver') await ticketsApi.resolver(id)
      if (action === 'fechar') await ticketsApi.fechar(id)
      if (action === 'reabrir') await ticketsApi.reabrir(id)
      if (action === 'cancelar') await ticketsApi.cancelar(id)
      if (action === 'aguardar_cliente') await ticketsApi.aguardarCliente(id)
      if (action === 'aguardar_tecnico') await ticketsApi.aguardarTerceiro(id)
      carregar()
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  const alterarPrioridade = async (prioridade: string) => {
    try {
      await ticketsApi.atualizarPrioridade(id, prioridade)
      carregar()
    } catch (err) {
      console.error('Erro ao alterar prioridade:', err)
    }
  }

  const alterarCategoria = async (categoriaId: string) => {
    try {
      await ticketsApi.atualizarCategoria(id, categoriaId || undefined)
      carregar()
    } catch (err) {
      console.error('Erro ao alterar categoria:', err)
    }
  }

  const assumirTicket = async () => {
    if (!user) return
    try {
      await ticketsApi.atribuir(id, user.id, user.nome)
      carregar()
    } catch (err) {
      console.error('Erro ao atribuir ticket:', err)
    }
  }

  const removerAtribuicao = async () => {
    try {
      await ticketsApi.removerAtribuicao(id)
      carregar()
    } catch (err) {
      console.error('Erro ao remover atribuição:', err)
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

  const getTimelineTypeLabel = (event: any) => {
    const labels: Record<string, string> = {
      ticket_criado: 'Ticket criado',
      ticket_atribuido: 'Atribuição',
      ticket_status_alterado: 'Status alterado',
      ticket_prioridade_alterada: 'Prioridade alterada',
      ticket_avaliado: 'Avaliação',
      chat_mensagem: 'Mensagem',
      chat_arquivo: 'Anexo',
      chat_imagem: 'Imagem',
      chat_sistema: 'Sistema',
      nota_interna: 'Nota interna',
      comentario: 'Comentário',
      sessao_solicitada: 'Sessão solicitada',
      sessao_consentida: 'Sessão consentida',
      sessao_recusada: 'Sessão recusada',
      sessao_iniciada: 'Sessão iniciada',
      sessao_finalizada: 'Sessão finalizada',
      script_executado: 'Script executado',
      anexo_adicionado: 'Anexo',
      sistema: 'Sistema',
    }
    return labels[event.tipo] || event.tipo
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
                <span className="text-dark-500">Prioridade</span>
                <select
                  value={ticket.prioridade}
                  onChange={(e) => alterarPrioridade(e.target.value)}
                  className="bg-dark-900 border border-dark-700 rounded px-2 py-0.5 text-xs text-dark-100"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Data</span>
                <span className="text-dark-200">{new Date(ticket.criadoEm).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between text-sm items-center">
                <span className="text-dark-500">Técnico</span>
                <div className="flex items-center gap-2">
                  <span className="text-dark-200 text-xs">
                    {ticket.tecnicoAtribuido ? ticket.tecnicoAtribuido.nome : 'Sem responsável'}
                  </span>
                  {user && (
                    <>
                      {!ticket.tecnicoAtribuido && (
                        <button
                          onClick={assumirTicket}
                          className="px-2 py-0.5 rounded-lg border border-brand-500 text-[10px] text-brand-400 hover:bg-brand-500/10"
                        >
                          Assumir
                        </button>
                      )}
                      {ticket.tecnicoAtribuido && ticket.tecnicoAtribuido.id === user.id && (
                        <button
                          onClick={removerAtribuicao}
                          className="px-2 py-0.5 rounded-lg border border-dark-600 text-[10px] text-dark-300 hover:bg-dark-800"
                        >
                          Remover
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              {ticket.device && (
                <div className="rounded-lg border border-dark-700 bg-dark-900/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-dark-500 mb-2">Dispositivo vinculado</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-dark-500">Hostname</span>
                      <span className="text-dark-200 font-medium text-right">{ticket.device.hostname || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-dark-500">IP</span>
                      <span className="text-dark-200 text-right">{ticket.device.ipLocal || ticket.device.ipExterno || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-dark-500">Status</span>
                      <span className="text-dark-200 capitalize text-right">{ticket.device.status || '-'}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-dark-500">Último check-in</span>
                      <span className="text-dark-200 text-right">
                        {ticket.device.lastSeen ? new Date(ticket.device.lastSeen).toLocaleString('pt-BR') : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-dark-500">Categoria</span>
                <select
                  value={ticket.categoriaId || ''}
                  onChange={(e) => alterarCategoria(e.target.value)}
                  className="bg-dark-900 border border-dark-700 rounded px-2 py-0.5 text-xs text-dark-100"
                >
                  <option value="">Não definida</option>
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
              </div>
              {ticket.slaResolucaoEm && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-dark-500">SLA Resolução</span>
                    <span className={`${new Date(ticket.slaResolucaoEm) < new Date() && ticket.status !== 'resolvido' && ticket.status !== 'fechado' ? 'text-red-400' : 'text-dark-200'}`}>
                      {new Date(ticket.slaResolucaoEm).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-500">SLA Status</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      ticket.slaStatus === 'vencido' ? 'bg-red-500/15 text-red-400'
                        : ticket.slaStatus === 'em_risco' ? 'bg-amber-500/15 text-amber-400'
                        : ticket.slaStatus === 'dentro_prazo' ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-dark-700 text-dark-300'
                    }`}>
                      {ticket.slaStatus === 'vencido' ? 'Vencido' : ticket.slaStatus === 'em_risco' ? 'Em risco' : ticket.slaStatus === 'dentro_prazo' ? 'Dentro do prazo' : 'Indefinido'}
                    </span>
                  </div>
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
              {ticket.status !== 'cancelado' && ticket.status !== 'fechado' && (
                <>
                  <button
                    onClick={() => handleAction('aguardar_cliente')}
                    className="text-xs py-1.5 px-3 text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                  >
                    Aguardar cliente
                  </button>
                  <button
                    onClick={() => handleAction('aguardar_tecnico')}
                    className="text-xs py-1.5 px-3 text-dark-200 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    Aguardar terceiro
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Notas internas</h3>
            <div className="space-y-3">
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {timeline.filter((event: any) => event.tipo === 'nota_interna').length === 0 ? (
                  <p className="text-xs text-dark-500">Nenhuma nota interna ainda</p>
                ) : timeline
                  .filter((event: any) => event.tipo === 'nota_interna')
                  .map((note: any) => (
                    <div key={note.id} className="rounded-lg border border-dark-700 bg-dark-900/60 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-xs font-medium text-orange-400">Nota interna</p>
                        <span className="text-[10px] text-dark-500">{new Date(note.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-sm text-dark-200 whitespace-pre-wrap">{note.conteudo}</p>
                      <p className="text-[10px] text-dark-500 mt-1">{note.autorNome}</p>
                      {note.metadata?.tipoEvento && (
                        <p className="text-[10px] text-dark-600 mt-1">Tipo: {note.metadata.tipoEvento}</p>
                      )}
                      {attachmentsByComment[note.id]?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {attachmentsByComment[note.id].map((file) => (
                            <button
                              key={file.id}
                              onClick={async () => {
                                const { data } = await storageApi.getUrl(file.id)
                                window.open(data.url, '_blank', 'noopener,noreferrer')
                              }}
                              className="block text-left text-xs text-cyan-400 hover:text-cyan-300"
                            >
                              {file.nomeOriginal}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder="Adicionar nota interna..."
              />
              <input
                type="file"
                multiple
                onChange={(e) => setInternalFiles(Array.from(e.target.files || []))}
                className="block w-full text-xs text-dark-400"
              />
              <div className="flex justify-end">
                <button onClick={criarNotaInterna} className="btn-secondary text-xs py-1.5 px-3" disabled={!newNote.trim()}>
                  Salvar nota
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-3">Anexos do chat</h3>
            {chatAttachments.length === 0 ? (
              <p className="text-xs text-dark-500">Nenhum anexo enviado no chat</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {chatAttachments.map((file) => (
                  <button
                    key={file.id}
                    onClick={async () => {
                      const { data } = await storageApi.getUrl(file.id)
                      window.open(data.url, '_blank', 'noopener,noreferrer')
                    }}
                    className="w-full text-left rounded-lg border border-dark-700 bg-dark-900/60 px-3 py-2 hover:bg-dark-800 transition-colors"
                  >
                    <p className="text-sm text-dark-200">{file.nomeOriginal}</p>
                    <p className="text-[10px] text-dark-500">{file.mimeType}</p>
                  </button>
                ))}
              </div>
            )}
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
            <button
              onClick={() => { carregarIA() }}
              className="ml-auto btn-secondary text-xs py-1.5 px-3"
            >
              Sugerir resposta
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
                            ? 'bg-brand-500 text-white'
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
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviarMensagem()}
                    className="input flex-1"
                    placeholder="Digite sua mensagem..."
                  />
                  <input
                    type="file"
                    onChange={(e) => setChatFiles(Array.from(e.target.files || []))}
                    className="block w-full text-xs text-dark-400"
                  />
                </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm text-dark-200 truncate">{event.conteudo}</p>
                      <span className="text-[9px] bg-dark-700 text-dark-300 px-1.5 py-0.5 rounded flex-shrink-0">
                        {getTimelineTypeLabel(event)}
                      </span>
                      {event.tipo === 'nota_interna' && (
                        <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded flex-shrink-0">interno</span>
                      )}
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5">
                      {event.autorNome || 'Sistema'} · {new Date(event.timestamp).toLocaleString('pt-BR')}
                      <span className="text-dark-600 ml-1">({event.fonte})</span>
                    </p>
                    {(event.metadata?.antes || event.metadata?.depois) && (
                      <p className="text-xs text-dark-400 mt-1">
                        {event.metadata?.antes ? `Antes: ${event.metadata.antes}` : 'Antes: -'} · {event.metadata?.depois ? `Depois: ${event.metadata.depois}` : 'Depois: -'}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2">
              {ia ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-brand-400 mb-2">Resposta sugerida</p>
                    <p className="text-sm text-dark-100 whitespace-pre-wrap">{ia.suggestedReply}</p>
                  </div>
                  <div className="rounded-lg border border-dark-700 bg-dark-900 p-4">
                    <p className="text-xs uppercase tracking-wide text-dark-500 mb-2">Resumo</p>
                    <p className="text-sm text-dark-200 whitespace-pre-wrap">{ia.summary}</p>
                    <p className="text-xs text-dark-500 mt-2">Prioridade sugerida: {ia.priority}</p>
                  </div>
                </div>
              ) : !resumo ? (
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
