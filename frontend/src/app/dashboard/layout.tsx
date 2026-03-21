'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Bell, Search, Check, BellOff, Clock, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { notificationsApi } from '@/lib/api'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, hydrate, logout } = useAuthStore()
  const [notifCount, setNotifCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications()
      const interval = setInterval(loadNotifications, 60000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = async () => {
    try {
      const [countRes, listRes] = await Promise.allSettled([
        notificationsApi.contar(),
        notificationsApi.listar(true),
      ])
      if (countRes.status === 'fulfilled') setNotifCount(countRes.value.data.count || 0)
      if (listRes.status === 'fulfilled') {
        const items = Array.isArray(listRes.value.data) ? listRes.value.data : listRes.value.data?.items || []
        setNotifications(items.slice(0, 8))
      }
    } catch {}
  }

  const markAllRead = async () => {
    try {
      await notificationsApi.marcarTodasLidas()
      setNotifCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })))
    } catch {}
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar />

      <div className="ml-64">
        <header className="h-14 bg-dark-900/80 backdrop-blur-sm border-b border-dark-700 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                placeholder="Buscar dispositivos, tickets..."
                className="bg-dark-800 border border-dark-700 rounded-lg pl-9 pr-4 py-1.5 text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:ring-1 focus:ring-brand-500 w-72"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs(!showNotifs); setShowUserMenu(false) }}
                className="relative p-2 text-dark-400 hover:text-dark-100 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
                    <h3 className="text-sm font-semibold text-white">Notificações</h3>
                    {notifCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Marcar todas lidas
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <BellOff className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                        <p className="text-dark-500 text-sm">Nenhuma notificação</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`px-4 py-3 border-b border-dark-700/50 hover:bg-dark-700/50 transition-colors ${!notif.lida ? 'bg-brand-600/5' : ''}`}
                        >
                          <p className="text-sm text-dark-200 line-clamp-2">{notif.titulo || notif.mensagem || 'Notificação'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-dark-500" />
                            <span className="text-[10px] text-dark-500">
                              {notif.criadoEm ? new Date(notif.criadoEm).toLocaleString('pt-BR') : ''}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false) }}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.nome?.charAt(0) || 'A'}
                </div>
                <div className="text-sm text-left">
                  <p className="text-dark-100 font-medium leading-tight">{user?.nome || 'Admin'}</p>
                  <p className="text-dark-500 text-xs">{user?.role || 'admin'}</p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-dark-700">
                    <p className="text-sm text-white font-medium truncate">{user?.nome}</p>
                    <p className="text-xs text-dark-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { router.push('/dashboard/settings'); setShowUserMenu(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-dark-300 hover:bg-dark-700 hover:text-white transition-colors"
                  >
                    Configurações
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-dark-700 transition-colors flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
