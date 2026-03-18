'use client'

import { useEffect, useMemo, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000'
const sockets = new Map<string, Socket>()

function getSocket(namespace: string) {
  const existing = sockets.get(namespace)
  if (existing) return existing

  const token = typeof window !== 'undefined' ? localStorage.getItem('miconecta_token') : null
  if (!token) return null

  const socket = io(`${WS_URL}${namespace}`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelayMax: 5000,
  })

  sockets.set(namespace, socket)
  socket.on('disconnect', () => {
    if (!socket.connected) return
  })
  return socket
}

export function useSocket(namespace: string = '/chat') {
  const socket = useMemo(() => getSocket(namespace), [namespace])

  useEffect(() => {
    if (!socket) return
    return () => {
      // Mantém a conexão compartilhada para evitar múltiplos sockets por página.
    }
  }, [socket])

  const emit = useCallback((event: string, data: unknown) => {
    socket?.emit(event, data)
  }, [socket])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socket?.on(event, handler)
    return () => {
      socket?.off(event, handler)
    }
  }, [socket])

  return { socket, emit, on }
}

export function useChatSocket(ticketId: string | null) {
  const { socket, emit, on } = useSocket('/chat')

  useEffect(() => {
    if (!ticketId || !socket) return
    emit('ticket:join', { ticketId })
    return () => {
      emit('ticket:leave', { ticketId })
    }
  }, [ticketId, socket, emit])

  const sendMessage = useCallback((content: string) => {
    if (!ticketId) return
    emit('message:send', { ticketId, content })
  }, [ticketId, emit])

  const sendFile = useCallback((payload: {
    arquivoUrl: string
    arquivoNome: string
    arquivoTamanho: number
    conteudo?: string
  }) => {
    if (!ticketId) return
    emit('chat:send_file', { ticketId, ...payload })
  }, [ticketId, emit])

  const sendTyping = useCallback((userId: string, nome: string, isTyping: boolean) => {
    if (!ticketId) return
    emit('chat:typing', { ticketId, userId, nome, isTyping })
  }, [ticketId, emit])

  return { socket, on, sendMessage, sendFile, sendTyping }
}
