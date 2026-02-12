import { create } from 'zustand'
import { themes, getTheme, applyTheme, generateCustomTheme } from '@/themes'

export interface ThemeState {
  currentTheme: string
  customColor: string | null

  loadTheme: () => Promise<void>
  setTheme: (themeName: string) => Promise<void>
  setCustomColor: (hex: string | null) => Promise<void>
}

/**
 * 将 HEX 颜色转换为 HSL 字符串（Tailwind 格式: "h s% l%"）
 */
function hexToHSL(hex: string): string {
  const raw = hex.replace('#', '')
  const r = parseInt(raw.substring(0, 2), 16) / 255
  const g = parseInt(raw.substring(2, 4), 16) / 255
  const b = parseInt(raw.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`
  }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  currentTheme: 'default-light',
  customColor: null,

  loadTheme: async () => {
    try {
      const config = await window.api.themeGet()
      const themeName = config.theme || 'default-light'
      const customColor = config.customColor || null

      set({ currentTheme: themeName, customColor })

      const base = getTheme(themeName)
      if (customColor) {
        const hsl = hexToHSL(customColor)
        applyTheme(generateCustomTheme(base, hsl))
      } else {
        applyTheme(base)
      }
    } catch {
      // Fallback to default theme on error
      applyTheme(getTheme('default-light'))
    }
  },

  setTheme: async (themeName) => {
    const theme = getTheme(themeName)
    const { customColor } = get()

    if (customColor) {
      const hsl = hexToHSL(customColor)
      applyTheme(generateCustomTheme(theme, hsl))
    } else {
      applyTheme(theme)
    }

    set({ currentTheme: themeName })

    try {
      await window.api.themeSet({ theme: themeName, customColor: customColor ?? undefined })
    } catch {
      // Theme already applied visually; persist failure is non-critical
    }
  },

  setCustomColor: async (hex) => {
    const { currentTheme } = get()
    const base = getTheme(currentTheme)

    if (hex) {
      const hsl = hexToHSL(hex)
      applyTheme(generateCustomTheme(base, hsl))
    } else {
      applyTheme(base)
    }

    set({ customColor: hex })

    try {
      await window.api.themeSet({ theme: currentTheme, customColor: hex ?? undefined })
    } catch {
      // Persist failure is non-critical
    }
  }
}))
