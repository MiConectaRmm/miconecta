'use client'

import { Users, Shield } from 'lucide-react'

export default function TechniciansPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Técnicos</h1>
        <p className="text-dark-400 mt-1">Gerencie os usuários da plataforma</p>
      </div>

      <div className="card text-center py-16">
        <Users className="w-16 h-16 text-dark-600 mx-auto mb-4" />
        <h3 className="text-lg text-dark-300 font-medium">Gestão de Técnicos</h3>
        <p className="text-dark-500 text-sm mt-2 max-w-md mx-auto">
          Os técnicos são gerenciados através do módulo de autenticação.
          Use o endpoint POST /api/v1/auth/register para cadastrar novos técnicos.
        </p>
      </div>
    </div>
  )
}
