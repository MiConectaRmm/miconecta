/** Cores estáveis por cliente (organização / dispositivo) para lista e cabeçalho do Inbox */

export interface ClientColor {
  border: string
  soft: string
  accent: string
}

const PALETTE: ClientColor[] = [
  { border: '#10b981', soft: 'rgba(16,185,129,0.12)', accent: '#34d399' },
  { border: '#6366f1', soft: 'rgba(99,102,241,0.12)', accent: '#a5b4fc' },
  { border: '#f59e0b', soft: 'rgba(245,158,11,0.12)', accent: '#fbbf24' },
  { border: '#ec4899', soft: 'rgba(236,72,153,0.12)', accent: '#f472b6' },
  { border: '#06b6d4', soft: 'rgba(6,182,212,0.12)', accent: '#22d3ee' },
  { border: '#a855f7', soft: 'rgba(168,85,247,0.12)', accent: '#c084fc' },
  { border: '#ef4444', soft: 'rgba(239,68,68,0.12)', accent: '#f87171' },
  { border: '#84cc16', soft: 'rgba(132,204,22,0.12)', accent: '#a3e635' },
  { border: '#eab308', soft: 'rgba(234,179,8,0.12)', accent: '#fde047' },
  { border: '#3b82f6', soft: 'rgba(59,130,246,0.12)', accent: '#60a5fa' },
]

export function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function colorForClientKey(key: string): ClientColor {
  return PALETTE[hashString(key) % PALETTE.length]
}

export function empresaUpper(nome?: string | null): string {
  const t = (nome || '').trim()
  if (!t) return 'CLIENTE'
  return t.toLocaleUpperCase('pt-BR')
}

const ALIAS_PREFIX = 'miconecta-inbox-alias-'

export function getInboxAlias(itemId: string): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(ALIAS_PREFIX + itemId) || ''
}

export function setInboxAlias(itemId: string, value: string) {
  if (typeof window === 'undefined') return
  const v = value.trim()
  if (!v) localStorage.removeItem(ALIAS_PREFIX + itemId)
  else localStorage.setItem(ALIAS_PREFIX + itemId, v)
}
