import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import type { AgentRole, ChatMessage, StreamChunk, ToolCall } from '../../../shared/types'
import { parseWorkbenchState } from '../lib/workbench-state'
import { useConversationStore } from '../store/conversation-store'

export function useChat() {
  const {
    activeConversationId,
    isStreaming,
    addMessage,
    updateMessage,
    appendToMessage,
    setStreaming,
    setPlan,
    setTodos,
    setAgentTasks,
    upsertAgentTask,
    upsertCommandRun,
    createConversation
  } = useConversationStore()

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      let convId = activeConversationId
      if (!convId) {
        convId = createConversation()
      }

      const outgoingContent = prepareWorkbenchCommand(content.trim(), convId, {
        setPlan,
        setTodos,
        upsertAgentTask
      })

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
        ? conversation.messages
            .filter((m) => m.id !== assistantMsgId)
            .map((m) => (m.id === userMsg.id ? { ...m, content: outgoingContent } : m))
        : []
      const streamContext = conversation
        ? {
            conversationId: conversation.id,
            plan: conversation.plan,
            todos: conversation.todos || [],
            agentTasks: conversation.agentTasks || []
          }
        : { conversationId: convId }

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
              const state = useConversationStore.getState()
              const conv = state.conversations.find((c) => c.id === convId)
              const msg = conv?.messages.find((m) => m.id === assistantMsgId)
              updateMessage(convId!, assistantMsgId, {
                toolCalls: [...(msg?.toolCalls || []), chunk.toolCall]
              })
            }
            break

          case 'tool_result':
            if (chunk.toolResult) {
              const state = useConversationStore.getState()
              const conv = state.conversations.find((c) => c.id === convId)
              const msg = conv?.messages.find((m) => m.id === assistantMsgId)
              updateMessage(convId!, assistantMsgId, {
                toolResults: [...(msg?.toolResults || []), chunk.toolResult]
              })
              currentToolCalls.splice(0)
            }
            break

          case 'command_output':
            if (chunk.commandRun) {
              upsertCommandRun(convId!, chunk.commandRun)
            }
            break

          case 'agent_state':
            if (chunk.agentTask) {
              upsertAgentTask(convId!, chunk.agentTask)
            }
            break

          case 'error':
            updateMessage(convId!, assistantMsgId, {
              content: `Error: ${chunk.error}`,
              isStreaming: false
            })
            break

          case 'done':
            {
              const finalState = useConversationStore.getState()
              const finalConv = finalState.conversations.find((c) => c.id === convId)
              const finalMsg = finalConv?.messages.find((m) => m.id === assistantMsgId)
              const parsed = finalMsg
                ? parseWorkbenchState(finalMsg.content, {
                    plan: finalConv?.plan,
                    todos: finalConv?.todos,
                    agentTasks: finalConv?.agentTasks
                  })
                : null
              const toolCalls = mergeToolCalls(finalMsg?.toolCalls || [], currentToolCalls.splice(0))

              updateMessage(convId!, assistantMsgId, {
                ...(parsed?.found ? { content: parsed.content } : {}),
                ...(toolCalls.length > 0 ? { toolCalls } : {}),
                isStreaming: false
              })

              if (parsed?.found) {
                if (parsed.plan) setPlan(convId!, parsed.plan)
                if (parsed.todos) setTodos(convId!, parsed.todos)
                if (parsed.agentTasks) setAgentTasks(convId!, parsed.agentTasks)
              }
            }
            setStreaming(false)
            // Save conversation
            useConversationStore.getState().saveConversationById(convId!)
            cleanup()
            break
        }
      })

      // Start stream
      try {
        await window.api.startChatStream(convId, apiMessages, streamContext)
      } catch (err: any) {
        updateMessage(convId!, assistantMsgId, {
          content: `Failed to start stream: ${err.message}`,
          isStreaming: false
        })
        setStreaming(false)
        cleanup()
      }
    },
    [
      activeConversationId,
      isStreaming,
      addMessage,
      appendToMessage,
      createConversation,
      setAgentTasks,
      setPlan,
      setStreaming,
      setTodos,
      upsertAgentTask,
      upsertCommandRun,
      updateMessage
    ]
  )

  return { sendMessage, isStreaming }
}

function mergeToolCalls(existing: ToolCall[], pending: ToolCall[]): ToolCall[] {
  const merged = [...existing]
  for (const toolCall of pending) {
    if (!merged.some((candidate) => candidate.id === toolCall.id)) {
      merged.push(toolCall)
    }
  }
  return merged
}

function prepareWorkbenchCommand(
  raw: string,
  conversationId: string,
  actions: {
    setPlan: ReturnType<typeof useConversationStore.getState>['setPlan']
    setTodos: ReturnType<typeof useConversationStore.getState>['setTodos']
    upsertAgentTask: ReturnType<typeof useConversationStore.getState>['upsertAgentTask']
  }
): string {
  const [command, ...rest] = raw.split(/\s+/)
  const request = rest.join(' ').trim()
  if (command === '/plan') {
    const now = Date.now()
    const title = request || 'Plan-first coding task'
    actions.setPlan(conversationId, {
      id: uuid(),
      title,
      summary: 'Draft plan requested from the Coordinator. Tool use still requires explicit approval.',
      approved: false,
      createdAt: now,
      updatedAt: now
    })
    actions.setTodos(conversationId, [
      { id: uuid(), content: 'Clarify objective and constraints', status: 'pending' },
      { id: uuid(), content: 'Inspect relevant files and risks', status: 'pending' },
      { id: uuid(), content: 'Propose implementation and tests', status: 'pending' }
    ])
    return `Use the Coordinator profile. Create a concise plan-first response for this task: ${title}. Include todos and wait for approval before implementation.`
  }

  if (command === '/agents') {
    const roles: AgentRole[] = ['explorer', 'implementer', 'reviewer', 'integrator']
    const title = request || 'Coordinate specialist agents'
    const now = Date.now()
    roles.forEach((role) => {
      actions.upsertAgentTask(conversationId, {
        id: uuid(),
        role,
        title: `${role}: ${title}`,
        status: 'pending',
        createdAt: now,
        updatedAt: now
      })
    })
    return `Use the Coordinator profile to split this request across Explorer, Implementer, Reviewer, and Integrator roles: ${title}. Summarize each role's prompt and expected output.`
  }

  if (command === '/help') {
    return 'Show the available slash commands and explain how Plan-first, multi-agent profiles, approvals, command output, and MCP work in this app.'
  }

  if (command === '/mcp') {
    return `Use the MCP Tool Agent profile. Explain how to configure local stdio MCP servers for this request: ${request || 'general setup'}.`
  }

  if (command === '/terminal') {
    return `Use a command-oriented workflow. Propose commands for this task, but wait for approval before running any command: ${request || 'terminal task'}.`
  }

  if (command === '/workdir') {
    return `Discuss the current workspace and any workdir changes needed for: ${request || 'this project'}.`
  }

  if (command === '/model') {
    return `Discuss model and agent profile configuration for: ${request || 'this project'}.`
  }

  return raw
}
