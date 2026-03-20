'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, User, Search, Mail, Phone, Building } from 'lucide-react'
import { usersApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'
import Modal from '@/components/ui/Modal'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    cargo: '',
  })

  const user = useAuthStore((s) => s.user)
  const isReadOnly = user?.userType === 'technician'

  useEffect(() => { carregar() }, [])

  const carregar = async () => {
    try {
      const { data } = await usersApi.listarClientes()
      setClientes(data)
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
    } finally {
      setCarregando(false)
    }
  }

  const abrirModal = (cliente?: any) => {
    if (cliente) {
      setEditando(cliente)
      setForm({
        nome: cliente.nome || '',
        email: cliente.email || '',
        telefone: cliente.telefone || '',
        cargo: cliente.cargo || '',
      })
    } else {
      setEditando(null)
      setForm({ nome: '', email: '', telefone: '', cargo: '' })
    }
    setShowModal(true)
  }

  const salvar = async () => {
    try {
      if (editando) {
        await usersApi.atualizarCliente(editando.id, form)
      } else {
        await usersApi.criarCliente(form)
      }
      setShowModal(false)
      carregar()
    } catch (err) {
      console.error('Erro ao salvar:', err)
    }
  }

  const desativar = async (id: string) => {
    if (!confirm('Deseja desativar este cliente?')) return
    try {
      await usersApi.desativarCliente(id)
      carregar()
    } catch (err) {
      console.error('Erro ao desativar:', err)
    }
  }

  const reativar = async (id: string) => {
    try {
      await usersApi.reativarCliente(id)
      carregar()
    } catch (err) {
      console.error('Erro ao reativar:', err)
    }
  }

  const enviarConvite = async (id: string) => {
    try {
      await usersApi.convidarCliente(id)
      alert('Convite enviado com sucesso!')
    } catch (err) {
      console.error('Erro ao enviar convite:', err)
    }
  }

  const filtrados = clientes.filter((c) => {
    if (!busca) return true
    const b = busca.toLowerCase()
    return (
      c.nome?.toLowerCase().includes(b) ||
      c.email?.toLowerCase().includes(b) ||
      c.telefone?.includes(b)
    )
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-dark-400 text-sm mt-1">{isReadOnly ? 'Visualizar usuários dos clientes' : 'Gerenciar usuários dos clientes'}</p>
        </div>
        {!isReadOnly && (
          <button onClick={() => abrirModal()} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Cliente
          </button>
        )}
      </div>

      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
      </div>

      <div className="card">
        {carregando ? (
          <div className="text-center py-12 text-dark-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((cliente: any) => (
              <div
                key={cliente.id}
                className="flex items-center justify-between p-4 rounded-lg bg-dark-900 hover:bg-dark-800 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{cliente.nome}</p>
                      {!cliente.ativo && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-dark-400">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {cliente.email}
                      </span>
                      {cliente.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {cliente.telefone}
                        </span>
                      )}
                      {cliente.cargo && (
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3" /> {cliente.cargo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModal(cliente)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Editar
                  </button>
                  {cliente.ativo ? (
                    <button
                      onClick={() => desativar(cliente.id)}
                      className="text-xs py-1.5 px-3 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      Desativar
                    </button>
                  ) : (
                    <button
                      onClick={() => reativar(cliente.id)}
                      className="text-xs py-1.5 px-3 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                    >
                      Reativar
                    </button>
                  )}
                  <button
                    onClick={() => enviarConvite(cliente.id)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Enviar convite
                  </button>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editando ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome completo</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="input w-full"
              placeholder="João da Silva"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input w-full"
              placeholder="joao@empresa.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Telefone</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              className="input w-full"
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Cargo</label>
            <input
              type="text"
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              className="input w-full"
              placeholder="Gerente de TI"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={salvar}
              className="btn-primary"
              disabled={!form.nome || !form.email}
            >
              {editando ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
