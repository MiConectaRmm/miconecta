'use client'

import { useEffect, useState } from 'react'
import { Users, Shield, Search, Plus, Mail, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { techniciansApi } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAuthStore } from '@/stores/auth.store'

interface Technician {
  id: string
  nome: string
  email: string
  funcao: string
  ativo: boolean
  tenantId?: string
  tenant?: { id: string; nome: string; slug?: string }
  ultimoLogin?: string
}

export default function TechniciansPage() {
  const user = useAuthStore((s) => s.user)
  const [tecnicos, setTecnicos] = useState<Technician[]>([])
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [funcaoFiltro, setFuncaoFiltro] = useState<'todos' | 'super_admin' | 'admin_maginf' | 'admin' | 'tecnico'>('todos')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<Technician | null>(null)
  const [form, setForm] = useState<{ nome: string; email: string; funcao: string; senha: string; confirmarSenha: string }>({
    nome: '',
    email: '',
    funcao: 'tecnico',
    senha: '',
    confirmarSenha: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  const carregar = async () => {
    setLoading(true)
    setErro('')
    try {
      const { data } = await techniciansApi.listar()
      setTecnicos(Array.isArray(data) ? data : data.items || [])
    } catch (err: any) {
      setErro(err.response?.data?.message || 'Erro ao carregar técnicos')
    } finally {
      setLoading(false)
    }
  }

  const abrirNovo = () => {
    setEditando(null)
    setForm({ nome: '', email: '', funcao: 'tecnico', senha: '', confirmarSenha: '' })
    setShowModal(true)
  }

  const abrirEdicao = (tec: Technician) => {
    setEditando(tec)
    setForm({ nome: tec.nome, email: tec.email, funcao: tec.funcao, senha: '', confirmarSenha: '' })
    setShowModal(true)
  }

  const salvar = async () => {
    if (!form.nome || !form.email) return
    if (!editando && (!form.senha || form.senha !== form.confirmarSenha)) return
    const tenantId = user?.tenantId
    if (!editando && !tenantId) return

    setSaving(true)
    try {
      if (editando) {
        await techniciansApi.atualizar(editando.id, { nome: form.nome, email: form.email, funcao: form.funcao })
      } else {
        await techniciansApi.criar({
          nome: form.nome,
          email: form.email,
          funcao: form.funcao,
          senha: form.senha,
          tenantId,
        })
      }
      setShowModal(false)
      await carregar()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao salvar técnico')
    } finally {
      setSaving(false)
    }
  }

  const toggleAtivo = async (tec: Technician) => {
    try {
      if (tec.ativo) {
        await techniciansApi.desativar(tec.id)
      } else {
        await techniciansApi.reativar(tec.id)
      }
      await carregar()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao atualizar status')
    }
  }

  const filtrados = tecnicos.filter((t) => {
    if (statusFiltro === 'ativos' && !t.ativo) return false
    if (statusFiltro === 'inativos' && t.ativo) return false
    if (funcaoFiltro !== 'todos' && t.funcao !== funcaoFiltro) return false
    if (!busca) return true
    const b = busca.toLowerCase()
    return t.nome?.toLowerCase().includes(b) || t.email?.toLowerCase().includes(b)
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Técnicos</h1>
          <p className="text-dark-400 mt-1 text-sm">Gerencie os usuários técnicos da plataforma</p>
        </div>
        <button onClick={abrirNovo} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Técnico
        </button>
      </div>

      <div className="card mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative w-full md:w-1/3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="input w-full pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as any)}
              className="input w-36"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
            <select
              value={funcaoFiltro}
              onChange={(e) => setFuncaoFiltro(e.target.value as any)}
              className="input w-44"
            >
              <option value="todos">Todas as funções</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin_maginf">Admin Maginf</option>
              <option value="admin">Admin Tenant</option>
              <option value="tecnico">Técnico</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-dark-400">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando técnicos...
          </div>
        ) : erro ? (
          <div className="text-center py-12 text-red-400">{erro}</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-dark-400">
            <Users className="w-10 h-10 text-dark-600 mx-auto mb-3" />
            Nenhum técnico encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-dark-500 border-b border-dark-700">
                  <th className="py-2.5 px-3">Nome</th>
                  <th className="py-2.5 px-3">E-mail</th>
                  <th className="py-2.5 px-3">Função</th>
                  <th className="py-2.5 px-3">Tenant</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <tr key={t.id} className="border-b border-dark-800 hover:bg-dark-900/40">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-brand-400" />
                        <div>
                          <div className="text-dark-100 font-medium">{t.nome}</div>
                          {t.ultimoLogin && (
                            <div className="text-xs text-dark-500">
                              Último acesso: {new Date(t.ultimoLogin).toLocaleString('pt-BR')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 text-dark-200">
                        <Mail className="w-3.5 h-3.5 text-dark-500" />
                        <span className="truncate max-w-[220px]">{t.email}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-xs capitalize bg-dark-800 text-dark-200 border border-dark-700">
                        {t.funcao}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-xs text-dark-400">
                      {t.tenant?.nome || 'Maginf / Global'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={t.ativo ? 'ativo' : 'suspenso'} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => abrirEdicao(t)}
                          className="text-xs text-brand-400 hover:text-brand-300"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleAtivo(t)}
                          className="flex items-center gap-1 text-xs text-dark-300 hover:text-white"
                        >
                          {t.ativo ? (
                            <>
                              <ToggleRight className="w-4 h-4 text-green-400" /> Desativar
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4 text-dark-500" /> Ativar
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editando ? 'Editar Técnico' : 'Novo Técnico'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="input w-full"
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input w-full"
              placeholder="tecnico@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Função</label>
            <select
              value={form.funcao}
              onChange={(e) => setForm({ ...form, funcao: e.target.value })}
              className="input w-full"
            >
              <option value="super_admin">Super Admin</option>
              <option value="admin_maginf">Admin Maginf</option>
              <option value="admin">Admin Tenant</option>
              <option value="tecnico">Técnico</option>
            </select>
          </div>

          {!editando && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Senha inicial</label>
                <input
                  type="password"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  className="input w-full"
                  placeholder="Senha temporária"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1.5">Confirmar senha</label>
                <input
                  type="password"
                  value={form.confirmarSenha}
                  onChange={(e) => setForm({ ...form, confirmarSenha: e.target.value })}
                  className="input w-full"
                  placeholder="Repita a senha"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={
                saving ||
                !form.nome ||
                !form.email ||
                (!editando && (!form.senha || form.senha !== form.confirmarSenha))
              }
              className="btn-primary flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editando ? 'Salvar' : 'Criar Técnico'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
