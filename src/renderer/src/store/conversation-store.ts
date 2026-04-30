import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Conversation, ChatMessage } from '../../../shared/types'

interface ConversationState {
  conversations: Conversation[]
  activeConversationId: string | null
  isStreaming: boolean

  loadConversations: () => Promise<void>
  createConversation: () => string
  setActiveConversation: (id: string | null) => void
  deleteConversation: (id: string) => Promise<void>
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void
  appendToMessage: (conversationId: string, messageId: string, content: string) => void
  setStreaming: (streaming: boolean) => void
  getActiveConversation: () => Conversation | undefined
  saveActiveConversation: () => Promise<void>
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  isStreaming: false,

  loadConversations: async () => {
    const conversations = await window.api.getConversations()
    set({ conversations })
  },

  createConversation: () => {
    const id = uuid()
    const now = Date.now()
    const conversation: Conversation = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: id
    }))
    return id
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id })
  },

  deleteConversation: async (id) => {
    await window.api.deleteConversation(id)
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id)
      const activeId =
        state.activeConversationId === id
          ? conversations[0]?.id || null
          : state.activeConversationId
      return { conversations, activeConversationId: activeId }
    })
  },

  addMessage: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c
        // Auto-title from first user message
        const title =
          c.messages.length === 0 && message.role === 'user'
            ? message.content.slice(0, 40) + (message.content.length > 40 ? '...' : '')
            : c.title
        return {
          ...c,
          title,
          messages: [...c.messages, message],
          updatedAt: Date.now()
        }
      })
    }))
  },

  updateMessage: (conversationId, messageId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c
        return {
          ...c,
          messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
          updatedAt: Date.now()
        }
      })
    }))
  },

  appendToMessage: (conversationId, messageId, content) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c
        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content: m.content + content } : m
          )
        }
      })
    }))
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming })
  },

  getActiveConversation: () => {
    const state = get()
    return state.conversations.find((c) => c.id === state.activeConversationId)
  },

  saveActiveConversation: async () => {
    const state = get()
    const conversation = state.conversations.find((c) => c.id === state.activeConversationId)
    if (conversation) {
      await window.api.saveConversation(conversation)
    }
  }
}))
