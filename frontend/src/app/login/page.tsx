'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, Eye, EyeOff, Loader2 } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth.store'

export default function LoginPage() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    try {
      const { data } = await authApi.login(email, senha)
      login(data.access_token, data.refresh_token || '', {
        id: data.user?.id || data.tecnico?.id,
        nome: data.user?.nome || data.tecnico?.nome,
        email: data.user?.email || data.tecnico?.email,
        userType: data.user?.userType || 'technician',
        role: data.user?.role || data.tecnico?.funcao || 'admin',
        tenantId: data.user?.tenantId || data.tecnico?.tenantId,
        tenant: data.user?.tenant,
        tenantsAtribuidos: data.user?.tenantsAtribuidos,
        permissions: data.user?.permissions || [],
      })

      const userType = data.user?.userType || 'technician'
      const role = data.user?.role || data.tecnico?.funcao
      
      // Técnico comum vai direto para tickets
      if (userType === 'technician' && role === 'tecnico') {
        router.push('/dashboard/tickets')
      } else if (userType === 'client_user') {
        router.push('/portal')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      setErro(err.response?.data?.message || 'Credenciais inválidas')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-4 shadow-lg shadow-brand-600/20">
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">MIConectaRMM</h1>
          <p className="text-dark-400 mt-1">by Maginf Tecnologia</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-white mb-6">Entrar na plataforma</h2>

          {erro && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="input w-full pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        <p className="text-center text-dark-600 text-xs mt-6">
          MIConectaRMM Enterprise v2.0.0 — Maginf Tecnologia © 2026
        </p>
      </div>
    </div>
  )
}
