'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Monitor,
  Bell,
  Terminal,
  Package,
  Shield,
  Users,
  Building2,
  FileText,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/devices', label: 'Dispositivos', icon: Monitor },
  { href: '/dashboard/alerts', label: 'Alertas', icon: Bell },
  { href: '/dashboard/scripts', label: 'Scripts', icon: Terminal },
  { href: '/dashboard/software', label: 'Software', icon: Package },
  { href: '/dashboard/patches', label: 'Patches', icon: Shield },
  { href: '/dashboard/clients', label: 'Clientes', icon: Building2 },
  { href: '/dashboard/technicians', label: 'Técnicos', icon: Users },
  { href: '/dashboard/audit', label: 'Auditoria', icon: FileText },
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  const handleLogout = () => {
    localStorage.removeItem('miconecta_token')
    localStorage.removeItem('miconecta_user')
    window.location.href = '/login'
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-900 border-r border-dark-700 flex flex-col z-50">
      {/* Logo */}
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

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {menuItems.map((item) => {
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

      {/* Footer */}
      <div className="p-4 border-t border-dark-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dark-400 hover:bg-dark-800 hover:text-red-400 transition-colors w-full"
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
