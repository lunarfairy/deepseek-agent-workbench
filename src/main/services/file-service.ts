import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises'
import { join, resolve, relative } from 'path'
import type { AppSettings } from '../../shared/types'

function isPathSafe(filePath: string, workDirectory: string): boolean {
  if (!workDirectory) return false
  const resolved = resolve(filePath)
  const resolvedWork = resolve(workDirectory)
  const rel = relative(resolvedWork, resolved)
  return !rel.startsWith('..') && !resolve(resolved).startsWith('..')
}

export async function readFileContent(filePath: string, workDirectory: string): Promise<string> {
  const fullPath = join(workDirectory, filePath)
  if (!isPathSafe(fullPath, workDirectory)) {
    throw new Error(`Path is outside work directory: ${filePath}`)
  }
  return readFile(fullPath, 'utf-8')
}

export async function writeFileContent(
  filePath: string,
  content: string,
  workDirectory: string
): Promise<string> {
  const fullPath = join(workDirectory, filePath)
  if (!isPathSafe(fullPath, workDirectory)) {
    throw new Error(`Path is outside work directory: ${filePath}`)
  }
  const dir = resolve(fullPath, '..')
  await mkdir(dir, { recursive: true })
  await writeFile(fullPath, content, 'utf-8')
  return `File written: ${filePath}`
}

export async function listFiles(dirPath: string, workDirectory: string): Promise<string> {
  const fullPath = join(workDirectory, dirPath || '.')
  if (!isPathSafe(fullPath, workDirectory)) {
    throw new Error(`Path is outside work directory: ${dirPath}`)
  }
  const entries = await readdir(fullPath, { withFileTypes: true })
  const results = await Promise.all(
    entries.map(async (entry) => {
      try {
        const s = await stat(join(fullPath, entry.name))
        const size = s.isFile() ? ` (${s.size} bytes)` : ''
        return `${entry.isDirectory() ? '📁' : '📄'} ${entry.name}${size}`
      } catch {
        return `${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`
      }
    })
  )
  return results.join('\n') || '(empty directory)'
}
