'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

/** Redirect legado: /dashboard/clientes/:id -> /dashboard/clients/:id */
export default function ClienteDetailRedirect() {
  const router = useRouter()
  const params = useParams()
  useEffect(() => { router.replace('/dashboard/clients/' + params.id) }, [router, params.id])
  return null
}
