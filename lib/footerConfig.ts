import type { ExternalValue, JsonObject } from '@/types/json'
/** Single-site footer configuration stored as a JSON document in site_settings. */
export const FOOTER_CONFIG_SETTING_KEY = 'cms-footer-layout'

export type FooterLink = {
  id: string
  labelEn: string
  labelBn: string
  href: string
}

export type FooterSectionKind = 'navigation' | 'custom' | 'contact'

export type FooterSection = {
  id: string
  titleEn: string
  titleBn: string
  enabled: boolean
  kind: FooterSectionKind
  columns: number
  showAddress: boolean
  showPhones: boolean
  showEmail: boolean
  links: FooterLink[]
}

export type FooterTypography = { titleFontFamily: string; titleSize: number; titleWeight: number; titleColor: string; linkSize: number; linkWeight: number; linkColor: string; bodyFontFamily: string; bodySize: number; bodyColor: string }

export type FooterConfig = {
  enabled: boolean
  typography: FooterTypography
  layoutColumns: number
  showBrand: boolean
  showLogo: boolean
  showTagline: boolean
  showSummary: boolean
  showSocial: boolean
  showCopyright: boolean
  sections: FooterSection[]
}

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  enabled: true,
  typography: { titleFontFamily: 'inherit', titleSize: 16, titleWeight: 700, titleColor: '#f3f8fc', linkSize: 14, linkWeight: 500, linkColor: '#d8e2ea', bodyFontFamily: 'inherit', bodySize: 14, bodyColor: '#d8e2ea' },
  layoutColumns: 3,
  showBrand: true,
  showLogo: true,
  showTagline: true,
  showSummary: false,
  showSocial: true,
  showCopyright: true,
  sections: [
    { id: 'useful-links', titleEn: 'Useful Links', titleBn: 'প্রয়োজনীয় লিংক', enabled: true, kind: 'navigation', columns: 2, showAddress: true, showPhones: true, showEmail: true, links: [] },
    { id: 'contact', titleEn: 'Contact', titleBn: 'যোগাযোগ', enabled: true, kind: 'contact', columns: 1, showAddress: true, showPhones: true, showEmail: true, links: [] },
  ],
}

function text(value: ExternalValue, fallback: string, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function safeHref(value: ExternalValue) {
  if (typeof value !== 'string') return '#'
  const href = value.trim().slice(0, 500)
  if (!href || href.startsWith('//') || /^(javascript|data|vbscript):/i.test(href)) return '#'
  return href.startsWith('/') || href.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(href) ? href : `/${href.replace(/^\/+/, '')}`
}

function boundedInteger(value: ExternalValue, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback
}

export function normalizeFooterConfig(value: ExternalValue): FooterConfig {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
  const rawSections = Array.isArray(source.sections) ? source.sections : DEFAULT_FOOTER_CONFIG.sections
  const sections = rawSections.slice(0, 8).map((entry, index): FooterSection => {
    const item = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry as JsonObject : {}
    const kind: FooterSectionKind = item.kind === 'custom' || item.kind === 'contact' ? item.kind : 'navigation'
    const links = Array.isArray(item.links) ? item.links.slice(0, 40).map((link, linkIndex) => {
      const row = link && typeof link === 'object' && !Array.isArray(link) ? link as JsonObject : {}
      return {
        id: text(row.id, `footer-link-${index + 1}-${linkIndex + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, '-') || `footer-link-${index + 1}-${linkIndex + 1}`,
        labelEn: text(row.labelEn, 'Link'),
        labelBn: text(row.labelBn, ''),
        href: safeHref(row.href),
      }
    }) : []
    return {
      id: text(item.id, `footer-section-${index + 1}`, 80).replace(/[^a-zA-Z0-9_-]/g, '-') || `footer-section-${index + 1}`,
      titleEn: text(item.titleEn, kind === 'contact' ? 'Contact' : `Section ${index + 1}`),
      titleBn: text(item.titleBn, ''),
      enabled: item.enabled !== false,
      kind,
      columns: boundedInteger(item.columns, 1, 1, 4),
      showAddress: item.showAddress !== false,
      showPhones: item.showPhones !== false,
      showEmail: item.showEmail !== false,
      links,
    }
  })
  const rawTypography = source.typography && typeof source.typography === 'object' && !Array.isArray(source.typography) ? source.typography as JsonObject : {}
  const color = (value: ExternalValue, fallback: string) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
  const allowedFonts = ['inherit', 'system', 'arial', 'georgia', 'times', 'inter', 'roboto', 'noto-sans-bengali']
  const font = (value: ExternalValue) => typeof value === 'string' && allowedFonts.includes(value) ? value : 'inherit'
  const typography: FooterTypography = {
    titleFontFamily: font(rawTypography.titleFontFamily),
    titleSize: boundedInteger(rawTypography.titleSize, DEFAULT_FOOTER_CONFIG.typography.titleSize, 12, 32),
    titleWeight: boundedInteger(rawTypography.titleWeight, DEFAULT_FOOTER_CONFIG.typography.titleWeight, 400, 900),
    titleColor: color(rawTypography.titleColor, DEFAULT_FOOTER_CONFIG.typography.titleColor),
    linkSize: boundedInteger(rawTypography.linkSize, DEFAULT_FOOTER_CONFIG.typography.linkSize, 11, 22),
    linkWeight: boundedInteger(rawTypography.linkWeight, DEFAULT_FOOTER_CONFIG.typography.linkWeight, 300, 800),
    linkColor: color(rawTypography.linkColor, DEFAULT_FOOTER_CONFIG.typography.linkColor),
    bodyFontFamily: font(rawTypography.bodyFontFamily),
    bodySize: boundedInteger(rawTypography.bodySize, DEFAULT_FOOTER_CONFIG.typography.bodySize, 11, 22),
    bodyColor: color(rawTypography.bodyColor, DEFAULT_FOOTER_CONFIG.typography.bodyColor),
  }
  return {
    enabled: source.enabled !== false,
    typography,
    layoutColumns: boundedInteger(source.layoutColumns, DEFAULT_FOOTER_CONFIG.layoutColumns, 1, 5),
    showBrand: source.showBrand !== false,
    showLogo: source.showLogo !== false,
    showTagline: source.showTagline !== false,
    showSummary: source.showSummary === true,
    showSocial: source.showSocial !== false,
    showCopyright: source.showCopyright !== false,
    sections: sections.length ? sections : [],
  }
}

export function splitFooterColumns<T>(items: T[], columns: number): T[][] {
  const count = Math.max(1, Math.min(4, Math.round(columns || 1), items.length || 1))
  const baseSize = Math.floor(items.length / count)
  const remainder = items.length % count
  let cursor = 0
  return Array.from({ length: count }, (_, index) => {
    const size = baseSize + (index < remainder ? 1 : 0)
    const column = items.slice(cursor, cursor + size)
    cursor += size
    return column
  }).filter((column) => column.length > 0)
}
