import { spawn } from 'child_process'
import { resolve } from 'path'
import { v4 as uuid } from 'uuid'
import type { CommandRun, ExecuteCommandArgs } from '../../shared/types'
import { resolveInside } from './path-safety'

interface ActiveCommand {
  cancel: () => void
}

const activeCommands = new Map<string, ActiveCommand>()

function resolveSafeCwd(cwd: string | undefined, workDirectory: string): string {
  const base = workDirectory || process.cwd()
  if (!workDirectory) return resolve(base, cwd || '.')
  return resolveInside(workDirectory, cwd || '.', 'Command cwd')
}

export function cancelCommandRun(id: string): void {
  const command = activeCommands.get(id)
  if (command) {
    command.cancel()
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
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const finish = (updates: Partial<CommandRun>) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
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

    const cancel = (message = '[Command cancelled]') => {
      if (!proc.killed) proc.kill()
      finish({
        status: 'cancelled',
        exitCode: null,
        stderr: run.stderr ? `${run.stderr}\n${message}` : message
      })
    }

    activeCommands.set(id, { cancel })
    onUpdate({ ...run })

    timer = setTimeout(() => {
      if (activeCommands.has(id)) {
        cancel(`[Command timed out after ${timeoutMs}ms]`)
      }
    }, timeoutMs)

    proc.stdout.on('data', (data: Buffer) => {
      if (settled) return
      run.stdout += data.toString()
      onUpdate({ ...run })
    })

    proc.stderr.on('data', (data: Buffer) => {
      if (settled) return
      run.stderr += data.toString()
      onUpdate({ ...run })
    })

    proc.on('close', (code) => {
      if (settled) return
      finish({ status: code === 0 ? 'completed' : 'failed', exitCode: code })
    })

    proc.on('error', (err) => {
      if (settled) return
      if (timer) clearTimeout(timer)
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
