import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { AppSettings } from '../../shared/types'
import { DEFAULT_AGENT_PROFILES, DEFAULT_SETTINGS } from '../../shared/types'

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
      const saved = JSON.parse(data)
      return normalizeSettings(saved)
    }
  } catch {
    // fall through to default
  }
  return normalizeSettings({})
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  const updated = normalizeSettings({
    ...current,
    ...settings,
    terminal: { ...current.terminal, ...settings.terminal },
    agentProfiles: settings.agentProfiles || current.agentProfiles,
    mcpServers: settings.mcpServers || current.mcpServers
  })
  ensureDir()
  writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

function normalizeSettings(settings: Partial<AppSettings>): AppSettings {
  const mergedProfiles = DEFAULT_AGENT_PROFILES.map((profile) => ({
    ...profile,
    ...(settings.agentProfiles || []).find((candidate) => candidate.role === profile.role)
  }))

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    terminal: { ...DEFAULT_SETTINGS.terminal, ...settings.terminal },
    agentProfiles: mergedProfiles,
    mcpServers: settings.mcpServers || []
  }
}
