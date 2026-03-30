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

/** Normaliza nome de contacto para agrupar linhas duplicadas na inbox (mesmo utilizador). */
export function normalizeInboxContactLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

export interface InboxItemLike {
  id: string
  kind?: string
  conversationId?: string
  ticketId?: string
  titulo: string
  cliente: string
  contatoLabel?: string
  deviceId?: string
  organizationId?: string
  tenantId?: string
  lastMessageAt?: string
  criadoEm: string
  unread: number
  lastMessage?: string
  empresaNome?: string
  ticketNumero?: number
  status?: string
  prioridade?: string
  deviceHostname?: string
  rustdeskId?: string
  deviceStatus?: string
}

/**
 * Chave estável para agrupar conversas/tickets do mesmo utilizador (uma linha na lista, estilo WhatsApp).
 * Prioridade: deviceId → organização+contacto → tenant+contacto; sem contacto válido não agrupa.
 */
export function inboxGroupKey(item: InboxItemLike): string {
  if (item.deviceId) return `d:${item.deviceId}`
  const raw = (item.contatoLabel || item.cliente || '').trim()
  if (!raw || raw === '—' || raw === 'N/A') return `u:${item.id}`
  const contact = normalizeInboxContactLabel(raw)
  if (item.organizationId) return `o:${item.organizationId}:${contact}`
  if (item.tenantId) return `t:${item.tenantId}:${contact}`
  return `u:${item.id}`
}

const ALIAS_PREFIX = 'miconecta-inbox-alias-'
const ALIAS_GROUP_PREFIX = 'miconecta-inbox-alias-gk-'

function sanitizedGroupKeyForStorage(gk: string): string {
  return gk.replace(/[^a-zA-Z0-9_-]+/g, '_')
}

export type InboxAliasItem = InboxItemLike & { mergedThreads?: InboxItemLike[] }

function legacyAliasKeysForItem(item: InboxAliasItem): string[] {
  const keys = [ALIAS_PREFIX + item.id]
  if (item.mergedThreads?.length) {
    for (const t of item.mergedThreads) keys.push(ALIAS_PREFIX + t.id)
  }
  return keys
}

/** Alias por contacto (device/org/tenant), estável quando o id da linha muda após merge na inbox. */
export function getContactAliasForItem(item: InboxAliasItem): string {
  if (typeof window === 'undefined') return ''
  const gk = sanitizedGroupKeyForStorage(inboxGroupKey(item))
  const groupVal = localStorage.getItem(ALIAS_GROUP_PREFIX + gk)
  if (groupVal) return groupVal
  for (const k of legacyAliasKeysForItem(item)) {
    const v = localStorage.getItem(k)
    if (v) return v
  }
  return ''
}

export function setContactAliasForItem(item: InboxAliasItem, value: string) {
  if (typeof window === 'undefined') return
  const gk = sanitizedGroupKeyForStorage(inboxGroupKey(item))
  const key = ALIAS_GROUP_PREFIX + gk
  const v = value.trim()
  if (!v) localStorage.removeItem(key)
  else localStorage.setItem(key, v)
  for (const lk of legacyAliasKeysForItem(item)) {
    localStorage.removeItem(lk)
  }
}

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

export function getContactDisplayName(item: InboxLike & Partial<InboxAliasItem>): string {
  const alias = getContactAliasForItem(item as InboxAliasItem)
  if (alias) return alias
  if (item.contatoLabel && item.contatoLabel !== '—') return item.contatoLabel
  if (item.cliente && item.cliente !== 'N/A') return item.cliente
  return item.titulo?.trim() || 'Contato'
}

export function inboxStableRowId(groupKey: string): string {
  return `group-${groupKey.replace(/[^a-zA-Z0-9_-]+/g, '_')}`
}

export type InboxMergedRow = InboxItemLike & { mergedThreads?: InboxItemLike[] }

/**
 * Junta várias threads (conversa/ticket) do mesmo contacto numa única linha da inbox.
 */
export function mergeInboxByContact(flat: InboxItemLike[]): InboxMergedRow[] {
  const buckets = new Map<string, Map<string, InboxItemLike>>()
  for (const it of flat) {
    const k = inboxGroupKey(it)
    if (!buckets.has(k)) buckets.set(k, new Map())
    buckets.get(k)!.set(it.id, it)
  }

  const merged: InboxMergedRow[] = []
  buckets.forEach((byId, key) => {
    const group = Array.from(byId.values())
    group.sort(
      (a, b) =>
        new Date(b.lastMessageAt || b.criadoEm).getTime() -
        new Date(a.lastMessageAt || a.criadoEm).getTime(),
    )
    if (group.length === 1) {
      merged.push({ ...group[0] })
      return
    }
    const primary = group[0]
    const unread = group.reduce((s, i) => s + (i.unread || 0), 0)
    const lastTs = Math.max(
      ...group.map((i) => new Date(i.lastMessageAt || i.criadoEm).getTime()),
    )
    const ticketLine = group.find((i) => i.ticketNumero)
    merged.push({
      ...primary,
      id: inboxStableRowId(key),
      unread,
      lastMessage: primary.lastMessage,
      lastMessageAt: new Date(lastTs).toISOString(),
      ticketNumero: ticketLine?.ticketNumero ?? primary.ticketNumero,
      mergedThreads: group,
    })
  })

  merged.sort((a, b) => {
    if ((a.unread || 0) > 0 && (b.unread || 0) === 0) return -1
    if ((a.unread || 0) === 0 && (b.unread || 0) > 0) return 1
    return (
      new Date(b.lastMessageAt || b.criadoEm).getTime() -
      new Date(a.lastMessageAt || a.criadoEm).getTime()
    )
  })
  return merged
}
