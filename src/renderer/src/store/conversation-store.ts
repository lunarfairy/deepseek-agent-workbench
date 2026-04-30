import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { AgentPlan, AgentTask, ChatMessage, CommandRun, Conversation, TodoItem } from '../../../shared/types'

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
  updateConversationMeta: (conversationId: string, updates: Partial<Pick<Conversation, 'plan' | 'todos' | 'agentTasks' | 'commandRuns'>>) => void
  upsertCommandRun: (conversationId: string, run: CommandRun) => void
  upsertAgentTask: (conversationId: string, task: AgentTask) => void
  setPlan: (conversationId: string, plan: AgentPlan | null) => void
  setTodos: (conversationId: string, todos: TodoItem[]) => void
  setAgentTasks: (conversationId: string, agentTasks: AgentTask[]) => void
  setStreaming: (streaming: boolean) => void
  getActiveConversation: () => Conversation | undefined
  saveConversationById: (conversationId: string) => Promise<void>
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
      plan: null,
      todos: [],
      agentTasks: [],
      commandRuns: [],
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

  updateConversationMeta: (conversationId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...updates, updatedAt: Date.now() } : c
      )
    }))
  },

  upsertCommandRun: (conversationId, run) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c
        const commandRuns = c.commandRuns || []
        const exists = commandRuns.some((existing) => existing.id === run.id)
        return {
          ...c,
          commandRuns: exists
            ? commandRuns.map((existing) => (existing.id === run.id ? run : existing))
            : [...commandRuns, run],
          updatedAt: Date.now()
        }
      })
    }))
  },

  upsertAgentTask: (conversationId, task) => {
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c
        const agentTasks = c.agentTasks || []
        const exists = agentTasks.some((existing) => existing.id === task.id)
        return {
          ...c,
          agentTasks: exists
            ? agentTasks.map((existing) => (existing.id === task.id ? task : existing))
            : [...agentTasks, task],
          updatedAt: Date.now()
        }
      })
    }))
  },

  setPlan: (conversationId, plan) => {
    get().updateConversationMeta(conversationId, { plan })
  },

  setTodos: (conversationId, todos) => {
    get().updateConversationMeta(conversationId, { todos })
  },

  setAgentTasks: (conversationId, agentTasks) => {
    get().updateConversationMeta(conversationId, { agentTasks })
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming })
  },

  getActiveConversation: () => {
    const state = get()
    return state.conversations.find((c) => c.id === state.activeConversationId)
  },

  saveConversationById: async (conversationId) => {
    const state = get()
    const conversation = state.conversations.find((c) => c.id === conversationId)
    if (conversation) {
      await window.api.saveConversation(conversation)
    }
  },

  saveActiveConversation: async () => {
    const state = get()
    const conversation = state.conversations.find((c) => c.id === state.activeConversationId)
    if (conversation) {
      await window.api.saveConversation(conversation)
    }
  }
}))
