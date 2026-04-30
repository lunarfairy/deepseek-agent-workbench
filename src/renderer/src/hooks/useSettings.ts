import { useEffect } from 'react'
import { useSettingsStore } from '../store/settings-store'

export function useSettings() {
  const { settings, loaded, loadSettings, updateSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [])

  return { settings, loaded, updateSettings }
}
