'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Redirect legado: /dashboard/clientes -> /dashboard/clients */
export default function ClientesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard/clients') }, [router])
  return null
}
