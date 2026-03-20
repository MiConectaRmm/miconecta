'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { 
  ArrowLeft, MessageSquare, Ticket, Monitor, Terminal, 
  Shield, Package, Download, Zap, AlertTriangle, Activity,
  List, Clock, FileText, Send, Paperclip, X, Play,
  CheckCircle, XCircle, RefreshCw, User
} from 'lucide-react'
import { 
  tenantsApi, ticketsApi, devicesApi, alertsApi, sessionsApi,
  chatApi, scriptsApi, patchesApi, softwareApi, agentsApi, storageApi
} from '@/lib/api'
import { useChatSocket } from '@/hooks/useChatSocket'
import { useAuthStore } from '@/stores/auth.store'

export default function ClienteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = params.id as string
  const ticketIdParam = searchParams?.get('ticket')
  
  const user = useAuthStore((s) => s.user)

  const [cliente, setCliente] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [ticketSelecionado, setTicketSelecionado] = useState<any>(null)
  const [devices, setDevices] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [sessoes, setSessoes] = useState<any[]>([])
  const [scripts, setScripts] = useState<any[]>([])
  const [patches, setPatches] = useState<any[]>([])
  const [softwares, setSoftwares] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [mensagens, setMensagens] = useState<any[]>([])
  const [novaMensagem, setNovaMensagem] = useState('')
  
  const [activeTab, setActiveTab] = useState('tickets')
  const [carregando, setCarregando] = useState(true)
  
  const token = useAuthStore((s) => s.token)
  const { sendMessage, connected } = useChatSocket(ticketSelecionado?.id || null, token)

  useEffect(() => {
    carregar()
  }, [clientId])

  useEffect(() => {
    if (ticketIdParam && tickets.length > 0) {
      const ticket = tickets.find((t) => t.id === ticketIdParam)
      if (ticket) {
        setTicketSelecionado(ticket)
        setActiveTab('chat')
        carregarMensagens(ticketIdParam)
      }
    }
  }, [ticketIdParam, tickets])

  const carregar = async () => {
    try {
      const [clienteRes, ticketsRes, devicesRes, alertasRes, sessoesRes] = await Promise.allSettled([
        tenantsApi.buscar(clientId),
        ticketsApi.listar({ tenantId: clientId }),
        devicesApi.listar({ tenantId: clientId }),
        alertsApi.listar({ tenantId: clientId }),
        sessionsApi.listar({ deviceTenantId: clientId }),
      ])
      
      if (clienteRes.status === 'fulfilled') setCliente(clienteRes.value.data)
      if (ticketsRes.status === 'fulfilled') setTickets(ticketsRes.value.data)
      if (devicesRes.status === 'fulfilled') setDevices(devicesRes.value.data)
      if (alertasRes.status === 'fulfilled') setAlertas(alertasRes.value.data)
      if (sessoesRes.status === 'fulfilled') setSessoes(sessoesRes.value.data)

      // Carregar scripts, patches, softwares, files
      const [scriptsRes, patchesRes, softwaresRes] = await Promise.allSettled([
        scriptsApi.listar(),
        patchesApi.resumo(),
        softwareApi.listarPacotes(),
      ])
      
      if (scriptsRes.status === 'fulfilled') setScripts(scriptsRes.value.data)
      if (patchesRes.status === 'fulfilled') setPatches(patchesRes.value.data.patches || [])
      if (softwaresRes.status === 'fulfilled') setSoftwares(softwaresRes.value.data)
      
    } catch (err) {
      console.error('Erro ao carregar:', err)
    } finally {
      setCarregando(false)
    }
  }

  const carregarMensagens = async (ticketId: string) => {
    try {
      const { data } = await chatApi.mensagens(ticketId)
      setMensagens(data)
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err)
    }
  }

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !ticketSelecionado) return
    
    try {
      if (connected) {
        sendMessage(novaMensagem)
      } else {
        await chatApi.enviar(ticketSelecionado.id, novaMensagem)
        carregarMensagens(ticketSelecionado.id)
      }
      setNovaMensagem('')
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err)
    }
  }

  const abrirTicket = (ticket: any) => {
    setTicketSelecionado(ticket)
    setActiveTab('chat')
    carregarMensagens(ticket.id)
  }

  const voltarParaTickets = () => {
    setTicketSelecionado(null)
    setActiveTab('tickets')
  }

  if (carregando) {
    return <div className="text-center py-12 text-dark-400">Carregando...</div>
  }

  if (!cliente) {
    return <div className="text-center py-12 text-dark-400">Cliente não encontrado</div>
  }

  const tabs = [
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'chat', label: 'Chat', icon: MessageSquare, hidden: !ticketSelecionado },
    { id: 'devices', label: 'Dispositivos', icon: Monitor },
    { id: 'remote', label: 'Acesso Remoto', icon: Zap },
    { id: 'scripts', label: 'Scripts', icon: Terminal },
    { id: 'patches', label: 'Patches', icon: Shield },
    { id: 'software', label: 'Software', icon: Package },
    { id: 'agent', label: 'Agente', icon: Download },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
    { id: 'inventory', label: 'Inventário', icon: List },
    { id: 'sessions', label: 'Sessões', icon: Clock },
    { id: 'files', label: 'Arquivos', icon: FileText },
  ].filter((t) => !t.hidden)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => router.push('/dashboard')}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{cliente.nome}</h1>
          <p className="text-dark-400 text-sm mt-1">
            {cliente.cnpj} • {devices.length} dispositivos • {tickets.filter((t: any) => ['aberto', 'em_andamento'].includes(t.status)).length} tickets ativos
          </p>
        </div>
        {ticketSelecionado && (
          <button
            onClick={voltarParaTickets}
            className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white transition-colors"
          >
            ← Voltar para Tickets
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-dark-900 text-dark-400 hover:bg-dark-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'tickets' && tickets.filter((t: any) => ['aberto', 'em_andamento'].includes(t.status)).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-brand-500 text-white text-xs">
                  {tickets.filter((t: any) => ['aberto', 'em_andamento'].includes(t.status)).length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* TICKETS */}
        {activeTab === 'tickets' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Tickets do Cliente</h2>
            {tickets.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum ticket encontrado</p>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket: any) => (
                  <div 
                    key={ticket.id} 
                    onClick={() => abrirTicket(ticket)}
                    className="p-4 bg-dark-900 rounded-lg hover:bg-dark-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">#{ticket.numero} - {ticket.titulo}</p>
                        <p className="text-xs text-dark-400 mt-1">
                          {ticket.status} • {ticket.prioridade} • {new Date(ticket.criadoEm).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        ticket.status === 'aberto' ? 'bg-green-500/20 text-green-400' :
                        ticket.status === 'em_andamento' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-dark-700 text-dark-400'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT */}
        {activeTab === 'chat' && ticketSelecionado && (
          <div className="card">
            <div className="border-b border-dark-700 pb-4 mb-4">
              <h2 className="text-lg font-semibold text-white">
                Ticket #{ticketSelecionado.numero} - {ticketSelecionado.titulo}
              </h2>
              <p className="text-xs text-dark-400 mt-1">{ticketSelecionado.descricao}</p>
            </div>

            <div className="h-[500px] flex flex-col">
              <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                {mensagens.map((msg: any) => {
                  const isMine = msg.remetenteId === user?.id
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-lg ${
                        isMine ? 'bg-brand-600 text-white' : 'bg-dark-900 text-dark-100'
                      }`}>
                        <p className="text-sm">{msg.content || msg.conteudo}</p>
                        <p className="text-[10px] mt-1 opacity-70">
                          {new Date(msg.createdAt || msg.criadoEm).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
                  placeholder="Digite sua mensagem..."
                  className="input flex-1"
                />
                <button onClick={enviarMensagem} className="btn-primary px-4">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DISPOSITIVOS */}
        {activeTab === 'devices' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Dispositivos</h2>
            {devices.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum dispositivo encontrado</p>
            ) : (
              <div className="space-y-2">
                {devices.map((device: any) => (
                  <div key={device.id} className="p-4 bg-dark-900 rounded-lg hover:bg-dark-800 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{device.hostname}</p>
                        <p className="text-xs text-dark-400 mt-1">{device.sistemaOperacional} • {device.ipLocal}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${device.online ? 'bg-green-500' : 'bg-dark-600'}`} />
                        <button className="btn-secondary text-xs px-3 py-1">
                          <Zap className="w-3 h-3 mr-1 inline" />
                          Acessar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ALERTAS */}
        {activeTab === 'alerts' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Alertas Ativos</h2>
            {alertas.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum alerta ativo</p>
            ) : (
              <div className="space-y-2">
                {alertas.map((alerta: any) => (
                  <div key={alerta.id} className="p-4 bg-dark-900 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-white font-medium">{alerta.tipo}</p>
                        <p className="text-xs text-dark-400 mt-1">{alerta.mensagem}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SESSÕES */}
        {activeTab === 'sessions' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Histórico de Sessões Remotas</h2>
            {sessoes.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhuma sessão registrada</p>
            ) : (
              <div className="space-y-2">
                {sessoes.map((sessao: any) => (
                  <div key={sessao.id} className="p-4 bg-dark-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">Sessão #{sessao.id.slice(0, 8)}</p>
                        <p className="text-xs text-dark-400 mt-1">
                          {new Date(sessao.criadoEm).toLocaleString()} • {sessao.status}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        sessao.status === 'ativa' ? 'bg-green-500/20 text-green-400' :
                        'bg-dark-700 text-dark-400'
                      }`}>
                        {sessao.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AGENTE */}
        {activeTab === 'agent' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Download do Agente</h2>
            <div className="space-y-4">
              <div className="p-4 bg-dark-900 rounded-lg">
                <h3 className="text-white font-medium mb-2">Agente Oficial (Instalação Permanente)</h3>
                <p className="text-xs text-dark-400 mb-3">Scripts pré-configurados para este cliente</p>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download .BAT
                  </button>
                  <button className="btn-secondary text-sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download .PS1
                  </button>
                </div>
              </div>

              <div className="p-4 bg-dark-900 rounded-lg">
                <h3 className="text-white font-medium mb-2">Quick Support (Conexão Rápida)</h3>
                <p className="text-xs text-dark-400 mb-3">Sem instalação, apenas suporte pontual</p>
                <button className="btn-primary text-sm">
                  <Zap className="w-4 h-4 mr-2" />
                  Download Quick Support
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACESSO REMOTO */}
        {activeTab === 'remote' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Acesso Remoto</h2>
            {devices.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum dispositivo disponível</p>
            ) : (
              <div className="space-y-2">
                {devices.map((device: any) => (
                  <div key={device.id} className="p-4 bg-dark-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{device.hostname}</p>
                        <p className="text-xs text-dark-400 mt-1">
                          {device.sistemaOperacional} • {device.online ? 'Online' : 'Offline'}
                        </p>
                      </div>
                      <button 
                        disabled={!device.online}
                        className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Iniciar Sessão
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SCRIPTS */}
        {activeTab === 'scripts' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Scripts Disponíveis</h2>
            {scripts.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum script cadastrado</p>
            ) : (
              <div className="space-y-2">
                {scripts.map((script: any) => (
                  <div key={script.id} className="p-4 bg-dark-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">{script.nome}</p>
                        <p className="text-xs text-dark-400 mt-1">{script.descricao}</p>
                      </div>
                      <button className="btn-secondary text-sm">
                        <Play className="w-4 h-4 mr-2" />
                        Executar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PATCHES */}
        {activeTab === 'patches' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Patches e Atualizações</h2>
            {devices.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum dispositivo para verificar patches</p>
            ) : (
              <div className="space-y-4">
                {devices.map((device: any) => (
                  <div key={device.id} className="p-4 bg-dark-900 rounded-lg">
                    <h3 className="text-white font-medium mb-3">{device.hostname}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 bg-dark-800 rounded">
                        <div>
                          <p className="text-sm text-white">Atualização de Segurança Windows</p>
                          <p className="text-xs text-dark-400 mt-1">Pendente instalação</p>
                        </div>
                        <button className="btn-secondary text-xs px-3 py-1">Instalar</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SOFTWARE */}
        {activeTab === 'software' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Deploy de Software</h2>
            {softwares.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum pacote de software disponível</p>
            ) : (
              <div className="space-y-2">
                {softwares.map((soft: any) => (
                  <div key={soft.id} className="p-4 bg-dark-900 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-white font-medium">{soft.nome}</p>
                        <p className="text-xs text-dark-400 mt-1">Versão {soft.versao || '1.0'}</p>
                      </div>
                      <button className="btn-primary text-sm">
                        <Download className="w-4 h-4 mr-2" />
                        Deploy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* INVENTÁRIO */}
        {activeTab === 'inventory' && (
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Inventário de Hardware e Software</h2>
            {devices.length === 0 ? (
              <p className="text-dark-400 text-sm text-center py-8">Nenhum dispositivo para inventariar</p>
            ) : (
              <div className="space-y-4">
                {devices.map((device: any) => (
                  <div key={device.id} className="p-4 bg-dark-900 rounded-lg">
                    <h3 className="text-white font-medium mb-3">{device.hostname}</h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-dark-400 mb-1">CPU</p>
                        <p className="text-sm text-white">{device.cpu || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-400 mb-1">RAM</p>
                        <p className="text-sm text-white">{device.memoriaTotal || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-400 mb-1">Disco</p>
                        <p className="text-sm text-white">{device.discoTotal || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-dark-400 mb-1">Sistema</p>
                        <p className="text-sm text-white">{device.sistemaOperacional}</p>
                      </div>
                    </div>

                    <button className="btn-secondary text-xs w-full">
                      <List className="w-4 h-4 mr-2" />
                      Ver Inventário Completo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ARQUIVOS */}
        {activeTab === 'files' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Arquivos e Documentação</h2>
              <button className="btn-primary text-sm">
                <Paperclip className="w-4 h-4 mr-2" />
                Upload
              </button>
            </div>
            {files.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                <p className="text-dark-400">Nenhum arquivo enviado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file: any) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-dark-900 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-brand-400" />
                      <div>
                        <p className="text-sm text-white">{file.nome}</p>
                        <p className="text-xs text-dark-400">{file.tamanho}</p>
                      </div>
                    </div>
                    <button className="btn-secondary text-xs px-3 py-1">Download</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
