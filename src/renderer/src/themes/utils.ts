import type { ThemeTokens } from './tokens'

/**
 * CSS 变量名与 ThemeTokens.colors 键名的映射
 * 键为 ThemeTokens.colors 的 camelCase 属性名，值为 CSS 变量名（不含 --）
 */
const COLOR_VAR_MAP: Record<keyof ThemeTokens['colors'], string> = {
  background: 'background',
  foreground: 'foreground',
  card: 'card',
  cardForeground: 'card-foreground',
  popover: 'popover',
  popoverForeground: 'popover-foreground',
  primary: 'primary',
  primaryForeground: 'primary-foreground',
  secondary: 'secondary',
  secondaryForeground: 'secondary-foreground',
  muted: 'muted',
  mutedForeground: 'muted-foreground',
  accent: 'accent',
  accentForeground: 'accent-foreground',
  destructive: 'destructive',
  destructiveForeground: 'destructive-foreground',
  border: 'border',
  input: 'input',
  ring: 'ring',
  sidebar: 'sidebar',
  sidebarForeground: 'sidebar-foreground',
  sidebarAccent: 'sidebar-accent',
  sidebarAccentForeground: 'sidebar-accent-foreground',
  sidebarBorder: 'sidebar-border'
}

/**
 * 将主题 token 应用到 document.documentElement
 * 设置所有 CSS 变量、dark class、border-radius、字体
 */
export function applyTheme(theme: ThemeTokens): void {
  const element = document.documentElement

  // 设置颜色 CSS 变量
  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP)) {
    const value = theme.colors[key as keyof ThemeTokens['colors']]
    element.style.setProperty(`--${cssVar}`, value)
  }

  // 设置 border-radius
  element.style.setProperty('--radius', theme.radius)

  // 处理 dark class
  if (theme.isDark) {
    element.classList.add('dark')
  } else {
    element.classList.remove('dark')
  }

  // 处理字体覆盖
  if (theme.fontFamily) {
    element.style.setProperty('--font-family-override', theme.fontFamily)
    document.body.style.fontFamily = theme.fontFamily
  } else {
    element.style.removeProperty('--font-family-override')
    document.body.style.removeProperty('font-family')
  }
}

/**
 * 解析 HSL 字符串为 { h, s, l }
 * 输入格式: "239 84% 67%"
 */
function parseHSL(hsl: string): { h: number; s: number; l: number } {
  const parts = hsl.trim().split(/\s+/)
  return {
    h: parseFloat(parts[0]),
    s: parseFloat(parts[1]),
    l: parseFloat(parts[2])
  }
}

/**
 * 将 { h, s, l } 格式化为 HSL 字符串
 * 输出格式: "239 84% 67%"
 */
function formatHSL(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(s * 10) / 10}% ${Math.round(l * 10) / 10}%`
}

/**
 * 限制数值范围
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 基于自定义主色生成完整主题
 * 以 baseTheme 为骨架，替换所有与 primary 相关的颜色
 */
export function generateCustomTheme(
  baseTheme: ThemeTokens,
  customPrimaryHSL: string
): ThemeTokens {
  const primary = parseHSL(customPrimaryHSL)
  const isDark = baseTheme.isDark

  // primary-foreground: 深色主色用白色前景，浅色主色用深色前景
  const primaryFg = primary.l < 55
    ? '0 0% 100%'
    : '0 0% 0%'

  // ring 与 primary 一致
  const ring = customPrimaryHSL

  // 基于主色色相生成辅助色
  const sidebarAccentL = isDark ? 15 : 93
  const sidebarAccent = formatHSL(primary.h, clamp(primary.s * 0.3, 3, 20), sidebarAccentL)
  const sidebarAccentFg = isDark ? '0 0% 95%' : formatHSL(primary.h, 10, 12)

  return {
    ...baseTheme,
    name: `custom-${baseTheme.name}`,
    label: `自定义 ${baseTheme.label}`,
    colors: {
      ...baseTheme.colors,
      primary: customPrimaryHSL,
      primaryForeground: primaryFg,
      ring,
      sidebarAccent,
      sidebarAccentForeground: sidebarAccentFg
    }
  }
}
