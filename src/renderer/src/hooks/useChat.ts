import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import type { ChatMessage, StreamChunk, ToolCall, ToolResult } from '../../../shared/types'
import { useConversationStore } from '../store/conversation-store'

export function useChat() {
  const {
    activeConversationId,
    isStreaming,
    addMessage,
    updateMessage,
    appendToMessage,
    setStreaming,
    getActiveConversation,
    saveActiveConversation,
    createConversation
  } = useConversationStore()

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      let convId = activeConversationId
      if (!convId) {
        convId = createConversation()
      }

      // Add user message
      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: content.trim(),
        createdAt: Date.now()
      }
      addMessage(convId, userMsg)

      // Add placeholder assistant message
      const assistantMsgId = uuid()
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        createdAt: Date.now()
      }
      addMessage(convId, assistantMsg)

      setStreaming(true)

      // Build messages array for API
      const conversation = useConversationStore.getState().conversations.find((c) => c.id === convId)
      const apiMessages = conversation
        ? conversation.messages.filter((m) => m.id !== assistantMsgId).map((m) => ({
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls,
            toolResults: m.toolResults
          }))
        : []

      // Current tool calls being accumulated
      const currentToolCalls: ToolCall[] = []

      // Setup streaming listener
      const cleanup = window.api.onStreamChunk((chunk: StreamChunk) => {
        switch (chunk.type) {
          case 'content':
            appendToMessage(convId!, assistantMsgId, chunk.content || '')
            break

          case 'reasoning_content':
            // Accumulate reasoning content on the message
            {
              const state = useConversationStore.getState()
              const conv = state.conversations.find((c) => c.id === convId)
              const msg = conv?.messages.find((m) => m.id === assistantMsgId)
              updateMessage(convId!, assistantMsgId, {
                reasoningContent: (msg?.reasoningContent || '') + (chunk.content || '')
              })
            }
            break

          case 'tool_call':
            if (chunk.toolCall) {
              currentToolCalls.push(chunk.toolCall)
            }
            break

          case 'tool_result':
            if (chunk.toolResult) {
              const state = useConversationStore.getState()
              const conv = state.conversations.find((c) => c.id === convId)
              const msg = conv?.messages.find((m) => m.id === assistantMsgId)
              updateMessage(convId!, assistantMsgId, {
                toolCalls: [...(msg?.toolCalls || []), ...currentToolCalls.splice(0)],
                toolResults: [...(msg?.toolResults || []), chunk.toolResult]
              })
            }
            break

          case 'error':
            updateMessage(convId!, assistantMsgId, {
              content: `Error: ${chunk.error}`,
              isStreaming: false
            })
            break

          case 'done':
            const finalState = useConversationStore.getState()
            const finalConv = finalState.conversations.find((c) => c.id === convId)
            const finalMsg = finalConv?.messages.find((m) => m.id === assistantMsgId)
            if (currentToolCalls.length > 0 || (finalMsg?.toolCalls && finalMsg.toolCalls.length > 0)) {
              updateMessage(convId!, assistantMsgId, {
                toolCalls: [...(finalMsg?.toolCalls || []), ...currentToolCalls.splice(0)],
                isStreaming: false
              })
            } else {
              updateMessage(convId!, assistantMsgId, { isStreaming: false })
            }
            setStreaming(false)
            // Save conversation
            useConversationStore.getState().saveActiveConversation()
            cleanup()
            break
        }
      })

      // Start stream
      try {
        await window.api.startChatStream(convId, apiMessages)
      } catch (err: any) {
        updateMessage(convId!, assistantMsgId, {
          content: `Failed to start stream: ${err.message}`,
          isStreaming: false
        })
        setStreaming(false)
        cleanup()
      }
    },
    [activeConversationId, isStreaming]
  )

  return { sendMessage, isStreaming }
}
