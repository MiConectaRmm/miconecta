'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Bell, Search } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { notificationsApi } from '@/lib/api'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, hydrate } = useAuthStore()
  const [notifCount, setNotifCount] = useState(0)

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
      notificationsApi.contar()
        .then(({ data }) => setNotifCount(data.count || 0))
        .catch(() => {})
    }
  }, [isAuthenticated])

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
            <button className="relative p-2 text-dark-400 hover:text-dark-100 transition-colors">
              <Bell className="w-5 h-5" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.nome?.charAt(0) || 'A'}
              </div>
              <div className="text-sm">
                <p className="text-dark-100 font-medium leading-tight">{user?.nome || 'Admin'}</p>
                <p className="text-dark-500 text-xs">{user?.role || 'admin'}</p>
              </div>
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
