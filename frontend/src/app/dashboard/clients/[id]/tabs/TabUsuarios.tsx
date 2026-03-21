'use client'

import { useEffect, useState } from 'react'
import {
  Users, User, Building2, Send, AlertTriangle,
} from 'lucide-react'
import { usersApi } from '@/lib/api'
import Modal from '@/components/ui/Modal'

interface Props {
  tenantId: string
  tenantNome: string
  maxUsuarios: number
}

export default function TabUsuarios({ tenantId, tenantNome, maxUsuarios }: Props) {
  const [portalUsers, setPortalUsers] = useState<any[]>([])
  const [contagem, setContagem] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', telefone: '', cargo: '', funcao: 'usuario' })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [tenantId])

  const carregar = async () => {
    setCarregando(true)
    try {
      const [usersRes, contagemRes] = await Promise.allSettled([
        usersApi.listarPorTenant(tenantId),
        usersApi.contagemPorTenant(tenantId),
      ])
      if (usersRes.status === 'fulfilled') setPortalUsers(usersRes.value.data)
      if (contagemRes.status === 'fulfilled') setContagem(contagemRes.value.data)
    } catch {} finally { setCarregando(false) }
  }

  const abrirModal = (usuario?: any) => {
    if (usuario) {
      setEditando(usuario)
      setForm({ nome: usuario.nome || '', email: usuario.email || '', senha: '', telefone: usuario.telefone || '', cargo: usuario.cargo || '', funcao: usuario.funcao || 'usuario' })
    } else {
      setEditando(null)
      setForm({ nome: '', email: '', senha: '', telefone: '', cargo: '', funcao: 'usuario' })
    }
    setShowModal(true)
  }

  const salvar = async () => {
    try {
      if (editando) {
        const payload: any = { nome: form.nome, email: form.email, telefone: form.telefone, cargo: form.cargo, funcao: form.funcao }
        if (form.senha) payload.senha = form.senha
        await usersApi.atualizarCliente(editando.id, payload)
      } else {
        await usersApi.criarCliente({ nome: form.nome, email: form.email, senha: form.senha, telefone: form.telefone, cargo: form.cargo, funcao: form.funcao }, tenantId)
      }
      setShowModal(false)
      carregar()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao salvar usuário'
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  const desativar = async (userId: string) => {
    if (!confirm('Deseja desativar este usuário do portal?')) return
    try { await usersApi.desativarCliente(userId); carregar() } catch {}
  }

  const reativar = async (userId: string) => {
    try { await usersApi.reativarCliente(userId); carregar() } catch {}
  }

  const convidar = async (userId: string) => {
    try { await usersApi.convidarCliente(userId); alert('Convite enviado!') } catch {}
  }

  if (carregando) return <div className="text-center py-12 text-dark-400">Carregando usuários...</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-dark-400 text-sm">Usuários que acessam o portal deste cliente</p>
        </div>
        <div className="flex items-center gap-3">
          {contagem && (
            <div className="flex items-center gap-2">
              <p className={`text-sm font-bold ${contagem.atingiuLimite ? 'text-red-400' : 'text-brand-400'}`}>
                {contagem.total}/{contagem.limite}
              </p>
              <div className="w-20">
                <div className="w-full bg-dark-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${
                    contagem.atingiuLimite ? 'bg-red-500' : contagem.total >= contagem.limite - 1 ? 'bg-yellow-500' : 'bg-brand-500'
                  }`} style={{ width: `${Math.min(100, (contagem.total / contagem.limite) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}
          <button onClick={() => abrirModal()} disabled={contagem?.atingiuLimite}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
            <User className="w-3.5 h-3.5" /> Novo Usuário
          </button>
        </div>
      </div>

      {contagem?.atingiuLimite && (
        <div className="mb-4 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">Limite de {contagem.limite} usuários atingido.</p>
        </div>
      )}

      {portalUsers.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-10 h-10 text-dark-600 mx-auto mb-2" />
          <p className="text-dark-400 text-sm">Nenhum usuário do portal cadastrado</p>
          <p className="text-dark-500 text-xs mt-1">Clique em "Novo Usuário" para criar o primeiro acesso</p>
        </div>
      ) : (
        <div className="space-y-2">
          {portalUsers.map((usr: any) => (
            <div key={usr.id} className={`card flex items-center justify-between p-3 ${!usr.ativo ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  usr.funcao === 'admin_cliente' ? 'bg-yellow-500/20' : usr.funcao === 'gestor' ? 'bg-blue-500/20' : 'bg-brand-500/20'
                }`}>
                  <User className={`w-4 h-4 ${
                    usr.funcao === 'admin_cliente' ? 'text-yellow-400' : usr.funcao === 'gestor' ? 'text-blue-400' : 'text-brand-400'
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-medium truncate">{usr.nome}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      usr.funcao === 'admin_cliente' ? 'bg-yellow-500/15 text-yellow-400'
                      : usr.funcao === 'gestor' ? 'bg-blue-500/15 text-blue-400'
                      : 'bg-dark-700 text-dark-300'
                    }`}>
                      {usr.funcao === 'admin_cliente' ? 'Admin' : usr.funcao === 'gestor' ? 'Gestor' : 'Usuário'}
                    </span>
                    {!usr.ativo && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">Inativo</span>}
                  </div>
                  <p className="text-xs text-dark-400 truncate mt-0.5">{usr.email}{usr.cargo ? ` · ${usr.cargo}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button onClick={() => abrirModal(usr)} className="text-xs py-1 px-2 text-dark-300 hover:text-white hover:bg-dark-600 rounded transition-colors">Editar</button>
                {usr.ativo ? (
                  <button onClick={() => desativar(usr.id)} className="text-xs py-1 px-2 text-red-400 hover:bg-red-500/10 rounded transition-colors">Desativar</button>
                ) : (
                  <button onClick={() => reativar(usr.id)} className="text-xs py-1 px-2 text-green-400 hover:bg-green-500/10 rounded transition-colors">Reativar</button>
                )}
                <button onClick={() => convidar(usr.id)} className="p-1 text-dark-400 hover:text-brand-400 rounded transition-colors" title="Enviar convite por e-mail">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editando ? 'Editar Usuário' : 'Novo Usuário do Portal'} size="lg">
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-dark-900 border border-dark-700">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-brand-400" />
              <span className="text-dark-300">Empresa:</span>
              <span className="text-white font-medium">{tenantNome}</span>
            </div>
            {contagem && !editando && (
              <p className="text-xs text-dark-500 mt-1 ml-6">{contagem.disponivel} {contagem.disponivel === 1 ? 'vaga restante' : 'vagas restantes'}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome completo *</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input w-full" placeholder="João da Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Email (login) *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" placeholder="joao@empresa.com" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Senha {editando ? '(vazio = manter)' : '*'}</label>
              <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="input w-full" placeholder={editando ? '••••••' : 'Mínimo 6 caracteres'} autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Perfil *</label>
              <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="input w-full">
                <option value="admin_cliente">Administrador</option>
                <option value="gestor">Gestor</option>
                <option value="usuario">Usuário</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Telefone</label>
              <input type="text" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="input w-full" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Cargo</label>
              <input type="text" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="input w-full" placeholder="Gerente de TI" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-dark-700">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn-primary" disabled={!form.nome || !form.email || (!editando && (!form.senha || form.senha.length < 6))}>
              {editando ? 'Salvar' : 'Criar Usuário'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
