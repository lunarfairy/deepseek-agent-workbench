import type OpenAI from 'openai'
import type { CommandRun, ToolName, ToolRisk } from '../../shared/types'
import {
  applyTextPatch,
  grepFiles,
  listFiles,
  readFileContent,
  readManyFiles,
  searchFiles,
  statPath,
  writeFileContent
} from './file-service'
import { executeCommand, runCommandStream } from './terminal-service'

interface ToolContext {
  workDirectory: string
  onCommandRun?: (run: CommandRun) => void
  terminalTimeoutMs?: number
}

interface RegisteredTool {
  name: ToolName
  risk: ToolRisk
  summary: (args: any) => string
  definition: OpenAI.Chat.Completions.ChatCompletionTool
  execute: (args: any, context: ToolContext) => Promise<string>
}

function schema(
  name: ToolName,
  description: string,
  properties: Record<string, any>,
  required: string[]
): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  }
}

const tools: RegisteredTool[] = [
  {
    name: 'read_file',
    risk: 'read',
    summary: (args) => `Read ${args.path}`,
    definition: schema('read_file', 'Read the contents of a file', {
      path: { type: 'string', description: 'Relative path to the file' }
    }, ['path']),
    execute: (args, context) => readFileContent(args.path, context.workDirectory)
  },
  {
    name: 'write_file',
    risk: 'write',
    summary: (args) => `Write ${args.path}`,
    definition: schema('write_file', 'Write content to a file (creates directories if needed)', {
      path: { type: 'string', description: 'Relative path to the file' },
      content: { type: 'string', description: 'Content to write' }
    }, ['path', 'content']),
    execute: (args, context) => writeFileContent(args.path, args.content, context.workDirectory)
  },
  {
    name: 'list_files',
    risk: 'read',
    summary: (args) => `List ${args.path || '.'}`,
    definition: schema('list_files', 'List files and directories in a given path', {
      path: { type: 'string', description: 'Relative directory path (default: ".")' }
    }, ['path']),
    execute: (args, context) => listFiles(args.path || '.', context.workDirectory)
  },
  {
    name: 'execute_command',
    risk: 'command',
    summary: (args) => `Run command: ${args.command}`,
    definition: schema('execute_command', 'Execute a terminal/shell command', {
      command: { type: 'string', description: 'The command to execute' },
      cwd: { type: 'string', description: 'Working directory relative to the configured workspace' }
    }, ['command']),
    execute: (args, context) => {
      if (context.onCommandRun) {
        return runCommandStream(
          args,
          context.workDirectory,
          context.onCommandRun,
          context.terminalTimeoutMs
        ).then((run) => {
          let result = ''
          if (run.stdout) result += run.stdout
          if (run.stderr) result += (result ? '\n' : '') + `[stderr]\n${run.stderr}`
          if (run.exitCode !== 0 && run.exitCode !== null) result += `\n[Exit code: ${run.exitCode}]`
          return result || '(no output)'
        })
      }
      return executeCommand(args, context.workDirectory)
    }
  },
  {
    name: 'grep',
    risk: 'read',
    summary: (args) => `Search content for ${args.pattern}`,
    definition: schema('grep', 'Search file contents with a case-insensitive regular expression', {
      pattern: { type: 'string', description: 'Regular expression pattern' },
      path: { type: 'string', description: 'Relative directory path (default: ".")' },
      maxResults: { type: 'number', description: 'Maximum result lines' }
    }, ['pattern']),
    execute: (args, context) => grepFiles(args.pattern, context.workDirectory, args.path || '.', args.maxResults || 100)
  },
  {
    name: 'search_files',
    risk: 'read',
    summary: (args) => `Find files matching ${args.query}`,
    definition: schema('search_files', 'Search workspace file names by substring', {
      query: { type: 'string', description: 'File name substring' },
      path: { type: 'string', description: 'Relative directory path (default: ".")' },
      maxResults: { type: 'number', description: 'Maximum results' }
    }, ['query']),
    execute: (args, context) => searchFiles(args.query, context.workDirectory, args.path || '.', args.maxResults || 100)
  },
  {
    name: 'read_many',
    risk: 'read',
    summary: (args) => `Read ${Array.isArray(args.paths) ? args.paths.length : 0} files`,
    definition: schema('read_many', 'Read multiple files at once', {
      paths: { type: 'array', items: { type: 'string' }, description: 'Relative file paths' }
    }, ['paths']),
    execute: (args, context) => readManyFiles(args.paths || [], context.workDirectory)
  },
  {
    name: 'stat_path',
    risk: 'read',
    summary: (args) => `Inspect ${args.path}`,
    definition: schema('stat_path', 'Return metadata for a file or directory', {
      path: { type: 'string', description: 'Relative path' }
    }, ['path']),
    execute: (args, context) => statPath(args.path, context.workDirectory)
  },
  {
    name: 'apply_patch',
    risk: 'write',
    summary: (args) => `Patch ${args.path}`,
    definition: schema('apply_patch', 'Apply a simple text replacement patch to one file', {
      path: { type: 'string', description: 'Relative file path' },
      search: { type: 'string', description: 'Exact text to replace' },
      replace: { type: 'string', description: 'Replacement text' }
    }, ['path', 'search', 'replace']),
    execute: (args, context) => applyTextPatch(args.path, args.search, args.replace, context.workDirectory)
  }
]

const toolMap = new Map(tools.map((tool) => [tool.name, tool]))

export function getToolDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => tool.definition)
}

export function getToolRisk(name: string): ToolRisk {
  return toolMap.get(name)?.risk || (name.startsWith('mcp:') ? 'mcp' : 'command')
}

export function getToolSummary(name: string, argsStr: string): string {
  const args = parseToolArgs(argsStr)
  return toolMap.get(name)?.summary(args) || `Run ${name}`
}

export function parseToolArgs(argsStr: string): any {
  try {
    return JSON.parse(argsStr || '{}')
  } catch {
    throw new Error(`Invalid tool arguments: ${argsStr}`)
  }
}

export async function executeRegisteredTool(
  name: string,
  argsStr: string,
  context: ToolContext
): Promise<string> {
  const tool = toolMap.get(name)
  if (!tool) {
    if (name.startsWith('mcp:')) {
      return `MCP tool ${name} is configured but the stdio runtime is not connected in this build.`
    }
    throw new Error(`Unknown tool: ${name}`)
  }
  const args = parseToolArgs(argsStr)
  return tool.execute(args, context)
}
