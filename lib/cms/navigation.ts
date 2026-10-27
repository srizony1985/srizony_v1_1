import { sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { db, withDbRetry } from '@/lib/db'
import { saveDocument } from '@/lib/site'
import type { PageData, PageSection, Section } from '@/types/entityType'
import { ensureCmsSchema } from './ensureSchema'

type Row = Record<string, any>
export type MenuType = 'page' | 'external'
export type SectionButtonType = 'none' | 'primary' | 'secondary' | 'both'
export type NavNode = { id: number; labelEn: string; labelBn: string; slug: string; isLandingPage?: boolean; renderedComponents: Section['type'][]; menuType: MenuType; sectionCount: number; sectionContentType: Section['type']; sectionButtonType: SectionButtonType; children: NavNode[] }
export type NavGroupTree = { id: number; key: string; labelEn: string; labelBn: string; items: NavNode[] }
export class NavError extends Error { constructor(message: string, public status = 400) { super(message) } }

const MAX_DEPTH = 3
const SLUG = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/
const RESERVED = /^\/(admin|api|bn|_next|search|unsubscribe)(\/|$)/
const SECTION_TYPES: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']
const BUTTON_TYPES: SectionButtonType[] = ['none', 'primary', 'secondary', 'both']
const database = () => { if (!db) throw new NavError('DATABASE_URL is not configured', 503); return db }
const run = (q: ReturnType<typeof sql>) => withDbRetry(() => database().execute(q))
const refresh = () => {
  revalidatePath('/', 'layout')
  revalidatePath('/api/navigation')
  revalidatePath('/api/site')
  revalidateTag('site-content', 'max')
}

export const RENDERED_COMPONENT_TYPES: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']

function parseRenderedComponents(value: unknown): Section['type'][] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? (() => { try { return JSON.parse(value) } catch { return [] } })() : []
  const valid = (list as unknown[]).filter((v): v is Section['type'] => RENDERED_COMPONENT_TYPES.includes(v as Section['type']))
  // Existing rows store collection names (project/product/team). Treat these old values as
  // "all components selected" to avoid breaking a page during the one-time UI transition.
  return valid.length ? Array.from(new Set(valid)) : [...RENDERED_COMPONENT_TYPES]
}

export function normalizeSlug(input: string) {
  const slug = '/' + input.trim().toLowerCase().replace(/^\/+|\/+$/g, '')
  if (!SLUG.test(slug) || RESERVED.test(slug) || slug.length > 160) throw new NavError('Slug must look like /our-work using lowercase letters, numbers and hyphens, and cannot use a reserved path.')
  return slug
}

function normalizeMenuHref(input: string, menuType: MenuType) {
  if (menuType === 'external') {
    let url: URL
    try { url = new URL(input.trim()) } catch { throw new NavError('Enter a valid absolute external URL, beginning with https://.') }
    if (!['https:', 'http:'].includes(url.protocol)) throw new NavError('External menus must use http:// or https:// URLs.')
    return url.toString()
  }
  return normalizeSlug(input)
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
      case 'contentFeed': return { type, heading, components: ['project'], items: [] }
      case 'reports': return { type, heading, items: [] }
      default: return { type: 'richText', heading, body: [{ ...blank }] }
    }
  })()
  section.visible = true
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
  const rows = (await run(sql`
    SELECT g.id AS gid, g.key, g.label_en AS g_en, g.label_bn AS g_bn, g.sort_order AS g_sort,
           i.id, i.parent_id, i.label_en, i.label_bn, i.href, i.sort_order, i.content_types, i.menu_type,
           COALESCE(CASE WHEN jsonb_typeof(p.render_cache->'sections') = 'array' THEN jsonb_array_length(p.render_cache->'sections') END, i.section_count, 1) AS actual_section_count,
           COALESCE(p.render_cache->'sections'->0->>'type', i.section_content_type, 'richText') AS actual_section_content_type,
           CASE WHEN p.render_cache->'sections'->0->'buttonConfig' IS NOT NULL
             THEN CASE WHEN COALESCE((p.render_cache->'sections'->0->'buttonConfig'->>'visible')::boolean, false)
               THEN COALESCE(p.render_cache->'sections'->0->'buttonConfig'->>'mode', 'primary') ELSE 'none' END
             WHEN p.render_cache->'sections'->0->>'type' = 'cta' AND p.render_cache->'sections'->0->'secondary' IS NOT NULL THEN 'both'
             WHEN p.render_cache->'sections'->0->>'type' = 'cta' AND p.render_cache->'sections'->0->'primary' IS NOT NULL THEN 'primary'
             ELSE COALESCE(i.section_button_type, 'none') END AS actual_section_button_type
    FROM nav_groups g LEFT JOIN nav_items i ON i.group_id = g.id
    LEFT JOIN pages p ON p.slug = i.href AND COALESCE(i.menu_type, 'page') = 'page'
    ORDER BY g.sort_order, i.sort_order, i.id`)).rows as Row[]
  const groups = new Map<number, NavGroupTree & { flat: Row[] }>()
  for (const r of rows) {
    const gid = Number(r.gid)
    if (!groups.has(gid)) groups.set(gid, { id: gid, key: r.key, labelEn: r.g_en, labelBn: r.g_bn, items: [], flat: [] })
    if (r.id != null) groups.get(gid)!.flat.push(r)
  }
  const build = (flat: Row[], parent: number | null): NavNode[] => flat
    .filter((r) => (r.parent_id == null ? parent === null : Number(r.parent_id) === parent))
    .map((r) => ({ id: Number(r.id), labelEn: r.label_en, labelBn: r.label_bn, slug: r.href, isLandingPage: String(r.href) === '/', renderedComponents: parseRenderedComponents(r.content_types), menuType: (r.menu_type === 'external' ? 'external' : 'page') as MenuType, sectionCount: Math.max(1, Math.min(12, Number(r.actual_section_count || r.section_count || 1))), sectionContentType: (SECTION_TYPES.includes(r.actual_section_content_type as Section['type']) ? r.actual_section_content_type : 'richText') as Section['type'], sectionButtonType: (BUTTON_TYPES.includes(r.actual_section_button_type as SectionButtonType) ? r.actual_section_button_type : 'none') as SectionButtonType, children: build(flat, Number(r.id)) }))
  return Array.from(groups.values()).map(({ flat, ...g }) => ({ ...g, items: build(flat, null) }))
}


export async function updateNavigationGroup(groupKey: string, labelEnInput: string, labelBnInput: string) {
  await ensureCmsSchema()
  const labelEn = labelEnInput.trim()
  const labelBn = labelBnInput.trim() || labelEn
  if (!labelEn) throw new NavError('Navigation group title (English) is required.')
  const result = await run(sql`UPDATE nav_groups SET label_en = ${labelEn}, label_bn = ${labelBn} WHERE key = ${groupKey} RETURNING id`)
  if (!result.rows.length) throw new NavError('Navigation group not found.', 404)
  refresh()
  return { groupKey, labelEn, labelBn }
}

async function assertSlugFree(slug: string, excludeItemId?: number) {
  const nav = await run(sql`SELECT id FROM nav_items WHERE href = ${slug} ${excludeItemId ? sql`AND id <> ${excludeItemId}` : sql``} LIMIT 1`)
  if (nav.rows.length) throw new NavError(`The slug ${slug} is already used by another menu.`, 409)
  const page = await run(sql`SELECT id FROM pages WHERE slug = ${slug} LIMIT 1`)
  if (page.rows.length && !excludeItemId) throw new NavError(`A page already exists at ${slug}.`, 409)
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
  const labelEn = input.labelEn.trim(); const labelBn = (input.labelBn || '').trim() || labelEn
  if (!labelEn) throw new NavError('Menu name (English) is required.')
  const menuType: MenuType = input.menuType === 'external' ? 'external' : 'page'
  const slug = normalizeMenuHref(input.slug || labelEn.toLowerCase().replace(/[^a-z0-9]+/g, '-'), menuType)
  const sectionCount = cleanSectionCount(input.sectionCount ?? 1)
  const sectionContentType = cleanSectionType(input.sectionContentType ?? 'richText')
  const sectionButtonType = cleanButtonType(input.sectionButtonType ?? 'none')
  const renderedComponents = menuType === 'external' ? [] : checkRenderedComponents(input.renderedComponents)
  if (menuType === 'page') await assertSlugFree(slug)
  const group = (await run(sql`SELECT id FROM nav_groups WHERE key = ${input.groupKey} LIMIT 1`)).rows[0] as Row | undefined
  if (!group) throw new NavError('Navigation group not found.', 404)
  if (input.parentId) {
    const p = (await run(sql`WITH RECURSIVE up AS (SELECT id, parent_id, 1 AS depth FROM nav_items WHERE id = ${input.parentId} UNION ALL SELECT n.id, n.parent_id, up.depth + 1 FROM nav_items n JOIN up ON n.id = up.parent_id) SELECT MAX(depth)::int AS depth FROM up`)).rows[0] as Row
    if (!p?.depth) throw new NavError('Parent menu not found.', 404)
    if (Number(p.depth) >= MAX_DEPTH) throw new NavError(`Menus can be nested ${MAX_DEPTH} levels deep at most.`)
  }
  const inserted = (await run(sql`
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, content_types, menu_type, section_count, section_content_type, section_button_type, sort_order)
    VALUES (${Number(group.id)}, ${input.parentId}, ${labelEn}, ${labelBn}, ${slug}, ${JSON.stringify(renderedComponents)}::jsonb, ${menuType}, ${sectionCount}, ${sectionContentType}, ${sectionButtonType},
      COALESCE((SELECT MAX(sort_order) + 1 FROM nav_items WHERE group_id = ${Number(group.id)} AND parent_id IS NOT DISTINCT FROM ${input.parentId}), 0))
    RETURNING id`)).rows[0] as Row
  try {
    if (menuType === 'page') await saveDocument(`page:${slug}`, menuPage(slug, labelEn, labelBn, undefined, { sectionCount, sectionContentType, sectionButtonType, retypeFirst: true, applyButtonSetting: true }), 'page', actor)
  }
  catch (error) { await run(sql`DELETE FROM nav_items WHERE id = ${Number(inserted.id)}`); throw error }
  refresh()
  return { id: Number(inserted.id), slug }
}

export async function updateMenu(id: number, input: { labelEn: string; labelBn: string; slug: string; renderedComponents: unknown; menuType?: unknown; sectionCount?: unknown; sectionContentType?: unknown; sectionButtonType?: unknown }, actor: string) {
  await ensureCmsSchema()
  const item = (await run(sql`SELECT * FROM nav_items WHERE id = ${id} LIMIT 1`)).rows[0] as Row | undefined
  if (!item) throw new NavError('Menu not found.', 404)
  if (String(item.href) === '/') throw new NavError('Home is the landing page. Edit its content in CMS → Landing Page; it cannot be changed as a navigation slug.', 409)
  const labelEn = input.labelEn.trim(); const labelBn = (input.labelBn || '').trim() || labelEn
  if (!labelEn) throw new NavError('Menu name (English) is required.')
  const menuType: MenuType = input.menuType === 'external' ? 'external' : 'page'
  const slug = normalizeMenuHref(input.slug, menuType)
  const sectionCount = cleanSectionCount(input.sectionCount ?? item.section_count ?? 1)
  const sectionContentType = cleanSectionType(input.sectionContentType ?? item.section_content_type ?? 'richText')
  const sectionButtonType = cleanButtonType(input.sectionButtonType ?? item.section_button_type ?? 'none')
  const renderedComponents = menuType === 'external' ? [] : checkRenderedComponents(input.renderedComponents)
  const oldSlug = String(item.href)
  const oldMenuType: MenuType = item.menu_type === 'external' ? 'external' : 'page'
  if (menuType === 'page' && (slug !== oldSlug || oldMenuType !== 'page')) {
    await assertSlugFree(slug, id)
    if ((await run(sql`SELECT id FROM pages WHERE slug = ${slug} LIMIT 1`)).rows.length && slug !== oldSlug) throw new NavError(`A page already exists at ${slug}.`, 409)
  }
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
  const removed = (await run(sql`
    WITH RECURSIVE tree AS (SELECT id, href FROM nav_items WHERE id = ${id} UNION ALL SELECT n.id, n.href FROM nav_items n JOIN tree t ON n.parent_id = t.id)
    SELECT id, href FROM tree`)).rows as Row[]
  if (!removed.length) throw new NavError('Menu not found.', 404)
  if (removed.some((row) => String(row.href) === '/')) throw new NavError('Home is the landing page and cannot be removed from Site Navigation. Edit its content in CMS → Landing Page.', 409)
  const ids = sql.join(removed.map((r) => sql`${Number(r.id)}`), sql`, `)
  await run(sql`DELETE FROM nav_items WHERE id IN (${ids})`)
  const slugs = removed.map((r) => String(r.href)).filter((s) => s !== '/')
  let pages = 0
  if (slugs.length) {
    const list = sql.join(slugs.map((s) => sql`${s}`), sql`, `)
    pages = (await run(sql`DELETE FROM pages WHERE slug IN (${list}) AND slug NOT IN (SELECT href FROM nav_items) RETURNING id`)).rows.length
  }
  refresh()
  return { menus: removed.length, pages }
}

export type MoveNode = { id: number; children?: MoveNode[] }

/** Persists the whole drag-and-drop tree of a group (parent/child + order). */
export async function saveNavigationOrder(groupKey: string, tree: MoveNode[]) {
  await ensureCmsSchema()
  const group = (await run(sql`SELECT id FROM nav_groups WHERE key = ${groupKey} LIMIT 1`)).rows[0] as Row | undefined
  if (!group) throw new NavError('Navigation group not found.', 404)
  const existingRows = (await run(sql`SELECT id, parent_id, sort_order, href FROM nav_items WHERE group_id = ${Number(group.id)}`)).rows as Row[]
  const existing = new Set(existingRows.map((r) => Number(r.id)))
  const landingRow = existingRows.find((row) => String(row.href) === '/')
  const flat: Array<{ id: number; parent: number | null; order: number }> = []
  const seen = new Set<number>()
  const walk = (nodes: MoveNode[], parent: number | null, depth: number) => {
    if (depth > MAX_DEPTH) throw new NavError(`Menus can be nested ${MAX_DEPTH} levels deep at most.`)
    nodes.forEach((n, order) => {
      const nid = Number(n.id)
      if (!existing.has(nid) || seen.has(nid)) throw new NavError('The navigation changed in another session. Reload and try again.', 409)
      seen.add(nid); flat.push({ id: nid, parent, order }); walk(n.children || [], nid, depth + 1)
    })
  }
  walk(tree, null, 1)
  if (seen.size !== existing.size) throw new NavError('The navigation changed in another session. Reload and try again.', 409)
  if (landingRow) {
    const landingId = Number(landingRow.id)
    const landingParent = landingRow.parent_id == null ? null : Number(landingRow.parent_id)
    const landingSortOrder = Number(landingRow.sort_order || 0)
    const landingExpectedOrder = existingRows.filter((row) => {
      const sameParent = (row.parent_id == null ? null : Number(row.parent_id)) === landingParent
      const rowSortOrder = Number(row.sort_order || 0)
      return sameParent && (rowSortOrder < landingSortOrder || (rowSortOrder === landingSortOrder && Number(row.id) < landingId))
    }).length
    const landingNode = flat.find((item) => item.id === landingId)
    if (!landingNode || landingNode.parent !== landingParent || landingNode.order !== landingExpectedOrder) {
      throw new NavError('Home is the landing page and cannot be reordered or nested in Site Navigation.', 409)
    }
  }
  if (!flat.length) return
  const values = sql.join(flat.map((f) => sql`(${f.id}::bigint, ${f.parent}::bigint, ${f.order}::int)`), sql`, `)
  await run(sql`UPDATE nav_items n SET parent_id = v.parent_id, sort_order = v.sort_order FROM (VALUES ${values}) AS v(id, parent_id, sort_order) WHERE n.id = v.id`)
  refresh()
}
