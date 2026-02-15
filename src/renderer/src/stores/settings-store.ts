import { create } from 'zustand'
import type { AppSettings } from '@shared/types'

export interface SettingsState {
  settings: AppSettings
  loaded: boolean
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: {
    theme: 'default-light',
    showTaskDuration: false,
    autoLaunch: false,
    closeToTray: true,
    confirmBeforeDelete: true,
    autoPostponeOverdue: true,
    sloganStyle: 'funny'
  },
  loaded: false,

  loadSettings: async () => {
    const settings = await window.api.settingsGet()
    set({ settings, loaded: true })
  },

  updateSettings: async (partial) => {
    const merged = { ...get().settings, ...partial }
    set({ settings: merged })
    await window.api.settingsSet(merged)
  }
}))
