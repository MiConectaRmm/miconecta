'use client'

import { useEffect, useState } from 'react'
import { Building2, Plus, Users } from 'lucide-react'
import { tenantsApi } from '@/lib/api'

export default function ClientsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregarTenants()
  }, [])

  const carregarTenants = async () => {
    try {
      const { data } = await tenantsApi.listar()
      setTenants(data)
    } catch (err) {
      console.error('Erro:', err)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-dark-400 mt-1">Gerencie tenants e organizações</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {carregando ? (
          <div className="col-span-full card text-center py-12 text-dark-400">Carregando...</div>
        ) : tenants.length === 0 ? (
          <div className="col-span-full card text-center py-12">
            <Building2 className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">Nenhum cliente cadastrado</p>
          </div>
        ) : (
          tenants.map((tenant: any) => (
            <div key={tenant.id} className="card hover:border-dark-600 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-brand-600/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">{tenant.nome}</h3>
                  <p className="text-dark-500 text-xs">{tenant.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-dark-400">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {tenant.organizations?.length || 0} orgs
                </span>
                <span className={tenant.ativo ? 'badge-online' : 'badge-offline'}>
                  {tenant.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
