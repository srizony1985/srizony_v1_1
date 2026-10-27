export type RuntimeThemePalette = Record<string, unknown> & {
  primary?: string
  secondary?: string
  accent?: string
  background?: string
  surface?: string
  surfaceAlt?: string
  surfaceRaised?: string
  border?: string
  ink?: string
  muted?: string
  headerBg?: string
  headerInk?: string
  footerBg?: string
  footerInk?: string
  success?: string
  warning?: string
  danger?: string
  focus?: string
  darkBackground?: string
  darkSurface?: string
  darkSurfaceAlt?: string
  darkSurfaceRaised?: string
  darkBorder?: string
  darkInk?: string
  darkMuted?: string
  darkHeaderBg?: string
  darkHeaderInk?: string
  darkFooterBg?: string
  darkFooterInk?: string
  typography?: {
    body?: string
    display?: string
    tracking?: string
    radius?: string
  }
}

export type RuntimeThemeMap = Record<string, RuntimeThemePalette>
export type RuntimeShapeName = 'rounded' | 'soft' | 'square'

/** One shared allowlist validates theme token overrides for persisted theme settings. */
export const THEME_COLOR_TOKEN_KEYS = [
  'primary', 'secondary', 'accent', 'background', 'surface', 'surfaceAlt', 'surfaceRaised', 'border',
  'ink', 'muted', 'headerBg', 'headerInk', 'footerBg', 'footerInk', 'success', 'warning', 'danger', 'focus',
  'darkBackground', 'darkSurface', 'darkSurfaceAlt', 'darkSurfaceRaised', 'darkBorder', 'darkInk',
  'darkMuted', 'darkHeaderBg', 'darkHeaderInk', 'darkFooterBg', 'darkFooterInk',
] as const

const HEX = /^#[0-9a-fA-F]{6}$/

function hex(value: unknown, fallback: string) {
  return typeof value === 'string' && HEX.test(value) ? value : fallback
}

function contrastInk(value: string) {
  const normalized = value.slice(1)
  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255)
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  const darkInkLuminance = 0.013
  const lightInkLuminance = 0.96
  const darkContrast = (luminance + 0.05) / (darkInkLuminance + 0.05)
  const lightContrast = (lightInkLuminance + 0.05) / (luminance + 0.05)
  // Choose the foreground with the stronger contrast, especially for the gold donate accent.
  return darkContrast >= lightContrast ? '#12221a' : '#f5fbf7'
}

export function parseThemeTokenOverrides(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const source = value as Record<string, unknown>
  const entries = Object.entries(source).filter(([key, token]) => THEME_COLOR_TOKEN_KEYS.includes(key as (typeof THEME_COLOR_TOKEN_KEYS)[number]) && typeof token === 'string' && HEX.test(token)) as Array<[string, string]>
  return Object.fromEntries(entries) as Record<string, string>
}

export function buildThemeCssVariables(
  themes: RuntimeThemeMap,
  themeName: string,
  mode: 'light' | 'dark',
  overrides: Record<string, string> = {},
  shape: RuntimeShapeName = 'rounded',
): Record<string, string> {
  const base = themes[themeName] || themes.midnight || themes.forest || Object.values(themes)[0] || {}
  const theme = { ...base, ...overrides } as RuntimeThemePalette
  const dark = mode === 'dark'

  const primary = hex(theme.primary, '#173d5b')
  const secondary = hex(theme.secondary, '#b55f5f')
  const accent = hex(theme.accent, '#d7b45f')
  const background = hex(dark ? theme.darkBackground : theme.background, dark ? '#0b1117' : '#f4f7fa')
  const surface = hex(dark ? theme.darkSurface : theme.surface, dark ? '#111c24' : '#ffffff')
  const surfaceAlt = hex(dark ? theme.darkSurfaceAlt : theme.surfaceAlt, dark ? '#16252f' : '#edf3f7')
  const surfaceRaised = hex(dark ? theme.darkSurfaceRaised : theme.surfaceRaised, dark ? '#1d303c' : '#ffffff')
  const border = hex(dark ? theme.darkBorder : theme.border, dark ? '#304452' : '#d8e1e8')
  const ink = hex(dark ? theme.darkInk : theme.ink, dark ? '#eef5fa' : '#1d2b36')
  const muted = hex(dark ? theme.darkMuted : theme.muted, dark ? '#a8bbc7' : '#65737c')
  const headerBg = hex(dark ? theme.darkHeaderBg : theme.headerBg, dark ? '#0d171f' : '#ffffff')
  const headerInk = hex(dark ? theme.darkHeaderInk : theme.headerInk, dark ? '#f0f6fa' : '#263b4b')
  const footerBg = hex(dark ? theme.darkFooterBg : theme.footerBg, dark ? '#081018' : '#111f2b')
  const footerInk = hex(dark ? theme.darkFooterInk : theme.footerInk, dark ? '#eff6fb' : '#f3f8fc')
  const primaryStrong = dark
    ? `color-mix(in srgb, ${primary} 55%, ${footerInk})`
    : `color-mix(in srgb, ${primary} 82%, ${ink})`
  const link = dark ? primaryStrong : primary
  const navActive = dark ? footerInk : primary
  const navActiveBg = dark
    ? `color-mix(in srgb, ${navActive} 13%, ${surface})`
    : `color-mix(in srgb, ${primary} 9%, ${surface})`
  const activeDarkBackground = hex(theme.darkBackground, '#0b1117')
  const onPrimary = contrastInk(primary)
  const onSecondary = contrastInk(secondary)
  const onAccent = contrastInk(accent)
  const themeRadius = theme.typography?.radius || '18px'
  const shapeRadius = shape === 'soft' ? '10px' : shape === 'square' ? '2px' : themeRadius

  return {
    '--sf-primary': primary,
    '--sf-secondary': secondary,
    '--sf-accent': accent,
    '--sf-bg': background,
    '--sf-card': surface,
    '--sf-surface': surface,
    '--sf-soft': surfaceAlt,
    '--sf-surface-alt': surfaceAlt,
    '--sf-surface-muted': surfaceAlt,
    '--sf-raised': surfaceRaised,
    '--sf-panel': surfaceRaised,
    '--sf-panel-hover': surfaceAlt,
    '--sf-input': surfaceAlt,
    '--sf-border': border,
    '--sf-border-soft': border,
    '--sf-border-strong': border,
    '--sf-divider': border,
    '--sf-ink': ink,
    '--sf-muted': muted,
    '--sf-header-bg': headerBg,
    '--sf-header-ink': headerInk,
    '--sf-footer-bg': footerBg,
    '--sf-footer-ink': footerInk,
    '--sf-footer-text': footerInk,
    '--sf-footer-muted': muted,
    '--sf-footer-border': border,
    '--sf-success': hex(theme.success, '#5d966f'),
    '--sf-warning': hex(theme.warning, '#a97622'),
    '--sf-danger': hex(theme.danger, '#c34f4f'),
    '--sf-focus': hex(theme.focus, '#4e7799'),
    '--sf-on-primary': onPrimary,
    '--sf-text-on-primary': onPrimary,
    '--sf-on-secondary': onSecondary,
    '--sf-on-accent': onAccent,
    '--sf-primary-strong': primaryStrong,
    '--sf-link': link,
    '--sf-nav-active': navActive,
    '--sf-nav-active-bg': navActiveBg,
    '--sf-nav-active-border': navActive,
    '--sf-nav-active-text': navActive,
    '--sf-hero-bg': `color-mix(in srgb, ${primary} 26%, ${activeDarkBackground})`,
    '--sf-overlay': `color-mix(in srgb, ${activeDarkBackground} 68%, transparent)`,
    // One typeface for the whole site (the loaded Inter + Noto Sans Bengali stack); themes change colour and shape, not type.
    '--sf-font-body': "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",
    '--sf-font-display': "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",
    '--sf-tracking': '-0.02em',
    '--sf-radius-theme': themeRadius,
    '--sf-radius-shape': shapeRadius,
  }
}
