import { spawn } from 'child_process'
import { resolve, relative } from 'path'
import { v4 as uuid } from 'uuid'
import type { CommandRun, ExecuteCommandArgs } from '../../shared/types'

const activeCommands = new Map<string, ReturnType<typeof spawn>>()

function resolveSafeCwd(cwd: string | undefined, workDirectory: string): string {
  const base = workDirectory || process.cwd()
  const resolved = resolve(base, cwd || '.')
  if (!workDirectory) return resolved
  const rel = relative(resolve(workDirectory), resolved)
  if (rel && (rel.startsWith('..') || resolve(rel).startsWith('..'))) {
    throw new Error(`Command cwd is outside work directory: ${cwd}`)
  }
  return resolved
}

export function cancelCommandRun(id: string): void {
  const proc = activeCommands.get(id)
  if (proc) {
    proc.kill()
    activeCommands.delete(id)
  }
}

export function runCommandStream(
  args: ExecuteCommandArgs,
  workDirectory: string,
  onUpdate: (run: CommandRun) => void,
  timeoutMs = 30000
): Promise<CommandRun> {
  return new Promise((resolvePromise, reject) => {
    const cwd = resolveSafeCwd(args.cwd, workDirectory)
    const id = uuid()
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellArgs = isWindows ? ['/c', args.command] : ['-c', args.command]
    const run: CommandRun = {
      id,
      command: args.command,
      cwd,
      status: 'running',
      stdout: '',
      stderr: '',
      exitCode: null,
      startedAt: Date.now()
    }

    const finish = (updates: Partial<CommandRun>) => {
      Object.assign(run, updates, { finishedAt: Date.now() })
      activeCommands.delete(id)
      onUpdate({ ...run })
      resolvePromise({ ...run })
    }

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    activeCommands.set(id, proc)
    onUpdate({ ...run })

    const timer = setTimeout(() => {
      if (activeCommands.has(id)) {
        proc.kill()
        finish({ status: 'cancelled', stderr: `${run.stderr}\n[Command timed out after ${timeoutMs}ms]` })
      }
    }, timeoutMs)

    proc.stdout.on('data', (data: Buffer) => {
      run.stdout += data.toString()
      onUpdate({ ...run })
    })

    proc.stderr.on('data', (data: Buffer) => {
      run.stderr += data.toString()
      onUpdate({ ...run })
    })

    proc.on('close', (code) => {
      clearTimeout(timer)
      if (run.status === 'cancelled') return
      finish({ status: code === 0 ? 'completed' : 'failed', exitCode: code })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      activeCommands.delete(id)
      reject(new Error(`Command execution failed: ${err.message}`))
    })
  })
}

export function executeCommand(
  args: ExecuteCommandArgs,
  workDirectory: string
): Promise<string> {
  return runCommandStream(args, workDirectory, () => undefined).then((run) => {
    let result = ''
    if (run.stdout) result += run.stdout
    if (run.stderr) result += (result ? '\n' : '') + `[stderr]\n${run.stderr}`
    if (run.exitCode !== 0 && run.exitCode !== null) result += `\n[Exit code: ${run.exitCode}]`
    if (run.status === 'cancelled') result += '\n[Command cancelled or timed out]'
    return result || '(no output)'
  })
}
