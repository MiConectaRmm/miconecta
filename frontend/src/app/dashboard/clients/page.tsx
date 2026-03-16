'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, Users, Search, Monitor, Mail } from 'lucide-react'
import { tenantsApi } from '@/lib/api'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'

export default function ClientsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [novoCliente, setNovoCliente] = useState({ nome: '', slug: '', email: '', cnpj: '', plano: 'basico' })
  const [carregando, setCarregando] = useState(true)

  useEffect(() => { carregar() }, [])

  const carregar = async () => {
    try {
      const { data } = await tenantsApi.listar()
      setTenants(data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  const criarCliente = async () => {
    try {
      await tenantsApi.criar({ ...novoCliente, ativo: true })
      setShowModal(false)
      setNovoCliente({ nome: '', slug: '', email: '', cnpj: '', plano: 'basico' })
      carregar()
    } catch (err) {
      console.error('Erro:', err)
    }
  }

  const filtrados = tenants.filter(t =>
    !busca || t.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    t.slug?.toLowerCase().includes(busca.toLowerCase()) ||
    t.email?.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-dark-400 text-sm mt-1">Gerencie tenants e organizações</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            placeholder="Buscar por nome, slug ou email..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input w-full pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carregando ? (
          <div className="col-span-full card text-center py-12 text-dark-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <div className="col-span-full card text-center py-12">
            <Building2 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum cliente encontrado</p>
          </div>
        ) : (
          filtrados.map((tenant: any) => (
            <Link key={tenant.id} href={`/dashboard/clients/${tenant.id}`} className="card hover:border-dark-600 transition-colors group cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium group-hover:text-brand-400 truncate">{tenant.nome}</h3>
                  <p className="text-dark-500 text-xs">{tenant.slug}</p>
                </div>
              </div>
              {tenant.email && (
                <div className="flex items-center gap-2 text-xs text-dark-400 mb-2">
                  <Mail className="w-3 h-3" /> {tenant.email}
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-dark-400 text-xs">
                    <Users className="w-3.5 h-3.5" />
                    {tenant.organizations?.length || 0} orgs
                  </span>
                  {tenant.plano && (
                    <span className="text-dark-500 text-xs capitalize">{tenant.plano}</span>
                  )}
                </div>
                <StatusBadge status={tenant.ativo ? 'ativo' : 'suspenso'} />
              </div>
            </Link>
          ))
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Cliente" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Nome</label>
              <input
                type="text"
                value={novoCliente.nome}
                onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })}
                className="input w-full"
                placeholder="Empresa LTDA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Slug</label>
              <input
                type="text"
                value={novoCliente.slug}
                onChange={(e) => setNovoCliente({ ...novoCliente, slug: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                className="input w-full"
                placeholder="empresa"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail</label>
              <input
                type="email"
                value={novoCliente.email}
                onChange={(e) => setNovoCliente({ ...novoCliente, email: e.target.value })}
                className="input w-full"
                placeholder="contato@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">CNPJ</label>
              <input
                type="text"
                value={novoCliente.cnpj}
                onChange={(e) => setNovoCliente({ ...novoCliente, cnpj: e.target.value })}
                className="input w-full"
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">Plano</label>
            <select
              value={novoCliente.plano}
              onChange={(e) => setNovoCliente({ ...novoCliente, plano: e.target.value })}
              className="input w-full"
            >
              <option value="trial">Trial</option>
              <option value="basico">Básico</option>
              <option value="profissional">Profissional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={criarCliente} className="btn-primary" disabled={!novoCliente.nome || !novoCliente.slug || !novoCliente.email}>
              Criar Cliente
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
