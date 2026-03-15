'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('miconecta_token')
    if (token) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [router])

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center">
      <div className="animate-pulse text-brand-500 text-xl font-semibold">
        Carregando MIConectaRMM...
      </div>
    </div>
  )
}
