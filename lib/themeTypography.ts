import type { ExternalValue, JsonObject } from '@/types/json'
import type { ThemeDefinition } from '@/types/entityType'
/** Theme-scoped typography preferences. Values are allowlisted and bounded before
 * they are stored or translated into CSS variables; no arbitrary CSS is accepted. */
export const THEME_TYPOGRAPHY_SETTING_KEY = 'cms-theme-typography'

export const THEME_FONT_FAMILIES = {
  inter: "var(--font-body), 'Noto Sans Bengali', 'Hind Siliguri', system-ui, sans-serif",
  poppins: "var(--font-display), 'Noto Sans Bengali', 'Hind Siliguri', system-ui, sans-serif",
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  arial: "Arial, Helvetica, sans-serif",
  georgia: "Georgia, 'Times New Roman', serif",
  bengali: "var(--font-bengali), 'Hind Siliguri', var(--font-body), sans-serif",
} as const

export type ThemeFontFamily = keyof typeof THEME_FONT_FAMILIES
export type ThemeTypographyPreferences = {
  bodyFont: ThemeFontFamily
  displayFont: ThemeFontFamily
  baseSize: number
  bodyWeight: number
  headingWeight: number
  headingScale: number
  lineHeight: number
  letterSpacing: number
  navFontSize: number
  navFontWeight: number
  bodyColor: string
  headingColor: string
  navColor: string
  /** CMS component tokens, consumed only inside the authenticated admin workspace. */
  adminSidebarSize: number
  adminToolbarSize: number
  adminTableSize: number
  adminControlSize: number
  adminHeaderSize: number
  adminDataHeadingSize: number
  adminFooterSize: number
}
export type ThemeTypographyScope = 'global' | 'header' | 'content' | 'footer' | 'cms'
export type ThemeTypographyOverrides = Partial<ThemeTypographyPreferences>
export type ThemeTypographyScopedSettings = {
  version: 2
  global: ThemeTypographyPreferences
  /** Optional overrides. An omitted property inherits the global value. */
  header: ThemeTypographyOverrides
  content: ThemeTypographyOverrides
  footer: ThemeTypographyOverrides
  /** CMS-only typography and component sizing tokens. */
  cms: ThemeTypographyOverrides
}
export type ThemeTypographyCollection = Record<string, ThemeTypographyPreferences>

export const DEFAULT_THEME_TYPOGRAPHY: ThemeTypographyPreferences = {
  bodyFont: 'inter', displayFont: 'poppins', baseSize: 16, bodyWeight: 400,
  headingWeight: 700, headingScale: 1, lineHeight: 1.65, letterSpacing: -0.02,
  navFontSize: 15, navFontWeight: 600, bodyColor: '', headingColor: '', navColor: '',
  adminSidebarSize: 12, adminToolbarSize: 13, adminTableSize: 12, adminControlSize: 13,
  adminHeaderSize: 13, adminDataHeadingSize: 16, adminFooterSize: 11,
}
export const DEFAULT_THEME_TYPOGRAPHY_SETTINGS: ThemeTypographyScopedSettings = {
  version: 2,
  global: DEFAULT_THEME_TYPOGRAPHY,
  header: {},
  content: {},
  footer: {},
  cms: {},
}

function boundedNumber(value: ExternalValue, fallback: number, min: number, max: number, precision = 2) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.max(min, Math.min(max, parsed))
  const factor = 10 ** precision
  return Math.round(clamped * factor) / factor
}
function color(value: ExternalValue) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : ''
}
function fontFamily(value: ExternalValue, fallback: ThemeFontFamily): ThemeFontFamily {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(THEME_FONT_FAMILIES, value)
    ? value as ThemeFontFamily : fallback
}
function asObject(value: ExternalValue): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

export function normalizeThemeTypographyPreferences(value: ExternalValue): ThemeTypographyPreferences {
  const source = asObject(value)
  return {
    bodyFont: fontFamily(source.bodyFont, DEFAULT_THEME_TYPOGRAPHY.bodyFont),
    displayFont: fontFamily(source.displayFont, DEFAULT_THEME_TYPOGRAPHY.displayFont),
    baseSize: boundedNumber(source.baseSize, DEFAULT_THEME_TYPOGRAPHY.baseSize, 13, 20, 1),
    bodyWeight: boundedNumber(source.bodyWeight, DEFAULT_THEME_TYPOGRAPHY.bodyWeight, 300, 700, 0),
    headingWeight: boundedNumber(source.headingWeight, DEFAULT_THEME_TYPOGRAPHY.headingWeight, 500, 900, 0),
    headingScale: boundedNumber(source.headingScale, DEFAULT_THEME_TYPOGRAPHY.headingScale, 0.85, 1.25, 2),
    lineHeight: boundedNumber(source.lineHeight, DEFAULT_THEME_TYPOGRAPHY.lineHeight, 1.2, 2, 2),
    letterSpacing: boundedNumber(source.letterSpacing, DEFAULT_THEME_TYPOGRAPHY.letterSpacing, -0.06, 0.1, 3),
    navFontSize: boundedNumber(source.navFontSize, DEFAULT_THEME_TYPOGRAPHY.navFontSize, 12, 20, 1),
    navFontWeight: boundedNumber(source.navFontWeight, DEFAULT_THEME_TYPOGRAPHY.navFontWeight, 400, 800, 0),
    adminSidebarSize: boundedNumber(source.adminSidebarSize, DEFAULT_THEME_TYPOGRAPHY.adminSidebarSize, 10, 16, 1),
    adminToolbarSize: boundedNumber(source.adminToolbarSize, DEFAULT_THEME_TYPOGRAPHY.adminToolbarSize, 11, 17, 1),
    adminTableSize: boundedNumber(source.adminTableSize, DEFAULT_THEME_TYPOGRAPHY.adminTableSize, 10, 16, 1),
    adminControlSize: boundedNumber(source.adminControlSize, DEFAULT_THEME_TYPOGRAPHY.adminControlSize, 11, 17, 1),
    adminHeaderSize: boundedNumber(source.adminHeaderSize, DEFAULT_THEME_TYPOGRAPHY.adminHeaderSize, 11, 18, 1),
    adminDataHeadingSize: boundedNumber(source.adminDataHeadingSize, DEFAULT_THEME_TYPOGRAPHY.adminDataHeadingSize, 12, 22, 1),
    adminFooterSize: boundedNumber(source.adminFooterSize, DEFAULT_THEME_TYPOGRAPHY.adminFooterSize, 9, 14, 1),
    bodyColor: color(source.bodyColor), headingColor: color(source.headingColor), navColor: color(source.navColor),
  }
}

/** Legacy single-scope and per-preset records remain readable during migration. */
export function normalizeSiteThemeTypography(value: ExternalValue): ThemeTypographyPreferences {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const source = value as JsonObject
    if ('bodyFont' in source || 'baseSize' in source) return normalizeThemeTypographyPreferences(source)
    const legacy = source.midnight && typeof source.midnight === 'object'
      ? source.midnight
      : Object.values(source).find((candidate) => candidate && typeof candidate === 'object' && !Array.isArray(candidate))
    return normalizeThemeTypographyPreferences(legacy)
  }
  return DEFAULT_THEME_TYPOGRAPHY
}

/** Only valid, explicitly provided properties are kept in optional scopes. */
export function normalizeThemeTypographyOverrides(value: ExternalValue): ThemeTypographyOverrides {
  const source = asObject(value)
  const normalized = normalizeThemeTypographyPreferences({ ...DEFAULT_THEME_TYPOGRAPHY, ...source })
  const output: ThemeTypographyOverrides = {}
  const numericRanges: Partial<Record<keyof ThemeTypographyPreferences, [number, number]>> = {
    baseSize: [13, 20], bodyWeight: [300, 700], headingWeight: [500, 900], headingScale: [0.85, 1.25],
    lineHeight: [1.2, 2], letterSpacing: [-0.06, 0.1], navFontSize: [12, 20], navFontWeight: [400, 800],
    adminSidebarSize: [10, 16], adminToolbarSize: [11, 17], adminTableSize: [10, 16], adminControlSize: [11, 17],
    adminHeaderSize: [11, 18], adminDataHeadingSize: [12, 22], adminFooterSize: [9, 14],
  }
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = rawKey as keyof ThemeTypographyPreferences
    if (key === 'bodyFont' || key === 'displayFont') {
      if (typeof rawValue === 'string' && Object.prototype.hasOwnProperty.call(THEME_FONT_FAMILIES, rawValue)) output[key] = normalized[key] as never
      continue
    }
    if (key === 'bodyColor' || key === 'headingColor' || key === 'navColor') {
      if (typeof rawValue === 'string' && /^#[0-9a-fA-F]{6}$/.test(rawValue)) output[key] = normalized[key] as never
      continue
    }
    const range = numericRanges[key]
    if (range && typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= range[0] && rawValue <= range[1]) output[key] = normalized[key] as never
  }
  return output
}

export function normalizeThemeTypographySettings(value: ExternalValue): ThemeTypographyScopedSettings {
  const source = asObject(value)
  if (source.version === 2 && source.global && typeof source.global === 'object') {
    return {
      version: 2,
      global: normalizeThemeTypographyPreferences(source.global),
      header: normalizeThemeTypographyOverrides(source.header),
      content: normalizeThemeTypographyOverrides(source.content),
      footer: normalizeThemeTypographyOverrides(source.footer),
      cms: normalizeThemeTypographyOverrides(source.cms),
    }
  }
  return {
    version: 2,
    global: normalizeSiteThemeTypography(value),
    header: {}, content: {}, footer: {}, cms: {},
  }
}

export function normalizeThemeTypographyCollection(value: ExternalValue, themeNames: string[]): ThemeTypographyCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as JsonObject
  return Object.fromEntries(themeNames.filter((name) => Object.prototype.hasOwnProperty.call(source, name))
    .map((name) => [name, normalizeThemeTypographyPreferences(source[name])]))
}

function toThemeTypography(preferences: ThemeTypographyPreferences) {
  return {
    body: THEME_FONT_FAMILIES[preferences.bodyFont], display: THEME_FONT_FAMILIES[preferences.displayFont],
    baseSize: preferences.baseSize, bodyWeight: preferences.bodyWeight, headingWeight: preferences.headingWeight,
    headingScale: preferences.headingScale, lineHeight: preferences.lineHeight, letterSpacing: preferences.letterSpacing,
    navFontSize: preferences.navFontSize, navFontWeight: preferences.navFontWeight,
    adminSidebarSize: preferences.adminSidebarSize, adminToolbarSize: preferences.adminToolbarSize,
    adminTableSize: preferences.adminTableSize, adminControlSize: preferences.adminControlSize,
    adminHeaderSize: preferences.adminHeaderSize, adminDataHeadingSize: preferences.adminDataHeadingSize, adminFooterSize: preferences.adminFooterSize,
    bodyColor: preferences.bodyColor, headingColor: preferences.headingColor, navColor: preferences.navColor,
  }
}

export function applyThemeTypographySettings(
  themes: Record<string, ThemeDefinition>,
  settings: ThemeTypographyScopedSettings,
): Record<string, ThemeDefinition> {
  const resolved = {
    header: { ...settings.global, ...settings.header },
    content: { ...settings.global, ...settings.content },
    footer: { ...settings.global, ...settings.footer },
    cms: { ...settings.global, ...settings.cms },
  }
  return Object.fromEntries(Object.entries(themes).map(([name, theme]) => [name, {
    ...theme,
    typography: {
      ...theme.typography,
      ...toThemeTypography(settings.global),
      scopes: {
        header: toThemeTypography(resolved.header),
        content: toThemeTypography(resolved.content),
        footer: toThemeTypography(resolved.footer),
        cms: toThemeTypography(resolved.cms),
      },
    },
  }]))
}

/** Backward-compatible adapter for older callers/tests. */
export function applyThemeTypographyPreferences(
  themes: Record<string, ThemeDefinition>,
  preferencesByTheme: ThemeTypographyCollection,
): Record<string, ThemeDefinition> {
  const preferences = preferencesByTheme.midnight || Object.values(preferencesByTheme)[0] || DEFAULT_THEME_TYPOGRAPHY
  return applyThemeTypographySettings(themes, { version: 2, global: preferences, header: {}, content: {}, footer: {}, cms: {} })
}
