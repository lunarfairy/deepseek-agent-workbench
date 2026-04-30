import { spawn } from 'child_process'
import { createHash } from 'crypto'
import type { McpServerConfig, McpToolInfo } from '../../shared/types'

type JsonRpcId = number

interface JsonRpcResponse {
  id?: JsonRpcId
  result?: any
  error?: {
    code?: number
    message?: string
    data?: unknown
  }
}

interface McpSession {
  request: (method: string, params?: Record<string, unknown>) => Promise<any>
  notify: (method: string, params?: Record<string, unknown>) => void
}

const MCP_PROTOCOL_VERSION = '2024-11-05'
const MCP_TIMEOUT_MS = 8000

export async function discoverMcpTools(
  serverId: string,
  servers: McpServerConfig[]
): Promise<string[]> {
  const tools = await discoverMcpToolInfos(serverId, servers)
  if (tools.length === 0) return ['No tools discovered']
  return tools.map((tool) => `${tool.registeredName} (${tool.serverName}/${tool.name})`)
}

export async function discoverConfiguredMcpTools(servers: McpServerConfig[]): Promise<McpToolInfo[]> {
  const enabledServers = servers.filter((server) => server.enabled && server.command.trim())
  const batches = await Promise.all(
    enabledServers.map(async (server) => {
      try {
        return await listMcpTools(server)
      } catch {
        return []
      }
    })
  )
  return batches.flat()
}

export async function callMcpToolByRegisteredName(
  registeredName: string,
  args: Record<string, unknown>,
  servers: McpServerConfig[]
): Promise<string> {
  const tools = await discoverConfiguredMcpTools(servers)
  const tool = tools.find((candidate) => candidate.registeredName === registeredName)
  if (!tool) {
    throw new Error(`MCP tool is not available: ${registeredName}`)
  }
  const server = servers.find((candidate) => candidate.id === tool.serverId)
  if (!server) {
    throw new Error(`MCP server is not configured: ${tool.serverName}`)
  }

  return withMcpSession(server, async (session) => {
    await initializeSession(session)
    const result = await session.request('tools/call', {
      name: tool.name,
      arguments: args || {}
    })
    return formatMcpResult(result)
  })
}

export function isMcpRegisteredToolName(name: string): boolean {
  return name.startsWith('mcp__')
}

export function makeMcpRegisteredName(serverId: string, toolName: string): string {
  const hash = createHash('sha1').update(`${serverId}:${toolName}`).digest('hex').slice(0, 8)
  const raw = `mcp__${safeName(serverId)}__${safeName(toolName)}__${hash}`
  if (raw.length <= 64) return raw
  return `${raw.slice(0, 54)}_${hash}`
}

async function discoverMcpToolInfos(
  serverId: string,
  servers: McpServerConfig[]
): Promise<McpToolInfo[]> {
  const server = servers.find((candidate) => candidate.id === serverId && candidate.enabled)
  if (!server) {
    throw new Error(`MCP server is not configured or disabled: ${serverId}`)
  }
  return listMcpTools(server)
}

async function listMcpTools(server: McpServerConfig): Promise<McpToolInfo[]> {
  return withMcpSession(server, async (session) => {
    await initializeSession(session)
    const result = await session.request('tools/list', {})
    const tools = Array.isArray(result?.tools) ? result.tools : []
    return tools
      .map((tool: any) => normalizeTool(server, tool))
      .filter((tool: McpToolInfo | null): tool is McpToolInfo => Boolean(tool))
  })
}

async function initializeSession(session: McpSession): Promise<void> {
  await session.request('initialize', {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: {
      name: 'deepseek-codex',
      version: '1.0.0'
    }
  })
  session.notify('notifications/initialized', {})
}

function withMcpSession<T>(
  server: McpServerConfig,
  work: (session: McpSession) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const proc = spawn(server.command, server.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    let nextId = 1
    let stdoutBuffer = ''
    let stderr = ''
    let settled = false
    const pending = new Map<JsonRpcId, { resolve: (value: any) => void; reject: (err: Error) => void }>()

    const timer = setTimeout(() => {
      finish(reject, new Error(`Timed out communicating with MCP server ${server.name}`))
    }, MCP_TIMEOUT_MS)

    const finish = (done: (value: any) => void, value: any) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      for (const waiter of pending.values()) {
        waiter.reject(new Error(`MCP server closed before responding: ${server.name}`))
      }
      pending.clear()
      if (!proc.killed) proc.kill()
      done(value)
    }

    const writeMessage = (message: Record<string, unknown>) => {
      proc.stdin.write(`${JSON.stringify(message)}\n`)
    }

    const session: McpSession = {
      request: (method, params) => {
        const id = nextId++
        writeMessage({ jsonrpc: '2.0', id, method, params: params || {} })
        return new Promise((requestResolve, requestReject) => {
          pending.set(id, { resolve: requestResolve, reject: requestReject })
        })
      },
      notify: (method, params) => {
        writeMessage({ jsonrpc: '2.0', method, params: params || {} })
      }
    }

    proc.stdout.on('data', (data: Buffer) => {
      stdoutBuffer += data.toString('utf8')
      for (const message of readMessages()) {
        handleMessage(message)
      }
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf8')
    })

    proc.on('error', (err) => {
      finish(reject, err)
    })

    proc.on('close', () => {
      if (!settled && pending.size > 0) {
        finish(reject, new Error(stderr || `MCP server closed before responding: ${server.name}`))
      }
    })

    work(session)
      .then((result) => finish(resolve, result))
      .catch((err) => finish(reject, err))

    function readMessages(): JsonRpcResponse[] {
      const messages: JsonRpcResponse[] = []
      while (stdoutBuffer.length > 0) {
        const headerMatch = stdoutBuffer.match(/^Content-Length:\s*(\d+)\r?\n\r?\n/i)
        if (headerMatch) {
          const headerLength = headerMatch[0].length
          const bodyLength = Number(headerMatch[1])
          if (stdoutBuffer.length < headerLength + bodyLength) break
          const body = stdoutBuffer.slice(headerLength, headerLength + bodyLength)
          stdoutBuffer = stdoutBuffer.slice(headerLength + bodyLength)
          pushJson(messages, body)
          continue
        }

        const newlineIndex = stdoutBuffer.indexOf('\n')
        if (newlineIndex === -1) break
        const line = stdoutBuffer.slice(0, newlineIndex).trim()
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
        if (line) pushJson(messages, line)
      }
      return messages
    }

    function handleMessage(message: JsonRpcResponse) {
      if (message.id === undefined) return
      const waiter = pending.get(message.id)
      if (!waiter) return
      pending.delete(message.id)
      if (message.error) {
        waiter.reject(new Error(message.error.message || `MCP request failed: ${message.error.code}`))
      } else {
        waiter.resolve(message.result)
      }
    }
  })
}

function normalizeTool(server: McpServerConfig, raw: any): McpToolInfo | null {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null
  const name = raw.name.trim()
  return {
    serverId: server.id,
    serverName: server.name || server.id,
    name,
    registeredName: makeMcpRegisteredName(server.id, name),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    inputSchema: normalizeInputSchema(raw.inputSchema)
  }
}

function normalizeInputSchema(schema: unknown): Record<string, unknown> {
  if (schema && typeof schema === 'object' && !Array.isArray(schema)) {
    return schema as Record<string, unknown>
  }
  return {
    type: 'object',
    properties: {},
    additionalProperties: true
  }
}

function formatMcpResult(result: any): string {
  if (Array.isArray(result?.content)) {
    const content = result.content
      .map((item: any) => {
        if (item?.type === 'text' && typeof item.text === 'string') return item.text
        return JSON.stringify(item)
      })
      .filter(Boolean)
      .join('\n')
    return content || JSON.stringify(result)
  }
  return JSON.stringify(result ?? null, null, 2)
}

function pushJson(messages: JsonRpcResponse[], input: string): void {
  try {
    messages.push(JSON.parse(input))
  } catch {
    // Some MCP servers log to stdout; ignore non-JSON lines.
  }
}

function safeName(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '')
  return normalized || 'tool'
}
