import { sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { db, withDbRetry } from '@/lib/db'
import { saveDocument } from '@/lib/site'
import type { PageData, PageSection, Section } from '@/types/entityType'
import { CONTENT_COLLECTION_ROUTES } from './components'
import { ensureCmsSchema } from './ensureSchema'
import { canonicalizeCmsRoute, getContentRouteParent } from '@/lib/cms/routes'
import { parseRenderedComponents, RENDERED_COMPONENT_TYPES } from './rendered-components'
export { RENDERED_COMPONENT_TYPES } from './rendered-components'

type Row = Record<string, any>
export type MenuType = 'page' | 'external' | 'folder'
export type SectionButtonType = 'none' | 'primary' | 'secondary' | 'both'
export type NavNode = { id: number; parentId?: number | null; labelEn: string; labelBn: string; slug: string; visible: boolean; isLandingPage?: boolean; renderedComponents: Section['type'][]; menuType: MenuType; sectionCount: number; sectionContentType: Section['type']; sectionButtonType: SectionButtonType; children: NavNode[] }
export type NavGroupTree = { id: number; key: string; labelEn: string; labelBn: string; landingId: number; items: NavNode[] }
export class NavError extends Error { constructor(message: string, public status = 400) { super(message) } }

// One navigation tree: Home is fixed and all descendant levels are editable.
const SLUG = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const RESERVED = /^\/(admin|api|bn|_next|search|unsubscribe|home)(\/|$)/
const SECTION_TYPES: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']
const BUTTON_TYPES: SectionButtonType[] = ['none', 'primary', 'secondary', 'both']
const database = () => { if (!db) throw new NavError('DATABASE_URL is not configured', 503); return db }
const run = (q: ReturnType<typeof sql>) => withDbRetry(() => database().execute(q))

/**
 * Normalize legacy multi-group data into one navigation tree. Home is the only
 * root; all previous group records are merged into the primary navigation.
 * The explicit hierarchy itself is installed by migration 0016.
 */
async function ensureLandingRootHierarchy() {
  await run(sql`INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
    VALUES ('primary', 'Site Navigation', 'সাইট নেভিগেশন', 0)
    ON CONFLICT (key) DO NOTHING`)
  const primary = (await run(sql`SELECT id FROM nav_groups WHERE key = 'primary' LIMIT 1`)).rows[0] as Row | undefined
  if (!primary) throw new NavError('The single navigation tree could not be initialized.', 503)
  const primaryId = Number(primary.id)

  let landing = (await run(sql`SELECT id FROM nav_items WHERE href = '/' AND COALESCE(menu_type, 'page') = 'page' ORDER BY CASE WHEN group_id = ${primaryId} THEN 0 ELSE 1 END, id LIMIT 1`)).rows[0] as Row | undefined
  if (!landing) {
    const inserted = await run(sql`INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
      VALUES (${primaryId}, NULL, 'Home', 'হোম', '/', 'page', 0, true) RETURNING id`)
    landing = inserted.rows[0] as Row
  }
  const landingId = Number(landing.id)

  const duplicateHomes = (await run(sql`SELECT id FROM nav_items WHERE href = '/' AND id <> ${landingId} ORDER BY id`)).rows as Row[]
  for (const duplicate of duplicateHomes) {
    const duplicateId = Number(duplicate.id)
    await run(sql`UPDATE nav_items SET parent_id = ${landingId} WHERE parent_id = ${duplicateId}`)
    await run(sql`DELETE FROM nav_items WHERE id = ${duplicateId}`)
  }

  await run(sql`UPDATE nav_items SET group_id = ${primaryId} WHERE group_id <> ${primaryId}`)
  await run(sql`UPDATE nav_items SET parent_id = ${landingId} WHERE parent_id IS NULL AND id <> ${landingId}`)
  await run(sql`UPDATE nav_items SET group_id = ${primaryId}, parent_id = NULL, sort_order = 0, is_visible = true, label_en = 'Home', label_bn = 'হোম' WHERE id = ${landingId}`)
  await run(sql`DELETE FROM nav_groups WHERE id <> ${primaryId}`)
  return landingId
}

const refresh = () => {
  revalidatePath('/', 'layout')
  revalidatePath('/api/navigation')
  revalidatePath('/api/site')
  revalidateTag('site-content', 'max')
}

export function normalizeSlug(input: string) {
  const rawSlug = '/' + input.trim().toLowerCase().replace(/^\/+|\/+$/g, '')
  const slug = canonicalizeCmsRoute(rawSlug)
  if (!SLUG.test(slug) || RESERVED.test(slug) || slug.length > 160) throw new NavError('Slug must look like /our-work using lowercase letters, numbers and hyphens, and cannot use a reserved path.')
  return slug
}

function normalizeMenuHref(input: string, menuType: MenuType) {
  if (menuType === 'folder') return ''
  if (menuType === 'external') {
    let url: URL
    try { url = new URL(input.trim()) } catch { throw new NavError('Enter a valid absolute external URL, beginning with https://.') }
    if (!['https:', 'http:'].includes(url.protocol)) throw new NavError('External menus must use http:// or https:// URLs.')
    return url.toString()
  }
  return normalizeSlug(input)
}

/** Menu routes are explicit page paths, not values inferred from their menu parent. */
function normalizeStoredMenuHref(input: string, menuType: MenuType) {
  return normalizeMenuHref(input, menuType)
}
function cleanSectionCount(value: unknown) {
  const count = Number(value)
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new NavError('Choose between 1 and 12 page sections.')
  return count
}
function cleanSectionType(value: unknown): Section['type'] {
  if (typeof value === 'string' && SECTION_TYPES.includes(value as Section['type'])) return value as Section['type']
  throw new NavError('Select a valid section content type.')
}
function cleanButtonType(value: unknown): SectionButtonType {
  if (typeof value === 'string' && BUTTON_TYPES.includes(value as SectionButtonType)) return value as SectionButtonType
  return 'none'
}

function defaultSection(type: Section['type'], titleEn: string, titleBn: string, slug: string, buttonType: SectionButtonType, index = 0): PageSection {
  const heading = { en: index ? `${titleEn} — section ${index + 1}` : titleEn, bn: index ? `${titleBn} — অংশ ${index + 1}` : titleBn }
  const blank = { en: '', bn: '' }
  const section: any = (() => {
    switch (type) {
      case 'richText': return { type, heading, body: [{ ...blank }] }
      case 'stats': return { type, items: [] }
      case 'cards': return { type, heading, items: [], columns: 3 }
      case 'gallery': return { type, heading, items: [], columns: 3 }
      case 'timeline': return { type, heading, variant: 'list', items: [] }
      case 'diagram': return { type, heading, body: blank, variant: 'impact' }
      case 'table': return { type, heading, headers: [], rows: [] }
      case 'video': return { type, heading, body: blank, poster: '', embedUrl: '', sourceUrl: '' }
      case 'cta': return { type, heading, body: blank, primary: { label: { en: 'Learn more', bn: 'আরও জানুন' }, href: '/contact' }, secondary: { label: { en: 'Contact us', bn: 'যোগাযোগ করুন' }, href: '/contact' } }
      case 'noticeList': return { type, heading, items: [] }
      case 'contact': return { type, heading, address: blank, phones: [], emails: [], locations: [] }
      case 'donation': return { type, heading, body: blank }
      case 'carousel': return { type, heading, items: [], presentation: 'collection' }
      case 'contentFeed': return { type, heading, components: ['project'], items: [], columns: 3 }
      case 'reports': return { type, heading, items: [] }
      default: return { type: 'richText', heading, body: [{ ...blank }] }
    }
  })()
  section.visible = true
  section.sectionId = `section-${slug.replace(/[^a-z0-9]+/gi, '-')}-${index + 1}`
  const defaultContentComponent = type === 'stats' ? 'stat' : type === 'reports' ? 'report' : type === 'noticeList' ? 'notice' : type === 'carousel' ? 'news' : 'project'
  const defaultLayout = type === 'carousel' ? 'carousel' : type === 'gallery' ? 'masonry' : type === 'cards' || type === 'contentFeed' || type === 'stats' ? 'grid' : 'list'
  section.contentCollection = { enabled: !['contact', 'diagram', 'video'].includes(type), component: defaultContentComponent, maxItems: type === 'cta' || type === 'donation' ? 1 : 12, layout: defaultLayout, columns: 3, gap: 24, viewportItems: 3 }
  section.buttonConfig = buttonType === 'none' ? { visible: false, mode: 'primary', label: { en: 'Learn more', bn: 'আরও জানুন' }, href: '/contact', action: 'route' } : {
    visible: true, mode: buttonType === 'both' ? 'both' : buttonType, label: { en: 'Learn more', bn: 'আরও জানুন' }, secondaryLabel: { en: 'Contact us', bn: 'যোগাযোগ করুন' }, href: '/contact', secondaryHref: '/contact', action: 'route',
  }
  if (section.type === 'cta') {
    if (buttonType === 'none') section.secondary = undefined
    else if (buttonType === 'primary') section.secondary = undefined
    else if (buttonType === 'secondary') section.primary = undefined
  }
  return section as PageSection
}

function checkRenderedComponents(value: unknown): Section['type'][] {
  const list = Array.isArray(value) ? value : []
  const parsed = Array.from(new Set(list.filter((v): v is Section['type'] => typeof v === 'string' && RENDERED_COMPONENT_TYPES.includes(v as Section['type']))))
  if (!parsed.length) throw new NavError('Select at least one rendered component for this page.')
  return parsed
}

export async function getNavigationTree(): Promise<NavGroupTree[]> {
  await ensureCmsSchema()
  const landingId = await ensureLandingRootHierarchy()
  const rows = (await run(sql`
    SELECT g.id AS gid, g.key, g.label_en AS g_en, g.label_bn AS g_bn,
           i.id, i.parent_id, i.label_en, i.label_bn, i.href, i.sort_order, i.content_types, i.menu_type, i.is_visible,
           COALESCE(CASE WHEN jsonb_typeof(p.render_cache->'sections') = 'array' THEN jsonb_array_length(p.render_cache->'sections') END, i.section_count, 1) AS actual_section_count,
           COALESCE(p.render_cache->'sections'->0->>'type', i.section_content_type, 'richText') AS actual_section_content_type,
           CASE WHEN p.render_cache->'sections'->0->'buttonConfig' IS NOT NULL
             THEN CASE WHEN COALESCE((p.render_cache->'sections'->0->'buttonConfig'->>'visible')::boolean, false)
               THEN COALESCE(p.render_cache->'sections'->0->'buttonConfig'->>'mode', 'primary') ELSE 'none' END
             WHEN p.render_cache->'sections'->0->>'type' = 'cta' AND p.render_cache->'sections'->0->'secondary' IS NOT NULL THEN 'both'
             WHEN p.render_cache->'sections'->0->>'type' = 'cta' AND p.render_cache->'sections'->0->'primary' IS NOT NULL THEN 'primary'
             ELSE COALESCE(i.section_button_type, 'none') END AS actual_section_button_type
    FROM nav_groups g
    LEFT JOIN nav_items i ON i.group_id = g.id
    LEFT JOIN pages p ON p.slug = i.href AND COALESCE(i.menu_type, 'page') = 'page'
    WHERE g.key = 'primary'
    ORDER BY i.parent_id NULLS FIRST, i.sort_order, i.id`)).rows as Row[]
  const primary = rows[0]
  if (!primary) throw new NavError('The Site Navigation tree is empty. Run database migration 0016 and seed the requested routes.', 409)
  const flat = rows.filter((row) => row.id != null)
  const build = (parent: number | null): NavNode[] => flat
    .filter((row) => (row.parent_id == null ? parent === null : Number(row.parent_id) === parent))
    .map((row) => ({
      id: Number(row.id),
      parentId: row.parent_id == null ? null : Number(row.parent_id),
      labelEn: String(row.label_en),
      labelBn: String(row.label_bn || ''),
      slug: String(row.href || ''),
      visible: row.is_visible !== false,
      isLandingPage: String(row.href) === '/' && row.menu_type !== 'folder',
      renderedComponents: parseRenderedComponents(row.content_types),
      menuType: (['external', 'folder'].includes(String(row.menu_type)) ? row.menu_type : 'page') as MenuType,
      sectionCount: Math.max(1, Math.min(12, Number(row.actual_section_count || row.section_count || 1))),
      sectionContentType: (SECTION_TYPES.includes(row.actual_section_content_type as Section['type']) ? row.actual_section_content_type : 'richText') as Section['type'],
      sectionButtonType: (BUTTON_TYPES.includes(row.actual_section_button_type as SectionButtonType) ? row.actual_section_button_type : 'none') as SectionButtonType,
      children: build(Number(row.id)),
    }))
  return [{ id: Number(primary.gid), key: 'primary', labelEn: 'Site Navigation', labelBn: 'সাইট নেভিগেশন', landingId, items: build(null) }]
}

export async function setMenuVisibility(id: number, visible: boolean) {
  await ensureCmsSchema()
  await ensureLandingRootHierarchy()
  const current = (await run(sql`SELECT href FROM nav_items WHERE id = ${id} LIMIT 1`)).rows[0] as Row | undefined
  if (!current) throw new NavError('Menu not found.', 404)
  if (String(current.href) === '/') throw new NavError('Landing is fixed and cannot be hidden from navigation.', 409)
  const result = await run(sql`UPDATE nav_items SET is_visible = ${visible} WHERE id = ${id} RETURNING id, is_visible`)
  if (!result.rows[0]) throw new NavError('Menu not found.', 404)
  refresh()
  return { id, visible: Boolean((result.rows[0] as Row).is_visible) }
}


async function assertSlugFree(slug: string, excludeItemId?: number, allowedExistingPageSlug?: string) {
  const nav = await run(sql`SELECT id FROM nav_items WHERE href = ${slug} ${excludeItemId ? sql`AND id <> ${excludeItemId}` : sql``} LIMIT 1`)
  if (nav.rows.length) throw new NavError(`The slug ${slug} is already used by another menu.`, 409)
  const page = await run(sql`SELECT id FROM pages WHERE slug = ${slug} LIMIT 1`)
  if (page.rows.length && slug !== allowedExistingPageSlug) throw new NavError(`A page already exists at ${slug}.`, 409)
  const segments = slug.split('/').filter(Boolean)
  if (segments.length) {
    const parentPath = getContentRouteParent(slug)
    const content = await run(sql`SELECT id FROM cms_content_items
      WHERE slug = ${segments[segments.length - 1]}
        AND COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
          WHEN 'project' THEN '/projects' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise-development'
          WHEN 'partner-agency' THEN '/about-us/partners-networks' WHEN 'health-service' THEN '/social-development/health-program'
          WHEN 'loan-product' THEN '/organizational-development' WHEN 'product' THEN '/enterprise-development' WHEN 'team' THEN '/management-staff'
          WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/resources' WHEN 'job' THEN '/carrer-job'
          WHEN 'success-story' THEN '/success-stories' ELSE '/' END) = ${parentPath}
      LIMIT 1`)
    if (content.rows.length) throw new NavError(`A published or draft content item already owns ${slug}. Choose another menu slug or move the content first.`, 409)
  }
}

function menuPage(slug: string, labelEn: string, labelBn: string, base?: Partial<PageData>, settings?: { sectionCount: number; sectionContentType: Section['type']; sectionButtonType: SectionButtonType; retypeFirst?: boolean; applyButtonSetting?: boolean }): PageData {
  const count = settings?.sectionCount ?? Math.max(1, base?.sections?.length || 1)
  const contentType = settings?.sectionContentType ?? 'richText'
  const buttonType = settings?.sectionButtonType ?? 'none'
  const existing = [...(base?.sections || [])] as PageSection[]
  const sections = existing.slice(0, count)
  while (sections.length < count) sections.push(defaultSection(contentType, labelEn, labelBn, slug, buttonType, sections.length))
  if (sections.length && (!existing.length || settings?.retypeFirst)) {
    const firstTitle = (sections[0] as any).heading && typeof (sections[0] as any).heading === 'object' ? (sections[0] as any).heading : { en: labelEn, bn: labelBn }
    const rebuilt = defaultSection(contentType, String(firstTitle.en || labelEn), String(firstTitle.bn || labelBn), slug, buttonType, 0)
    rebuilt.visible = sections[0].visible !== false
    sections[0] = rebuilt
  }
  sections.forEach((section, index) => {
    section.visible ??= true
    const buttonDefaults = defaultSection(section.type, labelEn, labelBn, slug, buttonType, index).buttonConfig
    if (settings?.applyButtonSetting || section.buttonConfig == null) section.buttonConfig = buttonDefaults
  })
  return { subtitle: { en: '', bn: '' }, ...base, slug, title: { en: labelEn, bn: labelBn }, sections, status: 'published' } as PageData
}

async function loadPage(slug: string) {
  const r = await run(sql`SELECT render_cache FROM pages WHERE slug = ${slug} LIMIT 1`)
  const cache = (r.rows[0] as Row | undefined)?.render_cache
  return cache && typeof cache === 'object' ? (cache as Partial<PageData>) : undefined
}

export async function createMenu(input: { groupKey: string; parentId: number | null; labelEn: string; labelBn: string; slug: string; renderedComponents: unknown; menuType?: unknown; sectionCount?: unknown; sectionContentType?: unknown; sectionButtonType?: unknown }, actor: string) {
  await ensureCmsSchema()
  await ensureLandingRootHierarchy()
  const labelEn = input.labelEn.trim(); const labelBn = (input.labelBn || '').trim() || labelEn
  if (!labelEn) throw new NavError('Menu name (English) is required.')
  const group = (await run(sql`SELECT id FROM nav_groups WHERE key = 'primary' LIMIT 1`)).rows[0] as Row | undefined
  if (!group || input.groupKey !== 'primary') throw new NavError('Only the single Site Navigation tree is supported.', 409)
  if (input.parentId == null) throw new NavError('Home is the only root. Add every other menu under Home or an existing menu.', 409)
  const parent = (await run(sql`SELECT id, group_id, href, menu_type FROM nav_items WHERE id = ${input.parentId} LIMIT 1`)).rows[0] as Row | undefined
  if (!parent || Number(parent.group_id) !== Number(group.id)) throw new NavError('Choose a parent from the single Site Navigation tree.', 409)
  if (parent.menu_type === 'external') throw new NavError('A submenu cannot be nested under an external URL.')

  const menuType: MenuType = input.menuType === 'folder' ? 'folder' : input.menuType === 'external' ? 'external' : 'page'
  const requestedSlug = input.slug || (menuType === 'page' ? labelEn.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '')
  const slug = normalizeStoredMenuHref(requestedSlug, menuType)
  const sectionCount = cleanSectionCount(input.sectionCount ?? 1)
  const sectionContentType = cleanSectionType(input.sectionContentType ?? 'richText')
  const sectionButtonType = cleanButtonType(input.sectionButtonType ?? 'none')
  const renderedComponents = menuType === 'page' ? checkRenderedComponents(input.renderedComponents) : []
  if (menuType === 'page') await assertSlugFree(slug, undefined, slug)
  const existingPage = menuType === 'page' ? await loadPage(slug) : undefined
  const preserveExistingSections = Boolean(existingPage?.sections?.length)
  const inserted = (await run(sql`
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, content_types, menu_type, section_count, section_content_type, section_button_type, sort_order)
    VALUES (${Number(group.id)}, ${input.parentId}, ${labelEn}, ${labelBn}, ${slug}, ${JSON.stringify(renderedComponents)}::jsonb, ${menuType}, ${sectionCount}, ${sectionContentType}, ${sectionButtonType},
      COALESCE((SELECT MAX(sort_order) + 1 FROM nav_items WHERE group_id = ${Number(group.id)} AND parent_id = ${input.parentId}), 0))
    RETURNING id`)).rows[0] as Row
  try {
    if (menuType === 'page') {
      const preservedCount = Math.max(sectionCount, existingPage?.sections?.length || 0)
      await saveDocument(`page:${slug}`, menuPage(slug, labelEn, labelBn, existingPage, { sectionCount: preservedCount, sectionContentType, sectionButtonType, retypeFirst: !preserveExistingSections, applyButtonSetting: !preserveExistingSections }), 'page', actor)
    }
  } catch (error) {
    await run(sql`DELETE FROM nav_items WHERE id = ${Number(inserted.id)}`)
    throw error
  }
  refresh()
  return { id: Number(inserted.id), slug, menuType }
}

export async function updateMenu(id: number, input: { labelEn: string; labelBn: string; slug: string; renderedComponents: unknown; menuType?: unknown; sectionCount?: unknown; sectionContentType?: unknown; sectionButtonType?: unknown }, actor: string) {
  await ensureCmsSchema()
  await ensureLandingRootHierarchy()
  const item = (await run(sql`SELECT * FROM nav_items WHERE id = ${id} LIMIT 1`)).rows[0] as Row | undefined
  if (!item) throw new NavError('Menu not found.', 404)
  if (String(item.href) === '/' && item.menu_type !== 'folder') throw new NavError('Home is fixed. Edit its content in CMS → Landing Page.', 409)
  const labelEn = input.labelEn.trim(); const labelBn = (input.labelBn || '').trim() || labelEn
  if (!labelEn) throw new NavError('Menu name (English) is required.')
  const menuType: MenuType = input.menuType === 'folder' ? 'folder' : input.menuType === 'external' ? 'external' : 'page'
  const oldSlug = String(item.href || '')
  const slug = normalizeStoredMenuHref(input.slug || (menuType === 'page' ? oldSlug : ''), menuType)
  const sectionCount = cleanSectionCount(input.sectionCount ?? item.section_count ?? 1)
  const sectionContentType = cleanSectionType(input.sectionContentType ?? item.section_content_type ?? 'richText')
  const sectionButtonType = cleanButtonType(input.sectionButtonType ?? item.section_button_type ?? 'none')
  const renderedComponents = menuType === 'page' ? checkRenderedComponents(input.renderedComponents) : []
  const oldMenuType: MenuType = item.menu_type === 'folder' ? 'folder' : item.menu_type === 'external' ? 'external' : 'page'
  if (menuType === 'page' && (slug !== oldSlug || oldMenuType !== 'page')) await assertSlugFree(slug, id, oldSlug)
  const base = oldMenuType === 'page' ? await loadPage(oldSlug) : undefined
  await run(sql`UPDATE nav_items SET label_en = ${labelEn}, label_bn = ${labelBn}, href = ${slug}, content_types = ${JSON.stringify(renderedComponents)}::jsonb, menu_type = ${menuType}, section_count = ${sectionCount}, section_content_type = ${sectionContentType}, section_button_type = ${sectionButtonType} WHERE id = ${id}`)
  try {
    if (menuType === 'page') {
      if (oldMenuType === 'page' && slug !== oldSlug) await run(sql`UPDATE pages SET slug = ${slug}, updated_at = now() WHERE slug = ${oldSlug}`)
      await saveDocument(`page:${slug}`, menuPage(slug, labelEn, labelBn, base, { sectionCount, sectionContentType, sectionButtonType, retypeFirst: sectionContentType !== item.section_content_type, applyButtonSetting: sectionButtonType !== item.section_button_type }), 'page', actor)
    }
  } catch (error) {
    await run(sql`UPDATE nav_items SET label_en = ${item.label_en}, label_bn = ${item.label_bn}, href = ${oldSlug}, content_types = ${JSON.stringify(parseRenderedComponents(item.content_types))}::jsonb, menu_type = ${oldMenuType}, section_count = ${Number(item.section_count || 1)}, section_content_type = ${String(item.section_content_type || 'richText')}, section_button_type = ${String(item.section_button_type || 'none')} WHERE id = ${id}`)
    if (oldMenuType === 'page' && slug !== oldSlug) await run(sql`UPDATE pages SET slug = ${oldSlug} WHERE slug = ${slug}`)
    throw error
  }
  refresh()
}

/** Removes the menu, its submenus and the pages created for them. */
export async function deleteMenu(id: number) {
  await ensureCmsSchema()
  await ensureLandingRootHierarchy()
  const removed = (await run(sql`
    WITH RECURSIVE tree AS (SELECT id, href FROM nav_items WHERE id = ${id} UNION ALL SELECT n.id, n.href FROM nav_items n JOIN tree t ON n.parent_id = t.id)
    SELECT id, href FROM tree`)).rows as Row[]
  if (!removed.length) throw new NavError('Menu not found.', 404)
  if (removed.some((row) => String(row.href) === '/')) throw new NavError('Home is the landing page and cannot be removed from Site Navigation. Edit its content in CMS → Landing Page.', 409)
  const ids = sql.join(removed.map((r) => sql`${Number(r.id)}`), sql`, `)
  await run(sql`DELETE FROM nav_items WHERE id IN (${ids})`)
  const protectedCollectionPaths = new Set(CONTENT_COLLECTION_ROUTES.map((route) => route.slug))
  const slugs = removed.map((r) => String(r.href || '')).filter((s) => s.startsWith('/') && s !== '/' && !protectedCollectionPaths.has(canonicalizeCmsRoute(s)))
  let pages = 0
  if (slugs.length) {
    const list = sql.join(slugs.map((s) => sql`${s}`), sql`, `)
    pages = (await run(sql`DELETE FROM pages WHERE slug IN (${list}) AND slug NOT IN (SELECT href FROM nav_items) RETURNING id`)).rows.length
  }
  refresh()
  return { menus: removed.length, pages }
}

export type MoveNode = { id: number; children?: MoveNode[] }

/** Persists the single Site Navigation tree (parent/child + order). */
export async function saveNavigationOrder(groupKey: string, tree: MoveNode[]) {
  await ensureCmsSchema()
  await ensureLandingRootHierarchy()
  const group = (await run(sql`SELECT id, key FROM nav_groups WHERE key = 'primary' LIMIT 1`)).rows[0] as Row | undefined
  if (!group || groupKey !== 'primary') throw new NavError('Only the single Site Navigation tree is supported.', 409)
  const landingRow = (await run(sql`SELECT i.id, i.parent_id, i.sort_order, i.href, i.menu_type FROM nav_items i JOIN nav_groups g ON g.id = i.group_id WHERE g.key = 'primary' AND i.href = '/' ORDER BY i.id LIMIT 1`)).rows[0] as Row | undefined
  if (!landingRow) throw new NavError('The fixed Landing menu is missing. Run the navigation migration / database seed.', 409)
  const landingId = Number(landingRow.id)
  const isPrimary = true
  const rootParent = null
  const existingRows = (await run(sql`SELECT id, parent_id, sort_order, href, menu_type FROM nav_items WHERE group_id = ${Number(group.id)}`)).rows as Row[]
  const existing = new Set(existingRows.map((r) => Number(r.id)))
  const flat: Array<{ id: number; parent: number | null; order: number }> = []
  const seen = new Set<number>()
  const walk = (nodes: MoveNode[], parent: number | null) => {
    nodes.forEach((n, order) => {
      const nid = Number(n.id)
      if (!existing.has(nid) || seen.has(nid)) throw new NavError('The navigation changed in another session. Reload and try again.', 409)
      seen.add(nid); flat.push({ id: nid, parent, order }); walk(n.children || [], nid)
    })
  }
  walk(tree, rootParent)
  const byExistingId = new Map(existingRows.map((row) => [Number(row.id), row]))
  const parentLookup = new Map(byExistingId)
  parentLookup.set(landingId, landingRow)
  if (seen.size !== existing.size) throw new NavError('The navigation changed in another session. Reload and try again.', 409)
  if (isPrimary) {
    if (tree.length !== 1 || Number(tree[0]?.id) !== landingId) {
      throw new NavError('Home must remain the only root of the single navigation tree.', 409)
    }
    if (landingRow.parent_id != null) throw new NavError('Home must remain at the root of the navigation.', 409)
  }
  for (const item of flat) {
    const currentRow = parentLookup.get(item.id)
    if (!currentRow) throw new NavError('The navigation changed in another session. Reload and try again.', 409)
    if (String(currentRow.href) === '/' && (item.parent !== null || !isPrimary)) {
      throw new NavError('Home is fixed and must remain the only root of the navigation tree.', 409)
    }
    if (String(currentRow.href) !== '/' && item.parent == null) {
      throw new NavError('Home is the only root. Keep every editable item beneath Home.', 409)
    }
    if (item.parent != null) {
      const parentRow = parentLookup.get(item.parent)
      if (!parentRow) throw new NavError('A menu parent is missing. Reload the navigation and try again.', 409)
      if (parentRow.menu_type === 'external' || /^https?:\/\//i.test(String(parentRow.href || ''))) {
        throw new NavError('A submenu page cannot be nested under an external URL. Add it under an internal page menu instead.')
      }
    }
  }
  // Reordering changes only parent/order metadata. Each page keeps the exact
  // public href supplied by the CMS; changing a menu position never rewrites URLs.
  if (!flat.length) return
  const values = sql.join(flat.map((f) => sql`(${f.id}::bigint, ${f.parent}::bigint, ${f.order}::int)`), sql`, `)
  await run(sql`UPDATE nav_items n SET parent_id = v.parent_id, sort_order = v.sort_order FROM (VALUES ${values}) AS v(id, parent_id, sort_order) WHERE n.id = v.id`)
  refresh()
}
