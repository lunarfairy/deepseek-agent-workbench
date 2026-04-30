import { create } from 'zustand'
import type { AppSettings } from '../../../shared/types'
import { DEFAULT_SETTINGS } from '../../../shared/types'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  loadSettings: async () => {
    const settings = await window.api.getSettings()
    set({ settings, loaded: true })
  },

  updateSettings: async (partial) => {
    const updated = await window.api.saveSettings(partial)
    set({ settings: updated })
  }
}))
