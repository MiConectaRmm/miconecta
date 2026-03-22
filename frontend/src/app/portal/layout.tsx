'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Monitor, Ticket, MessageSquare, BarChart3,
  History, Bell, LogOut, Package, Radio, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

const portalMenu = [
  { href: '/portal', label: 'Visão Geral', icon: Monitor, roles: null },
  { href: '/portal/devices', label: 'Inventário', icon: Package, roles: null },
  { href: '/portal/tickets', label: 'Chamados', icon: Ticket, roles: null },
  { href: '/portal/chat', label: 'Chat', icon: MessageSquare, roles: null },
  { href: '/portal/sessions', label: 'Sessões', icon: Radio, roles: ['admin_cliente', 'gestor'] },
  { href: '/portal/reports', label: 'Relatórios', icon: BarChart3, roles: ['admin_cliente', 'gestor'] },
  { href: '/portal/history', label: 'Histórico', icon: History, roles: null },
  { href: '/portal/users', label: 'Usuários', icon: Users, roles: ['admin_cliente'] },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, hydrate, logout } = useAuthStore()

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Top navigation bar for portal */}
      <header className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">MIConecta</span>
            <span className="text-dark-500 text-xs">Portal</span>
          </Link>

          <nav className="flex items-center gap-1">
            {portalMenu.filter(item => !item.roles || item.roles.includes(user?.role || '')).map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/portal' && pathname?.startsWith(item.href))
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 text-dark-400 hover:text-dark-100 transition-colors relative">
            <Bell className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.nome?.charAt(0) || 'C'}
            </div>
            <span className="text-dark-200 text-sm hidden md:inline">{user?.nome}</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-dark-500 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
