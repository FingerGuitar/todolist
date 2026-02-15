import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { app } from 'electron'
import type { AppSettings } from '../shared/types'

const DEFAULTS: AppSettings = {
  theme: 'default-light',
  showTaskDuration: false,
  autoLaunch: false,
  closeToTray: true,
  confirmBeforeDelete: true,
  autoPostponeOverdue: true,
  sloganStyle: 'funny'
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function getThemeConfigPath(): string {
  return join(app.getPath('userData'), 'theme.json')
}

export function loadSettings(): AppSettings {
  const settingsPath = getSettingsPath()
  if (existsSync(settingsPath)) {
    try {
      const data = readFileSync(settingsPath, 'utf-8')
      return { ...DEFAULTS, ...JSON.parse(data) }
    } catch {
      return { ...DEFAULTS }
    }
  }
  // 兼容旧版：迁移 theme.json → settings.json
  const themeConfigPath = getThemeConfigPath()
  if (existsSync(themeConfigPath)) {
    try {
      const data = readFileSync(themeConfigPath, 'utf-8')
      const themeConfig = JSON.parse(data)
      const migrated = { ...DEFAULTS, theme: themeConfig.theme, customColor: themeConfig.customColor }
      saveSettings(migrated)
      return migrated
    } catch {
      return { ...DEFAULTS }
    }
  }
  return { ...DEFAULTS }
}

export function saveSettings(settings: AppSettings): void {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}
