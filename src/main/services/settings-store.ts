import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { AppSettings } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'

const SETTINGS_DIR = join(app.getPath('userData'), 'data')
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.json')

function ensureDir(): void {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true })
  }
}

export function loadSettings(): AppSettings {
  try {
    ensureDir()
    if (existsSync(SETTINGS_FILE)) {
      const data = readFileSync(SETTINGS_FILE, 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
    }
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const updated = { ...current, ...settings }
  ensureDir()
  writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}
