import type { ThemeTokens } from './tokens'
import {
  defaultLight,
  warmLight,
  greenLight,
  defaultDark,
  midnight,
  amoled,
  cyberNeon,
  matrix,
  businessBlue,
  corporate,
  candy,
  sunset
} from './presets'

export type { ThemeTokens } from './tokens'
export { applyTheme, generateCustomTheme } from './utils'
export {
  defaultLight,
  warmLight,
  greenLight,
  defaultDark,
  midnight,
  amoled,
  cyberNeon,
  matrix,
  businessBlue,
  corporate,
  candy,
  sunset
} from './presets'

/**
 * 所有预设主题注册表
 * key 为主题 name，value 为完整 ThemeTokens
 */
export const themes: Record<string, ThemeTokens> = {
  'default-light': defaultLight,
  'warm-light': warmLight,
  'green-light': greenLight,
  'default-dark': defaultDark,
  'midnight': midnight,
  'amoled': amoled,
  'cyber-neon': cyberNeon,
  'matrix': matrix,
  'business-blue': businessBlue,
  'corporate': corporate,
  'candy': candy,
  'sunset': sunset
}

/**
 * 按分类组织的主题列表
 */
export const themeCategories = [
  {
    key: 'light' as const,
    label: '浅色主题',
    themes: [defaultLight, warmLight, greenLight]
  },
  {
    key: 'dark' as const,
    label: '深色主题',
    themes: [defaultDark, midnight, amoled]
  },
  {
    key: 'tech' as const,
    label: '科技主题',
    themes: [cyberNeon, matrix]
  },
  {
    key: 'business' as const,
    label: '商务主题',
    themes: [businessBlue, corporate]
  },
  {
    key: 'free' as const,
    label: '个性主题',
    themes: [candy, sunset]
  }
]

/**
 * 按名称获取主题，未找到则返回默认浅色主题
 */
export function getTheme(name: string): ThemeTokens {
  return themes[name] ?? defaultLight
}
