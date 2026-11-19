import type { ExternalValue, JsonObject } from '@/types/json'
export type RuntimeThemePalette = JsonObject & {
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
    baseSize?: number
    bodyWeight?: number
    headingWeight?: number
    headingScale?: number
    lineHeight?: number
    letterSpacing?: number
    navFontSize?: number
    navFontWeight?: number
    bodyScale?: number; h1Scale?: number; h2Scale?: number; h3Scale?: number; leadScale?: number; eyebrowScale?: number
    buttonScale?: number; buttonWeight?: number; breadcrumbScale?: number; cardTitleScale?: number; cardBodyScale?: number
    metaScale?: number; labelScale?: number; brandScale?: number; footerHeadingScale?: number; footerLinkScale?: number
    bodyColor?: string
    headingColor?: string
    navColor?: string
    scopes?: { header?: Record<string, string | number>; content?: Record<string, string | number>; footer?: Record<string, string | number>; cms?: Record<string, string | number> }
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
type RGB = readonly [number, number, number]

function hex(value: ExternalValue, fallback: string) {
  return typeof value === 'string' && HEX.test(value) ? value : fallback
}

function parseHex(value: string): RGB {
  const normalized = value.slice(1)
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as unknown as RGB
}

function rgbHex(value: RGB) {
  return `#${value.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')).join('')}`
}

function luminance(value: string) {
  const channels = parseHex(value).map((channel) => channel / 255)
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** WCAG contrast ratio between two opaque sRGB colours. */
export function getContrastRatio(foreground: string, background: string) {
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function mixHex(first: string, second: string, firstWeight: number) {
  const a = parseHex(first)
  const b = parseHex(second)
  return rgbHex(a.map((channel, index) => channel * firstWeight + b[index] * (1 - firstWeight)) as unknown as RGB)
}

/**
 * Preserve the requested hue, moving it toward black or white only as much as
 * necessary to meet the contrast target on every supplied surface.
 */
export function ensureThemeContrast(foreground: string, backgrounds: string[], target = 4.5) {
  const validBackgrounds = backgrounds.filter((value) => HEX.test(value))
  if (!HEX.test(foreground) || validBackgrounds.length === 0) return foreground
  const minimumContrast = (candidate: string) => Math.min(...validBackgrounds.map((background) => getContrastRatio(candidate, background)))
  if (minimumContrast(foreground) >= target) return foreground

  const endpoints = ['#000000', '#ffffff'].map((endpoint) => ({ endpoint, score: minimumContrast(endpoint) }))
    .sort((first, second) => second.score - first.score)
  const best = endpoints[0]
  if (best.score < target) return best.endpoint

  let low = 0
  let high = 1
  for (let iteration = 0; iteration < 28; iteration += 1) {
    const progress = (low + high) / 2
    const candidate = mixHex(foreground, best.endpoint, 1 - progress)
    if (minimumContrast(candidate) >= target) high = progress
    else low = progress
  }
  return mixHex(foreground, best.endpoint, 1 - high)
}

function contrastInk(value: string) {
  const darkContrast = getContrastRatio('#12221a', value)
  const lightContrast = getContrastRatio('#f5fbf7', value)
  // Choose the foreground with the stronger contrast, especially for the gold donate accent.
  return darkContrast >= lightContrast ? '#12221a' : '#f5fbf7'
}

export function parseThemeTokenOverrides(value: ExternalValue): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const source = value as JsonObject
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
  const rawBorder = hex(dark ? theme.darkBorder : theme.border, dark ? '#304452' : '#d8e1e8')
  const ink = ensureThemeContrast(hex(dark ? theme.darkInk : theme.ink, dark ? '#eef5fa' : '#1d2b36'), [surface, surfaceAlt], 7)
  const muted = ensureThemeContrast(hex(dark ? theme.darkMuted : theme.muted, dark ? '#a8bbc7' : '#65737c'), [surface, surfaceAlt], 4.5)
  // Component boundaries and keyboard focus need a visible edge on both cards
  // and inset/alternate surfaces, not merely a token that differs by one shade.
  const border = ensureThemeContrast(rawBorder, [surface, surfaceAlt], 3)
  const headerBg = hex(dark ? theme.darkHeaderBg : theme.headerBg, dark ? '#0d171f' : '#ffffff')
  const headerInk = ensureThemeContrast(hex(dark ? theme.darkHeaderInk : theme.headerInk, dark ? '#f0f6fa' : '#263b4b'), [headerBg], 4.5)
  const footerBg = hex(dark ? theme.darkFooterBg : theme.footerBg, dark ? '#081018' : '#111f2b')
  const footerInk = ensureThemeContrast(hex(dark ? theme.darkFooterInk : theme.footerInk, dark ? '#eff6fb' : '#f3f8fc'), [footerBg], 4.5)
  const primaryStrongBase = dark ? mixHex(primary, footerInk, 0.55) : mixHex(primary, ink, 0.82)
  const primaryStrong = ensureThemeContrast(primaryStrongBase, [surface, surfaceAlt], 4.5)
  const link = ensureThemeContrast(dark ? primaryStrong : primary, [surface, surfaceAlt], 4.5)
  const focus = ensureThemeContrast(hex(theme.focus, '#4e7799'), [surface, surfaceAlt], 3)
  const success = ensureThemeContrast(hex(theme.success, '#5d966f'), [surface, surfaceAlt], 4.5)
  const warning = ensureThemeContrast(hex(theme.warning, '#a97622'), [surface, surfaceAlt], 4.5)
  const danger = ensureThemeContrast(hex(theme.danger, '#c34f4f'), [surface, surfaceAlt], 4.5)
  const secondaryInk = ensureThemeContrast(secondary, [surface, surfaceAlt], 4.5)
  const accentInk = ensureThemeContrast(accent, [surface, surfaceAlt], 4.5)
  const navActive = dark ? footerInk : link
  const navActiveBg = dark
    ? `color-mix(in srgb, ${navActive} 16%, ${surface})`
    : `color-mix(in srgb, ${link} 12%, ${surface})`
  const activeDarkBackground = hex(theme.darkBackground, '#0b1117')
  const onPrimary = contrastInk(primary)
  const onLink = contrastInk(link)
  const onSecondary = contrastInk(secondary)
  const onAccent = contrastInk(accent)
  const themeRadius = theme.typography?.radius || '18px'
  const typography = theme.typography || {}
  const scopedTypography = typography.scopes || {}
  const headerTypography = { ...typography, ...(scopedTypography.header || {}) }
  const contentTypography = { ...typography, ...(scopedTypography.content || {}) }
  const footerTypography = { ...typography, ...(scopedTypography.footer || {}) }
  const cmsTypography = { ...typography, ...(scopedTypography.cms || {}) }
  const scopedFont = (scope: typeof headerTypography, key: 'body' | 'display', fallback: string) => typeof scope[key] === 'string' ? scope[key] as string : fallback
  const scopedNumber = (scope: typeof headerTypography, key: 'baseSize' | 'bodyWeight' | 'headingWeight' | 'headingScale' | 'lineHeight' | 'letterSpacing' | 'navFontSize' | 'navFontWeight' | 'bodyScale' | 'h1Scale' | 'h2Scale' | 'h3Scale' | 'leadScale' | 'eyebrowScale' | 'buttonScale' | 'buttonWeight' | 'breadcrumbScale' | 'cardTitleScale' | 'cardBodyScale' | 'metaScale' | 'labelScale' | 'brandScale' | 'footerHeadingScale' | 'footerLinkScale', fallback: number) => typeof scope[key] === 'number' && Number.isFinite(scope[key]) ? scope[key] as number : fallback
  const scopedColor = (scope: typeof headerTypography, key: 'bodyColor' | 'headingColor' | 'navColor', fallback: string) => typeof scope[key] === 'string' && HEX.test(scope[key] as string) ? scope[key] as string : fallback
  const baseSize = Math.max(13, Math.min(20, Number(typography.baseSize) || 16))
  const bodyWeight = Math.max(300, Math.min(700, Number(typography.bodyWeight) || 400))
  const headingWeight = Math.max(500, Math.min(900, Number(typography.headingWeight) || 700))
  const headingScale = Math.max(0.85, Math.min(1.25, Number(typography.headingScale) || 1))
  const lineHeight = Math.max(1.2, Math.min(2, Number(typography.lineHeight) || 1.65))
  const defaultTracking = typeof typography.tracking === 'string' && Number.isFinite(Number.parseFloat(typography.tracking))
    ? Number.parseFloat(typography.tracking)
    : -0.02
  const letterSpacing = Math.max(-0.06, Math.min(0.1, typeof typography.letterSpacing === 'number' ? typography.letterSpacing : defaultTracking))
  const navFontSize = Math.max(12, Math.min(20, Number(typography.navFontSize) || 15))
  const navFontWeight = Math.max(400, Math.min(800, Number(typography.navFontWeight) || 600))
  const shapeRadius = shape === 'soft' ? '10px' : shape === 'square' ? '2px' : themeRadius
  const componentTypeVars = (scope: typeof headerTypography, prefix: string) => {
    const base = prefix ? `--sf-${prefix}-type` : '--sf-type'
    const scale = (key: 'bodyScale' | 'h1Scale' | 'h2Scale' | 'h3Scale' | 'leadScale' | 'eyebrowScale' | 'buttonScale' | 'breadcrumbScale' | 'cardTitleScale' | 'cardBodyScale' | 'metaScale' | 'labelScale' | 'brandScale' | 'footerHeadingScale' | 'footerLinkScale', fallback = 1) => scopedNumber(scope, key, fallback)
    return {
      [`${base}-body-scale`]: String(scale('bodyScale')),
      [`${base}-h1-scale`]: String(scale('h1Scale')),
      [`${base}-h2-scale`]: String(scale('h2Scale')),
      [`${base}-h3-scale`]: String(scale('h3Scale')),
      [`${base}-lead-scale`]: String(scale('leadScale')),
      [`${base}-eyebrow-scale`]: String(scale('eyebrowScale')),
      [`${base}-button-scale`]: String(scale('buttonScale')),
      [`${base}-button-weight`]: String(scopedNumber(scope, 'buttonWeight', 600)),
      [`${base}-breadcrumb-scale`]: String(scale('breadcrumbScale')),
      [`${base}-card-title-scale`]: String(scale('cardTitleScale')),
      [`${base}-card-body-scale`]: String(scale('cardBodyScale')),
      [`${base}-meta-scale`]: String(scale('metaScale')),
      [`${base}-label-scale`]: String(scale('labelScale')),
      [`${base}-brand-scale`]: String(scale('brandScale')),
      [`${base}-footer-heading-scale`]: String(scale('footerHeadingScale')),
      [`${base}-footer-link-scale`]: String(scale('footerLinkScale')),
    }
  }

  return {
    '--sf-primary': primary,
    '--sf-secondary': secondary,
    '--sf-secondary-ink': secondaryInk,
    '--sf-accent': accent,
    '--sf-accent-ink': accentInk,
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
    '--sf-essentials-surface': surface,
    '--sf-essentials-border': border,
    '--sf-essentials-ink': ink,
    '--sf-essentials-muted': muted,
    '--sf-essentials-link': link,
    '--sf-ink': ink,
    '--sf-muted': muted,
    '--sf-header-bg': headerBg,
    '--sf-header-ink': headerInk,
    '--sf-footer-bg': footerBg,
    '--sf-footer-ink': footerInk,
    '--sf-footer-text': footerInk,
    '--sf-footer-muted': muted,
    '--sf-footer-border': border,
    '--sf-success': success,
    '--sf-warning': warning,
    '--sf-danger': danger,
    '--sf-info': focus,
    '--sf-focus': focus,
    '--sf-on-primary': onPrimary,
    '--sf-text-on-primary': onPrimary,
    '--sf-on-secondary': onSecondary,
    '--sf-on-accent': onAccent,
    '--sf-on-link': onLink,
    '--sf-primary-strong': primaryStrong,
    '--sf-link': link,
    '--sf-nav-active': navActive,
    '--sf-nav-active-bg': navActiveBg,
    '--sf-nav-active-border': navActive,
    '--sf-nav-active-text': navActive,
    '--sf-hero-bg': `color-mix(in srgb, ${primary} 26%, ${activeDarkBackground})`,
    '--sf-overlay': `color-mix(in srgb, ${activeDarkBackground} 68%, transparent)`,
    // Typography is resolved from the active theme, never from a global CMS override.
    '--sf-font-body': typography.body || "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",
    '--sf-font-display': typography.display || "var(--font-display),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif",
    '--sf-fs-md': `${baseSize}px`,
    '--sf-fs-body': `${baseSize}px`,
    ...componentTypeVars(typography, ''),
    '--sf-fs-lead': `${Math.round(baseSize * 1.125)}px`,
    '--sf-fs-h1': `calc(clamp(2.125rem, 5vw, 3.75rem) * ${headingScale})`,
    '--sf-fs-h2': `calc(clamp(1.75rem, 3.2vw, 2.5rem) * ${headingScale})`,
    '--sf-fs-h3': `calc(1.1875rem * ${headingScale})`,
    '--sf-fw-body': String(bodyWeight),
    '--sf-fw-head': String(headingWeight),
    '--sf-heading-scale': String(headingScale),
    '--sf-line-height-body': String(lineHeight),
    '--sf-nav-font-size': `${navFontSize}px`,
    '--sf-nav-font-weight': String(navFontWeight),
    '--sf-tracking': `${letterSpacing}em`,
    '--sf-typo-body-color': ensureThemeContrast(hex(typography.bodyColor, ink), [surface, surfaceAlt], 4.5),
    '--sf-typo-heading-color': ensureThemeContrast(hex(typography.headingColor, ink), [surface, surfaceAlt], 7),
    '--sf-typo-nav-color': ensureThemeContrast(hex(typography.navColor, headerInk), [headerBg], 4.5),
    ...componentTypeVars(headerTypography, 'header'),
    '--sf-header-font-body': scopedFont(headerTypography, 'body', typography.body || "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-header-font-display': scopedFont(headerTypography, 'display', typography.display || "var(--font-display),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-header-font-size': `${scopedNumber(headerTypography, 'baseSize', baseSize)}px`,
    '--sf-header-font-weight': String(scopedNumber(headerTypography, 'bodyWeight', bodyWeight)),
    '--sf-header-heading-weight': String(scopedNumber(headerTypography, 'headingWeight', headingWeight)),
    '--sf-header-heading-scale': String(scopedNumber(headerTypography, 'headingScale', headingScale)),
    '--sf-header-line-height': String(scopedNumber(headerTypography, 'lineHeight', lineHeight)),
    '--sf-header-tracking': `${scopedNumber(headerTypography, 'letterSpacing', letterSpacing)}em`,
    '--sf-header-nav-font-size': `${scopedNumber(headerTypography, 'navFontSize', navFontSize)}px`,
    '--sf-header-nav-font-weight': String(scopedNumber(headerTypography, 'navFontWeight', navFontWeight)),
    '--sf-header-body-color': ensureThemeContrast(scopedColor(headerTypography, 'bodyColor', headerInk), [headerBg], 4.5),
    '--sf-header-heading-color': ensureThemeContrast(scopedColor(headerTypography, 'headingColor', headerInk), [headerBg], 7),
    '--sf-header-nav-color': ensureThemeContrast(scopedColor(headerTypography, 'navColor', headerInk), [headerBg], 4.5),
    ...componentTypeVars(contentTypography, 'content'),
    '--sf-content-font-body': scopedFont(contentTypography, 'body', typography.body || "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-content-font-display': scopedFont(contentTypography, 'display', typography.display || "var(--font-display),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-content-font-size': `${scopedNumber(contentTypography, 'baseSize', baseSize)}px`,
    '--sf-content-font-weight': String(scopedNumber(contentTypography, 'bodyWeight', bodyWeight)),
    '--sf-content-heading-weight': String(scopedNumber(contentTypography, 'headingWeight', headingWeight)),
    '--sf-content-heading-scale': String(scopedNumber(contentTypography, 'headingScale', headingScale)),
    '--sf-content-line-height': String(scopedNumber(contentTypography, 'lineHeight', lineHeight)),
    '--sf-content-tracking': `${scopedNumber(contentTypography, 'letterSpacing', letterSpacing)}em`,
    '--sf-content-body-color': ensureThemeContrast(scopedColor(contentTypography, 'bodyColor', hex(typography.bodyColor, ink)), [surface, surfaceAlt], 4.5),
    '--sf-content-heading-color': ensureThemeContrast(scopedColor(contentTypography, 'headingColor', hex(typography.headingColor, ink)), [surface, surfaceAlt], 7),
    ...componentTypeVars(footerTypography, 'footer'),
    '--sf-footer-font-body': scopedFont(footerTypography, 'body', typography.body || "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-footer-font-display': scopedFont(footerTypography, 'display', typography.display || "var(--font-display),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-footer-font-size': `${scopedNumber(footerTypography, 'baseSize', baseSize)}px`,
    '--sf-footer-font-weight': String(scopedNumber(footerTypography, 'bodyWeight', bodyWeight)),
    '--sf-footer-heading-weight': String(scopedNumber(footerTypography, 'headingWeight', headingWeight)),
    '--sf-footer-heading-scale': String(scopedNumber(footerTypography, 'headingScale', headingScale)),
    '--sf-footer-line-height': String(scopedNumber(footerTypography, 'lineHeight', lineHeight)),
    '--sf-footer-tracking': `${scopedNumber(footerTypography, 'letterSpacing', letterSpacing)}em`,
    '--sf-footer-body-color': ensureThemeContrast(scopedColor(footerTypography, 'bodyColor', footerInk), [footerBg], 4.5),
    '--sf-footer-heading-color': ensureThemeContrast(scopedColor(footerTypography, 'headingColor', footerInk), [footerBg], 7),
    ...componentTypeVars(cmsTypography, 'cms'),
    '--sf-cms-font-body': scopedFont(cmsTypography, 'body', typography.body || "var(--font-body),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-cms-font-display': scopedFont(cmsTypography, 'display', typography.display || "var(--font-display),'Noto Sans Bengali','Hind Siliguri',system-ui,sans-serif"),
    '--sf-cms-font-size': `${scopedNumber(cmsTypography, 'baseSize', baseSize)}px`,
    '--sf-cms-font-weight': String(scopedNumber(cmsTypography, 'bodyWeight', bodyWeight)),
    '--sf-cms-heading-weight': String(scopedNumber(cmsTypography, 'headingWeight', headingWeight)),
    '--sf-cms-heading-scale': String(scopedNumber(cmsTypography, 'headingScale', headingScale)),
    '--sf-cms-line-height': String(scopedNumber(cmsTypography, 'lineHeight', lineHeight)),
    '--sf-cms-tracking': `${scopedNumber(cmsTypography, 'letterSpacing', letterSpacing)}em`,
    '--sf-cms-nav-size': `${scopedNumber(cmsTypography, 'navFontSize', navFontSize)}px`,
    '--sf-cms-nav-weight': String(scopedNumber(cmsTypography, 'navFontWeight', navFontWeight)),
    '--sf-cms-body-color': ensureThemeContrast(scopedColor(cmsTypography, 'bodyColor', ink), [surface, surfaceAlt], 4.5),
    '--sf-cms-heading-color': ensureThemeContrast(scopedColor(cmsTypography, 'headingColor', ink), [surface, surfaceAlt], 7),
    '--sf-cms-nav-color': ensureThemeContrast(scopedColor(cmsTypography, 'navColor', link), [surface, surfaceAlt], 4.5),
    '--sf-radius-theme': themeRadius,
    '--sf-radius-shape': shapeRadius,
  }
}
