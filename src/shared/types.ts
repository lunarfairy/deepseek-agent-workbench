// ============================================================
// Shared Types
// ============================================================

// ---------- Chat Messages ----------

export type ReasoningEffort = 'high' | 'max'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  toolCallId: string
  content: string
  approved: boolean
}

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  reasoningContent?: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  isStreaming?: boolean
  createdAt: number
}

// ---------- Conversations ----------

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

// ---------- Settings ----------

export interface AppSettings {
  apiKey: string
  model: string
  workDirectory: string
  systemPrompt: string
  reasoningEffort: ReasoningEffort
  thinkingEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'deepseek-v4-flash',
  workDirectory: '',
  reasoningEffort: 'high',
  thinkingEnabled: true,
  systemPrompt: `You are DeepSeek Codex, an expert programming assistant. You can:
- Read, write, and list files in the user's working directory
- Execute terminal commands
- Help with coding, debugging, and software engineering tasks

Always ask for user approval before performing file operations or running commands. Be concise and helpful.`
}

// ---------- Tool Definitions ----------

export type ToolName = 'read_file' | 'write_file' | 'list_files' | 'execute_command'

export interface ReadFileArgs {
  path: string
}

export interface WriteFileArgs {
  path: string
  content: string
}

export interface ListFilesArgs {
  path: string
}

export interface ExecuteCommandArgs {
  command: string
  cwd?: string
}

export interface ToolApprovalRequest {
  toolCallId: string
  toolName: ToolName
  args: string
}

export interface ToolApprovalResponse {
  toolCallId: string
  approved: boolean
}

// ---------- Streaming ----------

export interface StreamChunk {
  type: 'content' | 'reasoning_content' | 'tool_call' | 'tool_result' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  error?: string
}

// ---------- IPC API ----------

export interface ElectronAPI {
  // Settings
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings>): Promise<void>

  // Conversations
  getConversations(): Promise<Conversation[]>
  saveConversation(conversation: Conversation): Promise<void>
  deleteConversation(id: string): Promise<void>

  // Chat streaming via MessagePort
  startChatStream(conversationId: string, messages: Array<{ role: string; content: string; toolCalls?: any[]; toolResults?: any[] }>): Promise<void>

  // Tool approval
  onToolApprovalRequest(callback: (request: ToolApprovalRequest) => void): () => void
  respondToolApproval(response: ToolApprovalResponse): Promise<void>

  // Dialogs
  selectDirectory(): Promise<string | null>

  // Open paths
  openInExplorer(path: string): void
  openFile(path: string): void

  // Window controls
  windowMinimize(): void
  windowMaximize(): void
  windowClose(): void

  // Events from main
  onStreamChunk(callback: (chunk: StreamChunk) => void): () => void
}
