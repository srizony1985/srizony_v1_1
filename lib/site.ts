import { sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { contentData, systemData, donationInfo, SDGsteps } from '@/data/data'
import { db, withDbRetry } from '@/lib/db'
import type { NavGroup, NavItem, PageData } from '@/types/entityType'
import { getPublishedFeed, getPublishedFieldNews, getPublishedContentDetailPage } from '@/lib/cms/content'

export type CmsDocumentKey = 'site-global' | `page:${string}` | 'ui'

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

const aliases: Record<string, string> = {
  '/category/news': '/news', '/category/projects': '/projects', '/notices': '/notice', '/about': '/about-us',
  '/partners': '/partners-networks', '/partners-and-networks': '/partners-networks', '/govorning-body': '/governing-body',
  '/good-govornance': '/good-governance', '/executive-secratariat': '/executive-secretariat',
  '/organizetional-development': '/organizational-development', '/student-looan': '/student-loan',
  '/job-circulars': '/job-circular', '/career': '/job-circular', '/donate-now': '/donate',
}

export function resolvePagePath(path: string) { return aliases[path] ?? (path || '/') }

// During `next build` a production database may not have been seeded yet.
// Keep the build deterministic by using the bundled content only for build-time
// static generation. Runtime requests still require the CMS database unless
// CMS_STATIC_FALLBACK=true is explicitly enabled.
function isProductionBuild() { return process.env.NEXT_PHASE === 'phase-production-build' }

function jsonb(value: unknown) { return sql`${JSON.stringify(value ?? null)}::jsonb` }

async function readDocumentsUncached(keys: string[], publishedOnly = false) {
  const database = db
  if (!database || keys.length === 0 || isProductionBuild()) return new Map<string, unknown>()
  const result = new Map<string, unknown>()
  const globalRequested = keys.includes('site-global')
  const pageSlugs = keys.filter((key) => key.startsWith('page:')).map((key) => key.slice('page:'.length))
  if (globalRequested) {
    const global = await withDbRetry(() => database.execute(sql`SELECT value FROM site_global_state WHERE id = 1 LIMIT 1`))
    if (global.rows[0]) result.set('site-global', (global.rows[0] as Record<string, unknown>).value)
  }
  if (pageSlugs.length) {
    const pages = await withDbRetry(() => database.execute(sql`
      SELECT slug, render_cache, status, sort_order, updated_at
      FROM pages
      WHERE slug IN (${sql.join(pageSlugs.map((slug) => sql`${slug}`), sql`, `)})
        ${publishedOnly ? sql`AND status = 'published'` : sql``}
    `))
    for (const row of pages.rows as Array<Record<string, unknown>>) {
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
        result.set(`page:${String(row.slug)}`, { ...(row.render_cache as Record<string, unknown>), __cmsMeta: meta })
      }
    }
  }
  return result
}

async function readDocuments(keys: string[], publishedOnly = false) {
  return readDocumentsUncached(keys, publishedOnly)
}

async function readPublicDocumentsCached(slug: string) {
  // The homepage reuses the canonical enterprise cards and field-news carousel
  // from their own pages, so load those page snapshots alongside the homepage.
  const keys = [`site-global`, `page:${slug}`]
  if (slug === '/') keys.push('page:/enterprise-development', 'page:/social-development')
  const map = await readDocuments(keys, true)
  return Object.fromEntries(map.entries())
}

const cachedPublicDocuments = unstable_cache(
  async (slug: string) => readPublicDocumentsCached(slug),
  ['srizony-public-site-v3-home-references'],
  { revalidate: 60, tags: ['site-content'] },
)

async function getCmsNavigation(): Promise<{ primaryNav: NavItem[]; navGroups: NavGroup[] }> {
  const database = db
  // Navigation remains CMS-controlled at runtime even when the legacy static-content
  // fallback is enabled. Only build-time rendering uses bundled navigation.
  if (isProductionBuild()) return filterNavigation(systemData.navGroups, systemData.primaryNav)
  if (!database) {
    if (process.env.CMS_STATIC_FALLBACK === 'true') return filterNavigation(systemData.navGroups, systemData.primaryNav)
    throw new Error('DATABASE_URL is required to render public navigation. Configure the database and run npm run db:bootstrap.')
  }
  const rows = await withDbRetry(() => database.execute(sql`
    SELECT g.id AS group_id, g.key AS group_key, g.label_en AS group_label_en, g.label_bn AS group_label_bn, g.sort_order AS group_sort_order,
           i.id AS item_id, i.parent_id, i.label_en, i.label_bn, i.href, i.featured, i.sort_order, i.menu_type, i.content_types
    FROM nav_groups g
    LEFT JOIN nav_items i ON i.group_id = g.id
    ORDER BY g.sort_order ASC, i.parent_id NULLS FIRST, i.sort_order ASC, i.id ASC
  `))
  type Row = Record<string, unknown>
  const groups = new Map<number, { key: string; label: { en: string; bn: string }; sort: number; items: Row[] }>()
  for (const row of rows.rows as Row[]) {
    const groupId = Number(row.group_id)
    if (!groups.has(groupId)) groups.set(groupId, { key: String(row.group_key), label: { en: String(row.group_label_en), bn: String(row.group_label_bn) }, sort: Number(row.group_sort_order || 0), items: [] })
    if (row.item_id != null) groups.get(groupId)!.items.push(row)
  }
  const buildItems = (items: Row[], parentId: number | null): NavItem[] => items.filter((row) => (row.parent_id == null ? parentId === null : Number(row.parent_id) === parentId)).sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0) || Number(a.item_id)-Number(b.item_id)).map((row) => {
    const children = buildItems(items, Number(row.item_id))
    const sectionTypes = ['richText','stats','cards','gallery','timeline','diagram','table','video','cta','noticeList','contact','donation','carousel','contentFeed','reports'] as const
    let rawComponents: unknown = row.content_types
    if (typeof rawComponents === 'string') { try { rawComponents = JSON.parse(rawComponents) } catch { rawComponents = [] } }
    const validComponents = Array.isArray(rawComponents) ? rawComponents.filter((v): v is typeof sectionTypes[number] => typeof v === 'string' && sectionTypes.includes(v as typeof sectionTypes[number])) : []
    const renderedComponents = validComponents.length ? Array.from(new Set(validComponents)) : undefined
    return { label: { en: String(row.label_en), bn: String(row.label_bn) }, href: String(row.href), featured: Boolean(row.featured), menuType: row.menu_type === 'external' ? 'external' as const : 'page' as const, renderedComponents, children: children.length ? children : undefined }
  })
  const orderedGroups = Array.from(groups.values()).sort((a,b) => a.sort-b.sort)
  const primaryGroup = orderedGroups.find((group) => group.key === 'primary')
  const rawPrimaryNav = primaryGroup ? buildItems(primaryGroup.items, null) : []
  const rawNavGroups = orderedGroups.filter((group) => group.key !== 'primary').map((group) => ({ label: group.label, items: buildItems(group.items, null) }))
  const { primaryNav, navGroups } = filterNavigation(rawNavGroups, rawPrimaryNav)

  // Navigation remains fully CMS-controlled: editors may rename entries, move them,
  // or remove links without the public site rejecting the whole navigation tree.
  if (!primaryNav.length && !navGroups.length) {
    throw new Error('CMS navigation is empty. Run npm run db:seed to populate navigation in PostgreSQL before serving public content.')
  }
  return { primaryNav, navGroups }
}

async function savePage(database: NonNullable<typeof db>, slug: string, value: unknown, actorEmail?: string, expectedUpdatedAt?: string) {
  const data = (value || {}) as Partial<PageData>
  // The root route is the landing page, not an ordinary navigation page. Keep it published at all times.
  const status = slug === '/' ? 'published' : data.status && ['draft', 'published', 'archived'].includes(data.status) ? data.status : 'published'
  const sortOrder = Number.isInteger(data.sortOrder) && Number(data.sortOrder) >= 0 ? Number(data.sortOrder) : 0
  const titleEn = data.title?.en || slug
  const titleBn = data.title?.bn || titleEn
  const subtitleEn = data.subtitle?.en || null
  const subtitleBn = data.subtitle?.bn || null
  const heroTone = data.heroTone || null
  const metaDescriptionEn = data.metaDescription?.en || null
  const metaDescriptionBn = data.metaDescription?.bn || null
  const storedValue = { ...(value as Record<string, unknown>), status, sortOrder }
  if (expectedUpdatedAt) {
    const current = await withDbRetry(() => database.execute(sql`SELECT updated_at FROM pages WHERE slug = ${slug} LIMIT 1`))
    const currentUpdatedAt = current.rows[0] && String((current.rows[0] as Record<string, unknown>).updated_at || '')
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

export async function saveDocument(key: string, value: unknown, type: string, actorEmail?: string, expectedUpdatedAt?: string) {
  const database = db
  if (!database) throw new Error('DATABASE_URL is not configured')
  if (key === 'site-global') {
    if (expectedUpdatedAt) {
      const current = await withDbRetry(() => database.execute(sql`SELECT updated_at FROM site_global_state WHERE id = 1 LIMIT 1`))
      const currentUpdatedAt = current.rows[0] && String((current.rows[0] as Record<string, unknown>).updated_at || '')
      if (!currentUpdatedAt || new Date(currentUpdatedAt).getTime() !== new Date(expectedUpdatedAt).getTime()) throw new Error('CMS_CONFLICT')
    }
    await withDbRetry(() => database.execute(sql`
      INSERT INTO site_global_state (id, value, updated_at) VALUES (1, ${jsonb(value)}, now())
      ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `))
    revalidatePath('/', 'layout')
    revalidateTag('site-content', 'max')
    return
  }
  if (key.startsWith('page:')) {
    const slug = resolvePagePath(key.slice('page:'.length))
    await savePage(database, slug, value, actorEmail, expectedUpdatedAt)
    revalidatePath(slug === '/' ? '/' : slug)
    revalidatePath(slug === '/' ? '/bn' : `/bn${slug}`)
    revalidateTag('site-content', 'max')
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
    await withDbRetry(() => database.execute(sql`DELETE FROM pages WHERE slug = ${resolvePagePath(key.slice('page:'.length))}`))
    return
  }
  throw new Error('Unsupported CMS document key.')
}

function normalizeGlobal(value: any) { return value && typeof value === 'object' ? value : null }

async function getDatabaseSdgSteps() {
  if (!db) return []
  try {
    const result = await withDbRetry(() => db!.execute(sql`SELECT id, number_value, en, bn, en_text, bn_text FROM sdg_steps ORDER BY sort_order ASC, id ASC`))
    return (result.rows as Array<Record<string, unknown>>).map((row) => ({
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

function portfolioBilingual(value: unknown): { en: string; bn: string } {
  if (typeof value === 'string') return { en: value.trim(), bn: value.trim() }
  if (!value || typeof value !== 'object') return { en: '', bn: '' }
  const record = value as Record<string, unknown>
  const en = typeof record.en === 'string' ? record.en.trim() : ''
  const bn = typeof record.bn === 'string' ? record.bn.trim() : ''
  return { en: en || bn, bn: bn || en }
}

function hasPortfolioCopy(value: unknown) {
  const valueBi = portfolioBilingual(value)
  return Boolean(valueBi.en || valueBi.bn)
}

function portfolioPeopleItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((person: any) => {
    const title = portfolioBilingual(person?.name ?? person?.title ?? person?.label)
    const role = portfolioBilingual(person?.role ?? person?.designation ?? person?.position)
    const bio = portfolioBilingual(person?.bio ?? person?.description ?? person?.summary)
    const combinedTitle = {
      en: [title.en, role.en && role.en !== title.en ? role.en : ''].filter(Boolean).join(' — '),
      bn: [title.bn, role.bn && role.bn !== title.bn ? role.bn : ''].filter(Boolean).join(' — '),
    }
    const imageSrc = typeof person?.image === 'string' ? person.image : typeof person?.photo === 'string' ? person.photo : ''
    return {
      title: combinedTitle,
      body: bio.en || bio.bn ? bio : undefined,
      image: imageSrc ? { src: imageSrc, alt: title } : undefined,
      href: typeof person?.href === 'string' ? person.href : undefined,
      tag: role.en || role.bn ? role : undefined,
      icon: 'users' as const,
    }
  }).filter((item) => item.title.en || item.title.bn)
}

function applyPortfolioToPage(page: PageData, global: Record<string, any>): PageData {
  const portfolio = global.portfolio && typeof global.portfolio === 'object' ? global.portfolio : {}
  const contact = global.contactInfo && typeof global.contactInfo === 'object' ? global.contactInfo : {}
  const slug = page.slug || ''
  let sections = [...(page.sections || [])]
  const about = portfolioBilingual(portfolio.about)
  const mission = portfolioBilingual(portfolio.mission)
  const vision = portfolioBilingual(portfolio.vision)
  const values = Array.isArray(portfolio.values) ? portfolio.values : []

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
      if (section.type === 'cards' && /mission|goal|value/i.test(section.heading?.en || '')) {
        const items: any[] = []
        if (hasPortfolioCopy(portfolio.mission)) items.push({ title: { en: 'Mission', bn: 'মিশন' }, body: mission, icon: 'heart' })
        if (hasPortfolioCopy(portfolio.vision)) items.push({ title: { en: 'Vision', bn: 'দৃষ্টিভঙ্গি' }, body: vision, icon: 'leaf' })
        for (const value of values) {
          const title = portfolioBilingual((value as any)?.title ?? (value as any)?.name)
          const body = portfolioBilingual((value as any)?.description ?? (value as any)?.body)
          if (title.en || title.bn) items.push({ title, body: body.en || body.bn ? body : undefined, icon: 'users' })
        }
        if (items.length) return { ...section, heading: { en: 'Mission, Vision & Values', bn: 'মিশন, ভিশন ও মূল্যবোধ' }, items: items as any, columns: 3 as const }
      }
      return section
    })
  }

  if (slug === '/mission-vision' || slug === '/mission-and-vision') {
    const items: any[] = []
    if (hasPortfolioCopy(portfolio.mission)) items.push({ title: { en: 'Mission', bn: 'মিশন' }, body: mission, icon: 'heart' })
    if (hasPortfolioCopy(portfolio.vision)) items.push({ title: { en: 'Vision', bn: 'দৃষ্টিভঙ্গি' }, body: vision, icon: 'leaf' })
    for (const value of values) {
      const title = portfolioBilingual((value as any)?.title ?? (value as any)?.name)
      const body = portfolioBilingual((value as any)?.description ?? (value as any)?.body)
      if (title.en || title.bn) items.push({ title, body: body.en || body.bn ? body : undefined, icon: 'users' })
    }
    if (items.length) sections = [{ type: 'cards', heading: { en: 'Mission, Vision & Values', bn: 'মিশন, ভিশন ও মূল্যবোধ' }, columns: 3, items } as any, ...sections.filter((section) => section.type !== 'cards')]
  }

  if (slug === '/governing-body' && Array.isArray(portfolio.governingBody) && portfolio.governingBody.length) {
    const items = portfolioPeopleItems(portfolio.governingBody)
    sections = sections.map((section) => section.type === 'cards' && /governing body|member/i.test(section.heading?.en || '') ? { ...section, items: items as any } : section)
  }
  if (slug === '/executive-committee' && Array.isArray(portfolio.executiveCommittee) && portfolio.executiveCommittee.length) {
    const items = portfolioPeopleItems(portfolio.executiveCommittee)
    const matching = sections.findIndex((section) => section.type === 'cards')
    if (matching >= 0) sections[matching] = { ...(sections[matching] as any), heading: { en: 'Executive Committee Members', bn: 'নির্বাহী কমিটির সদস্যবৃন্দ' }, items } as any
    else sections.push({ type: 'cards', heading: { en: 'Executive Committee Members', bn: 'নির্বাহী কমিটির সদস্যবৃন্দ' }, columns: 3, items } as any)
  }
  if (slug === '/senior-management' && Array.isArray(portfolio.seniorManagement) && portfolio.seniorManagement.length) {
    const items = portfolioPeopleItems(portfolio.seniorManagement)
    const matching = sections.findIndex((section) => section.type === 'cards')
    if (matching >= 0) sections[matching] = { ...(sections[matching] as any), items } as any
  }
  if (['/teams', '/team', '/our-team', '/our-people'].includes(slug) && Array.isArray(portfolio.teams) && portfolio.teams.length) {
    const items = portfolioPeopleItems(portfolio.teams)
    const matching = sections.findIndex((section) => section.type === 'cards')
    if (matching >= 0) sections[matching] = { ...(sections[matching] as any), items } as any
  }

  // Shared contact data is the source of truth for every rendered contact section.
  if (contact && (contact.address || contact.primaryPhone || contact.email || contact.footprint)) {
    sections = sections.map((section) => {
      if (section.type !== 'contact') return section
      const footprint = Array.isArray(contact.footprint) ? contact.footprint.map((loc: any) => ({
        name: portfolioBilingual(loc.name),
        address: portfolioBilingual(loc.address),
        mapQuery: String(loc.mapQuery || loc.address?.en || loc.name?.en || ''),
        phone: typeof loc.phone === 'string' ? loc.phone : undefined,
        email: typeof loc.email === 'string' ? loc.email : undefined,
        kind: loc.kind === 'site' || loc.kind === 'branch' ? loc.kind : 'footprint',
      })) : section.locations
      return {
        ...section,
        address: hasPortfolioCopy(contact.address) ? portfolioBilingual(contact.address) : section.address,
        phones: Array.isArray(contact.phones) && contact.phones.length ? contact.phones : contact.primaryPhone ? [contact.primaryPhone] : section.phones,
        emails: contact.email ? [String(contact.email)] : section.emails,
        locations: footprint,
      }
    })
  }

  return { ...page, sections }
}

export async function getPublicSiteSnapshot(path = '/') {
  const canonicalSlug = resolvePagePath(path)
  // Public content never silently falls back to data.ts at runtime. Use the bundled
  // catalogue only during the build or when an operator explicitly enables preview mode.
  const useStaticFallback = process.env.CMS_STATIC_FALLBACK === 'true' || isProductionBuild()
  const cachedDocs = useStaticFallback ? {} : await cachedPublicDocuments(canonicalSlug)
  const docs = new Map<string, unknown>(Object.entries(cachedDocs))
  const globalOverride = normalizeGlobal(docs.get('site-global'))
  const rawPageOverride = docs.get(`page:${canonicalSlug}`) as (Partial<PageData> & { __cmsMeta?: { status?: string; sortOrder?: number; updatedAt?: string }; __unpublished?: boolean }) | undefined
  const pageOverride = rawPageOverride ? { ...rawPageOverride } : undefined
  if (pageOverride) { delete pageOverride.__cmsMeta; delete pageOverride.__unpublished }

  const serializableDonationInfo = donationInfo.map(({ icon: _icon, ...item }) => ({ ...item, icon: item.id }))
  const sdgSteps = useStaticFallback ? SDGsteps.map(({ Icon: _Icon, ...step }) => step) : await getDatabaseSdgSteps()
  const override = globalOverride || {}
  // Load navigation from the CMS database on every runtime snapshot. The general
  // static fallback may still supply bundled page content, but must never mask CMS
  // navigation edits after an administrator saves them.
  const navigation = isProductionBuild()
    ? { primaryNav: systemData.primaryNav, navGroups: systemData.navGroups }
    : await getCmsNavigation()
  const overrideUi = override.ui && typeof override.ui === 'object' ? override.ui as Record<string, any> : {}
  const themeOverrides = override.themes && typeof override.themes === 'object' ? override.themes as Record<string, unknown> : {}
  const mergedThemes = Object.fromEntries(Object.entries(systemData.themes).map(([name, base]) => [name, { ...base, ...(themeOverrides[name] && typeof themeOverrides[name] === 'object' ? themeOverrides[name] : {}) }]))
  const customThemeEntries = Object.entries(themeOverrides).filter(([name]) => !(name in systemData.themes)).map(([name, value]) => [name, value])
  const global = {
    ...(useStaticFallback ? systemData : { primaryNav: [], navGroups: [], themes: systemData.themes, ui: systemData.ui }), ...override, ...navigation,
    // Keep complete homepage hero defaults available for older global snapshots while honoring CMS overrides.
    homeHero: {
      ...systemData.homeHero,
      ...(override.homeHero && typeof override.homeHero === 'object' ? override.homeHero : {}),
      slides: Array.isArray((override.homeHero as any)?.slides) ? (override.homeHero as any).slides : systemData.homeHero.slides,
      stats: Array.isArray((override.homeHero as any)?.stats) ? (override.homeHero as any).stats : systemData.homeHero.stats,
    },
    // The seeded PostgreSQL global snapshot is the source of truth for payment options; bundled entries are only a missing-field bootstrap default.
    donationInfo: Array.isArray(override.donationInfo) ? override.donationInfo : Array.isArray(override.paymentInfo) ? override.paymentInfo : serializableDonationInfo,
    SDGsteps: sdgSteps,
    ui: { ...systemData.ui, ...overrideUi, en: { ...systemData.ui.en, ...(overrideUi.en || {}) }, bn: { ...systemData.ui.bn, ...(overrideUi.bn || {}) } },
    themes: { ...mergedThemes, ...Object.fromEntries(customThemeEntries) },
  }
  const fallbackPage = (useStaticFallback || canonicalSlug === '/') ? (contentData.allPages[canonicalSlug] ?? null) : null
  if (canonicalSlug !== '/' && rawPageOverride?.__unpublished) return { global, page: null, canonicalSlug, notFound: true, updatedAt: rawPageOverride.__cmsMeta?.updatedAt || null }
  // Detail pages are assembled from cms_content_items at request time. This deliberately
  // takes precedence over the old page.render_cache snapshot so CMS edits are visible.
  const cmsDetail = useStaticFallback ? { handled: false, page: null } : await getPublishedContentDetailPage(canonicalSlug)
  if (cmsDetail.handled && !cmsDetail.page) return { global, page: null, canonicalSlug, notFound: true, updatedAt: null }
  let page = cmsDetail.handled ? cmsDetail.page : pageOverride ? ({ ...fallbackPage, ...pageOverride } as PageData) : fallbackPage

  // Normalize the homepage sections once; the homepage renderer maps managed components by
  // CMS section identity and renders any added generic section through SectionRenderer.
  if (canonicalSlug === '/' && page) page = ensureLandingPageSections(page, !pageOverride)

  // Field-news cards are managed as CMS project items. The JSON page snapshot keeps the
  // section layout, while published CMS items supply its live cards at runtime.
  if (!useStaticFallback && page && (canonicalSlug === '/' || canonicalSlug === '/social-development')) {
    const fieldItems = await getPublishedFieldNews(12)
    page = {
      ...page,
      sections: page.sections.map((section) => {
        const sectionHeading = (section.type === 'carousel' ? section.heading?.en : '')?.trim().toLowerCase()
        const isLandingStoryRail = canonicalSlug === '/' && section.type === 'carousel' && (
          section.homeComponent === 'stories' || sectionHeading === 'success story of srizony' || sectionHeading === 'news from the field'
        )
        const isFieldNews = section.type === 'carousel' && (section.dataSource !== 'manual') && (isLandingStoryRail || canonicalSlug === '/social-development')
        if (!isFieldNews || section.type !== 'carousel') return section
        return {
          ...section,
          ...(canonicalSlug === '/social-development' ? {
            eyebrow: undefined,
            heading: { en: 'News from the Field', bn: 'মাঠপর্যায়ের সংবাদ' },
            body: undefined,
          } : {}),
          presentation: 'scroller' as const,
          items: fieldItems.map((entry) => ({
            title: entry.title,
            body: entry.summary,
            // Keep cards structurally complete if an editor publishes an item before attaching a photo.
            // This is only a remote stock-image presentation placeholder; all story text remains CMS data.
            image: { src: entry.image || 'https://images.unsplash.com/photo-1766858669684-4e501b3b9f9f?auto=format&fit=crop&w=1600&q=85', alt: entry.title },
            href: entry.href || `/news/${entry.slug}`,
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
    const catalogueConfig: Record<string, { component: 'project' | 'news' | 'enterprise' | 'notice' | 'partner-agency' | 'health-service' | 'loan-product'; fallbackImage: string; route: string }> = {
      '/projects': { component: 'project', fallbackImage: '/images/general/project-3.jpg', route: '/projects' },
      '/news': { component: 'news', fallbackImage: '/images/general/project-2.jpg', route: '/news' },
      '/enterprise-development': { component: 'enterprise', fallbackImage: '/images/general/enterprise.jpg', route: '/enterprise' },
      '/notice': { component: 'notice', fallbackImage: '/images/general/project-1.jpg', route: '/notice' },
      '/partners-networks': { component: 'partner-agency', fallbackImage: '/images/field/partnership.jpg', route: '/partners-networks' },
      '/health-program': { component: 'health-service', fallbackImage: '/images/programs/health-program.jpg', route: '/health-program' },
      '/loans': { component: 'loan-product', fallbackImage: '/images/loans/small-enterprise-loan.jpg', route: '/loans' },
    }
    const config = catalogueConfig[canonicalSlug]
    const collection = config && db ? await getPublishedFeed([config.component], 100) : []
    if (config && db) {
      const cards = collection.map((entry, index) => ({
        title: entry.title,
        body: entry.summary,
        href: entry.href || `${config!.route}/${entry.slug}`,
        image: entry.image ? { src: entry.image, alt: entry.title } : undefined,
        icon: (config!.component === 'health-service' ? 'heart' : config!.component === 'partner-agency' ? 'building' : config!.component === 'loan-product' ? 'coins' : 'briefcase') as any,
        tag: config!.component === 'loan-product' ? { en: 'Loan product', bn: 'ঋণ পণ্য' } : undefined,
      }))
      page = {
        ...page,
        sections: page.sections.map((section) => {
          if (canonicalSlug === '/projects' && section.type === 'carousel' && section.collectionKind === 'projects') {
            return { ...section, items: collection.map((entry) => ({ title: entry.title, body: entry.summary, image: { src: entry.image || config!.fallbackImage, alt: entry.title }, href: entry.href || `${config!.route}/${entry.slug}` })) }
          }
          if (canonicalSlug === '/news' && section.type === 'carousel' && section.collectionKind === 'news') {
            return { ...section, items: collection.map((entry) => ({ title: entry.title, body: entry.summary, image: { src: entry.image || config!.fallbackImage, alt: entry.title }, href: entry.href || `${config!.route}/${entry.slug}`, tag: { en: entry.date, bn: entry.date } })) }
          }
          if (canonicalSlug === '/enterprise-development' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'srizony enterprises') {
            return { ...section, items: cards }
          }
          if (canonicalSlug === '/partners-networks' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'partnership focus') {
            return { ...section, heading: { en: 'Present Donor & Partner Agencies', bn: 'বর্তমান দাতা ও অংশীদার সংস্থা' }, columns: 3 as const, items: cards }
          }
          if (canonicalSlug === '/health-program' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'service components') {
            return { ...section, items: cards }
          }
          if (canonicalSlug === '/loans' && section.type === 'cards' && (section.heading?.en || '').trim().toLowerCase() === 'loan products') {
            return { ...section, items: cards }
          }
          if (canonicalSlug === '/notice' && section.type === 'noticeList') {
            return { ...section, items: collection.map((entry) => ({ date: entry.date, title: entry.title, body: entry.summary, href: entry.href || `${config!.route}/${entry.slug}` })) }
          }
          return section
        }),
      }
    }
  }

  // The home page also shares the live enterprise collection instead of freezing the
  // seed-time cards inside pages.render_cache.
  if (!useStaticFallback && page && canonicalSlug === '/') {
    const enterpriseItems = await getPublishedFeed(['enterprise'], 8)
    if (db) {
      page = {
        ...page,
        sections: page.sections.map((section) => {
          const homeComponent = String(section.homeComponent ?? '').trim().toLowerCase()
          const isEnterpriseSection = section.type === 'cards' && section.dataSource !== 'manual' && (
            (section.heading?.en || '').trim().toLowerCase() === 'srizony enterprises'
            || homeComponent === 'enterprises'
            || section.items.some((item) => item.href?.startsWith('/enterprise/'))
          )
          return isEnterpriseSection
            ? { ...section, heading: { en: 'Srizony Enterprises', bn: 'সৃজনী উদ্যোগসমূহ' }, items: enterpriseItems.map((entry) => ({
                title: entry.title, body: entry.summary, href: entry.href || `/enterprise/${entry.slug}`,
                image: entry.image ? { src: entry.image, alt: entry.title } : undefined, icon: 'building' as const,
              })) }
            : section
        }),
      }
    }
  }

  if (canonicalSlug === '/reports' && page && (!page.sections?.some((section) => section.type === 'reports'))) {
    const reportFallback = (fallbackPage?.sections || []).find((section) => section.type === 'reports')
    const legacyCta = page.sections?.find((section) => section.type === 'cta')
    page = reportFallback ? { ...page, sections: legacyCta ? [reportFallback, legacyCta] : [reportFallback] } : page
  }
  if (page && !isProductionBuild() && page.sections?.some((section) => section.type === 'contentFeed')) {
    // Content feeds are filled on the server so components never call an API for their data.
    page = { ...page, sections: await Promise.all(page.sections.map(async (section) => section.type === 'contentFeed' ? { ...section, items: await getPublishedFeed(section.components) } : section)) }
  }
  if (page) page = applyPortfolioToPage(page, global as Record<string, any>)
  return { global, page, canonicalSlug, notFound: !page, updatedAt: rawPageOverride?.__cmsMeta?.updatedAt || null }
}

export async function getThemeConfig() {
  const docs = await readDocuments(['site-global'])
  const override = normalizeGlobal(docs.get('site-global'))
  const themeOverrides = override?.themes && typeof override.themes === 'object' ? override.themes as Record<string, unknown> : {}
  const mergedThemes = Object.fromEntries(Object.entries(systemData.themes).map(([name, base]) => [name, { ...base, ...(themeOverrides[name] && typeof themeOverrides[name] === 'object' ? themeOverrides[name] : {}) }]))
  const customThemeEntries = Object.entries(themeOverrides).filter(([name]) => !(name in systemData.themes))
  return { themes: { ...mergedThemes, ...Object.fromEntries(customThemeEntries) } }
}

export function getFallbackGlobal() {
  return { ...systemData, donationInfo: donationInfo.map(({ icon: _icon, ...item }) => ({ ...item, icon: item.id })), SDGsteps: SDGsteps.map(({ Icon: _Icon, ...step }) => step) }
}

async function getAvailableMenus() {
  const navigation = await getCmsNavigation()
  const normalize = (items: NavItem[]): any[] => items.map((item) => ({ label: item.label, href: item.href, children: Array.isArray(item.children) ? normalize(item.children) : undefined }))
  return [{ key: 'primary', label: { en: 'Main Navigation', bn: 'প্রধান নেভিগেশন' }, items: normalize(navigation.primaryNav) }, ...navigation.navGroups.map((group) => ({ key: group.label.en, label: group.label, items: normalize(group.items) }))]
}

export async function getCmsEditorData(slug?: string) {
  if (!slug) {
    const docs = await readDocuments(['site-global'])
    const database = db
    let updatedAt: string | undefined
    if (database) {
      const result = await withDbRetry(() => database.execute(sql`SELECT updated_at FROM site_global_state WHERE id = 1 LIMIT 1`))
      updatedAt = result.rows[0] && String((result.rows[0] as Record<string, unknown>).updated_at || '')
    }
    return { global: normalizeGlobal(docs.get('site-global')) || getFallbackGlobal(), updatedAt }
  }
  const canonicalSlug = resolvePagePath(slug)
  const docs = await readDocuments([`page:${canonicalSlug}`])
  const rawOverride = docs.get(`page:${canonicalSlug}`) as Record<string, unknown> | undefined
  const meta = rawOverride?.__cmsMeta
  const fallback = ensureLandingPageSections(getFallbackPage(canonicalSlug))
  let override = rawOverride ? { ...rawOverride } : null
  if (override) {
    delete override.__cmsMeta
    delete override.__unpublished
  }
  if (canonicalSlug === '/') {
    const source = { ...(fallback || {}), ...(override || {}), slug: '/' } as PageData
    source.sections = Array.isArray(override?.sections) ? override!.sections as PageData['sections'] : (fallback?.sections || [])
    override = ensureLandingPageSections(source, !rawOverride) as unknown as Record<string, unknown>
  }
  return { slug: canonicalSlug, fallback, override: override || null, meta: canonicalSlug === '/' ? { ...(meta || {}), status: 'published' } : (meta || null) }
}

export async function getCmsMenuIndex() {
  const fallbackPages = Object.values(contentData.allPages)
  const database = db
  if (!database || isProductionBuild()) return { availablePages: fallbackPages.map((page) => ({ slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published', sortOrder: 0 })), availableMenus: await getAvailableMenus() }
  try {
    const rows = await withDbRetry(() => database.execute(sql`
      SELECT slug, title_en, title_bn, subtitle_en, subtitle_bn, status, updated_at, sort_order
      FROM pages ORDER BY sort_order ASC, slug ASC
    `))
    const availablePages = new Map<string, any>()
    const bundledHome = fallbackPages.find((page) => page.slug === '/')
    if (bundledHome) availablePages.set('/', { slug: '/', title: bundledHome.title, subtitle: bundledHome.subtitle, status: 'published', sortOrder: -1 })
    if (process.env.CMS_STATIC_FALLBACK === 'true' || isProductionBuild()) fallbackPages.forEach((page) => availablePages.set(page.slug, { slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published', sortOrder: page.slug === '/' ? -1 : 0 }))
    for (const raw of rows.rows as Array<Record<string, unknown>>) {
      const slug = String(raw.slug)
      const fallback = availablePages.get(slug)
      availablePages.set(slug, {
        slug, title: { en: String(raw.title_en || fallback?.title.en || slug), bn: String(raw.title_bn || fallback?.title.bn || '') },
        subtitle: raw.subtitle_en || raw.subtitle_bn ? { en: String(raw.subtitle_en || fallback?.subtitle?.en || ''), bn: String(raw.subtitle_bn || fallback?.subtitle?.bn || '') } : fallback?.subtitle,
        status: slug === '/' ? 'published' : String(raw.status || 'published'), sortOrder: slug === '/' ? -1 : Number(raw.sort_order || 0),
        updatedAt: raw.updated_at instanceof Date ? raw.updated_at.toISOString() : String(raw.updated_at || ''),
      })
    }
    return { availablePages: Array.from(availablePages.values()), availableMenus: await getAvailableMenus() }
  } catch (error) {
    console.error('CMS menu index read failed', error)
    throw error instanceof Error ? error : new Error('Unable to read CMS menu index.')
  }
}

export async function getAllCmsContent() {
  const fallbackPages = Object.values(contentData.allPages)
  const fallbackGlobal = getFallbackGlobal()
  const database = db
  if (!database || isProductionBuild()) return {
    global: fallbackGlobal,
    overrides: {},
    availablePages: fallbackPages.map((page) => ({ slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published', sortOrder: 0 })),
    availableMenus: await getAvailableMenus(),
  }
  try {
    const [globalResult, pageResult] = await Promise.all([
      withDbRetry(() => database.execute(sql`SELECT value FROM site_global_state WHERE id = 1 LIMIT 1`)),
      withDbRetry(() => database.execute(sql`SELECT slug, render_cache, status FROM pages ORDER BY sort_order ASC, slug ASC`)),
    ])
    const overrides = new Map<string, unknown>()
    for (const raw of pageResult.rows as Array<Record<string, unknown>>) {
      if (raw.render_cache && typeof raw.render_cache === 'object') overrides.set(String(raw.slug), raw.render_cache)
    }
    const availablePages = new Map<string, any>()
    const useStaticFallback = process.env.CMS_STATIC_FALLBACK === 'true' || isProductionBuild()
    if (useStaticFallback) fallbackPages.forEach((page) => availablePages.set(page.slug, { slug: page.slug, title: page.title, subtitle: page.subtitle, status: 'published' }))
    for (const raw of pageResult.rows as Array<Record<string, unknown>>) {
      if (String(raw.status || 'published') !== 'published') continue
      const slug = String(raw.slug)
      const page = overrides.get(slug) as any
      if (page && typeof page === 'object') availablePages.set(slug, { slug, title: page.title || { en: slug, bn: slug }, subtitle: page.subtitle, status: 'published' })
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

    const normalizedGlobal = normalizeGlobal((globalResult.rows[0] as Record<string, unknown> | undefined)?.value)
    if (!normalizedGlobal && !useStaticFallback) throw new Error('CMS global state is missing. Run the database seed before serving CMS content.')
    return { global: (normalizedGlobal || fallbackGlobal) as any, overrides: Object.fromEntries(overrides.entries()), availablePages: Array.from(availablePages.values()), availableMenus: await getAvailableMenus() }
  } catch (error) {
    console.error('CMS content read failed', error)
    throw error instanceof Error ? error : new Error('Unable to read CMS content.')
  }
}

const normalizeLandingHeading = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
const isLandingAreasSection = (section: any) => section?.type === 'cards' && normalizeLandingHeading(section.heading?.en) === 'integrated development areas'
const LANDING_MANAGED_SECTION_KEYS = [
  ['hero', 'carousel', 'landing page hero'],
  ['growth', 'stats', 'growing together'],
  ['missionVisionValues', 'cards', 'mission, vision & values'],
  ['locations', 'richText', 'our offices across bangladesh'],
  ['developmentAreas', 'cards', 'integrated development areas'],
  ['stories', 'carousel', 'success story of srizony'],
  ['donate', 'cta', 'support srizony'],
] as const
function isManagedLandingSection(section: any, type: string, heading: string) {
  return section?.type === type && normalizeLandingHeading(section.heading?.en) === heading
}

/**
 * Normalize stable identities for custom homepage modules without suppressing older generic
 * sections. A missing managed section is seeded only when there is no saved page override;
 * once a CMS editor has saved the root page, removing a section is respected.
 */
function ensureLandingPageSections(page: PageData | null, addMissingManaged = true): PageData | null {
  if (!page || page.slug !== '/') return page
  const currentSections = Array.isArray(page.sections) ? [...page.sections] : []
  const defaults = contentData.allPages['/']?.sections || []
  const defaultFor = (type: string, heading: string) => defaults.find((section) => isManagedLandingSection(section, type, heading))
  const legacyStories = currentSections.find((section): section is Extract<PageData['sections'][number], { type: 'carousel' }> => isManagedLandingSection(section, 'carousel', 'news from the field'))
  const storiesFallback = defaults.find((section): section is Extract<PageData['sections'][number], { type: 'carousel' }> => isManagedLandingSection(section, 'carousel', 'success story of srizony'))
  if (legacyStories && storiesFallback) {
    legacyStories.homeComponent = 'stories'
    legacyStories.eyebrow = storiesFallback.eyebrow
    legacyStories.heading = storiesFallback.heading
  }
  for (const [component, type, heading] of LANDING_MANAGED_SECTION_KEYS) {
    const current = currentSections.find((section) => section.homeComponent === component || isManagedLandingSection(section, type, heading))
    if (current) {
      current.homeComponent = component
      continue
    }
    if (addMissingManaged) {
      const fallback = defaultFor(type, heading)
      if (fallback) currentSections.push({ ...fallback, homeComponent: component })
    }
  }
  if (addMissingManaged && !currentSections.some((section) => section.homeComponent === 'developmentAreas' || isLandingAreasSection(section))) {
    const fallback = defaults.find(isLandingAreasSection)
    if (fallback) currentSections.push({ ...fallback, homeComponent: 'developmentAreas' })
  }
  return { ...page, slug: '/', sections: currentSections }
}

export function getFallbackPage(slug: string) { return contentData.allPages[resolvePagePath(slug)] ?? null }
export type PublicSiteGlobal = Awaited<ReturnType<typeof getPublicSiteSnapshot>>['global']
