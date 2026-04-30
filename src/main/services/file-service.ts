import { readFile, writeFile, mkdir, readdir, stat } from 'fs/promises'
import { join, resolve, relative, dirname } from 'path'

function isPathSafe(filePath: string, workDirectory: string): boolean {
  if (!workDirectory) return false
  const resolved = resolve(filePath)
  const resolvedWork = resolve(workDirectory)
  const rel = relative(resolvedWork, resolved)
  return rel === '' || (!rel.startsWith('..') && !resolve(rel).startsWith('..'))
}

function resolveSafePath(inputPath: string, workDirectory: string): string {
  const fullPath = resolve(workDirectory, inputPath || '.')
  if (!isPathSafe(fullPath, workDirectory)) {
    throw new Error(`Path is outside work directory: ${inputPath}`)
  }
  return fullPath
}

async function walkFiles(
  dirPath: string,
  workDirectory: string,
  maxResults = 200,
  results: string[] = []
): Promise<string[]> {
  if (results.length >= maxResults) return results
  const fullPath = resolveSafePath(dirPath, workDirectory)
  const entries = await readdir(fullPath, { withFileTypes: true })
  for (const entry of entries) {
    if (results.length >= maxResults) break
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'out') {
      continue
    }
    const relativePath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await walkFiles(relativePath, workDirectory, maxResults, results)
    } else {
      results.push(relativePath.replace(/\\/g, '/'))
    }
  }
  return results
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
  const dir = dirname(fullPath)
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

export async function readManyFiles(paths: string[], workDirectory: string): Promise<string> {
  const chunks: string[] = []
  for (const filePath of paths.slice(0, 20)) {
    const content = await readFileContent(filePath, workDirectory)
    chunks.push(`--- ${filePath} ---\n${content}`)
  }
  return chunks.join('\n\n') || '(no files requested)'
}

export async function statPath(inputPath: string, workDirectory: string): Promise<string> {
  const fullPath = resolveSafePath(inputPath, workDirectory)
  const s = await stat(fullPath)
  return JSON.stringify(
    {
      path: inputPath,
      type: s.isDirectory() ? 'directory' : s.isFile() ? 'file' : 'other',
      size: s.size,
      modifiedAt: s.mtime.toISOString()
    },
    null,
    2
  )
}

export async function searchFiles(
  query: string,
  workDirectory: string,
  rootPath = '.',
  maxResults = 100
): Promise<string> {
  const files = await walkFiles(rootPath || '.', workDirectory, Math.min(maxResults, 500))
  const needle = query.toLowerCase()
  const matches = files.filter((file) => file.toLowerCase().includes(needle)).slice(0, maxResults)
  return matches.join('\n') || '(no matching files)'
}

export async function grepFiles(
  pattern: string,
  workDirectory: string,
  rootPath = '.',
  maxResults = 100
): Promise<string> {
  const files = await walkFiles(rootPath || '.', workDirectory, Math.min(maxResults * 2, 500))
  const matches: string[] = []
  const regex = new RegExp(pattern, 'i')
  for (const file of files) {
    if (matches.length >= maxResults) break
    try {
      const content = await readFileContent(file, workDirectory)
      const lines = content.split(/\r?\n/)
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          matches.push(`${file}:${i + 1}: ${lines[i]}`)
          if (matches.length >= maxResults) break
        }
      }
    } catch {
      // Skip binary or unreadable files.
    }
  }
  return matches.join('\n') || '(no matches)'
}

export async function applyTextPatch(
  filePath: string,
  search: string,
  replace: string,
  workDirectory: string
): Promise<string> {
  const content = await readFileContent(filePath, workDirectory)
  if (!content.includes(search)) {
    throw new Error(`Patch search text not found in ${filePath}`)
  }
  const updated = content.replace(search, replace)
  await writeFileContent(filePath, updated, workDirectory)
  return `Patch applied: ${filePath}`
}
