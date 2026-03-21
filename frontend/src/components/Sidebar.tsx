'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Monitor,
  Inbox,
  Users,
  Building2,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

interface MenuItem {
  href: string
  label: string
  icon: any
  /** Roles que podem ver este item. Se vazio, todos veem. */
  roles?: string[]
}

const menuItems: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/atendimento', label: 'Central de Atendimento', icon: Inbox },
  { href: '/dashboard/clients', label: 'Clientes', icon: Building2 },
  { href: '/dashboard/technicians', label: 'Técnicos', icon: Users, roles: ['super_admin', 'admin', 'admin_maginf'] },
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings, roles: ['super_admin', 'admin', 'admin_maginf'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const userRole = user?.role || ''

  // Técnicos de campo: só Dashboard + Central + Clientes
  const isFieldTechnician =
    user?.userType === 'technician' &&
    ['tecnico', 'tecnico_senior', 'visualizador'].includes(userRole)

  const displayItems = menuItems.filter((item) => {
    // Se tem restrição de role, verificar
    if (item.roles && item.roles.length > 0) {
      if (isFieldTechnician) return false
      return item.roles.includes(userRole)
    }
    return true
  })

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-900 border-r border-dark-700 flex flex-col z-50">
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">MIConecta</h1>
            <p className="text-xs text-dark-400">RMM Enterprise</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {displayItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href))
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-600/20 text-brand-400'
                      : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-dark-700">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.nome?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">{user?.nome || 'Usuário'}</p>
            <p className="text-[10px] text-dark-500 truncate">
              {userRole === 'super_admin' ? 'Super Admin' : userRole === 'admin' || userRole === 'admin_maginf' ? 'Admin' : 'Técnico'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-dark-400 hover:bg-dark-800 hover:text-red-400 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
        <p className="text-[10px] text-dark-600 text-center mt-3">
          Maginf Tecnologia © 2026
        </p>
      </div>
    </aside>
  )
}
