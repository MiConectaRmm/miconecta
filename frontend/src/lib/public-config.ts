/**
 * URLs públicas de produção MIConecta.
 * Painel oficial: app.maginf.com.br — API: api.maginf.com.br
 */
export const PUBLIC_APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL || 'https://app.maginf.com.br'

export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.maginf.com.br/api/v1'

export const PUBLIC_WS_ORIGIN =
  process.env.NEXT_PUBLIC_WS_URL || 'wss://api.maginf.com.br'

/** MSI servido pela API (instalador do agente Windows) */
export const AGENT_MSI_DOWNLOAD_URL = `${PUBLIC_API_BASE_URL.replace(/\/$/, '')}/agents/download/msi`
