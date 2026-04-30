import { spawn } from 'child_process'
import type { McpServerConfig } from '../../shared/types'

export async function discoverMcpTools(
  serverId: string,
  servers: McpServerConfig[]
): Promise<string[]> {
  const server = servers.find((candidate) => candidate.id === serverId && candidate.enabled)
  if (!server) {
    throw new Error(`MCP server is not configured or disabled: ${serverId}`)
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(server.command, server.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error(`Timed out discovering MCP tools for ${server.name}`))
    }, 5000)

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    proc.on('close', () => {
      clearTimeout(timer)
      const names = extractToolNames(stdout)
      if (names.length > 0) {
        resolve(names)
      } else {
        resolve(stderr ? [`No tools discovered. stderr: ${stderr}`] : ['No tools discovered'])
      }
    })
  })
}

function extractToolNames(output: string): string[] {
  try {
    const parsed = JSON.parse(output)
    if (Array.isArray(parsed.tools)) {
      return parsed.tools
        .map((tool: any) => tool.name || tool.function?.name)
        .filter((name: any): name is string => typeof name === 'string')
    }
    if (Array.isArray(parsed)) {
      return parsed
        .map((tool: any) => tool.name || tool.function?.name || tool)
        .filter((name: any): name is string => typeof name === 'string')
    }
  } catch {
    // Some stdio servers do not support discovery by plain process execution.
  }
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 50)
}
