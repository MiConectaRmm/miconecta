'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, UserCheck, UserX, Mail } from 'lucide-react'
import { usersApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'next/navigation'

export default function PortalUsersPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', email: '', senha: '', funcao: 'usuario', telefone: '', cargo: '' })

  useEffect(() => {
    if (user?.role !== 'admin_cliente') {
      router.push('/portal')
      return
    }
    carregar()
  }, [user])

  const carregar = async () => {
    try {
      const { data } = await usersApi.listarClientes()
      setUsuarios(Array.isArray(data) ? data : [])
    } catch {}
    setCarregando(false)
  }

  const salvar = async () => {
    try {
      if (editando) {
        const dados: any = { nome: form.nome, funcao: form.funcao, telefone: form.telefone, cargo: form.cargo }
        if (form.senha) dados.senha = form.senha
        await usersApi.atualizarCliente(editando.id, dados)
      } else {
        await usersApi.criarCliente(form)
      }
      setShowModal(false)
      setEditando(null)
      setForm({ nome: '', email: '', senha: '', funcao: 'usuario', telefone: '', cargo: '' })
      carregar()
    } catch {}
  }

  const desativar = async (id: string) => {
    if (!confirm('Desativar este usuário?')) return
    try {
      await usersApi.desativarCliente(id)
      carregar()
    } catch {}
  }

  const reativar = async (id: string) => {
    try {
      await usersApi.reativarCliente(id)
      carregar()
    } catch {}
  }

  const abrirEdicao = (u: any) => {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', funcao: u.funcao, telefone: u.telefone || '', cargo: u.cargo || '' })
    setShowModal(true)
  }

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', email: '', senha: '', funcao: 'usuario', telefone: '', cargo: '' })
    setShowModal(true)
  }

  const funcaoLabel: Record<string, string> = {
    admin_cliente: 'Administrador',
    gestor: 'Gestor',
    usuario: 'Usuário',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-dark-400 text-sm mt-1">Gerencie os usuários da sua empresa</p>
        </div>
        <button onClick={abrirNovo} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : usuarios.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Nome</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">E-mail</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Perfil</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Status</th>
                  <th className="text-left py-2.5 px-3 text-dark-400 font-medium">Último Login</th>
                  <th className="text-right py-2.5 px-3 text-dark-400 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u: any) => (
                  <tr key={u.id} className="border-b border-dark-800/50 hover:bg-dark-800/50 transition-colors">
                    <td className="py-2.5 px-3 text-white font-medium">{u.nome}</td>
                    <td className="py-2.5 px-3 text-dark-400">{u.email}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={u.funcao} /></td>
                    <td className="py-2.5 px-3">
                      {u.ativo ? (
                        <span className="text-emerald-400 text-xs font-medium">Ativo</span>
                      ) : (
                        <span className="text-red-400 text-xs font-medium">Inativo</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-dark-500 text-xs">
                      {u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => abrirEdicao(u)} className="p-1.5 text-dark-400 hover:text-brand-400" title="Editar">
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        {u.ativo ? (
                          <button onClick={() => desativar(u.id)} className="p-1.5 text-dark-400 hover:text-red-400" title="Desativar">
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button onClick={() => reativar(u.id)} className="p-1.5 text-dark-400 hover:text-emerald-400" title="Reativar">
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editando ? 'Editar Usuário' : 'Novo Usuário'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome</label>
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input w-full" placeholder="Nome completo" />
          </div>
          {!editando && (
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input w-full" placeholder="email@empresa.com" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">{editando ? 'Nova Senha (opcional)' : 'Senha'}</label>
            <input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} className="input w-full" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Perfil</label>
            <select value={form.funcao} onChange={(e) => setForm({ ...form, funcao: e.target.value })} className="input w-full">
              <option value="usuario">Usuário</option>
              <option value="gestor">Gestor</option>
              <option value="admin_cliente">Administrador</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Telefone</label>
              <input type="text" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="input w-full" placeholder="(11) 99999-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Cargo</label>
              <input type="text" value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="input w-full" placeholder="Ex: Analista" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={salvar} className="btn-primary" disabled={!form.nome || (!editando && (!form.email || !form.senha))}>
              {editando ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
