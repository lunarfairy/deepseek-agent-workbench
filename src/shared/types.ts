// ============================================================
// Shared Types
// ============================================================

// ---------- Chat Messages ----------

export type ReasoningEffort = 'high' | 'max'

export type MessageRole = 'user' | 'assistant' | 'system'

export type AgentRole =
  | 'coordinator'
  | 'explorer'
  | 'implementer'
  | 'reviewer'
  | 'integrator'
  | 'mcp'

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export type ApprovalPolicy = 'always'

export type ToolRisk = 'read' | 'write' | 'command' | 'mcp'

export interface AgentProfile {
  role: AgentRole
  name: string
  prompt: string
  enabled: boolean
}

export interface TodoItem {
  id: string
  content: string
  status: TodoStatus
}

export interface AgentPlan {
  id: string
  title: string
  summary: string
  approved: boolean
  createdAt: number
  updatedAt: number
}

export interface AgentTask {
  id: string
  role: AgentRole
  title: string
  status: AgentTaskStatus
  result?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export interface ChatStreamContext {
  conversationId: string
  plan?: AgentPlan | null
  todos?: TodoItem[]
  agentTasks?: AgentTask[]
}

export interface WorkbenchStateUpdate {
  plan?: {
    title?: string
    summary?: string
    approved?: boolean
  }
  todos?: Array<
    | string
    | {
        id?: string
        content: string
        status?: TodoStatus | string
      }
  >
  agentTasks?: Array<{
    id?: string
    role: AgentRole | string
    title: string
    status?: AgentTaskStatus | string
    result?: string
    error?: string
  }>
}

export interface CommandRun {
  id: string
  command: string
  cwd: string
  status: AgentTaskStatus
  stdout: string
  stderr: string
  exitCode?: number | null
  startedAt: number
  finishedAt?: number
}

export interface McpServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
}

export interface McpToolInfo {
  serverId: string
  serverName: string
  name: string
  registeredName: string
  description?: string
  inputSchema?: Record<string, unknown>
}

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
  toolName?: ToolName | string
  risk?: ToolRisk
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
  plan?: AgentPlan | null
  todos?: TodoItem[]
  agentTasks?: AgentTask[]
  commandRuns?: CommandRun[]
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
  approvalPolicy: ApprovalPolicy
  agentConcurrency: number
  planFirstEnabled: boolean
  agentProfiles: AgentProfile[]
  mcpServers: McpServerConfig[]
  terminal: {
    shell: string
    timeoutMs: number
  }
}

export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    role: 'coordinator',
    name: 'Coordinator',
    enabled: true,
    prompt:
      "You are the Coordinator agent for DeepSeek Agent Workbench. Your job is to understand the user's goal, decompose it into safe implementation steps, assign focused tasks to specialist agents, maintain a structured plan and todo list, and integrate their findings. Do not edit files directly unless explicitly acting as the Integrator. Prefer clear, testable steps. Before any tool use or code change, ensure the action fits the approved plan and requires user approval."
  },
  {
    role: 'explorer',
    name: 'Explorer',
    enabled: true,
    prompt:
      'You are the Explorer agent. Your job is read-only codebase investigation. Inspect files, architecture, dependencies, build errors, data flow, and extension points. Do not edit files. Return concise findings with file paths, risks, and recommended implementation order. Prefer facts from the repository over assumptions.'
  },
  {
    role: 'implementer',
    name: 'Implementer',
    enabled: true,
    prompt:
      'You are the Implementer agent. Your job is to make scoped code changes assigned by the Coordinator. Respect existing architecture and style. Do not touch unrelated files. Preserve user changes. After editing, report changed files, behavior added, and any tests or checks needed. All filesystem and command actions require approval through the tool approval flow.'
  },
  {
    role: 'reviewer',
    name: 'Reviewer',
    enabled: true,
    prompt:
      'You are the Reviewer agent. Your job is to inspect proposed or completed changes for bugs, regressions, missing tests, unsafe tool behavior, security issues, and UX risks. Lead with concrete findings and file references. Do not rewrite code unless explicitly assigned. If no issues are found, state residual risks and verification gaps.'
  },
  {
    role: 'integrator',
    name: 'Integrator',
    enabled: true,
    prompt:
      'You are the Integrator agent. Your job is to merge specialist outputs into one coherent implementation. Resolve conflicts, keep shared types and IPC contracts consistent, ensure UI and backend behavior match, and run the required checks. Prefer small, reversible changes and leave the repository in a buildable state.'
  },
  {
    role: 'mcp',
    name: 'MCP Tool Agent',
    enabled: true,
    prompt:
      'You are the MCP Tool agent. Your job is to manage configured local MCP servers, discover available tools, normalize their schemas, and route MCP tool calls through the same approval and result system as native tools. Never bypass user approval. Treat MCP servers as untrusted external capabilities unless explicitly configured by the user.'
  }
]

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  model: 'deepseek-v4-flash',
  workDirectory: '',
  reasoningEffort: 'high',
  thinkingEnabled: true,
  approvalPolicy: 'always',
  agentConcurrency: 3,
  planFirstEnabled: true,
  agentProfiles: DEFAULT_AGENT_PROFILES,
  mcpServers: [],
  terminal: {
    shell: 'cmd.exe',
    timeoutMs: 30000
  },
  systemPrompt: `You are DeepSeek Agent Workbench, an expert programming assistant powered by the user's configured DeepSeek-compatible model. You can:
- Read, write, search, and patch files in the user's working directory
- Execute terminal commands with streamed output
- Work in Plan-first mode with specialist agent profiles
- Use configured local MCP tools

Always ask for user approval before performing file operations or running commands. Be concise and helpful.

When you create or update a plan, todo list, or agent task list, append one fenced block with language workbench_state. The block must contain JSON matching:
{
  "plan": { "title": "short title", "summary": "short summary", "approved": false },
  "todos": [{ "content": "step", "status": "pending" }],
  "agentTasks": [{ "role": "explorer", "title": "inspect files", "status": "pending" }]
}
Todo statuses are pending, in_progress, or completed. Agent task statuses are pending, running, completed, failed, or cancelled.
Keep the JSON concise. Do not put prose inside the JSON block.`
}

// ---------- Tool Definitions ----------

export type ToolName =
  | 'read_file'
  | 'write_file'
  | 'list_files'
  | 'execute_command'
  | 'grep'
  | 'search_files'
  | 'read_many'
  | 'stat_path'
  | 'apply_patch'
  | string

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

export interface ToolInvocation {
  id: string
  name: ToolName
  arguments: string
}

export interface ToolExecutionResult {
  toolCallId: string
  toolName: ToolName
  approved: boolean
  content: string
  risk: ToolRisk
}

export interface ToolApprovalRequest {
  toolCallId: string
  toolName: ToolName
  args: string
  summary?: string
  risk?: ToolRisk
}

export interface ToolApprovalResponse {
  toolCallId: string
  approved: boolean
}

// ---------- Streaming ----------

export interface StreamChunk {
  type:
    | 'content'
    | 'reasoning_content'
    | 'tool_call'
    | 'tool_result'
    | 'command_output'
    | 'agent_state'
    | 'error'
    | 'done'
  content?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  commandRun?: CommandRun
  agentTask?: AgentTask
  error?: string
}

// ---------- IPC API ----------

export interface ElectronAPI {
  // Settings
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>

  // Conversations
  getConversations(): Promise<Conversation[]>
  saveConversation(conversation: Conversation): Promise<void>
  deleteConversation(id: string): Promise<void>

  // Chat streaming via MessagePort
  startChatStream(
    conversationId: string,
    messages: ChatMessage[],
    context?: ChatStreamContext
  ): Promise<void>

  // Tool approval
  onToolApprovalRequest(callback: (request: ToolApprovalRequest) => void): () => void
  respondToolApproval(response: ToolApprovalResponse): Promise<void>

  // Command runs
  runCommand(command: string, cwd?: string): Promise<CommandRun>
  cancelCommand(id: string): Promise<void>
  onCommandRun(callback: (run: CommandRun) => void): () => void

  // MCP
  discoverMcpTools(serverId: string, server?: McpServerConfig): Promise<string[]>

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
