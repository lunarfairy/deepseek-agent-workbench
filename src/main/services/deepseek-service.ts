import OpenAI from 'openai'
import type { AppSettings, CommandRun, StreamChunk, ToolApprovalRequest, ChatMessage } from '../../shared/types'
import { loadSettings } from './settings-store'
import {
  executeRegisteredTool,
  getToolDefinitions,
  getToolRisk,
  getToolSummary
} from './tool-registry'

interface PendingApproval {
  resolve: (approved: boolean) => void
  toolName: string
  args: string
}

// Map of pending tool approvals keyed by toolCallId
const pendingApprovals = new Map<string, PendingApproval>()

// Callback to send tool approval requests to renderer
let sendApprovalRequest: ((req: ToolApprovalRequest) => void) | null = null

export function setApprovalCallback(cb: (req: ToolApprovalRequest) => void): void {
  sendApprovalRequest = cb
}

export function resolveToolApproval(toolCallId: string, approved: boolean): void {
  const pending = pendingApprovals.get(toolCallId)
  if (pending) {
    pending.resolve(approved)
    pendingApprovals.delete(toolCallId)
  }
}

async function waitForApproval(toolCallId: string, toolName: string, args: string): Promise<boolean> {
  return new Promise((resolve) => {
    pendingApprovals.set(toolCallId, { resolve, toolName, args })

    // Send approval request to renderer
    if (sendApprovalRequest) {
      sendApprovalRequest({
        toolCallId,
        toolName: toolName as any,
        args,
        summary: getToolSummary(toolName, args),
        risk: getToolRisk(toolName)
      })
    }
  })
}

function buildApiMessages(
  messages: ChatMessage[],
  systemPrompt: string,
  thinkingEnabled: boolean
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt }
  ]

  for (const msg of messages) {
    if (msg.role === 'user') {
      apiMessages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        // When thinking mode is on and reasoning content exists, include it
        const assistantMsg: any = {
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          }))
        }
        if (thinkingEnabled && msg.reasoningContent) {
          assistantMsg.reasoning_content = msg.reasoningContent
        }
        apiMessages.push(assistantMsg)
        // Add tool results
        if (msg.toolResults) {
          for (const tr of msg.toolResults) {
            apiMessages.push({
              role: 'tool' as const,
              tool_call_id: tr.toolCallId,
              content: tr.content
            })
          }
        }
      } else {
        apiMessages.push({ role: 'assistant', content: msg.content })
      }
    }
  }

  return apiMessages
}

function buildSystemPrompt(settings: AppSettings): string {
  const enabledProfiles = settings.agentProfiles
    .filter((profile) => profile.enabled)
    .map((profile) => `### ${profile.name} (${profile.role})\n${profile.prompt}`)
    .join('\n\n')

  return `${settings.systemPrompt}

Agent workbench policy:
- Plan-first mode is ${settings.planFirstEnabled ? 'enabled' : 'disabled'}.
- All tool calls require explicit user approval.
- Use specialist agent profiles when the user asks for planning, review, implementation, MCP, or multi-agent work.
- Keep structured plan and todo updates concise and implementation-oriented.
- When plan, todo, or agent task state changes, append one fenced workbench_state JSON block. Use keys "plan", "todos", and "agentTasks". Todo statuses are pending, in_progress, or completed. Agent task statuses are pending, running, completed, failed, or cancelled. Keep prose outside the JSON block.

Available agent profiles:
${enabledProfiles || '(no enabled profiles)'}`
}

export async function runChatStream(
  messages: ChatMessage[],
  sendChunk: (chunk: StreamChunk) => void
): Promise<void> {
  const settings = loadSettings()

  if (!settings.apiKey) {
    sendChunk({ type: 'error', error: 'API Key not set. Please configure in Settings.' })
    sendChunk({ type: 'done' })
    return
  }

  const client = new OpenAI({
    apiKey: settings.apiKey,
    baseURL: 'https://api.deepseek.com'
  })

  const apiMessages = buildApiMessages(messages, buildSystemPrompt(settings), settings.thinkingEnabled)
  let continueLoop = true

  // V4 models: deepseek-v4-flash, deepseek-v4-pro
  // Legacy aliases: deepseek-chat (→flash non-thinking), deepseek-reasoner (→flash thinking)
  const model = settings.model || 'deepseek-v4-flash'
  const isV4Model = model.startsWith('deepseek-v4-') || model === 'deepseek-chat' || model === 'deepseek-reasoner'

  while (continueLoop) {
    continueLoop = false

    try {
      const createParams: any = {
        model,
        messages: apiMessages,
        tools: getToolDefinitions(),
        stream: true
      }

      // Thinking mode for V4 models
      if (isV4Model && settings.thinkingEnabled) {
        createParams.thinking = { type: 'enabled' }
      }

      // Reasoning effort for V4 models (high or max)
      if (isV4Model && settings.reasoningEffort) {
        createParams.reasoning_effort = settings.reasoningEffort
      }

      const stream = (await client.chat.completions.create(createParams)) as unknown as AsyncIterable<any>

      let currentContent = ''
      let currentReasoningContent = ''
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as any
        if (!delta) continue

        // Reasoning content (thinking/CoT)
        if (delta.reasoning_content) {
          currentReasoningContent += delta.reasoning_content
          sendChunk({ type: 'reasoning_content', content: delta.reasoning_content })
        }

        // Content delta
        if (delta.content) {
          currentContent += delta.content
          sendChunk({ type: 'content', content: delta.content })
        }

        // Tool call deltas
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (!toolCalls.has(idx)) {
              toolCalls.set(idx, { id: tc.id || '', name: '', arguments: '' })
            }
            const existing = toolCalls.get(idx)!
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            if (tc.function?.arguments) existing.arguments += tc.function.arguments
          }
        }
      }

      // If there are tool calls, process them
      if (toolCalls.size > 0) {
        // Add assistant message with tool calls to api messages
        // Must include reasoning_content when thinking mode is on
        const assistantApiMsg: any = {
          role: 'assistant',
          content: currentContent || null,
          tool_calls: Array.from(toolCalls.values()).map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments }
          }))
        }
        if (settings.thinkingEnabled && currentReasoningContent) {
          assistantApiMsg.reasoning_content = currentReasoningContent
        }
        apiMessages.push(assistantApiMsg)

        // Process each tool call
        for (const tc of Array.from(toolCalls.values())) {
          sendChunk({
            type: 'tool_call',
            toolCall: {
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments }
            }
          })

          // Request approval from user
          const approved = await waitForApproval(tc.id, tc.name, tc.arguments)

          if (!approved) {
            const result = 'User rejected this tool call.'
            apiMessages.push({
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: result
            })
            sendChunk({
              type: 'tool_result',
              toolResult: {
                toolCallId: tc.id,
                toolName: tc.name,
                content: result,
                approved: false,
                risk: getToolRisk(tc.name)
              }
            })
          } else {
            // Execute the tool
            let result: string
            try {
              result = await executeRegisteredTool(tc.name, tc.arguments, {
                workDirectory: settings.workDirectory,
                terminalTimeoutMs: settings.terminal.timeoutMs,
                onCommandRun: (run: CommandRun) => {
                  sendChunk({ type: 'command_output', commandRun: run })
                }
              })
            } catch (err: any) {
              result = `Error: ${err.message}`
            }
            apiMessages.push({
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: result
            })
            sendChunk({
              type: 'tool_result',
              toolResult: {
                toolCallId: tc.id,
                toolName: tc.name,
                content: result,
                approved: true,
                risk: getToolRisk(tc.name)
              }
            })
          }
        }

        // Continue the loop to get AI's next response
        continueLoop = true
      }
    } catch (err: any) {
      sendChunk({ type: 'error', error: err.message || 'Unknown error occurred' })
    }
  }

  sendChunk({ type: 'done' })
}
