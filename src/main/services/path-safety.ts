import { isAbsolute, relative, resolve, sep } from 'path'

export function isPathInside(basePath: string, targetPath: string): boolean {
  if (!basePath) return false
  const resolvedBase = resolve(basePath)
  const resolvedTarget = resolve(targetPath)
  const rel = relative(resolvedBase, resolvedTarget)
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
}

export function resolveInside(basePath: string, inputPath = '.', label = 'Path'): string {
  if (!basePath) {
    throw new Error(`${label} requires a configured work directory`)
  }
  const resolved = resolve(basePath, inputPath || '.')
  if (!isPathInside(basePath, resolved)) {
    throw new Error(`${label} is outside work directory: ${inputPath}`)
  }
  return resolved
}
