export interface ThemeTokens {
  name: string
  label: string
  category: 'light' | 'dark' | 'tech' | 'business' | 'free'
  categoryLabel: string
  isDark: boolean
  colors: {
    background: string
    foreground: string
    card: string
    cardForeground: string
    popover: string
    popoverForeground: string
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    muted: string
    mutedForeground: string
    accent: string
    accentForeground: string
    destructive: string
    destructiveForeground: string
    border: string
    input: string
    ring: string
    sidebar: string
    sidebarForeground: string
    sidebarAccent: string
    sidebarAccentForeground: string
    sidebarBorder: string
  }
  radius: string
  fontFamily?: string
}
