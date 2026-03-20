'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userType: 'client' | 'technician';
  content: string;
  createdAt: string;
  read?: boolean;
}

export function useChatSocket(ticketId: string | null, token: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const previousTicketIdRef = useRef<string | null>(null);

  // Connect socket
  useEffect(() => {
    if (!token) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const newSocket = io(wsUrl, {
      transports: ['websocket'],
      auth: { token },
    });

    newSocket.on('connect', () => {
      console.log('[useChatSocket] Conectado ao WebSocket');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('[useChatSocket] Desconectado do WebSocket');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('[useChatSocket] Erro de conexão:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  // Join ticket room and listen for messages
  useEffect(() => {
    if (!socket || !ticketId) return;

    // Leave previous room
    if (previousTicketIdRef.current) {
      socket.emit('chat:leave_ticket', { ticketId: previousTicketIdRef.current });
    }

    // Join new room
    socket.emit('chat:join_ticket', { ticketId });
    previousTicketIdRef.current = ticketId;

    const handleNewMessage = (message: ChatMessage) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:new_message', handleNewMessage);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:new_message', handleNewMessage);
    };
  }, [socket, ticketId]);

  const sendMessage = (content: string) => {
    if (!socket || !ticketId || !content.trim()) return;

    socket.emit('chat:send_message', {
      ticketId,
      content: content.trim(),
    });
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    socket,
    connected,
    messages,
    sendMessage,
    clearMessages,
  };
}
