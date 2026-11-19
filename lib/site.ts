import type { DatabaseRow, ExternalRecord, ExternalValue, JsonObject, JsonValue } from '@/types/json'
import { sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { contentData, systemData, donationInfo, SDGsteps } from '@/lib/cms/fallback-gateway'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { applyThemeTypographySettings, normalizeThemeTypographySettings, THEME_TYPOGRAPHY_SETTING_KEY } from '@/lib/themeTypography'
import { DEFAULT_FOOTER_CONFIG, FOOTER_CONFIG_SETTING_KEY, normalizeFooterConfig } from '@/lib/footerConfig'
import { readDriveTableSnapshot } from '@/lib/google/drive-snapshot'
import { readCmsSettingValue } from '@/lib/cms/settings-store'
import type { Bilingual, HeroData, IconName, IllustrationName, NavGroup, NavItem, PageData } from '@/types/entityType'
import type { CmsPageIndexEntry, PublicGlobal, PublicSiteSnapshot } from '@/types/site'
import { CONTENT_COLLECTION_ROUTES, type ContentComponent } from '@/lib/cms/components'
import { canonicalizeCmsRoute, LEGACY_ROUTE_ALIASES } from '@/lib/cms/routes'
import { getPublishedFeed, getPublishedFieldNews, getPublishedContentDetailPage } from '@/lib/cms/content'
import { validatePageComponentLayers } from '@/lib/cms/component-policy'
import { supportsLocationMap } from '@/lib/cms/locationMap'
import { parseRenderedComponents } from '@/lib/cms/rendered-components'
import { ensureNavigationTypographySchema } from '@/lib/cms/ensureSchema'
import { normalizeCmsTypography } from '@/lib/cms/typography'
import { DEFAULT_JOB_APPLICATION_PROCESS, normalizeJobApplicationProcessConfig } from '@/lib/jobApplicationProcess'

export type CmsDocumentKey = 'site-global' | `page:${string}` | 'ui'

type CardsSection = Extract<PageData['sections'][number], { type: 'cards' }>
type CardSectionItem = CardsSection['items'][number]
type StatsSection = Extract<PageData['sections'][number], { type: 'stats' }>
type StatIcon = NonNullable<StatsSection['items'][number]['icon']>
type AvailableMenuNode = { label: Bilingual; href: string; menuType?: NavItem['menuType']; children?: AvailableMenuNode[] }
type AvailableMenuGroup = { key: string; label: Bilingual; items: AvailableMenuNode[] }

function asExternalRecord(value: unknown): ExternalRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value instanceof Date || value instanceof Uint8Array) return null
  return value as ExternalRecord
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function normalizeIllustration(value: unknown): IllustrationName | undefined {
  const allowed: IllustrationName[] = ['mission', 'vision', 'values', 'heart', 'book', 'users', 'coins', 'sprout', 'store', 'women-business', 'small-enterprise', 'agriculture', 'migrant-household', 'rural-development', 'career', 'education']
  return typeof value === 'string' && allowed.includes(value as IllustrationName) ? value as IllustrationName : undefined
}

const PROJECT_CONTENT_COMPONENTS: ContentComponent[] = ['project']

// Public navigation deliberately hides these legacy menu entries. The underlying
// content pages may remain available to CMS editors, but they must not appear in
// desktop/mobile navigation or footer links. Apply this to both bundled and DB menus.
const excludedNavigationPaths = new Set([
  '/executive-secretariat', '/executive-secratariat',
  '/senior-management',
  '/public-relation', '/public-relations', '/public-relations-office', '/public-relations-unit',
  '/social-enterprise',
])
const excludedNavigationLabels = new Set([
  'executive secretariat', 'senior management', 'public relation', 'public relations', 'social enterprise',
  'নির্বাহী সচিবালয়', 'নির্বাহী সচিবালয়', 'সিনিয়র ম্যানেজমেন্ট', 'সিনিয়র ম্যানেজমেন্ট',
  'জনসংযোগ', 'সামাজিক উদ্যোগ',
])
function normalizeNavigationLabel(value: unknown) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
}
function isExcludedNavigationEntry(item: NavItem) {
  const path = String(item.href || '/').split(/[?#]/, 1)[0].replace(/\/+$/, '').toLocaleLowerCase() || '/'
  const en = normalizeNavigationLabel(item.label?.en)
  const bn = normalizeNavigationLabel(item.label?.bn)
  return excludedNavigationPaths.has(path) || excludedNavigationLabels.has(en) || excludedNavigationLabels.has(bn)
}
function filterNavigationItems(items: NavItem[]): NavItem[] {
  return items
    .filter((item) => !isExcludedNavigationEntry(item))
    .map((item) => {
      if (!item.children?.length) return item
      const children = filterNavigationItems(item.children)
      return { ...item, children: children.length ? children : undefined }
    })
}
function filterNavigation(groups: NavGroup[], primary: NavItem[]) {
  return {
    primaryNav: filterNavigationItems(primary),
    navGroups: groups
      .filter((group) => !excludedNavigationLabels.has(normalizeNavigationLabel(group.label?.en))
        && !excludedNavigationLabels.has(normalizeNavigationLabel(group.label?.bn)))
      .map((group) => ({ ...group, items: filterNavigationItems(group.items) })),
  }
}

export function resolvePagePath(path: string) {
  return canonicalizeCmsRoute(path)
}

// During `next build` a production database may not have been seeded yet.
// Keep the build deterministic by using the bundled content only for build-time
// static generation. Runtime requests still require the CMS database unless
// CMS_STATIC_FALLBACK=true is explicitly enabled.
function isProductionBuild() { return process.env.NEXT_PHASE === 'phase-production-build' }


function jsonb(value: unknown) { return sql`${JSON.stringify(value ?? null)}::jsonb` }

/**
 * Read-only public-site failover. The Drive JSON mirror is not PostgreSQL and
 * must never receive CMS writes or transactional workloads.
 */

function uiRowsToDocument(rows: Array<Record<string, unknown>>): JsonObject {
  const en: Record<string, string> = {}
  const bn: Record<string, string> = {}
  for (const row of rows) {
    const key = String(row.key || '').trim()
    if (!key) continue
    en[key] = String(row.value_en ?? '')
    bn[key] = String(row.value_bn ?? '')
  }
  return { en, bn }
}

async function readDocumentsFromDrive(keys: string[], publishedOnly: boolean) {
  const result = new Map<string, JsonValue>()
  const [globalRows, pageRows, uiRows] = await Promise.all([
    keys.includes('site-global') ? readDriveTableSnapshot('site_global_state') : Promise.resolve(null),
    keys.some((key) => key.startsWith('page:')) ? readDriveTableSnapshot('pages') : Promise.resolve(null),
    keys.includes('ui') ? readDriveTableSnapshot('ui_content') : Promise.resolve(null),
  ])
  const global = globalRows?.find((row) => Number(row.id) === 1)
  if (global && keys.includes('site-global')) result.set('site-global', global.value)
  if (keys.includes('ui') && uiRows) result.set('ui', uiRowsToDocument(uiRows))
  if (pageRows) {
    const requested = new Set(keys.filter((key) => key.startsWith('page:')).map((key) => key.slice(5)))
    for (const row of pageRows) {
      const slug = String(row.slug || '')
      if (!requested.has(slug)) continue
      const status = String(row.status || 'published')
      const meta = { status, sortOrder: Number(row.sort_order || 0), updatedAt: String(row.updated_at || '') }
      if (publishedOnly && status !== 'published') {
        result.set(`page:${slug}`, { __cmsMeta: meta, __unpublished: true })
      } else if (row.render_cache && typeof row.render_cache === 'object') {
        result.set(`page:${slug}`, { ...(row.render_cache as JsonObject), __cmsMeta: meta })
      }
    }
  }
  return result
}

async function readDocumentsUncached(keys: string[], publishedOnly = false) {
  if (keys.length === 0 || isProductionBuild()) return new Map<string, JsonValue>()
  const database = db
  if (!database) return readDocumentsFromDrive(keys, publishedOnly)
  const result = new Map<string, JsonValue>()
  const globalRequested = keys.includes('site-global')
  const pageSlugs = keys.filter((key) => key.startsWith('page:')).map((key) => key.slice('page:'.length))
  try {
    if (globalRequested) {
      const global = await withDbRetry(() => database.execute(sql`SELECT value FROM site_global_state WHERE id = 1 LIMIT 1`))
      if (global.rows[0]) result.set('site-global', (global.rows[0] as JsonObject).value)
    }
    if (keys.includes('ui')) {
      const ui = await withDbRetry(() => database.execute(sql`SELECT key, value_en, value_bn FROM ui_content ORDER BY key`))
      result.set('ui', uiRowsToDocument(ui.rows as Array<Record<string, unknown>>))
    }
    if (pageSlugs.length) {
      const pages = await withDbRetry(() => database.execute(sql`
        SELECT slug, render_cache, status, sort_order, updated_at
        FROM pages
        WHERE slug IN (${sql.join(pageSlugs.map((slug) => sql`${slug}`), sql`, `)})
          ${publishedOnly ? sql`AND status = 'published'` : sql``}
      `))
      for (const row of pages.rows as DatabaseRow[]) {
        const status = String(row.status || 'published')
        const meta = {
          status,
          sortOrder: Number(row.sort_order || 0),
          updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ''),
        }
        if (publishedOnly && status !== 'published') {
          result.set(`page:${String(row.slug)}`, { __cmsMeta: meta, __unpublished: true })
          continue
        }
        if (row.render_cache && typeof row.render_cache === 'object') {
          result.set(`page:${String(row.slug)}`, { ...(row.render_cache as JsonObject), __cmsMeta: meta })
        }
      }
    }
    return result
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error
    console.error('[site-failover] Transient Neon page read failure; attempting a read-only Google Drive mirror.', error)
    const mirror = await readDocumentsFromDrive(keys, publishedOnly)
    if (mirror.size) return mirror
    throw error
  }
}

async function readDocuments(keys: string[], publishedOnly = false) {
  return readDocumentsUncached(keys, publishedOnly)
}

async function readPublicDocumentsCached(slug: string) {
  // The homepage reuses the canonical enterprise cards and field-news carousel
  // from their own pages, so load those page snapshots alongside the homepage.
  const keys = [`site-global`, `page:${slug}`, 'ui']
  if (slug === '/') keys.push('page:/enterprise-development', 'page:/social-development')
  const map = await readDocuments(keys, true)
  return Object.fromEntries(map.entries())
}

const cachedPublicDocuments = unstable_cache(
  async (slug: string) => readPublicDocumentsCached(slug),
  ['srizony-public-site-v3-home-references'],
  { revalidate: 60, tags: ['site-content', 'job-application-process'] },
)

// Keep the navigation API lightweight: it needs only the menu tree plus the
// small global UI-label document, not the full homepage/page/content snapshot.
const cachedPublicGlobalDocument = unstable_cache(
  async () => {
    const documents = await readDocuments(['site-global', 'ui'], true)
    return { global: documents.get('site-global') ?? null, ui: documents.get('ui') ?? null }
  },
  ['srizony-public-global-document-v1'],
  { revalidate: 60, tags: ['site-content', 'job-application-process'] },
)

async function getCmsNavigationUncached(): Promise<{ primaryNav: NavItem[]; navGroups: NavGroup[] }> {
  const database = db
  if (isProductionBuild()) return filterNavigation(systemData.navGroups, systemData.primaryNav)
  type Row = ExternalRecord
  let rows: Row[]
  const readNavigationFromDrive = async () => {
    const [navRows, pageRows] = await Promise.all([readDriveTableSnapshot('nav_items'), readDriveTableSnapshot('pages')])
    if (!navRows) return null
    const pagesBySlug = new Map((pageRows || []).map((page) => [String(page.slug), String(page.status || 'published')]))
    return navRows.map((row) => ({
      item_id: row.id, parent_id: row.parent_id, label_en: row.label_en, label_bn: row.label_bn,
      href: row.href, featured: row.featured, sort_order: row.sort_order, menu_type: row.menu_type,
      content_types: row.content_types, is_visible: row.is_visible, typography: row.typography,
      page_status: pagesBySlug.get(String(row.href)) || 'published',
    })) as Row[]
  }
  if (!database) {
    const fallbackRows = await readNavigationFromDrive()
    if (!fallbackRows) {
      if (process.env.CMS_STATIC_FALLBACK === 'true') return filterNavigation(systemData.navGroups, systemData.primaryNav)
      throw new Error('Neither Neon nor a recent Google Drive navigation snapshot is available.')
    }
    rows = fallbackRows
    console.error('[site-failover] Neon is not configured; serving read-only Google Drive navigation mirror.')
  } else {
    try {
      // Migration 0021 adds this optional display column. Repair it before the
      // query so an older deployed Neon schema cannot crash the public layout.
      await ensureNavigationTypographySchema()
      const result = await withDbRetry(() => database.execute(sql`
        SELECT i.id AS item_id, i.parent_id, i.label_en, i.label_bn, i.href, i.featured, i.sort_order,
               i.menu_type, i.content_types, i.is_visible, i.typography, p.status AS page_status
        FROM nav_groups g
        LEFT JOIN nav_items i ON i.group_id = g.id
        LEFT JOIN pages p ON i.menu_type = 'page' AND p.slug = i.href
        WHERE g.key = 'primary'
        ORDER BY i.parent_id NULLS FIRST, i.sort_order ASC, i.id ASC
      `))
      rows = result.rows as Row[]
    } catch (error) {
      if (!isTransientDatabaseError(error)) throw error
      const fallbackRows = await readNavigationFromDrive()
      if (!fallbackRows) throw error
      rows = fallbackRows
      console.error('[site-failover] Transient Neon failure; serving read-only Google Drive navigation mirror.')
    }
  }
  const items = rows.filter((row) => row.item_id != null)
  const buildItems = (parentId: number | null): NavItem[] => items
    .filter((row) => row.parent_id == null ? parentId === null : Number(row.parent_id) === parentId)
    .filter((row) => row.is_visible !== false && (row.menu_type === 'folder' || row.menu_type === 'external' || row.page_status === 'published'))
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.item_id) - Number(b.item_id))
    .map((row) => {
      const id = Number(row.item_id)
      const menuType = row.menu_type === 'folder' ? 'folder' as const : row.menu_type === 'external' ? 'external' as const : 'page' as const
      const children = buildItems(id)
      // Normalize legacy JSONB objects/strings the same way as the admin API.
      // Invalid or legacy collection names intentionally fall back to all types.
      const renderedComponents = parseRenderedComponents(row.content_types)
      return {
        label: { en: String(row.label_en), bn: String(row.label_bn || '') },
        href: menuType === 'folder' ? '' : menuType === 'external' ? String(row.href) : resolvePagePath(String(row.href)),
        featured: Boolean(row.featured), menuType, renderedComponents,
        typography: normalizeCmsTypography(row.typography),
        children: children.length ? children : undefined,
      }
    })
  const rawPrimaryNav = buildItems(null)
  const { primaryNav } = filterNavigation([], rawPrimaryNav)
  if (!primaryNav.length) throw new Error('CMS navigation is empty. Run npm run db:migrate and npm run db:seed to install the single navigation tree.')
  return { primaryNav, navGroups: [] }
}

// The navigation query is shared by page rendering and the small navigation
// endpoint. Cache it independently so nav refreshes never repeat a large page
// snapshot query, while CMS mutations invalidate this tag immediately.
const cachedCmsNavigation = unstable_cache(
  async () => getCmsNavigationUncached(),
  ['srizony-cms-navigation-v2'],
  { revalidate: 60, tags: ['site-navigation', 'site-content'] },
)

async function getCmsNavigation() {
  return cachedCmsNavigation()
}

/**
 * Minimal public navigation payload. Avoids hydrating a full page snapshot,
 * content collections, donation metadata, footer settings, and theme config
 * for a request that only needs navigation and its translated UI labels.
 */
export async function getPublicNavigationSnapshot() {
  const [navigation, globalDocument] = await Promise.all([
    getCmsNavigation(),
    process.env.CMS_STATIC_FALLBACK === 'true' || isProductionBuild()
      ? Promise.resolve(null)
      : cachedPublicGlobalDocument(),
  ])
  const globalValue = asExternalRecord(globalDocument?.global)
  const overrideUi = asExternalRecord(globalValue?.ui) ?? {}
  const overrideUiEn = asExternalRecord(overrideUi.en) ?? {}
  const overrideUiBn = asExternalRecord(overrideUi.bn) ?? {}
  const uiDocument = asExternalRecord(globalDocument?.ui) ?? {}
  const uiDocumentEn = asExternalRecord(uiDocument.en) ?? {}
  const uiDocumentBn = asExternalRecord(uiDocument.bn) ?? {}
  return {
    ...navigation,
    ui: {
      ...systemData.ui,
      ...overrideUi,
      en: { ...systemData.ui.en, ...overrideUiEn, ...uiDocumentEn },
      bn: { ...systemData.ui.bn, ...overrideUiBn, ...uiDocumentBn },
    },
  }
}

async function savePage(database: NonNullable<typeof db>, slug: string, value: ExternalValue, actorEmail?: string, expectedUpdatedAt?: string) {
  const data = (value || {}) as Partial<PageData>
  const layerIssue = validatePageComponentLayers(slug, data.sections ?? [])
  if (layerIssue) throw new Error(layerIssue)
  // The root route is the landing page, not an ordinary navigation page. Keep it published at all times.
  const status = slug === '/' ? 'published' : data.status && ['draft', 'published', 'archived'].includes(data.status) ? data.status : 'published'
  const sortOrder = Number.isInteger(data.sortOrder) && Number(data.sortOrder) >= 0 ? Number(data.sortOrder) : 0
  const titleEn = data.title?.en || slug
  const titleBn = data.title?.bn || titleEn
  const subtitleEn = data.subtitle?.en || null
  const subtitleBn = data.subtitle?.bn || null
  // Hero colours are part of the fixed brand system; old imported tone overrides are ignored.
  const heroTone = null
  const metaDescriptionEn = data.metaDescription?.en || null
  const metaDescriptionBn = data.metaDescription?.bn || null
  const rawValue = asExternalRecord(value) ?? {}
  const markedProjectsSectionIndex = slug === '/projects' ? (data.sections ?? []).findIndex((section) => isProjectsCollectionSection(section)) : -1
  const projectsSectionIndex = slug === '/projects'
    ? markedProjectsSectionIndex >= 0 ? markedProjectsSectionIndex : (data.sections ?? []).findIndex((section) => isProjectCollectionPresentation(section))
    : -1
  const normalizedSections = Array.isArray(data.sections) ? data.sections.map((rawSection, index) => {
    if (!rawSection || typeof rawSection !== 'object') return rawSection
    const section = asExternalRecord(rawSection) ?? {}
    const sectionId = typeof section.sectionId === 'string' && section.sectionId.trim() ? section.sectionId : `section-${slug.replace(/[^a-z0-9]+/gi, '-')}-${index + 1}`
    const allContentTypes = ['project', 'news', 'enterprise', 'partner-agency', 'health-service', 'loan-product', 'product', 'team', 'notice', 'report', 'job', 'success-story', 'stat']
    const rawComponents = Array.isArray(section.components) ? section.components : []
    const storedCollection = asExternalRecord(section.contentCollection) ?? null
    const selectedComponent = storedCollection?.component ?? rawComponents.find((item) => typeof item === 'string' && allContentTypes.includes(item)) ?? 'project'
    const component = allContentTypes.includes(String(selectedComponent)) ? String(selectedComponent) : 'project'
    const headingRecord = asExternalRecord(section.heading) ?? {}
    const sectionHeading = `${readString(headingRecord.en)} ${readString(headingRecord.bn)}`.trim().toLowerCase()
    const isCanonicalProjectsCollection = slug === '/projects' && (
      index === projectsSectionIndex
      || section.collectionKind === 'projects'
      || storedCollection?.component === 'project'
      || rawComponents.includes('project')
      || (section.dataSource !== 'manual' && /projects?|প্রকল্প/.test(sectionHeading)
        && ['cards', 'carousel', 'contentFeed', 'gallery'].includes(String(section.type)))
    )
    const allowedLayouts: Record<string, string[]> = {
      cards: ['grid', 'carousel', 'masonry', 'list'], contentFeed: ['grid', 'carousel', 'masonry', 'list'],
      carousel: ['carousel', 'grid', 'list'], gallery: ['grid', 'masonry'], stats: ['grid', 'list'],
    }
    const sectionType = readString(section.type)
    const sectionLayouts = allowedLayouts[sectionType] || ['list']
    const requestedLayout = String(storedCollection?.layout || (section.type === 'carousel' ? 'carousel' : section.type === 'gallery' ? 'grid' : section.type === 'stats' || section.type === 'cards' || section.type === 'contentFeed' ? 'grid' : 'list'))
    const layout = sectionLayouts.includes(requestedLayout) ? requestedLayout : sectionLayouts[0]
    // A contentFeed is intrinsically a collection. Older CMS pages that predate
    // contentCollection are upgraded to an enabled collection using their saved type.
    const shouldNormalizeCollection = Boolean(storedCollection) || section.type === 'contentFeed' || isCanonicalProjectsCollection
    const contentCollection = shouldNormalizeCollection ? {
      enabled: isCanonicalProjectsCollection ? true : section.type === 'contentFeed' ? storedCollection?.enabled !== false : storedCollection?.enabled === true,
      component: isCanonicalProjectsCollection ? 'project' : component,
      maxItems: section.type === 'cta' || section.type === 'donation' ? 1 : Math.max(1, Math.min(100, Number(storedCollection?.maxItems) || 12)),
      layout,
      columns: [2, 3, 4].includes(Number(storedCollection?.columns)) ? Number(storedCollection?.columns) : Number(section.columns) && [2, 3, 4].includes(Number(section.columns)) ? Number(section.columns) : 3,
      gap: Math.max(0, Math.min(64, Number.isFinite(Number(storedCollection?.gap)) ? Number(storedCollection?.gap) : 24)),
      viewportItems: Math.max(1, Math.min(12, Number(storedCollection?.viewportItems) || 3)),
      showSearch: storedCollection?.showSearch !== false,
      showCategoryFilter: storedCollection?.showCategoryFilter !== false,
      showYearFilter: storedCollection?.showYearFilter !== false,
    } : undefined
    return {
      ...section,
      sectionId,
      ...(section.type === 'contentFeed' ? { components: [component] } : {}),
      ...(contentCollection ? { contentCollection } : {}),
      // Project cards are a live CMS catalogue. The admin editor may receive a
      // hydrated preview, but the page snapshot must never duplicate those records.
      ...(slug === '/projects' && isCanonicalProjectsCollection ? { items: [] } : {}),
    }
  }) : data.sections
  const storedValue = { ...rawValue, ...(normalizedSections ? { sections: normalizedSections } : {}), slug, showContactMap: supportsLocationMap(slug) && data.showContactMap === true, status, sortOrder }
  if (expectedUpdatedAt) {
    const current = await withDbRetry(() => database.execute(sql`SELECT updated_at FROM pages WHERE slug = ${slug} LIMIT 1`))
    const currentUpdatedAt = current.rows[0] && String((current.rows[0] as JsonObject).updated_at || '')
    if (!currentUpdatedAt || new Date(currentUpdatedAt).getTime() !== new Date(expectedUpdatedAt).getTime()) throw new Error('CMS_CONFLICT')
  }

  await withDbRetry(() => database.execute(sql`
    WITH existing AS (
      SELECT id, render_cache
      FROM pages
      WHERE slug = ${slug}
      FOR UPDATE
    ), revision AS (
      INSERT INTO page_revisions (page_id, version, content, created_by)
      SELECT existing.id, COALESCE((SELECT MAX(version) FROM page_revisions WHERE page_id = existing.id), 0) + 1, existing.render_cache, ${actorEmail || null}
      FROM existing
      WHERE existing.render_cache IS NOT NULL
    ), upserted AS (
      INSERT INTO pages (
        slug, title_en, title_bn, subtitle_en, subtitle_bn,
        hero_tone, meta_description_en, meta_description_bn,
        render_cache, status, sort_order, updated_at
      ) VALUES (
        ${slug}, ${titleEn}, ${titleBn}, ${subtitleEn}, ${subtitleBn},
        ${heroTone}, ${metaDescriptionEn}, ${metaDescriptionBn},
        ${jsonb(storedValue)}, ${status}, ${sortOrder}, now()
      )
      ON CONFLICT (slug) DO UPDATE SET
        title_en = EXCLUDED.title_en, title_bn = EXCLUDED.title_bn,
        subtitle_en = EXCLUDED.subtitle_en, subtitle_bn = EXCLUDED.subtitle_bn,
        hero_tone = EXCLUDED.hero_tone, meta_description_en = EXCLUDED.meta_description_en,
        meta_description_bn = EXCLUDED.meta_description_bn, render_cache = EXCLUDED.render_cache,
        status = EXCLUDED.status, sort_order = EXCLUDED.sort_order, updated_at = now()
      RETURNING id
    )
    SELECT id FROM upserted
  `))
}

export async function saveDocument(key: string, value: ExternalValue, type: string, actorEmail?: string, expectedUpdatedAt?: string) {
  const database = db
  if (!database) throw new Error('DATABASE_URL is not configured')
  if (key === 'site-global') {
    if (expectedUpdatedAt) {
      const current = await withDbRetry(() => database.execute(sql`SELECT updated_at FROM site_global_state WHERE id = 1 LIMIT 1`))
      const currentUpdatedAt = current.rows[0] && String((current.rows[0] as JsonObject).updated_at || '')
      if (!currentUpdatedAt || new Date(currentUpdatedAt).getTime() !== new Date(expectedUpdatedAt).getTime()) throw new Error('CMS_CONFLICT')
    }
    await withDbRetry(() => database.execute(sql`
      INSERT INTO site_global_state (id, value, updated_at) VALUES (1, ${jsonb(value)}, now())
      ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `))
    revalidatePath('/', 'layout')
    revalidateTag('site-content', { expire: 0 })
    return
  }
  if (key.startsWith('page:')) {
    const slug = resolvePagePath(key.slice('page:'.length))
    await savePage(database, slug, value, actorEmail, expectedUpdatedAt)
    revalidatePath(slug === '/' ? '/' : slug)
    revalidatePath(slug === '/' ? '/bn' : `/bn${slug}`)
    revalidateTag('site-content', { expire: 0 })
    return
  }
  throw new Error(`Unsupported CMS document type: ${type}`)
}

export async function syncCmsMenuContent() {
  const database = db
  if (!database) return
  for (const page of Object.values(contentData.allPages)) await savePage(database, page.slug, page)
}

export async function deleteDocument(key: string) {
  const database = db
  if (!database) throw new Error('DATABASE_URL is not configured')
  if (key === 'site-global') {
    await withDbRetry(() => database.execute(sql`DELETE FROM site_global_state WHERE id = 1`))
    return
  }
  if (key.startsWith('page:')) {
    const requestedSlug = key.slice('page:'.length)
    const canonicalSlug = resolvePagePath(requestedSlug)
    const aliases = Object.keys(LEGACY_ROUTE_ALIASES).filter((alias) => resolvePagePath(alias) === canonicalSlug)
    const candidates = Array.from(new Set([requestedSlug, canonicalSlug, ...aliases]))
    await withDbRetry(() => database.execute(sql`DELETE FROM pages WHERE slug IN (${sql.join(candidates.map((slug) => sql`${slug}`), sql`, `)})`))
    revalidatePath(canonicalSlug === '/' ? '/' : canonicalSlug)
    revalidateTag('site-content', { expire: 0 })
    return
  }
  throw new Error('Unsupported CMS document key.')
}

function normalizeGlobal(value: ExternalValue): PublicGlobal | null {
  const record = asExternalRecord(value)
  if (!record) return null

  // Global settings are edited independently over time, so older/partial JSONB
  // snapshots must be merged into the complete typed fallback instead of being
  // treated as a fully populated PublicGlobal object.
  const fallback = getFallbackGlobal()
  const identity = asExternalRecord(record.siteIdentity) ?? {}
  const images = asExternalRecord(record.images) ?? {}
  const media = asExternalRecord(record.media) ?? {}
  const contactInfo = asExternalRecord(record.contactInfo) ?? {}
  const ui = asExternalRecord(record.ui) ?? {}
  const uiEn = asExternalRecord(ui.en) ?? {}
  const uiBn = asExternalRecord(ui.bn) ?? {}
  const keywords = Array.isArray(identity.keywords)
    ? identity.keywords.filter((item): item is string => typeof item === 'string')
    : fallback.siteIdentity.keywords

  return {
    ...fallback,
    ...record,
    siteIdentity: { ...fallback.siteIdentity, ...identity, keywords },
    images: { ...fallback.images, ...images },
    media: { ...fallback.media, ...media },
    contactInfo: { ...fallback.contactInfo, ...contactInfo } as PublicGlobal['contactInfo'],
    ui: {
      ...fallback.ui,
      ...ui,
      en: { ...fallback.ui.en, ...uiEn },
      bn: { ...fallback.ui.bn, ...uiBn },
    } as PublicGlobal['ui'],
  } as unknown as PublicGlobal
}

async function getDatabaseSdgSteps() {
  if (!db) return []
  try {
    const result = await withDbRetry(() => db!.execute(sql`SELECT id, number_value, en, bn, en_text, bn_text FROM sdg_steps ORDER BY sort_order ASC, id ASC`))
    return (result.rows as DatabaseRow[]).map((row) => ({
      n: String(row.number_value ?? row.id),
      en: String(row.en ?? ''),
      bn: String(row.bn ?? row.en ?? ''),
      enText: String(row.en_text ?? ''),
      bnText: String(row.bn_text ?? row.en_text ?? ''),
    }))
  } catch (error) {
    console.error('Could not load SDG content from PostgreSQL', error)
    return []
  }
}

function portfolioBilingual(value: ExternalValue): { en: string; bn: string } {
  if (typeof value === 'string') return { en: value.trim(), bn: value.trim() }
  if (!value || typeof value !== 'object') return { en: '', bn: '' }
  const record = asExternalRecord(value)
  const en = typeof record?.en === 'string' ? record.en.trim() : ''
  const bn = typeof record?.bn === 'string' ? record.bn.trim() : ''
  return { en: en || bn, bn: bn || en }
}

function hasPortfolioCopy(value: ExternalValue) {
  const valueBi = portfolioBilingual(value)
  return Boolean(valueBi.en || valueBi.bn)
}

function portfolioPeopleItems(value: ExternalValue): CardSectionItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((personValue: ExternalValue) => {
    const person = asExternalRecord(personValue)
    if (!person) return []
    const title = portfolioBilingual(person.name ?? person.title ?? person.label)
    const role = portfolioBilingual(person.role ?? person.designation ?? person.position)
    const bio = portfolioBilingual(person.bio ?? person.description ?? person.summary)
    const combinedTitle = {
      en: [title.en, role.en && role.en !== title.en ? role.en : ''].filter(Boolean).join(' — '),
      bn: [title.bn, role.bn && role.bn !== title.bn ? role.bn : ''].filter(Boolean).join(' — '),
    }
    const imageSrc = readString(person.image) || readString(person.photo)
    return [{
      title: combinedTitle,
      body: bio.en || bio.bn ? bio : undefined,
      image: imageSrc ? { src: imageSrc, alt: title } : undefined,
      href: typeof person.href === 'string' ? person.href : undefined,
      tag: role.en || role.bn ? role : undefined,
      icon: 'users' as const,
    }]
  }).filter((item) => item.title.en || item.title.bn)
}

function applyPortfolioToPage(page: PageData, global: Pick<PublicGlobal, 'portfolio' | 'contactInfo'>): PageData {
  const portfolio = asExternalRecord(global.portfolio) ?? {}
  const contact = asExternalRecord(global.contactInfo) ?? {}
  const slug = page.slug || ''
  let sections = [...(page.sections || [])]
  const about = portfolioBilingual(portfolio.about)
  const mission = portfolioBilingual(portfolio.mission)
  const vision = portfolioBilingual(portfolio.vision)
  const values: ExternalValue[] = Array.isArray(portfolio.values) ? portfolio.values : []
  const mvvItems: CardSectionItem[] = []
  if (hasPortfolioCopy(portfolio.mission)) mvvItems.push({ title: { en: 'Mission', bn: 'মিশন' }, body: mission, icon: 'heart', illustration: 'mission' })
  if (hasPortfolioCopy(portfolio.vision)) mvvItems.push({ title: { en: 'Vision', bn: 'দৃষ্টিভঙ্গি' }, body: vision, icon: 'leaf', illustration: 'vision' })
  for (const value of values) {
    const record = asExternalRecord(value)
    if (!record) continue
    const title = portfolioBilingual(record.title ?? record.name)
    const body = portfolioBilingual(record.description ?? record.body)
    if (title.en || title.bn) mvvItems.push({ title, body: body.en || body.bn ? body : undefined, icon: 'users', illustration: normalizeIllustration(record.illustration) || 'values' })
  }
  const mvvHeading = { en: 'Mission, Vision & Values', bn: 'মিশন, ভিশন ও মূল্যবোধ' }
  const isMvvSection = (section: PageData['sections'][number]): section is CardsSection => section.type === 'cards' && (
    section.homeComponent === 'missionVisionValues' || /mission|vision|goal|value/i.test(section.heading?.en || '')
  )
  const mergeMvvArtwork = (items: CardSectionItem[], savedSection?: CardsSection): CardSectionItem[] => {
    const savedItems = savedSection?.items ?? []
    const normalize = (value: ExternalValue) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, ' ')
    return items.map((item, index) => {
      const wanted = normalize(item.title.en || item.title.bn)
      const saved = savedItems.find((candidate) => normalize(candidate.title.en || candidate.title.bn) === wanted) || savedItems[index]
      // Portfolio owns the text, while the page builder owns the visual selection.
      // Preserve per-card illustration and uploaded artwork across portfolio refreshes.
      return {
        ...item,
        illustration: saved?.illustration || item.illustration,
        image: saved?.image?.src ? saved.image : item.image,
        icon: saved?.icon || item.icon,
        chips: saved?.chips || item.chips,
      }
    })
  }
  const withMvv = (section: CardsSection): CardsSection => {
    const mergedItems = [...(section.items || [])]
    const semanticKey = (title: ExternalValue) => {
      const value = String(title ?? '').trim().toLocaleLowerCase()
      if (value.includes('mission') || value.includes('মিশন')) return 'mission'
      if (value.includes('vision') || value.includes('ভিশন') || value.includes('দৃষ্টিভঙ্গি')) return 'vision'
      if (value.includes('values') || value.includes('value') || value.includes('মূল্যবোধ')) return 'values'
      return ''
    }
    for (const incoming of mvvItems) {
      const incomingTitle = incoming.title.en || incoming.title.bn
      const key = semanticKey(incomingTitle)
      const existingIndex = mergedItems.findIndex((candidate) => {
        const candidateKey = semanticKey(candidate.title.en || candidate.title.bn)
        return key ? candidateKey === key : normalizeLandingHeading(candidate.title.en || candidate.title.bn) === normalizeLandingHeading(incomingTitle)
      })
      if (existingIndex >= 0) {
        const existing = mergedItems[existingIndex]
        mergedItems[existingIndex] = {
          ...existing,
          ...incoming,
          body: incoming.body ?? existing.body,
          image: incoming.image ?? existing.image,
          illustration: existing.illustration || incoming.illustration,
          icon: existing.icon || incoming.icon,
        }
      } else {
        mergedItems.push(incoming)
      }
    }
    return {
      ...section,
      homeComponent: section.homeComponent || (slug === '/' ? 'missionVisionValues' : undefined),
      heading: hasPortfolioCopy(section.heading) ? section.heading : mvvHeading,
      items: mergeMvvArtwork(mergedItems, section),
      columns: section.columns || 3,
      // Visibility is an explicit Page Builder setting. Empty portfolio fields must
      // never hide a healthy fallback section.
      visible: section.visible !== false,
    }
  }

  // About copy and Mission/Vision/Values are independent portfolio domains. Editing
  // one must not gate or prevent the other from updating public pages.
  if (slug === '/about-us' && hasPortfolioCopy(portfolio.about)) {
    let applied = false
    sections = sections.map((section) => {
      if (!applied && section.type === 'richText') {
        applied = true
        const biParagraphs: Array<{ en: string; bn: string }> = []
        const enParts = about.en.split(/\n\s*\n/).map((part: string) => part.trim()).filter(Boolean)
        const bnParts = about.bn.split(/\n\s*\n/).map((part: string) => part.trim()).filter(Boolean)
        const count = Math.max(enParts.length, bnParts.length)
        for (let i = 0; i < count; i++) biParagraphs.push({ en: enParts[i] || bnParts[i] || '', bn: bnParts[i] || enParts[i] || '' })
        return { ...section, body: biParagraphs.length ? biParagraphs : section.body }
      }
      return section
    })
  }

  if (mvvItems.length > 0) {
    let replacedMvv = false
    sections = sections.map((section) => {
      if (!replacedMvv && isMvvSection(section)) {
        replacedMvv = true
        return withMvv(section)
      }
      return section
    })
    // Portfolio fields may populate an existing Mission/Vision section, but they
    // must not recreate a homepage section removed in Page Builder. On regular
    // organizational pages, retain the convenience of adding the portfolio block.
    if (!replacedMvv && mvvItems.length && (slug === '/about-us' || slug === '/mission-vision' || slug === '/mission-and-vision')) {
      const section = withMvv({ type: 'cards', heading: mvvHeading, columns: 3, items: [] })
      const afterIntro = sections.findIndex((item) => item.type === 'richText')
      sections.splice(afterIntro >= 0 ? afterIntro + 1 : 0, 0, section)
    }
    // Empty or partially configured portfolio fields do not suppress the homepage
    // section; the Page Builder visibility switch remains the explicit hide control.
  }

  if ((slug === '/mission-vision' || slug === '/mission-and-vision') && mvvItems.length && !sections.some(isMvvSection)) {
    sections = [{ type: 'cards', heading: mvvHeading, columns: 3, items: mvvItems }, ...sections.filter((section) => section.type !== 'cards')]
  }

  if (slug === '/governing-body' && Array.isArray(portfolio.governingBody) && portfolio.governingBody.length) {
    const items = portfolioPeopleItems(portfolio.governingBody)
    sections = sections.map((section) => section.type === 'cards' && /governing body|member/i.test(section.heading?.en || '') ? { ...section, items } : section)
  }
  if (slug === '/executive-committee' && Array.isArray(portfolio.executiveCommittee) && portfolio.executiveCommittee.length) {
    const items = portfolioPeopleItems(portfolio.executiveCommittee)
    const matching = sections.findIndex((section) => section.type === 'cards')
    if (matching >= 0 && sections[matching].type === 'cards') sections[matching] = { ...sections[matching], heading: { en: 'Executive Committee Members', bn: 'নির্বাহী কমিটির সদস্যবৃন্দ' }, items }
    else sections.push({ type: 'cards', heading: { en: 'Executive Committee Members', bn: 'নির্বাহী কমিটির সদস্যবৃন্দ' }, columns: 3, items })
  }
  if (slug === '/senior-management' && Array.isArray(portfolio.seniorManagement) && portfolio.seniorManagement.length) {
    const items = portfolioPeopleItems(portfolio.seniorManagement)
    const matching = sections.findIndex((section) => section.type === 'cards')
    if (matching >= 0 && sections[matching].type === 'cards') sections[matching] = { ...sections[matching], items }
  }
  if (['/teams', '/team', '/our-team', '/our-people'].includes(slug) && Array.isArray(portfolio.teams) && portfolio.teams.length) {
    const items = portfolioPeopleItems(portfolio.teams)
    const matching = sections.findIndex((section) => section.type === 'cards')
    if (matching >= 0 && sections[matching].type === 'cards') sections[matching] = { ...sections[matching], items }
  }

  // Shared contact data is the source of truth for every rendered contact section.
  if (Object.keys(contact).some((key) => ['address', 'primaryPhone', 'email', 'footprint'].includes(key))) {
    sections = sections.map((section) => {
      if (section.type !== 'contact') return section
      const footprint = Array.isArray(contact.footprint) ? contact.footprint.flatMap((locValue: ExternalValue) => {
        const loc = asExternalRecord(locValue)
        if (!loc) return []
        const name = portfolioBilingual(loc.name)
        const address = portfolioBilingual(loc.address)
        const mapQuery = readString(loc.mapQuery) || address.en || name.en
        const kind: 'site' | 'branch' | 'footprint' = loc.kind === 'site' ? 'site' : loc.kind === 'branch' ? 'branch' : 'footprint'
        return [{
          name,
          address,
          mapQuery,
          phone: readString(loc.phone) || undefined,
          email: readString(loc.email) || undefined,
          kind,
        }]
      }) : section.locations
      const phones = Array.isArray(contact.phones) ? contact.phones.filter((phone): phone is string => typeof phone === 'string') : []
      const primaryPhone = readString(contact.primaryPhone)
      const email = readString(contact.email)
      return {
        ...section,
        address: hasPortfolioCopy(contact.address) ? portfolioBilingual(contact.address) : section.address,
        phones: phones.length ? phones : primaryPhone ? [primaryPhone] : section.phones,
        emails: email ? [email] : section.emails,
        locations: footprint,
      }
    })
  }

  return { ...page, sections }
}

function isProjectCollectionPresentation(section: PageData['sections'][number]) {
  const dataSource = section.type === 'cards' || section.type === 'carousel' ? section.dataSource : undefined
  return ['cards', 'carousel', 'gallery', 'contentFeed'].includes(section.type)
    && dataSource !== 'manual'
    && !['news', 'stories', 'newsFeed', 'successStories'].includes(String(section.homeComponent || ''))
}

function projectsCollectionSectionIndex(sections: PageData['sections']) {
  const marked = sections.findIndex((section) => isProjectsCollectionSection(section))
  return marked >= 0 ? marked : sections.findIndex((section) => isProjectCollectionPresentation(section))
}

function normalizeCardIcon(value: string | undefined): CardSectionItem['icon'] | undefined {
  const icons: NonNullable<CardSectionItem['icon']>[] = [
    'heart', 'leaf', 'book', 'scale', 'users', 'sun', 'droplets', 'briefcase', 'coins',
    'building', 'megaphone', 'shield', 'play', 'arrow', 'check', 'sprout', 'store',
  ]
  return value && icons.includes(value as (typeof icons)[number]) ? value as (typeof icons)[number] : undefined
}

function normalizeStatIcon(value: string | undefined): StatIcon | undefined {
  const icons: StatIcon[] = ['heart', 'leaf', 'book', 'scale', 'users', 'sun', 'droplets', 'briefcase', 'coins', 'building', 'megaphone', 'shield', 'play', 'arrow', 'check', 'home']
  return value && icons.includes(value as StatIcon) ? value as StatIcon : undefined
}

function hydrateSectionFromCollection(
  section: PageData['sections'][number],
  entries: Awaited<ReturnType<typeof getPublishedFeed>>,
  config: NonNullable<PageData['sections'][number]['contentCollection']>,
): PageData['sections'][number] {
  const items = entries.map((entry) => ({
    title: entry.title,
    body: entry.summary,
    ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
    href: entry.href || `${entry.slug}`,
    tag: entry.category,
  }))
  switch (section.type) {
    case 'cards':
      return {
        ...section,
        columns: config.columns || section.columns || 3,
        items: entries.map((entry) => ({
          title: entry.title,
          body: entry.summary,
          ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
          href: entry.href || entry.slug,
          tag: entry.category,
          ...(normalizeCardIcon(entry.icon) ? { icon: normalizeCardIcon(entry.icon) } : {}),
          ...(normalizeIllustration(entry.illustration) ? { illustration: normalizeIllustration(entry.illustration) } : {}),
        })),
      }
    case 'carousel':
      return { ...section, presentation: config.layout === 'carousel' ? 'scroller' : section.presentation || 'collection', maxItems: config.maxItems, items: items.map((item) => ({ ...item, tag: item.tag || { en: '', bn: '' } })) }
    case 'gallery':
      return { ...section, columns: config.columns || section.columns || 3, items: entries.filter((entry) => entry.image).map((entry) => ({ src: entry.image!, alt: entry.title, caption: entry.title })) }
    case 'noticeList':
      return { ...section, items: entries.map((entry) => ({ date: entry.date, title: entry.title, body: entry.summary, href: entry.href })) }
    case 'timeline':
      return { ...section, items: entries.map((entry) => ({ year: String(entry.date || '').slice(0, 4) || '—', title: entry.title, body: entry.summary })) }
    case 'reports':
      return { ...section, items: entries.map((entry) => ({ title: entry.title, description: entry.summary, file: entry.attachment, publishedAt: entry.date, category: entry.category })) }
    case 'stats':
      return { ...section, items: entries.map((entry) => ({
        value: entry.metricValue || '0', label: entry.title, note: entry.summary,
        ...(normalizeStatIcon(entry.icon) ? { icon: normalizeStatIcon(entry.icon) } : {}),
        ...(normalizeIllustration(entry.illustration) ? { illustration: normalizeIllustration(entry.illustration) } : {}),
        ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
      })) }
    case 'contentFeed':
      return { ...section, components: [config.component], columns: config.columns || section.columns || 3, items: entries }
    case 'richText':
      return { ...section, body: entries.flatMap((entry) => [{ en: [entry.title.en, entry.summary.en].filter(Boolean).join('\n\n'), bn: [entry.title.bn, entry.summary.bn].filter(Boolean).join('\n\n') }]) }
    case 'table':
      return { ...section, headers: [{ en: 'Title', bn: 'শিরোনাম' }, { en: 'Details', bn: 'বিবরণ' }], rows: entries.map((entry) => [entry.title, entry.summary]) }
    case 'cta': {
      const first = entries[0]
      return first ? { ...section, heading: first.title, body: first.summary, primary: { label: section.primary.label || { en: 'Read more', bn: 'আরও পড়ুন' }, href: first.href || section.primary.href || '/' } } : section
    }
    case 'donation': {
      const first = entries[0]
      return first ? { ...section, heading: first.title, body: first.summary } : section
    }
    default:
      return section
  }
}

function isProjectsCollectionSection(section: PageData['sections'][number]) {
  const heading = `${section.heading?.en || ''} ${section.heading?.bn || ''}`.trim().toLowerCase()
  const configuredComponent = section.contentCollection?.component
  const feedComponent = section.type === 'contentFeed' ? section.components[0] : undefined
  const collectionKind = section.type === 'carousel' ? section.collectionKind : undefined
  const dataSource = section.type === 'cards' || section.type === 'carousel' ? section.dataSource : undefined
  return collectionKind === 'projects'
    || configuredComponent === 'project'
    || (section.type === 'contentFeed' && feedComponent === 'project')
    || (dataSource !== 'manual' && /projects?|প্রকল্প/.test(heading)
      && ['cards', 'carousel', 'contentFeed', 'gallery'].includes(section.type))
}

function projectFeedCards(entries: Awaited<ReturnType<typeof getPublishedFeed>>) {
  return entries.map((entry) => ({
    title: entry.title,
    body: entry.summary,
    href: entry.href || `/projects/${entry.slug}`,
    ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
    icon: 'briefcase' as const,
  }))
}

/**
 * The Projects page editor must show the live CMS records in its `items` array,
 * even though those records are stripped again before the page layout is saved.
 * This keeps the editor preview, collection manager and public page in sync while
 * preserving cms_content_items as the single source of truth.
 */
function hydrateProjectsEditorPage(page: PageData | null, entries: Awaited<ReturnType<typeof getPublishedFeed>>): PageData | null {
  if (!page || !Array.isArray(page.sections)) return page
  const sections = [...page.sections]
  const sectionIndex = projectsCollectionSectionIndex(sections)
  const hydrate = (section: PageData['sections'][number]) => {
    if (section.type === 'contentFeed') return { ...section, components: [...PROJECT_CONTENT_COMPONENTS], items: entries }
    if (section.type === 'cards') return { ...section, items: projectFeedCards(entries) }
    if (section.type === 'gallery') return { ...section, items: entries.filter((entry) => entry.image).map((entry) => ({ src: entry.image!, alt: entry.title, caption: entry.title })) }
    if (section.type === 'carousel') return { ...section, items: entries.map((entry) => ({
      title: entry.title,
      body: entry.summary,
      ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
      href: entry.href || `/projects/${entry.slug}`,
    })) }
    return section
  }
  if (sectionIndex >= 0) sections[sectionIndex] = hydrate(sections[sectionIndex])
  else if (entries.length) sections.push({
    type: 'contentFeed', visible: true, heading: { en: 'Projects', bn: 'প্রকল্পসমূহ' },
    components: [...PROJECT_CONTENT_COMPONENTS], items: entries, columns: 3,
    contentCollection: { enabled: true, component: 'project', maxItems: 100, layout: 'grid', columns: 3, gap: 24, viewportItems: 3 },
  } as PageData['sections'][number])
  return { ...page, sections }
}

async function getPublicSiteSnapshotUncached(path = '/'): Promise<PublicSiteSnapshot> {
  const canonicalSlug = resolvePagePath(path)
  // Public content never silently falls back to data.ts at runtime. Use the bundled
  // catalogue only during the build or when an operator explicitly enables preview mode.
  const useStaticFallback = process.env.CMS_STATIC_FALLBACK === 'true' || isProductionBuild()
  const cachedDocs = useStaticFallback ? {} : await cachedPublicDocuments(canonicalSlug)
  const docs = new Map<string, JsonValue>(Object.entries(cachedDocs))
  const globalOverride = normalizeGlobal(docs.get('site-global'))
  const rawPageOverride = docs.get(`page:${canonicalSlug}`) as (Partial<PageData> & { __cmsMeta?: { status?: string; sortOrder?: number; updatedAt?: string }; __unpublished?: boolean }) | undefined
  const pageOverride = rawPageOverride ? { ...rawPageOverride } : undefined
  if (pageOverride) { delete pageOverride.__cmsMeta; delete pageOverride.__unpublished }

  const serializableDonationInfo = donationInfo.map((item) => ({
  ...Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'icon')),
  icon: item.id,
}))
  const sdgSteps = useStaticFallback
    ? SDGsteps.map((step) => {
        const sanitizedStep = { ...step }
        Reflect.deleteProperty(sanitizedStep, 'Icon')
        return sanitizedStep
      })
    : await getDatabaseSdgSteps()
  const fallbackGlobal = getFallbackGlobal()
  const override: PublicGlobal = globalOverride ?? fallbackGlobal
  const overrideRecord = asExternalRecord(override) ?? {}
  const uiDocument = asExternalRecord(docs.get('ui')) ?? {}
  const uiDocumentEn = asExternalRecord(uiDocument.en) ?? {}
  const uiDocumentBn = asExternalRecord(uiDocument.bn) ?? {}
  // Load navigation from the CMS database on every runtime snapshot. The general
  // static fallback may still supply bundled page content, but must never mask CMS
  // navigation edits after an administrator saves them.
  const navigation = isProductionBuild()
    ? { primaryNav: systemData.primaryNav, navGroups: systemData.navGroups }
    : await getCmsNavigation()
  const overrideUi = asExternalRecord(override.ui) ?? {}
  const overrideUiEn = asExternalRecord(overrideUi.en) ?? {}
  const overrideUiBn = asExternalRecord(overrideUi.bn) ?? {}
  const overrideHero = asExternalRecord(override.homeHero) ?? {}
  const overrideIdentity = asExternalRecord(override.siteIdentity) ?? {}
  const themeConfig = useStaticFallback ? { themes: systemData.themes } : await getThemeConfig()
  const footerConfig = useStaticFallback ? DEFAULT_FOOTER_CONFIG : await getFooterConfig()
  // The site has one fixed design theme. Typography is one shared setting used by that theme in both appearance modes.
  const overrideImages = asExternalRecord(override.images) ?? {}
  const overrideMedia = asExternalRecord(override.media) ?? {}
  const overrideContact = asExternalRecord(override.contactInfo) ?? {}
  const global = {
    ...fallbackGlobal, ...override, ...navigation,
    images: { ...fallbackGlobal.images, ...overrideImages },
    media: { ...fallbackGlobal.media, ...overrideMedia },
    contactInfo: { ...fallbackGlobal.contactInfo, ...overrideContact } as PublicGlobal['contactInfo'],
    siteIdentity: { ...fallbackGlobal.siteIdentity, ...overrideIdentity },
    // Keep complete homepage hero defaults available for older global snapshots while honoring CMS overrides.
    homeHero: {
      ...systemData.homeHero,
      ...overrideHero,
      slides: Array.isArray(overrideHero.slides) ? overrideHero.slides as HeroData['slides'] : systemData.homeHero.slides,
      stats: Array.isArray(overrideHero.stats) ? overrideHero.stats as HeroData['stats'] : systemData.homeHero.stats,
    },
    // The seeded PostgreSQL global snapshot is the source of truth for payment options; bundled entries are only a missing-field bootstrap default.
    donationInfo: Array.isArray(override.donationInfo) ? override.donationInfo : Array.isArray(overrideRecord.paymentInfo) ? overrideRecord.paymentInfo : serializableDonationInfo,
    SDGsteps: sdgSteps,
    ui: { ...systemData.ui, ...overrideUi, en: { ...systemData.ui.en, ...overrideUiEn, ...uiDocumentEn }, bn: { ...systemData.ui.bn, ...overrideUiBn, ...uiDocumentBn } },
    themes: themeConfig.themes,
    footer: footerConfig,
  } as unknown as PublicGlobal
  // Built-in content collections, including Career / Jobs, remain routable even if an older database
  // has not yet received the page snapshot. Editors can then save the generated page into the CMS.
  // Outside explicit static-fallback/build mode, the public route must resolve
  // from the persisted CMS page or a published content-detail record. A code-owned
  // collection registry must never silently invent public page copy at runtime.
  const fallbackPage = (useStaticFallback || canonicalSlug === '/') ? (getFallbackPage(canonicalSlug) ?? null) : null
  if (canonicalSlug !== '/' && rawPageOverride?.__unpublished) return { global, page: null, canonicalSlug, notFound: true, updatedAt: rawPageOverride.__cmsMeta?.updatedAt || null }
  // Detail pages are assembled from cms_content_items at request time. This deliberately
  // takes precedence over the old page.render_cache snapshot so CMS edits are visible.
  const cmsDetail = useStaticFallback ? { handled: false, page: null } : await getPublishedContentDetailPage(canonicalSlug)
  if (cmsDetail.handled && !cmsDetail.page) return { global, page: null, canonicalSlug, notFound: true, updatedAt: null }
  let page = cmsDetail.handled ? cmsDetail.page : pageOverride ? ({ ...fallbackPage, ...pageOverride } as PageData) : fallbackPage

  // Normalize homepage section identity once. HomePage accepts only registered landing compositions.
  if (canonicalSlug === '/' && page) page = ensureLandingPageSections(page, !pageOverride)

  // Field-news cards are managed as CMS project items. The JSON page snapshot keeps the
  // section layout, while published CMS items supply its live cards at runtime.
  const pageUsesNewsRail = Boolean(page?.sections.some((section) => section.type === 'carousel' && (section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed')))
  const pageUsesSuccessStoriesGallery = Boolean(page?.sections.some((section) => section.type === 'carousel' && section.homeComponent === 'successStories'))
  const needsFieldNews = pageUsesNewsRail
  if (!useStaticFallback && page && (needsFieldNews || pageUsesSuccessStoriesGallery)) {
    // Capture the narrowed page before entering callbacks: TypeScript does not
    // preserve the outer nullable-property narrowing inside nested closures.
    const currentPage = page
    const sectionItemLimits = (matches: (section: PageData['sections'][number]) => boolean) => currentPage.sections.flatMap((section) => {
      if (section.type !== 'carousel' || !matches(section)) return []
      const configuredLimit = section.contentCollection?.maxItems
      const legacyLimit = section.type === 'carousel' ? section.maxItems : undefined
      return [Number(configuredLimit ?? legacyLimit ?? 8) || 8]
    })
    const newsLimits = sectionItemLimits((section) => section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed')
    const successLimits = sectionItemLimits((section) => section.homeComponent === 'successStories')
    const newsSectionLimit = Math.max(2, Math.min(12, ...(newsLimits.length ? newsLimits : [8])))
    const successSectionLimit = Math.max(2, Math.min(12, ...(successLimits.length ? successLimits : [8])))
    const fieldItems = needsFieldNews ? await getPublishedFieldNews(newsSectionLimit) : []
    const successStoryItems = pageUsesSuccessStoriesGallery
      ? await getPublishedFeed(['success-story'], successSectionLimit, '/success-stories')
      : []
    page = {
      ...currentPage,
      sections: currentPage.sections.map((section) => {
        const sectionHeading = (section.type === 'carousel' ? section.heading?.en : '')?.trim().toLowerCase()
        const isLandingNewsRail = section.type === 'carousel' && (
          section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed' || (canonicalSlug === '/' && ['news from the field', 'latest news'].includes(sectionHeading ?? ''))
        )
        const isLandingSuccessGallery = section.type === 'carousel' && section.homeComponent === 'successStories'
        const isFieldNews = section.type === 'carousel' && (isLandingNewsRail || (section.dataSource !== 'manual' && canonicalSlug === '/social-development'))
        if (isLandingSuccessGallery && section.type === 'carousel') {
          return {
            ...section,
            collectionKind: 'success-stories' as const,
            dataSource: 'published-success-stories' as const,
            presentation: 'collection' as const,
            items: successStoryItems.flatMap((entry) => entry.image ? [{
              title: entry.title,
              image: { src: entry.image, alt: entry.title },
              href: `/success-stories/${entry.slug}`,
            }] : []),
          }
        }
        if (!isFieldNews || section.type !== 'carousel') return section
        return {
          ...section,
          homeComponent: section.homeComponent === 'stories' || section.homeComponent === 'newsFeed' ? 'news' : section.homeComponent,
          collectionKind: 'news' as const,
          dataSource: 'published-news' as const,
          ...(canonicalSlug === '/social-development' ? {
            eyebrow: undefined,
            heading: { en: 'News from the Field', bn: 'মাঠপর্যায়ের সংবাদ' },
            body: undefined,
          } : {}),
          presentation: 'scroller' as const,
          items: fieldItems.map((entry) => ({
            title: entry.title,
            body: entry.summary,
            ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
            href: `/news/${entry.slug}`,
            tag: { en: entry.date, bn: entry.date },
          })),
        }
      }),
    }
  }

  // Resolve the main content catalogues from PostgreSQL at request time. Page layout,
  // typography and section ordering still come from the refined page design; the editable
  // titles, descriptions, images and details come from cms_content_items.
  if (!useStaticFallback && page) {
    const catalogueConfig: Record<string, { component: 'project' | 'news' | 'enterprise' | 'notice' | 'partner-agency' | 'health-service' | 'loan-product'; route: string }> = {
      '/projects': { component: 'project', route: '/projects' },
      '/news': { component: 'news', route: '/news' },
      '/enterprise-development': { component: 'enterprise', route: '/enterprise-development' },
      '/notice': { component: 'notice', route: '/notice' },
      '/about-us/partners-networks': { component: 'partner-agency', route: '/about-us/partners-networks' },
      '/social-development/health-program': { component: 'health-service', route: '/social-development/health-program' },
      '/organizational-development': { component: 'loan-product', route: '/organizational-development' },
    }
    const config = catalogueConfig[canonicalSlug]
    // `/projects` is the canonical catalogue for published projects. A number of
    // older CMS records were assigned to a nested page before the listing page was
    // made database-backed, so include all published project records here. Their
    // individual hrefs still honour each record's saved routeParent.
    const collection = config && db
      ? await getPublishedFeed([config.component], 100, canonicalSlug === '/projects' ? undefined : canonicalSlug)
      : []
    if (config && db) {
      const cards = config.component === 'project'
        ? projectFeedCards(collection)
        : collection.map((entry) => ({
            title: entry.title,
            body: entry.summary,
            href: entry.href || `${config!.route}/${entry.slug}`,
            image: entry.image ? { src: entry.image, alt: entry.title } : undefined,
            icon: (config!.component === 'health-service' ? 'heart' : config!.component === 'partner-agency' ? 'building' : config!.component === 'loan-product' ? 'coins' : 'briefcase') as IconName,
            tag: config!.component === 'loan-product' ? { en: 'Loan product', bn: 'ঋণ পণ্য' } : undefined,
          }))
      const projectSectionIndex = canonicalSlug === '/projects' ? projectsCollectionSectionIndex(page.sections) : -1
      let projectSectionMatched = false
      page = {
        ...page,
        sections: page.sections.map((section, sectionIndex) => {
          if (canonicalSlug === '/projects' && config!.component === 'project' && sectionIndex === projectSectionIndex) {
            projectSectionMatched = true
            if (section.type === 'contentFeed') return { ...section, components: ['project'], items: collection }
            if (section.type === 'cards') return { ...section, items: cards }
            if (section.type === 'gallery') return { ...section, items: collection.filter((entry) => entry.image).map((entry) => ({ src: entry.image!, alt: entry.title, caption: entry.title })) }
            if (section.type === 'carousel') return { ...section, items: collection.map((entry) => ({
              title: entry.title,
              body: entry.summary,
              ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}),
              href: entry.href || `${config!.route}/${entry.slug}`,
            })) }
            return section
          }
          if (canonicalSlug === '/news' && section.type === 'carousel' && section.collectionKind === 'news') {
            return { ...section, items: collection.map((entry) => ({ title: entry.title, body: entry.summary, ...(entry.image ? { image: { src: entry.image, alt: entry.title } } : {}), href: entry.href || `${config!.route}/${entry.slug}`, tag: { en: entry.date, bn: entry.date } })) }
          }
          if (canonicalSlug === '/enterprise-development' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'srizony enterprises') {
            return { ...section, items: cards }
          }
          if (canonicalSlug === '/about-us/partners-networks' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'partnership focus') {
            return { ...section, heading: { en: 'Present Donor & Partner Agencies', bn: 'বর্তমান দাতা ও অংশীদার সংস্থা' }, columns: 3 as const, items: cards }
          }
          if (canonicalSlug === '/social-development/health-program' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'service components') {
            return { ...section, items: cards }
          }
          if (canonicalSlug === '/organizational-development' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'loan products') {
            return { ...section, items: cards }
          }
          if (canonicalSlug === '/notice' && section.type === 'noticeList') {
            return { ...section, items: collection.map((entry) => ({ date: entry.date, title: entry.title, body: entry.summary, href: entry.href || `${config!.route}/${entry.slug}` })) }
          }
          return section
        }),
      }
      // If a legacy editor save removed the old carousel marker entirely, keep the
      // published catalogue visible rather than leaving the page with an empty
      // `items` array and no database-backed section.
      if (canonicalSlug === '/projects' && collection.length && !projectSectionMatched) {
        page = {
          ...page,
          sections: [...page.sections, {
            type: 'contentFeed',
            visible: true,
            heading: { en: 'Projects', bn: 'প্রকল্পসমূহ' },
            components: ['project'],
            items: collection,
            columns: 3,
          } as PageData['sections'][number]],
        }
      }
    }
  }

  // The home page also shares the live enterprise collection instead of freezing the
  // seed-time cards inside pages.render_cache.
  if (!useStaticFallback && page && canonicalSlug === '/') {
    // This is a featured homepage rail, while each enterprise's canonical detail
    // Enterprise entries use their canonical Enterprise Development route hierarchy.
    const enterpriseItems = await getPublishedFeed(['enterprise'], 8, '/enterprise-development')
    if (db) {
      page = {
        ...page,
        sections: page.sections.map((section) => {
          const homeComponent = String(section.homeComponent ?? '').trim().toLowerCase()
          const isEnterpriseSection = section.type === 'cards' && section.dataSource !== 'manual' && (
            (section.heading?.en || '').trim().toLowerCase() === 'srizony enterprises'
            || homeComponent === 'enterprises'
            || section.items.some((item) => item.href?.startsWith('/enterprise-development/'))
          )
          return isEnterpriseSection
            ? { ...section, heading: { en: 'Srizony Enterprises', bn: 'সৃজনী উদ্যোগসমূহ' }, items: enterpriseItems.map((entry) => ({
                title: entry.title, body: entry.summary, href: entry.href || `/enterprise-development/${entry.slug}`,
                image: entry.image ? { src: entry.image, alt: entry.title } : undefined, icon: 'building' as const,
              })) }
            : section
        }),
      }
    }
  }

  if (!useStaticFallback && page && canonicalSlug === '/carrer-job') {
    // A job is published from CMS → Job Management. Always bind that database collection
    // to the public Career / Jobs page instead of relying on the empty legacy careerEntries array.
    const jobs = (await getPublishedFeed(['job'], 100, '/carrer-job')).map((entry) => ({
      ...entry,
      href: `/carrer-job/${entry.slug}`,
    }))
    const existingJobFeed = page.sections.findIndex((section) => section.type === 'contentFeed' && section.components?.[0] === 'job')
    if (existingJobFeed >= 0) {
      page = { ...page, sections: page.sections.map((section, index) => index === existingJobFeed && section.type === 'contentFeed' ? { ...section, components: ['job'], items: jobs } : section) }
    } else {
      const opportunitiesIndex = page.sections.findIndex((section) => section.type === 'noticeList' && /open opportunities|current vacancies|career|job/i.test(section.heading?.en || ''))
      if (opportunitiesIndex >= 0) {
        page = { ...page, sections: page.sections.map((section, index) => index === opportunitiesIndex ? ({
          type: 'contentFeed' as const,
          visible: section.visible,
          heading: section.type === 'noticeList' ? section.heading : { en: 'Current Vacancies', bn: 'চলমান চাকরির সুযোগ' },
          components: ['job'] as ['job'],
          items: jobs,
          buttonConfig: section.buttonConfig,
        }) : section) }
      } else {
        page = { ...page, sections: [...page.sections, { type: 'contentFeed', heading: { en: 'Current Vacancies', bn: 'চলমান চাকরির সুযোগ' }, components: ['job'], items: jobs, visible: true }] }
      }
    }
  }

  if (page && !isProductionBuild() && !useStaticFallback && page.sections.some((section) => section.contentCollection?.enabled === true)) {
    const hydrated = await Promise.all(page.sections.map(async (section) => {
      const config = section.contentCollection
      if (!config?.enabled) return section
      if (canonicalSlug === '/projects' && config.component === 'project') return section
      const maxItems = Math.max(1, Math.min(100, Number(config.maxItems) || 12))
      const entries = await getPublishedFeed(
        [config.component],
        maxItems,
        canonicalSlug === '/projects' && config.component === 'project' ? undefined : canonicalSlug,
      )
      return hydrateSectionFromCollection(section, entries, config)
    }))
    page = { ...page, sections: hydrated }
  }

  if (page && !isProductionBuild() && !useStaticFallback && page.sections?.some((section) => section.type === 'contentFeed')) {
    // Legacy content-feed sections are upgraded on save; this fallback keeps older
    // snapshots working while preserving canonical News/Success Story detail links.
    page = { ...page, sections: await Promise.all(page.sections.map(async (section) => {
      if (section.type !== 'contentFeed') return section
      if (section.contentCollection?.enabled === true) return section
      const isCanonicalProjectsFeed = canonicalSlug === '/projects' && (
        section.components?.[0] === 'project' || section.contentCollection?.component === 'project'
      )
      if (section.contentCollection?.enabled === false && !isCanonicalProjectsFeed) return { ...section, items: [] }
      const component = section.components?.[0] || 'project'
      const entries = await getPublishedFeed([component], 100, canonicalSlug === '/projects' && component === 'project' ? undefined : canonicalSlug)
      return { ...section, components: [component], items: entries }
    })) }
  }
  if (page) page = applyPortfolioToPage(page, global)
  const isJobRoute = canonicalSlug === '/carrer-job' || canonicalSlug.startsWith('/carrer-job/')
  const jobApplicationProcess = isJobRoute
    ? normalizeJobApplicationProcessConfig(await readCmsSettingValue('cms-document:job-application-process.json').catch(() => DEFAULT_JOB_APPLICATION_PROCESS))
    : undefined
  return {
    global, page, canonicalSlug, notFound: !page,
    updatedAt: rawPageOverride?.__cmsMeta?.updatedAt || null,
    ...(jobApplicationProcess ? { jobApplicationProcess } : {}),
  }
}

// Metadata generation, the root layout and page rendering can request the same
// public snapshot during one navigation. Cache the complete public result for
// 60 seconds and invalidate it whenever CMS content/navigation is changed.
const cachedPublicSiteSnapshot = unstable_cache(
  async (path: string) => getPublicSiteSnapshotUncached(path),
  ['srizony-public-site-snapshot-v4'],
  { revalidate: 60, tags: ['site-content', 'job-application-process'] },
)

export async function getPublicSiteSnapshot(path = '/') {
  return cachedPublicSiteSnapshot(resolvePagePath(path))
}

/**
 * The project uses one fixed Midnight theme (with light/dark appearance modes).
 * CMS typography is a single site-wide theme-scoped configuration.
 */
export async function getThemeConfig() {
  if (isProductionBuild()) return { themes: systemData.themes }
  try {
    const saved = await readCmsSettingValue(THEME_TYPOGRAPHY_SETTING_KEY)
    const typography = normalizeThemeTypographySettings(saved)
    return { themes: applyThemeTypographySettings(systemData.themes, typography) }
  } catch (error) {
    console.error('[theme-typography] Neon/Drive settings unavailable; using design-system defaults.', error)
    return { themes: systemData.themes }
  }
}

export async function getFooterConfig() {
  if (isProductionBuild()) return DEFAULT_FOOTER_CONFIG
  try {
    const saved = await readCmsSettingValue(FOOTER_CONFIG_SETTING_KEY)
    return normalizeFooterConfig(saved ?? DEFAULT_FOOTER_CONFIG)
  } catch (error) {
    console.error('[footer-config] Neon/Drive settings unavailable; using defaults.', error)
    return DEFAULT_FOOTER_CONFIG
  }
}

export function getFallbackGlobal(): PublicGlobal {
  return {
    ...systemData,
    siteIdentity: { ...systemData.siteIdentity, keywords: [...systemData.siteIdentity.keywords] },
    footer: DEFAULT_FOOTER_CONFIG,
    donationInfo: donationInfo.map((item) => ({ ...item, icon: item.id })),
    SDGsteps: SDGsteps.map(({ Icon, ...step }) => {
      void Icon
      return step
    }),
  }
}

async function getAvailableMenus() {
  const navigation = await getCmsNavigation()
  const normalize = (items: NavItem[]): AvailableMenuNode[] => items.map((item) => ({ label: item.label, href: item.href, menuType: item.menuType, children: item.children?.length ? normalize(item.children) : undefined }))
  return [{ key: 'primary', label: { en: 'Site Navigation', bn: 'সাইট নেভিগেশন' }, items: normalize(navigation.primaryNav) }]
}

function navigationPathSet(availableMenus: AvailableMenuGroup[]): Set<string> {
  const paths = new Set<string>(['/'])
  const visit = (items: AvailableMenuNode[]) => {
    for (const item of items) {
      if (item.menuType !== 'external' && item.href.startsWith('/')) paths.add(resolvePagePath(item.href))
      if (item.children?.length) visit(item.children)
    }
  }
  for (const group of availableMenus) visit(group.items)
  return paths
}

function filterPagesToNavigation<T extends { slug: string }>(pages: T[], availableMenus: AvailableMenuGroup[]): T[] {
  const paths = navigationPathSet(availableMenus)
  return pages.filter((page) => paths.has(resolvePagePath(page.slug)))
}

export async function getCmsEditorData(slug?: string) {
  if (!slug) {
    const docs = await readDocuments(['site-global'])
    const database = db
    let updatedAt: string | undefined
    if (database) {
      const result = await withDbRetry(() => database.execute(sql`SELECT updated_at FROM site_global_state WHERE id = 1 LIMIT 1`))
      updatedAt = result.rows[0] && String((result.rows[0] as JsonObject).updated_at || '')
    }
    return { global: normalizeGlobal(docs.get('site-global')) || getFallbackGlobal(), updatedAt }
  }
  const canonicalSlug = resolvePagePath(slug)
  // Older CMS versions could persist both a legacy alias and its canonical route.
  // Prefer the canonical document, but keep the editor recoverable when only the
  // legacy row exists. A subsequent save writes the canonical route.
  const legacySlugs = Object.keys(LEGACY_ROUTE_ALIASES).filter((alias) => resolvePagePath(alias) === canonicalSlug && alias !== canonicalSlug)
  const candidateSlugs = [canonicalSlug, ...legacySlugs]
  const docs = await readDocuments(candidateSlugs.map((candidate) => `page:${candidate}`))
  const rawOverride = (docs.get(`page:${canonicalSlug}`)
    ?? legacySlugs.map((candidate) => docs.get(`page:${candidate}`)).find(Boolean)) as JsonObject | undefined
  const meta = rawOverride?.__cmsMeta
  let fallback = ensureLandingPageSections(getFallbackPage(canonicalSlug))
  let override = rawOverride ? { ...rawOverride } : null
  if (override) {
    delete override.__cmsMeta
    delete override.__unpublished
  }
  if (canonicalSlug === '/') {
    const source = { ...(fallback || {}), ...(override || {}), slug: '/' } as PageData
    source.sections = Array.isArray(override?.sections) ? override!.sections as PageData['sections'] : (fallback?.sections || [])
    override = ensureLandingPageSections(source, !rawOverride) as JsonObject
  }
  if (canonicalSlug === '/projects' && db && !isProductionBuild() && process.env.CMS_STATIC_FALLBACK !== 'true') {
    // Admin preview data is loaded from the same CMS catalogue as the public page.
    // Draft/hidden records remain visible in the Collection manager, while only
    // published records are inserted into the page's preview `items` array.
    const projects = await getPublishedFeed(['project'], 100)
    fallback = hydrateProjectsEditorPage(fallback, projects)
    override = hydrateProjectsEditorPage(override as PageData | null, projects) as JsonObject | null
  }
  return { slug: canonicalSlug, fallback, override: override || null, meta: canonicalSlug === '/' ? { ...(asExternalRecord(meta) ?? {}), status: 'published' } : (asExternalRecord(meta) ?? null) }
}

export async function getCmsMenuIndex() {
  const fallbackPages = getBuiltInPages()
  const database = db
  const availableMenus = await getAvailableMenus()
  const fallbackNavigationPaths = navigationPathSet(availableMenus)
  const protectedSystemPaths = new Set<string>(['/', ...CONTENT_COLLECTION_ROUTES.map((route) => route.slug)])
  const pagesByCanonicalSlug = new Map<string, CmsPageIndexEntry & { sourceSlug: string; updatedAtMs: number }>()

  const addPage = (raw: Record<string, unknown>) => {
    const sourceSlug = String(raw.slug || '').trim()
    if (!sourceSlug) return
    const slug = resolvePagePath(sourceSlug)
    const fallback = fallbackPages.find((page) => page.slug === slug || page.slug === sourceSlug)
    const updatedAt = raw.updated_at instanceof Date ? raw.updated_at.toISOString() : String(raw.updated_at || '')
    const updatedAtMs = Date.parse(updatedAt) || 0
    const candidate = {
      slug,
      title: {
        en: String(raw.title_en || fallback?.title.en || slug),
        bn: String(raw.title_bn || fallback?.title.bn || raw.title_en || slug),
      },
      subtitle: raw.subtitle_en || raw.subtitle_bn
        ? { en: String(raw.subtitle_en || fallback?.subtitle?.en || ''), bn: String(raw.subtitle_bn || fallback?.subtitle?.bn || '') }
        : fallback?.subtitle,
      status: slug === '/' ? 'published' : String(raw.status || 'published'),
      sortOrder: slug === '/' ? -1 : Number(raw.sort_order || 0),
      ...(updatedAt ? { updatedAt } : {}),
      sourceSlug,
      updatedAtMs,
    }
    const current = pagesByCanonicalSlug.get(slug)
    // Canonical rows always win over aliases. If multiple legacy aliases exist,
    // retain the most recently updated record so no editor data is lost.
    const candidateIsCanonical = sourceSlug === slug
    const currentIsCanonical = current?.sourceSlug === slug
    if (!current || (candidateIsCanonical && !currentIsCanonical) || (candidateIsCanonical === currentIsCanonical && updatedAtMs > current.updatedAtMs)) {
      pagesByCanonicalSlug.set(slug, candidate)
    }
  }

  const addReachableFallbackPages = (navigationPaths: Set<string>) => {
    for (const page of fallbackPages) {
      // Do not resurrect a built-in document after its navigation branch has
      // been removed. Missing defaults are synthesized only for active routes
      // and protected system collection routes; persisted orphan/draft records
      // are already included by addPage above.
      if (!pagesByCanonicalSlug.has(page.slug) && (navigationPaths.has(page.slug) || protectedSystemPaths.has(page.slug))) {
        addPage({ slug: page.slug, title_en: page.title.en, title_bn: page.title.bn, subtitle_en: page.subtitle?.en, subtitle_bn: page.subtitle?.bn, status: 'published', sort_order: page.slug === '/' ? -1 : page.sortOrder ?? 0 })
      }
    }
  }

  const buildDriveIndex = async () => {
    pagesByCanonicalSlug.clear()
    // The JSON Drive snapshot is a read-only index fallback. Include every
    // persisted page (including drafts and orphaned pages) when it is available.
    const [driveRows, navRows] = !isProductionBuild()
      ? await Promise.all([readDriveTableSnapshot('pages'), readDriveTableSnapshot('nav_items')])
      : [null, null]
    for (const row of driveRows || []) addPage(row as Record<string, unknown>)
    const navBySlug = new Map<string, { id: number; visible: boolean }>()
    for (const row of navRows || []) {
      if ((row.menu_type || 'page') !== 'page' || !String(row.href || '').startsWith('/')) continue
      const key = resolvePagePath(String(row.href))
      const current = navBySlug.get(key)
      if (!current || Number(row.id) < current.id) navBySlug.set(key, { id: Number(row.id), visible: row.is_visible !== false && row.is_visible !== 'false' })
    }
    const reachablePaths = new Set([...fallbackNavigationPaths, ...navBySlug.keys()])
    addReachableFallbackPages(reachablePaths)
    const availablePages = Array.from(pagesByCanonicalSlug.values()).map(({ sourceSlug: _sourceSlug, updatedAtMs: _updatedAtMs, ...page }) => {
      const navigation = navBySlug.get(page.slug)
      return { ...page, ...(navigation ? { navigationId: navigation.id, navigationVisible: navigation.visible } : {}) }
    }).sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
    return { availablePages, availableMenus }
  }

  if (!database || isProductionBuild()) return buildDriveIndex()

  try {
    const [pageResult, navResult] = await Promise.all([
      withDbRetry(() => database.execute(sql`
        SELECT slug, title_en, title_bn, subtitle_en, subtitle_bn, status, updated_at, sort_order
        FROM pages ORDER BY sort_order ASC, slug ASC
      `)),
      withDbRetry(() => database.execute(sql`
        SELECT id, href, is_visible FROM nav_items
        WHERE COALESCE(menu_type, 'page') = 'page' AND href LIKE '/%'
        ORDER BY id ASC
      `)),
    ])
    for (const raw of pageResult.rows as DatabaseRow[]) addPage(raw as Record<string, unknown>)

    const navBySlug = new Map<string, { id: number; visible: boolean }>()
    for (const raw of navResult.rows as DatabaseRow[]) {
      const href = String(raw.href || '')
      if (!href.startsWith('/')) continue
      const key = resolvePagePath(href)
      const current = navBySlug.get(key)
      if (!current || Number(raw.id) < current.id) navBySlug.set(key, { id: Number(raw.id), visible: raw.is_visible !== false && raw.is_visible !== 'false' })
    }
    const reachablePaths = new Set([...fallbackNavigationPaths, ...navBySlug.keys()])
    addReachableFallbackPages(reachablePaths)

    const availablePages = Array.from(pagesByCanonicalSlug.values()).map(({ sourceSlug: _sourceSlug, updatedAtMs: _updatedAtMs, ...page }) => {
      const navigation = navBySlug.get(page.slug)
      return { ...page, ...(navigation ? { navigationId: navigation.id, navigationVisible: navigation.visible } : {}) }
    }).sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug))
    return { availablePages, availableMenus }
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      console.warn('CMS page index is using the Google Drive JSON snapshot after a transient database failure.')
      return buildDriveIndex()
    }
    console.error('CMS menu index read failed', error)
    throw error instanceof Error ? error : new Error('Unable to read CMS page index.')
  }
}

export async function getAllCmsContent(): Promise<{ global: PublicGlobal; overrides: Record<string, JsonValue>; availablePages: CmsPageIndexEntry[]; availableMenus: AvailableMenuGroup[] }> {
  const fallbackPages = getBuiltInPages()
  const fallbackGlobal = getFallbackGlobal()
  const database = db
  if (!database || isProductionBuild()) {
    const availableMenus = await getAvailableMenus()
    const pages = fallbackPages.map((page) => ({ slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published', sortOrder: 0 }))
    return { global: fallbackGlobal, overrides: {} as Record<string, import('@/types/json').JsonValue>, availablePages: filterPagesToNavigation(pages, availableMenus), availableMenus }
  }
  try {
    const [globalResult, pageResult] = await Promise.all([
      withDbRetry(() => database.execute(sql`SELECT value FROM site_global_state WHERE id = 1 LIMIT 1`)),
      withDbRetry(() => database.execute(sql`SELECT slug, render_cache, status FROM pages ORDER BY sort_order ASC, slug ASC`)),
    ])
    const overrides = new Map<string, JsonValue>()
    for (const raw of pageResult.rows as DatabaseRow[]) {
      if (raw.render_cache && typeof raw.render_cache === 'object' && !(raw.render_cache instanceof Date) && !(raw.render_cache instanceof Uint8Array) && !Array.isArray(raw.render_cache)) {
        overrides.set(String(raw.slug), raw.render_cache as JsonObject)
      }
    }
    const availablePages = new Map<string, CmsPageIndexEntry>()
    const useStaticFallback = process.env.CMS_STATIC_FALLBACK === 'true' || isProductionBuild()
    if (useStaticFallback) fallbackPages.forEach((page) => availablePages.set(page.slug, { slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published', sortOrder: page.sortOrder ?? 0 }))
    for (const raw of pageResult.rows as DatabaseRow[]) {
      if (String(raw.status || 'published') !== 'published') continue
      const slug = String(raw.slug)
      const page = overrides.get(slug) as JsonObject
      if (page && typeof page === 'object' && !Array.isArray(page)) {
        const titleRecord = asExternalRecord(page.title) ?? {}
        const subtitleRecord = asExternalRecord(page.subtitle)
        const title: Bilingual = { en: readString(titleRecord.en, slug), bn: readString(titleRecord.bn, readString(titleRecord.en, slug)) }
        const subtitle = subtitleRecord ? { en: readString(subtitleRecord.en), bn: readString(subtitleRecord.bn) } : undefined
        availablePages.set(slug, { slug, title, subtitle, status: 'published', sortOrder: 0 })
      }
    }
    for (const page of fallbackPages.filter((item) => CONTENT_COLLECTION_ROUTES.some((route) => route.slug === item.slug))) {
      if (!availablePages.has(page.slug)) {
        const storedRow = (pageResult.rows as DatabaseRow[]).find((row) => String(row.slug) === page.slug)
        const routeStatus = String(storedRow?.status || 'published')
        // A stale page row with NULL render_cache must not hide a valid generated
        // collection page from the CMS editor or the public route preview.
        if (!overrides.has(page.slug)) overrides.set(page.slug, page)
        if (routeStatus === 'published') {
          availablePages.set(page.slug, { slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published', sortOrder: page.sortOrder ?? 0 })
        } else {
          availablePages.set(page.slug, { slug: page.slug, title: page.title, subtitle: page.subtitle, status: routeStatus, sortOrder: page.sortOrder ?? 0 })
        }
      }
    }

    // Keep the canonical landing page discoverable to every consumer of the page catalogue,
    // even when an older database has no pages row for '/'. Home is not an ordinary slug.
    const bundledHome = contentData.allPages['/']
    if (bundledHome) {
      const storedHome = overrides.get('/') as Partial<PageData> | undefined
      const mergedHome = ensureLandingPageSections({
        ...bundledHome,
        ...(storedHome || {}),
        slug: '/',
        status: 'published',
        sections: Array.isArray(storedHome?.sections) ? storedHome.sections : bundledHome.sections,
      } as PageData, !storedHome)
      if (mergedHome) {
        overrides.set('/', mergedHome)
        availablePages.set('/', { slug: '/', title: mergedHome.title || bundledHome.title, subtitle: mergedHome.subtitle ?? bundledHome.subtitle, status: 'published', sortOrder: -1 })
      }
    }

    const normalizedGlobal = normalizeGlobal((globalResult.rows[0] as JsonObject | undefined)?.value)
    if (!normalizedGlobal && !useStaticFallback) throw new Error('CMS global state is missing. Run the database seed before serving CMS content.')
    const availableMenus = await getAvailableMenus()
    const navigationPaths = navigationPathSet(availableMenus)
    const filteredOverrides = Object.fromEntries(Array.from(overrides.entries()).filter(([slug]) => navigationPaths.has(resolvePagePath(slug))))
    return {
      global: normalizedGlobal || fallbackGlobal,
      overrides: filteredOverrides,
      availablePages: filterPagesToNavigation(Array.from(availablePages.values()), availableMenus),
      availableMenus,
    }
  } catch (error) {
    console.error('CMS content read failed', error)
    throw error instanceof Error ? error : new Error('Unable to read CMS content.')
  }
}

const normalizeLandingHeading = (value: ExternalValue) => String(value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
const isLandingAreasSection = (section: PageData['sections'][number]) => section.type === 'cards' && normalizeLandingHeading(section.heading?.en) === 'integrated development areas'
const LANDING_MANAGED_SECTION_KEYS = [
  ['hero', 'carousel', 'landing page hero'],
  ['growth', 'stats', 'growing together'],
  ['missionVisionValues', 'cards', 'mission, vision & values'],
  ['locations', 'richText', 'our offices across bangladesh'],
  ['impactCards', 'cards', 'what we do'],
  ['developmentAreas', 'cards', 'integrated development areas'],
  ['news', 'carousel', 'news from the field'],
  ['successStories', 'carousel', 'success stories of srizony'],
  ['donate', 'cta', 'support srizony'],
] as const

function isManagedLandingSection(section: PageData['sections'][number], type: PageData['sections'][number]['type'], heading: string) {
  return section?.type === type && normalizeLandingHeading(section.heading?.en) === heading
}

function isLegacyLandingImpactSection(section: PageData['sections'][number]) {
  return section.type === 'cards' && section.variant === 'impact'
}

function hasLandingBilingualText(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const item = value as { en?: unknown; bn?: unknown }
  return (typeof item.en === 'string' && Boolean(item.en.trim())) || (typeof item.bn === 'string' && Boolean(item.bn.trim()))
}

function hasLandingBody(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => hasLandingBilingualText(item))
}

function insertManagedLandingFallback(
  currentSections: PageData['sections'],
  defaults: PageData['sections'],
  fallback: PageData['sections'][number],
  component: typeof LANDING_MANAGED_SECTION_KEYS[number][0],
) {
  const normalizedFallback = {
    ...fallback,
    homeComponent: component,
    ...(component === 'news' && fallback.type === 'carousel' ? { collectionKind: 'news' as const, dataSource: 'published-news' as const } : {}),
    ...(component === 'successStories' && fallback.type === 'carousel' ? { collectionKind: 'success-stories' as const, dataSource: 'published-success-stories' as const } : {}),
  } as PageData['sections'][number]
  const defaultIndex = defaults.indexOf(fallback)
  const laterDefault = defaults.slice(defaultIndex + 1)
  const insertionIndex = currentSections.findIndex((section) => laterDefault.some((candidate) =>
    (section.homeComponent && candidate.homeComponent === section.homeComponent) ||
    (section.type === candidate.type && normalizeLandingHeading(section.heading?.en) === normalizeLandingHeading(candidate.heading?.en))
  ))
  currentSections.splice(insertionIndex >= 0 ? insertionIndex : currentSections.length, 0, normalizedFallback)
}

/**
 * Normalize homepage compositions without overriding CMS layout decisions.
 * A bundled fallback page receives the default managed sections; once a CMS
 * override exists, its `sections` array is authoritative: absent means deleted,
 * while `visible: false` means retained but hidden. Never resurrect deleted sections.
 */
function ensureLandingPageSections(page: PageData | null, addMissingManaged = true): PageData | null {
  if (!page || page.slug !== '/') return page
  const currentSections = Array.isArray(page.sections) ? [...page.sections] : []
  const defaults = contentData.allPages['/']?.sections || []
  const defaultFor = (type: PageData['sections'][number]['type'], heading: string) => defaults.find((section) => isManagedLandingSection(section, type, heading))
  const legacyNews = currentSections.find((section): section is Extract<PageData['sections'][number], { type: 'carousel' }> =>
    section.type === 'carousel' && section.homeComponent !== 'successStories' && (
      section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed' ||
      ['news from the field', 'latest news', 'success story of srizony', 'success stories of srizony'].includes(normalizeLandingHeading(section.heading?.en))
    ))
  const newsFallback = defaults.find((section): section is Extract<PageData['sections'][number], { type: 'carousel' }> => isManagedLandingSection(section, 'carousel', 'news from the field'))
  // Older saved homepages used one generic `stories` rail for both the newsroom and
  // the Success Stories heading. Preserve its news feed, then add the new gallery
  // as a distinct landing composition so existing sites adopt the split safely.
  let promoteLegacyStoryRailToGallery = false
  if (legacyNews) {
    const hadLegacyStoriesKey = legacyNews.homeComponent === 'stories'
    const hadStoryTitle = ['success story of srizony', 'success stories of srizony'].includes(normalizeLandingHeading(legacyNews.heading?.en))
    promoteLegacyStoryRailToGallery = hadLegacyStoriesKey || hadStoryTitle
    legacyNews.homeComponent = 'news'
    legacyNews.collectionKind = 'news'
    legacyNews.dataSource = 'published-news'
    if (promoteLegacyStoryRailToGallery && newsFallback) {
      legacyNews.eyebrow = newsFallback.eyebrow
      legacyNews.heading = newsFallback.heading
      legacyNews.body = newsFallback.body
    }
  }

  for (const [component, type, heading] of LANDING_MANAGED_SECTION_KEYS) {
    const currentIndex = currentSections.findIndex((section) => section.homeComponent === component
      || (component === 'impactCards' && isLegacyLandingImpactSection(section))
      || isManagedLandingSection(section, type, heading))
    let current = currentIndex >= 0 ? currentSections[currentIndex] : undefined
    const fallback = defaultFor(type, heading)

    // Replace incompatible old section discriminators with their registered default,
    // but carry over an explicit CMS hide flag and editor metadata.
    if (current && current.type !== type && fallback) {
      const replacement = {
        ...fallback,
        homeComponent: component,
        ...(current.visible === false ? { visible: false } : {}),
        ...(current.sectionId ? { sectionId: current.sectionId } : {}),
        ...(current.typography ? { typography: current.typography } : {}),
        ...(current.buttonConfig ? { buttonConfig: current.buttonConfig } : {}),
      } as PageData['sections'][number]
      currentSections[currentIndex] = replacement
      current = replacement
    }

    if (current) {
      current.homeComponent = component
      if (fallback && current.type === fallback.type) {
        // Keep valid CMS-authored content. Fill only missing/empty essentials from
        // the bundled baseline so older page snapshots render rather than vanish.
        if (current.type === 'stats' && fallback.type === 'stats') {
          if (!hasLandingBilingualText(current.eyebrow)) current.eyebrow = fallback.eyebrow
          if (!hasLandingBilingualText(current.heading)) current.heading = fallback.heading
          if (!current.items?.length) current.items = fallback.items
        } else if (current.type === 'cards' && fallback.type === 'cards') {
          if (!hasLandingBilingualText(current.eyebrow)) current.eyebrow = fallback.eyebrow
          if (!hasLandingBilingualText(current.heading)) current.heading = fallback.heading
          if (!current.items?.length) current.items = fallback.items
          if (component === 'impactCards') current.variant = 'impact'
          if (component === 'missionVisionValues' && !current.columns) current.columns = 3
        } else if (current.type === 'richText' && fallback.type === 'richText') {
          if (!hasLandingBilingualText(current.eyebrow)) current.eyebrow = fallback.eyebrow
          if (!hasLandingBilingualText(current.heading)) current.heading = fallback.heading
          if (!hasLandingBody(current.body)) current.body = fallback.body
        }
      }
      if (current.type === 'carousel' && component === 'news') {
        current.collectionKind = 'news'
        current.dataSource = 'published-news'
        current.presentation = 'scroller'
      }
      if (current.type === 'carousel' && component === 'successStories') {
        current.collectionKind = 'success-stories'
        current.dataSource = 'published-success-stories'
        current.presentation = 'collection'
      }
      continue
    }

    // Only a page without a persisted CMS override receives bundled defaults.
    // For other existing overrides, a missing section is an intentional deletion.
    // The newsroom is the exception: old snapshots frequently omitted the homepage
    // rail during the news/stories split, so restore it unless an editor hid it.
    const shouldInsertDefault = Boolean(fallback && (addMissingManaged || component === 'news'))
    if (fallback && addMissingManaged) {
      insertManagedLandingFallback(currentSections, defaults, fallback, component)
    } else if (fallback && component === 'news' && shouldInsertDefault) {
      insertManagedLandingFallback(currentSections, defaults, fallback, component)
    }
  }
  if (addMissingManaged && !currentSections.some((section) => section.homeComponent === 'developmentAreas' || isLandingAreasSection(section))) {
    const fallback = defaults.find(isLandingAreasSection)
    if (fallback) currentSections.push({ ...fallback, homeComponent: 'developmentAreas' })
  }
  return { ...page, slug: '/', sections: currentSections }
}

function makeContentCollectionPage(slug: string): PageData | null {
  const route = CONTENT_COLLECTION_ROUTES.find((item) => item.slug === slug)
  if (!route) return null
  const existing = contentData.allPages[slug]
  if (existing) return existing
  return {
    slug: route.slug,
    title: route.title,
    subtitle: route.subtitle,
    status: 'published',
    sortOrder: 0,
    sections: [{ type: 'contentFeed', visible: true, heading: route.heading, components: [route.component], items: [] }],
  }
}

function getBuiltInPages(): PageData[] {
  const pages = new Map<string, PageData>(Object.values(contentData.allPages).map((page) => [page.slug, page]))
  for (const route of CONTENT_COLLECTION_ROUTES) if (!pages.has(route.slug)) {
    const page = makeContentCollectionPage(route.slug)
    if (page) pages.set(route.slug, page)
  }
  return Array.from(pages.values())
}

export function getFallbackPage(slug: string) {
  const canonical = resolvePagePath(slug)
  return contentData.allPages[canonical] ?? makeContentCollectionPage(canonical)
}
export type PublicSiteGlobal = Awaited<ReturnType<typeof getPublicSiteSnapshot>>['global']
