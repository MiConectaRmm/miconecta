/**
 * Payload do backend em emitNotification → atendimento:update e notification:new
 * (fluxo POST /tickets/:id/remote-session).
 */
export type RemoteConnectToastType = 'ticket' | 'alerta' | 'info'

export interface RemoteConnectRequestWsPayload {
  type: 'remote_connect_request'
  ticketId?: string
  deviceId?: string
  agentOnline?: boolean
  technicianId?: string
  technicianNome?: string | null
}

export function isRemoteConnectRequestPayload(data: unknown): data is RemoteConnectRequestWsPayload {
  if (typeof data !== 'object' || data === null) return false
  return (data as Record<string, unknown>).type === 'remote_connect_request'
}

/**
 * Toasts + som opcional + callback após exibir (ex.: patch na lista de tickets).
 * Retorna true se o evento foi reconhecido e tratado.
 */
export function handleRemoteConnectRequestNotification(
  data: unknown,
  options: {
    addToast: (message: string, type: RemoteConnectToastType) => void
    playSound?: () => void
    onAfterToast?: (payload: RemoteConnectRequestWsPayload) => void
  },
): boolean {
  if (!isRemoteConnectRequestPayload(data)) return false
  const online = data.agentOnline === true
  if (online) {
    options.addToast('Agente do cliente notificado. Iniciando conexão remota...', 'info')
    options.playSound?.()
  } else {
    options.addToast('Agente do cliente está offline.', 'info')
  }
  options.onAfterToast?.(data)
  return true
}
