'use client'

import { create } from 'zustand'

export interface AuthUser {
  id: string
  nome: string
  email: string
  userType: 'technician' | 'client_user'
  role: string
  tenantId: string
  tenant?: { id: string; nome: string; slug?: string }
  permissions: string[]
  tenantsAtribuidos?: string[]
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (token: string, refreshToken: string, user: AuthUser) => void
  logout: () => void
  setUser: (user: AuthUser) => void
  setLoading: (loading: boolean) => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: (token, refreshToken, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('miconecta_token', token)
      localStorage.setItem('miconecta_refresh', refreshToken)
      localStorage.setItem('miconecta_user', JSON.stringify(user))
    }
    set({ token, refreshToken, user, isAuthenticated: true, isLoading: false })
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('miconecta_token')
      localStorage.removeItem('miconecta_refresh')
      localStorage.removeItem('miconecta_user')
    }
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false })
  },

  setUser: (user) => set({ user }),

  setLoading: (isLoading) => set({ isLoading }),

  hydrate: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('miconecta_token')
    const refreshToken = localStorage.getItem('miconecta_refresh')
    const userData = localStorage.getItem('miconecta_user')

    if (token && userData) {
      try {
        const user = JSON.parse(userData) as AuthUser
        set({ token, refreshToken, user, isAuthenticated: true, isLoading: false })
      } catch {
        set({ isLoading: false })
      }
    } else {
      set({ isLoading: false })
    }
  },
}))
