import OpenAI from 'openai'
import type { ElectronAPI, StreamChunk, ToolApprovalRequest, ChatMessage, AppSettings } from '../../shared/types'
import { readFileContent, writeFileContent, listFiles } from './file-service'
import { executeCommand } from './terminal-service'
import { loadSettings } from './settings-store'
import { v4 as uuid } from 'uuid'

const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read the contents of a file',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file (creates directories if needed)',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and directories in a given path',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative directory path (default: ".")' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: 'Execute a terminal/shell command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The command to execute' },
          cwd: { type: 'string', description: 'Working directory for the command (optional)' }
        },
        required: ['command']
      }
    }
  }
]

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
        args
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

async function executeTool(name: string, argsStr: string, workDirectory: string): Promise<string> {
  let args: any
  try {
    args = JSON.parse(argsStr)
  } catch {
    throw new Error(`Invalid tool arguments: ${argsStr}`)
  }

  switch (name) {
    case 'read_file':
      return readFileContent(args.path, workDirectory)
    case 'write_file':
      return writeFileContent(args.path, args.content, workDirectory)
    case 'list_files':
      return listFiles(args.path || '.', workDirectory)
    case 'execute_command':
      return executeCommand(args, workDirectory)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
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

  const apiMessages = buildApiMessages(messages, settings.systemPrompt, settings.thinkingEnabled)
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
        tools: TOOL_DEFINITIONS,
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

      const stream = await client.chat.completions.create(createParams)

      let currentContent = ''
      let currentReasoningContent = ''
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
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
        for (const [_, tc] of toolCalls) {
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
              toolResult: { toolCallId: tc.id, content: result, approved: false }
            })
          } else {
            // Execute the tool
            let result: string
            try {
              result = await executeTool(tc.name, tc.arguments, settings.workDirectory)
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
              toolResult: { toolCallId: tc.id, content: result, approved: true }
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
