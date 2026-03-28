/** Cores estáveis por cliente (organização / dispositivo) para lista e cabeçalho do Inbox */

export interface ClientColor {
  border: string
  soft: string
  accent: string
}

export const INBOX_PALETTE: ClientColor[] = [
  { border: '#10b981', soft: 'rgba(16,185,129,0.14)', accent: '#34d399' },
  { border: '#6366f1', soft: 'rgba(99,102,241,0.14)', accent: '#a5b4fc' },
  { border: '#f59e0b', soft: 'rgba(245,158,11,0.14)', accent: '#fbbf24' },
  { border: '#ec4899', soft: 'rgba(236,72,153,0.14)', accent: '#f472b6' },
  { border: '#06b6d4', soft: 'rgba(6,182,212,0.14)', accent: '#22d3ee' },
  { border: '#a855f7', soft: 'rgba(168,85,247,0.14)', accent: '#c084fc' },
  { border: '#ef4444', soft: 'rgba(239,68,68,0.14)', accent: '#f87171' },
  { border: '#84cc16', soft: 'rgba(132,204,22,0.14)', accent: '#a3e635' },
  { border: '#eab308', soft: 'rgba(234,179,8,0.14)', accent: '#fde047' },
  { border: '#3b82f6', soft: 'rgba(59,130,246,0.14)', accent: '#60a5fa' },
]

const PALETTE = INBOX_PALETTE

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

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return `rgba(59,130,246,${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const COLOR_STORE_PREFIX = 'miconecta-inbox-color-'

export type InboxColorOverride = 'auto' | { kind: 'palette'; index: number } | { kind: 'hex'; hex: string }

export function getInboxColorOverride(itemId: string): InboxColorOverride {
  if (typeof window === 'undefined') return 'auto'
  const raw = localStorage.getItem(COLOR_STORE_PREFIX + itemId)
  if (!raw) return 'auto'
  if (raw.startsWith('hex:')) {
    const hex = raw.slice(4)
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return { kind: 'hex', hex }
  }
  const n = parseInt(raw, 10)
  if (!Number.isNaN(n) && n >= 0 && n < PALETTE.length) return { kind: 'palette', index: n }
  return 'auto'
}

export function setInboxColorAuto(itemId: string) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(COLOR_STORE_PREFIX + itemId)
}

export function setInboxColorPalette(itemId: string, index: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(COLOR_STORE_PREFIX + itemId, String(index % PALETTE.length))
}

export function setInboxColorHex(itemId: string, hex: string) {
  if (typeof window === 'undefined') return
  const h = hex.trim()
  if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return
  localStorage.setItem(COLOR_STORE_PREFIX + itemId, 'hex:' + h)
}

export function resolveInboxColor(itemId: string, fallbackKey: string): ClientColor {
  const o = getInboxColorOverride(itemId)
  if (o === 'auto') return colorForClientKey(fallbackKey)
  if (o.kind === 'palette') return PALETTE[o.index % PALETTE.length]
  return {
    border: o.hex,
    soft: hexToRgba(o.hex, 0.14),
    accent: o.hex,
  }
}

export function empresaLabel(nome?: string | null): string {
  const t = (nome || '').trim()
  if (!t) return 'Empresa não informada'
  return t
}

/** Legado: lista em caps; preferir empresaLabel no UI novo */
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

export interface InboxLike {
  id: string
  contatoLabel?: string
  cliente?: string
  titulo: string
}

export function getContactDisplayName(item: InboxLike): string {
  const alias = getInboxAlias(item.id)
  if (alias) return alias
  if (item.contatoLabel && item.contatoLabel !== '—') return item.contatoLabel
  if (item.cliente && item.cliente !== 'N/A') return item.cliente
  return item.titulo?.trim() || 'Contato'
}
