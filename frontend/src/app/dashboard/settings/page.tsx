'use client'

import { Settings, Server, Key, Bell, Globe } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-dark-400 mt-1">Configurações gerais da plataforma</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RustDesk */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Acesso Remoto (RustDesk)</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Servidor</span>
              <span className="text-white font-mono">136.248.114.218</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Domínio</span>
              <span className="text-white font-mono">remoto.maginf.com.br</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Portas</span>
              <span className="text-white font-mono">21115-21119</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-dark-400">Status</span>
              <span className="badge-online">Configurado</span>
            </div>
          </div>
        </div>

        {/* API */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">API Backend</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">URL Base</span>
              <span className="text-white font-mono text-xs">
                {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">WebSocket</span>
              <span className="text-white font-mono text-xs">
                {process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-dark-400">Versão</span>
              <span className="text-white">v1.0.0</span>
            </div>
          </div>
        </div>

        {/* Segurança */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Segurança</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Autenticação</span>
              <span className="text-white">JWT Bearer Token</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Controle de Acesso</span>
              <span className="text-white">RBAC (Role-Based)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-dark-400">Auditoria</span>
              <span className="badge-online">Ativa</span>
            </div>
          </div>
        </div>

        {/* Notificações */}
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-semibold text-white">Notificações</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">E-mail (SMTP)</span>
              <span className="text-dark-500">Configurar no .env</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-700">
              <span className="text-dark-400">Alertas em tempo real</span>
              <span className="badge-online">WebSocket</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-dark-400">Motor de alertas</span>
              <span className="badge-online">Ativo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Branding */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-white mb-4">Branding</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div>
            <span className="text-dark-400 block mb-1">Empresa</span>
            <span className="text-white font-medium">Maginf Tecnologia</span>
          </div>
          <div>
            <span className="text-dark-400 block mb-1">Produto</span>
            <span className="text-white font-medium">MIConectaRMM Enterprise</span>
          </div>
          <div>
            <span className="text-dark-400 block mb-1">Cor primária</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-brand-600 rounded" />
              <span className="text-white font-mono">#ea580c</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
