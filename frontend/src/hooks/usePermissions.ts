'use client'

import { useAuthStore } from '@/stores/auth.store'

export function usePermissions() {
  const user = useAuthStore((s) => s.user)
  const permissions = user?.permissions || []

  const has = (permission: string): boolean => {
    if (permissions.includes('*')) return true
    if (permissions.includes(permission)) return true
    const [resource] = permission.split(':')
    return permissions.includes(`${resource}:*`)
  }

  const hasAny = (...perms: string[]): boolean => perms.some(has)
  const hasAll = (...perms: string[]): boolean => perms.every(has)

  const isMaginf = user?.userType === 'technician'
  const isClient = user?.userType === 'client_user'
  const isAdmin = ['super_admin', 'admin_maginf', 'admin'].includes(user?.role || '')

  return { has, hasAny, hasAll, isMaginf, isClient, isAdmin, role: user?.role }
}
