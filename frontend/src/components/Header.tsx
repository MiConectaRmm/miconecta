'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Settings, LogOut, User, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { cn } from '@/lib/utils'
import ProfileModal from './ProfileModal'

const MOTIVATIONAL_PHRASES = [
  'Cada conexão é uma oportunidade de resolver.',
  'Transformando TI em soluções reais.',
  'Conectados para proteger e resolver.',
  'Sua expertise, nossa plataforma.',
  'Simplificando a gestão de TI.',
]

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const [currentPhrase] = useState(() => 
    MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)]
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/chat', label: 'Chat/Ticket' },
  ]

  const initials = user?.nome?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'
  const profilePhoto = user?.profilePhotoUrl

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Logo + Menu */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold text-gray-800">Miconecta</span>
          </Link>

          {/* Menu horizontal */}
          <nav className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/dashboard' && pathname?.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-600 border-b-2 border-brand-500'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Frase motivacional + Perfil */}
        <div className="flex items-center gap-6">
          {/* Frase motivacional */}
          <p className="hidden lg:block text-sm text-gray-500 italic max-w-xs">
            {currentPhrase}
          </p>

          {/* User dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                {profilePhoto ? (
                  <img src={profilePhoto} alt={user?.nome || 'Perfil'} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-800 leading-tight">
                  {user?.nome || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'super_admin' ? 'Super Admin' : 
                   ['admin', 'admin_maginf'].includes(user?.role || '') ? 'Admin' : 'Técnico'}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {/* Header do dropdown */}
                <div className="px-4 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-purple-500 rounded-full flex items-center justify-center text-white text-base font-bold overflow-hidden">
                      {profilePhoto ? (
                        <img src={profilePhoto} alt={user?.nome || 'Perfil'} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {user?.nome || 'Usuário'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {user?.email || ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      setShowProfileModal(true)
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-500" />
                    Meu perfil
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)} 
      />
    </header>
  )
}
