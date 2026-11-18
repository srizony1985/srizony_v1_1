import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { SiteIdentity } from '@/types/site'

export type CmsSiteConfig = {
  id: number
  siteKey: string
  name: string
  primaryDomain: string | null
  baseUrl: string | null
  defaultLocale: string
  supportedLocales: string[]
  identity: Record<string, unknown>
  settings: Record<string, unknown>
  status: string
}

let activeSiteRequest: Promise<CmsSiteConfig> | null = null

function cleanObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return {} }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanLocales(value: unknown): string[] {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return ['en'] }
  }
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(item)) : ['en']
}

/**
 * Resolve the website attached to this CMS installation. A deployment normally
 * has one database per website; CMS_SITE_KEY provides a stable identifier while
 * CMS_SITE_NAME / CMS_SITE_URL / CMS_DEFAULT_LOCALE supply first-run values.
 * Editors can subsequently manage the same values in the CMS database.
 */
export async function getActiveCmsSite(): Promise<CmsSiteConfig> {
  if (!db) throw new Error('DATABASE_URL is not configured.')
  activeSiteRequest ??= (async () => {
    const siteKey = (process.env.CMS_SITE_KEY || 'default').trim().slice(0, 120) || 'default'
    const siteName = (process.env.CMS_SITE_NAME || '').trim()
    const baseUrl = (process.env.CMS_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '')
    let inferredDomain = ''
    if (baseUrl) { try { inferredDomain = new URL(baseUrl).hostname } catch { throw new Error('CMS_SITE_URL / NEXT_PUBLIC_SITE_URL must be a valid absolute URL.') } }
    const primaryDomain = (process.env.CMS_SITE_DOMAIN || inferredDomain).trim()
    const defaultLocale = (process.env.CMS_DEFAULT_LOCALE || 'en').trim()
    const supportedLocales = (process.env.CMS_SUPPORTED_LOCALES || defaultLocale).split(',').map((item) => item.trim()).filter(Boolean)

    // A fresh migration inserts a neutral `default` row at id=1. Rename that row
    // when a deployment supplies its own site key; its existing site_id references
    // remain stable and all later records keep the same identity.
    if (siteKey !== 'default') {
      await db.execute(sql`UPDATE cms_sites SET site_key = ${siteKey}, updated_at = now() WHERE id = 1 AND site_key = 'default' AND NOT EXISTS (SELECT 1 FROM cms_sites WHERE site_key = ${siteKey})`)
    }
    const result = await db.execute(sql`
      INSERT INTO cms_sites (site_key, name, primary_domain, base_url, default_locale, supported_locales)
      VALUES (${siteKey}, ${siteName}, ${primaryDomain || null}, ${baseUrl || null}, ${defaultLocale}, ${JSON.stringify(supportedLocales.length ? supportedLocales : [defaultLocale])}::jsonb)
      ON CONFLICT (site_key) DO UPDATE SET
        name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE cms_sites.name END,
        primary_domain = COALESCE(NULLIF(EXCLUDED.primary_domain, ''), cms_sites.primary_domain),
        base_url = COALESCE(NULLIF(EXCLUDED.base_url, ''), cms_sites.base_url),
        default_locale = COALESCE(NULLIF(EXCLUDED.default_locale, ''), cms_sites.default_locale),
        supported_locales = CASE WHEN EXCLUDED.supported_locales <> '["en"]'::jsonb THEN EXCLUDED.supported_locales ELSE cms_sites.supported_locales END,
        updated_at = now()
      RETURNING *
    `)
    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) throw new Error('Unable to resolve the active CMS site record.')
    return {
      id: Number(row.id), siteKey: String(row.site_key), name: String(row.name || ''),
      primaryDomain: row.primary_domain ? String(row.primary_domain) : null,
      baseUrl: row.base_url ? String(row.base_url) : null,
      defaultLocale: String(row.default_locale || 'en'), supportedLocales: cleanLocales(row.supported_locales),
      identity: cleanObject(row.identity), settings: cleanObject(row.settings), status: String(row.status || 'active'),
    }
  })().catch((error) => { activeSiteRequest = null; throw error })
  return activeSiteRequest
}

export async function updateActiveCmsSite(input: {
  name?: string
  primaryDomain?: string | null
  baseUrl?: string | null
  defaultLocale?: string
  supportedLocales?: string[]
  identity?: Record<string, unknown>
  settings?: Record<string, unknown>
}) {
  if (!db) throw new Error('DATABASE_URL is not configured.')
  const current = await getActiveCmsSite()
  const nextName = input.name?.trim().slice(0, 250) ?? current.name
  const nextDomain = input.primaryDomain === undefined ? current.primaryDomain : input.primaryDomain?.trim().slice(0, 255) || null
  const nextUrl = input.baseUrl === undefined ? current.baseUrl : input.baseUrl?.trim().replace(/\/$/, '') || null
  const nextLocale = input.defaultLocale?.trim().slice(0, 16) ?? current.defaultLocale
  const nextLocales = input.supportedLocales ?? current.supportedLocales
  const nextIdentity = input.identity ?? current.identity
  const nextSettings = input.settings ?? current.settings
  await db.execute(sql`
    UPDATE cms_sites SET name=${nextName}, primary_domain=${nextDomain}, base_url=${nextUrl},
      default_locale=${nextLocale}, supported_locales=${JSON.stringify(nextLocales)}::jsonb,
      identity=${JSON.stringify(nextIdentity)}::jsonb, settings=${JSON.stringify(nextSettings)}::jsonb,
      updated_at=now() WHERE id=${current.id}
  `)
  activeSiteRequest = null
  return getActiveCmsSite()
}

export async function getCmsRegistry() {
  if (!db) throw new Error('DATABASE_URL is not configured.')
  const site = await getActiveCmsSite()
  const [types, fields, pipelines] = await Promise.all([
    db.execute(sql`SELECT * FROM cms_content_type_definitions WHERE site_id=${site.id} AND enabled=true ORDER BY sort_order, component_key`),
    db.execute(sql`SELECT * FROM cms_content_field_definitions WHERE site_id=${site.id} ORDER BY component_key, sort_order, field_key`),
    db.execute(sql`SELECT * FROM cms_data_pipelines WHERE site_id=${site.id} AND enabled=true ORDER BY domain_key`),
  ])
  return { site, contentTypes: types.rows, fields: fields.rows, pipelines: pipelines.rows }
}


/** Resolve the public brand from CMS configuration, preventing one deployment's
 * fallback identity from leaking into a separately configured website. */
export function resolveCmsSiteIdentity(site: CmsSiteConfig, fallback: SiteIdentity): SiteIdentity {
  const source = site.identity
  const readString = (key: string, fallbackValue = '') => typeof source[key] === 'string' ? String(source[key]).trim() : fallbackValue
  const configured = site.siteKey !== 'default' || Boolean(site.name || site.baseUrl) || Object.keys(source).length > 0
  if (!configured) return fallback
  const siteName = site.name || readString('name', 'Website') || 'Website'
  const keywordsValue = source.keywords
  const keywords = Array.isArray(keywordsValue)
    ? keywordsValue.filter((value): value is string => typeof value === 'string')
    : typeof keywordsValue === 'string' ? keywordsValue.split(',').map((value) => value.trim()).filter(Boolean) : []
  return {
    ...source,
    name: readString('name', siteName) || siteName,
    alternateName: readString('alternateName', siteName) || siteName,
    canonicalUrl: site.baseUrl || readString('canonicalUrl'),
    title: readString('title', siteName) || siteName,
    description: readString('description'),
    keywords,
    foundingDate: readString('foundingDate'),
    logo: readString('logo'),
    ogImage: readString('ogImage'),
  } as SiteIdentity
}
