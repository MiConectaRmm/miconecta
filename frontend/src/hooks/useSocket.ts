'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000'

export function useSocket(namespace: string = '/chat') {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('miconecta_token') : null
    if (!token) return

    const socket = io(`${WS_URL}${namespace}`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => console.log(`[WS] Connected to ${namespace}`))
    socket.on('disconnect', () => console.log(`[WS] Disconnected from ${namespace}`))

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [namespace])

  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data)
  }, [])

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler)
    return () => { socketRef.current?.off(event, handler) }
  }, [])

  return { socket: socketRef.current, emit, on }
}

export function useChatSocket(ticketId: string | null) {
  const { socket, emit, on } = useSocket('/chat')

  useEffect(() => {
    if (!ticketId || !socket) return
    emit('chat:join_ticket', { ticketId })
    return () => { emit('chat:leave_ticket', { ticketId }) }
  }, [ticketId, socket, emit])

  const sendMessage = useCallback((conteudo: string, remetenteId: string, remetenteNome: string, remetenteTipo: string) => {
    if (!ticketId) return
    emit('chat:send_message', { ticketId, conteudo, remetenteId, remetenteNome, remetenteTipo })
  }, [ticketId, emit])

  const sendTyping = useCallback((userId: string, nome: string, isTyping: boolean) => {
    if (!ticketId) return
    emit('chat:typing', { ticketId, userId, nome, isTyping })
  }, [ticketId, emit])

  return { on, sendMessage, sendTyping }
}
