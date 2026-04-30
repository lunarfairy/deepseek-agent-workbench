import { spawn } from 'child_process'
import type { ExecuteCommandArgs } from '../../shared/types'

export function executeCommand(
  args: ExecuteCommandArgs,
  workDirectory: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const shell = isWindows ? 'cmd.exe' : '/bin/sh'
    const shellArgs = isWindows ? ['/c', args.command] : ['-c', args.command]

    const proc = spawn(shell, shellArgs, {
      cwd: args.cwd || workDirectory || undefined,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      let result = ''
      if (stdout) result += stdout
      if (stderr) result += (result ? '\n' : '') + `[stderr]\n${stderr}`
      if (code !== 0) result += `\n[Exit code: ${code}]`
      resolve(result || '(no output)')
    })

    proc.on('error', (err) => {
      reject(new Error(`Command execution failed: ${err.message}`))
    })

    // Timeout after 30 seconds
    setTimeout(() => {
      proc.kill()
      resolve((stdout || '') + '\n[Command timed out after 30s]')
    }, 30000)
  })
}
