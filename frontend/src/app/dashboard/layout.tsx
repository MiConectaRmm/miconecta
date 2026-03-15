'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { Bell } from 'lucide-react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('miconecta_token')
    const userData = localStorage.getItem('miconecta_user')
    if (!token) {
      router.push('/login')
      return
    }
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [router])

  return (
    <div className="min-h-screen bg-dark-950">
      <Sidebar />

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <header className="h-16 bg-dark-900/80 backdrop-blur-sm border-b border-dark-700 flex items-center justify-between px-8 sticky top-0 z-40">
          <div />
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-dark-400 hover:text-dark-100 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                3
              </span>
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user?.nome?.charAt(0) || 'A'}
              </div>
              <div className="text-sm">
                <p className="text-dark-100 font-medium">{user?.nome || 'Admin'}</p>
                <p className="text-dark-500 text-xs">{user?.funcao || 'admin'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
