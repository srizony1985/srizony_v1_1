import type { ExternalValue, JsonObject } from '@/types/json'
import { ensureThemeContrast } from '@/lib/themeRuntime'
export type CmsTypography = {
  fontFamily?: 'inherit' | 'system' | 'arial' | 'georgia' | 'times' | 'inter' | 'roboto' | 'noto-sans-bengali'
  fontWeight?: 300 | 400 | 500 | 600 | 700 | 800 | 900
  fontSize?: number
  color?: string
  letterSpacing?: number
  lineHeight?: number
}

const FONT_STACKS: Record<NonNullable<CmsTypography['fontFamily']>, string> = {
  inherit: 'inherit',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, serif',
  times: '"Times New Roman", Times, serif',
  inter: 'Inter, system-ui, sans-serif',
  roboto: 'Roboto, Arial, sans-serif',
  'noto-sans-bengali': '"Noto Sans Bengali", "Nirmala UI", sans-serif',
}

const FONT_FAMILY_VALUES = new Set<CmsTypography['fontFamily']>(['inherit', 'system', 'arial', 'georgia', 'times', 'inter', 'roboto', 'noto-sans-bengali'])

/** Parse and bound typography coming from persisted CMS JSON or a form payload. */
export function normalizeCmsTypography(input: ExternalValue): CmsTypography | undefined {
  let value = input
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return undefined }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as JsonObject
  const result: CmsTypography = {}
  if (typeof source.fontFamily === 'string' && FONT_FAMILY_VALUES.has(source.fontFamily as CmsTypography['fontFamily'])) result.fontFamily = source.fontFamily as CmsTypography['fontFamily']
  const weight = Number(source.fontWeight)
  if (Number.isInteger(weight) && [300, 400, 500, 600, 700, 800, 900].includes(weight)) result.fontWeight = weight as NonNullable<CmsTypography['fontWeight']>
  const size = Number(source.fontSize)
  if (Number.isFinite(size) && size >= 10 && size <= 64) result.fontSize = size
  if (typeof source.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.color)) result.color = source.color
  const spacing = Number(source.letterSpacing)
  if (Number.isFinite(spacing) && spacing >= -0.1 && spacing <= 0.5) result.letterSpacing = spacing
  const height = Number(source.lineHeight)
  if (Number.isFinite(height) && height >= 0.8 && height <= 2.5) result.lineHeight = height
  return Object.keys(result).length ? result : undefined
}

export function toCmsTypographyStyle(value?: CmsTypography | null): Record<string, string | number> {
  if (!value || typeof value !== 'object') return {}
  const style: Record<string, string | number> = {}
  if (value.fontFamily && value.fontFamily in FONT_STACKS) {
    const fontFamily = FONT_STACKS[value.fontFamily]
    style['--sf-cms-font-family'] = fontFamily
    style['--sf-cms-heading-font-family'] = fontFamily
    style.fontFamily = fontFamily
  }
  if (Number.isInteger(value.fontWeight) && value.fontWeight! >= 300 && value.fontWeight! <= 900) {
    style['--sf-cms-font-weight'] = value.fontWeight!
    style['--sf-cms-heading-font-weight'] = value.fontWeight!
    style.fontWeight = value.fontWeight!
  }
  if (Number.isFinite(value.fontSize) && value.fontSize! >= 10 && value.fontSize! <= 64) {
    const size = value.fontSize!
    style['--sf-cms-font-size'] = `${size}px`
    style.fontSize = `${size}px`
    // Preserve heading hierarchy while allowing the CMS base size to scale it.
    style['--sf-cms-h1-size'] = `calc(${size}px * 2.2)`
    style['--sf-cms-h2-size'] = `calc(${size}px * 1.8)`
    style['--sf-cms-h3-size'] = `calc(${size}px * 1.5)`
    style['--sf-cms-h4-size'] = `calc(${size}px * 1.25)`
    style['--sf-cms-h5-size'] = `calc(${size}px * 1.1)`
    style['--sf-cms-h6-size'] = `${size}px`
  }
  if (typeof value.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.color)) {
    // Retain the CMS-selected hue while guaranteeing readable text on the
    // public page's standard light and dark content surfaces.
    style['--sf-cms-text-color-light'] = ensureThemeContrast(value.color, ['#ffffff', '#edf3f7'], 4.5)
    style['--sf-cms-heading-color-light'] = ensureThemeContrast(value.color, ['#ffffff', '#edf3f7'], 7)
    style['--sf-cms-text-color-dark'] = ensureThemeContrast(value.color, ['#111c24', '#16252f'], 4.5)
    style['--sf-cms-heading-color-dark'] = ensureThemeContrast(value.color, ['#111c24', '#16252f'], 7)
  }
  if (Number.isFinite(value.letterSpacing) && value.letterSpacing! >= -0.1 && value.letterSpacing! <= 0.5) {
    const spacing = `${value.letterSpacing}em`
    style['--sf-cms-letter-spacing'] = spacing
    style.letterSpacing = spacing
  }
  if (Number.isFinite(value.lineHeight) && value.lineHeight! >= 0.8 && value.lineHeight! <= 2.5) {
    style['--sf-cms-line-height'] = value.lineHeight!
    style.lineHeight = value.lineHeight!
  }
  return style
}
