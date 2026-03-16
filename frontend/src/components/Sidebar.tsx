'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  Ticket,
  MessageSquare,
  BarChart3,
  Eye,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'

interface MenuItem {
  href: string
  label: string
  icon: any
  section?: string
}

const menuItems: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Principal' },
  { href: '/dashboard/clients', label: 'Clientes', icon: Building2, section: 'Principal' },
  { href: '/dashboard/devices', label: 'Dispositivos', icon: Monitor, section: 'RMM' },
  { href: '/dashboard/alerts', label: 'Alertas', icon: Bell, section: 'RMM' },
  { href: '/dashboard/scripts', label: 'Scripts', icon: Terminal, section: 'RMM' },
  { href: '/dashboard/software', label: 'Software', icon: Package, section: 'RMM' },
  { href: '/dashboard/patches', label: 'Patches', icon: Shield, section: 'RMM' },
  { href: '/dashboard/tickets', label: 'Tickets', icon: Ticket, section: 'Help Desk' },
  { href: '/dashboard/chat', label: 'Chat', icon: MessageSquare, section: 'Help Desk' },
  { href: '/dashboard/technicians', label: 'Técnicos', icon: Users, section: 'Administração' },
  { href: '/dashboard/audit', label: 'Auditoria', icon: Eye, section: 'Administração' },
  { href: '/dashboard/reports', label: 'Relatórios', icon: BarChart3, section: 'Administração' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const sections = menuItems.reduce((acc, item) => {
    const section = item.section || 'Outros'
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {} as Record<string, MenuItem[]>)

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

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} className="mb-4">
            <p className="text-[10px] uppercase tracking-wider text-dark-500 font-semibold px-3 mb-1.5">{section}</p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href))
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-600/20 text-brand-400'
                          : 'text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                      )}
                    >
                      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-700">
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
