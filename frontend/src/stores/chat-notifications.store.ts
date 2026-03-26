'use client'

import { create } from 'zustand'

interface ChatNotificationsState {
  totalUnread: number
  unreadByItem: Record<string, number>
  increment: (itemId: string) => void
  clearItem: (itemId: string) => void
  setTotal: (count: number) => void
  setItemUnread: (itemId: string, count: number) => void
  reset: () => void
}

export const useChatNotificationsStore = create<ChatNotificationsState>((set, get) => ({
  totalUnread: 0,
  unreadByItem: {},

  increment: (itemId) => set((state) => {
    const newByItem = { ...state.unreadByItem, [itemId]: (state.unreadByItem[itemId] || 0) + 1 }
    return { unreadByItem: newByItem, totalUnread: Object.values(newByItem).reduce((a, b) => a + b, 0) }
  }),

  clearItem: (itemId) => set((state) => {
    const newByItem = { ...state.unreadByItem }
    delete newByItem[itemId]
    return { unreadByItem: newByItem, totalUnread: Object.values(newByItem).reduce((a, b) => a + b, 0) }
  }),

  setTotal: (count) => set({ totalUnread: count }),

  setItemUnread: (itemId, count) => set((state) => {
    const newByItem = { ...state.unreadByItem, [itemId]: count }
    return { unreadByItem: newByItem, totalUnread: Object.values(newByItem).reduce((a, b) => a + b, 0) }
  }),

  reset: () => set({ totalUnread: 0, unreadByItem: {} }),
}))
