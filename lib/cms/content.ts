import { sql } from 'drizzle-orm'
import { revalidatePath, revalidateTag } from 'next/cache'
import { contentData, contentEntries, contentDetails, imageForSlug, openImageUrlForPath } from '@/lib/cms/fallback-gateway'
import { db, withDbRetry } from '@/lib/db'
import { buildContentRoute, canonicalizeCmsRoute, getContentRouteParent } from '@/lib/cms/routes'
import { normalizeMediaSrc } from '@/lib/mediaUrl'
import { ensureCmsSchema } from './ensureSchema'
import { COMPONENTS, CONTENT_COLLECTION_ROUTES, CORE_KEYS, DEFAULT_CONTENT_PARENT, NEWS_COMPONENTS, FIXED_CONTENT_PARENT, SLUG_PATTERN, storageKeys, type ContentComponent, type ContentRecord, type ContentValues, type FeedItem } from './components'
import type { PageData, Bilingual } from '@/types/entityType'

type Row = Record<string, any>
const isoDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10))
const database = () => { if (!db) throw new Error('DATABASE_URL is not configured'); return db }

export class ContentError extends Error { constructor(message: string, public status = 400, public field?: string) { super(message) } }

export function isComponent(value: unknown): value is ContentComponent { return typeof value === 'string' && value in COMPONENTS }

/** Identify known seed-catalogue images, including older rows whose seed image
 * was externalized to a remote photo URL by an earlier migration. An editor-uploaded
 * URL differs from these known defaults and remains eligible when imageManaged=true. */
function isSeedCatalogueImage(row: Row, attrs: Record<string, unknown>): boolean {
  const image = String(row.image_src || '')
  if (!image) return false
  const component = String(row.component || '')
  const slug = String(row.slug || '')
  const seedSource = String(attrs.seedSource || '')

  if (seedSource === 'contentDetails-v1') {
    const seed = contentDetails.find((entry) => entry.component === component && entry.slug === slug)
    const seedPath = String(seed?.image_src || '')
    if (!seedPath) return false
    const candidates = new Set<string>([seedPath])
    if (seedPath.startsWith('/images/')) candidates.add(openImageUrlForPath(seedPath))
    candidates.add(imageForSlug(slug, component === 'product' ? 'enterprise' : component === 'report' ? 'news' : 'project'))
    return candidates.has(image)
  }

  // Career items originally imported from the legacy catalogue use /job-circular
  // detail paths and have no contentDetails-v1 marker. Their source images are not
  // CMS uploads, even if an earlier edit mistakenly marked the default as managed.
  if (component === 'job' && String(attrs.detailPath || '').startsWith('/job-circular/')) {
    const seed = contentEntries.find((entry) => entry.category === 'career' && entry.slug === slug) as any
    const source = String(seed?.image?.src || '')
    if (!source) return false
    const candidates = new Set<string>([source])
    if (source.startsWith('/images/')) candidates.add(openImageUrlForPath(source))
    return candidates.has(image)
  }
  return false
}

/**
 * Older CMS exports stored media keys or `{ src }` objects in JSON attributes,
 * while current records use the `image_src` column. Resolve both shapes into a
 * browser-safe public URL and keep legacy private-bucket paths on the guarded
 * compatibility endpoint.
 */
function storedImageSource(row: Row, attrs: Record<string, unknown>) {
  const imageManaged = String(attrs.imageManaged || '').toLowerCase() === 'true'
  const attributeCandidates = [attrs.image, attrs.imageSrc, attrs.image_url]
  // When the editor has explicitly selected a new CMS image, that value takes
  // precedence over an older seed/legacy image that may still be present in the
  // image_src column. Otherwise prefer the canonical column, then legacy attrs.
  const candidates = imageManaged
    ? [...attributeCandidates, row.image_src]
    : [row.image_src, ...attributeCandidates]

  for (const raw of candidates) {
    const candidate = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).src ?? (raw as Record<string, unknown>).url
      : raw
    if (typeof candidate !== 'string') continue
    const value = candidate.trim()
    if (!value || /^(?:data|blob|javascript):/i.test(value) || value.startsWith('//')) continue
    if (/^media\//i.test(value)) {
      return `/api/media/by-key/${value.split('/').map((part) => encodeURIComponent(part)).join('/')}`
    }
    if (/^\/?uploads\/media\//i.test(value)) return normalizeMediaSrc(value.startsWith('/') ? value : `/${value}`)
    if (value.startsWith('/') || /^https?:\/\//i.test(value)) return normalizeMediaSrc(value)
  }
  return ''
}

function toRecord(row: Row): ContentRecord {
  const attrs = (row.attributes && typeof row.attributes === 'object' ? row.attributes : {}) as Record<string, unknown>
  const seedSource = String(attrs.seedSource || '')
  const imageManaged = String(attrs.imageManaged || '').toLowerCase() === 'true'
  const knownSeedImage = !imageManaged && isSeedCatalogueImage(row, attrs)
  // Keep seed artwork out of the CMS image field. Otherwise editing an unrelated
  // field could silently turn a bundled or legacy stock image into a CMS image.
  const savedImage = storedImageSource(row, attrs)
  const editableImage = savedImage && !knownSeedImage && (imageManaged || !seedSource) ? savedImage : ''
  const values: ContentValues = {
    title_en: row.title_en || '', title_bn: row.title_bn || '', summary_en: row.summary_en || '', summary_bn: row.summary_bn || '',
    body_en: row.body_en || '', body_bn: row.body_bn || '', image: editableImage, date: isoDate(row.published_at),
  }
  for (const [k, v] of Object.entries(attrs)) values[k] = v == null ? '' : String(v)
  values.image = editableImage
  return { id: Number(row.id), component: row.component, slug: row.slug, status: row.status, values, publishedAt: isoDate(row.published_at), updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || '') }
}

/** Validates form values against the component's field definitions and splits core columns from attributes. */
export function validateValues(component: ContentComponent, slug: string, input: Record<string, unknown>, existingRouteParent?: string) {
  const def = COMPONENTS[component]
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) throw new ContentError('Slug must use lowercase letters, numbers and single hyphens (e.g. safe-water-project).', 400, 'slug')
  // News and success stories belong to their dedicated canonical collections.
  // Never permit a form payload or stale database value to move them elsewhere.
  const fixedParent = FIXED_CONTENT_PARENT[component]
  const rawParent = fixedParent || (typeof input.routeParent === 'string' && input.routeParent.trim() ? input.routeParent.trim() : (existingRouteParent || DEFAULT_CONTENT_PARENT[component]))
  const normalizedParent = rawParent.length > 1 ? rawParent.replace(/\/+$/, '') : (rawParent || '/')
  const routeParent = fixedParent ? normalizedParent : canonicalizeCmsRoute(normalizedParent)
  if (!/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/.test(routeParent)) {
    throw new ContentError('Choose a valid destination page from the list.', 400, 'routeParent')
  }
  // Destination pages can be nested to any CMS navigation depth. The route regex above
  // validates each segment, so there is intentionally no submenu-depth cap.
  const clean: ContentValues = {}
  for (const field of def.fields) {
    const keys = field.bilingual ? [`${field.key}_en`, `${field.key}_bn`] : [field.key]
    for (const key of keys) {
      const raw = input[key]
      const value = raw == null ? '' : String(raw).trim()
      const label = field.bilingual ? `${field.label} (${key.endsWith('_en') ? 'English' : 'বাংলা'})` : field.label
      if (field.required && !value && (!field.bilingual || key.endsWith('_en'))) throw new ContentError(`${label} is required.`, 400, key)
      if (field.max && value.length > field.max) throw new ContentError(`${label} must be ${field.max} characters or fewer.`, 400, key)
      if (value) {
        if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ContentError(`${label} must be a valid date.`, 400, key)
        if (field.type === 'number' && (!/^\d+(\.\d+)?$/.test(value) || (field.key === 'displayOrder' && (!/^\d+$/.test(value) || Number(value) > 100000)))) throw new ContentError(field.key === 'displayOrder' ? `${label} must be a whole number from 0 to 100000.` : `${label} must be a number.`, 400, key)
        if (field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new ContentError(`${label} must be a valid email.`, 400, key)
        if (field.type === 'select' && !field.options?.includes(value)) throw new ContentError(`${label} has an unsupported value.`, 400, key)
        if (['image', 'url'].includes(field.type) && (/^(data|blob|javascript):/i.test(value) || !/^(\/|https:\/\/)/i.test(value))) throw new ContentError(`${label} must start with / or https:// (no embedded media).`, 400, key)
      }
      clean[key] = value
    }
  }
  const attributes: Record<string, string> = {}
  for (const key of storageKeys(def)) if (!CORE_KEYS.includes(key) && clean[key]) attributes[key] = clean[key]
  return { clean, attributes, routeParent }
}

function collectionPageSnapshot(routeParent: string) {
  // The landing page is a special, unique route. If an older database has no stored
  // page row for '/', bootstrap it from the bundled landing composition instead of
  // refusing to publish content assigned to Home.
  if (routeParent === '/') {
    const home = contentData.allPages['/']
    if (!home) return null
    return { ...home, slug: '/', status: 'published', sortOrder: -1, sections: [...home.sections] }
  }
  const definition = CONTENT_COLLECTION_ROUTES.find((route) => route.slug === routeParent)
  if (!definition) return null
  return {
    slug: definition.slug, title: definition.title, subtitle: definition.subtitle, status: 'published', sortOrder: 0,
    sections: [{ type: 'contentFeed', visible: true, heading: definition.heading, components: [definition.component], items: [], columns: 3 }],
  }
}

/** Ensure content has a real destination page and a one-type content-feed section. */
async function ensureCollectionSection(routeParent: string, component: ContentComponent) {
  await ensureCmsSchema()
  // News and Success Stories collection pages are the canonical detail parents:
  // /news and /success-stories each host their list plus /{slug} detail routes.
  const destinationPage = FIXED_CONTENT_PARENT[component] || routeParent
  let row = (await runCms(sql`SELECT slug, title_en, title_bn, render_cache, status FROM pages WHERE slug = ${destinationPage} LIMIT 1`)).rows[0] as Row | undefined
  if (!row) {
    const generated = collectionPageSnapshot(destinationPage)
    if (!generated) throw new ContentError(`The selected destination page ${routeParent} does not exist. Create the navigation/page first.`, 404, 'routeParent')
    await runCms(sql`INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at) VALUES (${destinationPage}, ${generated.title.en}, ${generated.title.bn}, ${generated.subtitle?.en ?? ''}, ${generated.subtitle?.bn ?? ''}, ${JSON.stringify(generated)}::jsonb, 'published', 0, now()) ON CONFLICT (slug) DO NOTHING`)
    row = (await runCms(sql`SELECT slug, title_en, title_bn, render_cache, status FROM pages WHERE slug = ${destinationPage} LIMIT 1`)).rows[0] as Row | undefined
  }
  if (!row) throw new ContentError(`Unable to initialize destination page ${destinationPage}.`, 503, 'routeParent')
  const raw = row.render_cache && typeof row.render_cache === 'object' ? row.render_cache as Record<string, any> : {}
  const sections: Array<Record<string, any>> = Array.isArray(raw.sections) ? [...raw.sections] : []
  const existingCollectionIndex = sections.findIndex((section) =>
    section?.contentCollection?.component === component
    || (section?.type === 'contentFeed' && Array.isArray(section.components) && section.components[0] === component)
  )
  if (existingCollectionIndex >= 0) {
    const current = sections[existingCollectionIndex]
    // Upgrade older feed sections to the shared collection contract in place.
    // Explicitly disabled collections stay disabled when an item is created in Site Content.
    if (current.type === 'contentFeed' && !current.contentCollection) {
      sections[existingCollectionIndex] = {
        ...current,
        components: [component],
        contentCollection: { enabled: true, component, maxItems: 12, layout: 'grid', columns: Number(current.columns) || 3, gap: 24, viewportItems: 3 },
      }
      const upgraded = { ...raw, sections }
      await runCms(sql`UPDATE pages SET render_cache = ${JSON.stringify(upgraded)}::jsonb, updated_at = now() WHERE slug = ${destinationPage}`)
      revalidatePath(destinationPage)
      revalidatePath(`/bn${destinationPage}`)
      revalidateTag('site-content', 'max')
    }
    return
  }

  const existingCareerSlot = destinationPage === '/carrer-job' ? sections.findIndex((section) => section?.type === 'noticeList' && /career|job|open opportunities|current vacancies/i.test(String(section.heading?.en || ''))) : -1
  const definition = COMPONENTS[component]
  const labels: Record<ContentComponent, { en: string; bn: string }> = {
    project: { en: 'Projects', bn: 'প্রকল্পসমূহ' }, news: { en: 'News', bn: 'সংবাদ' }, enterprise: { en: 'Enterprises', bn: 'উদ্যোগসমূহ' },
    'partner-agency': { en: 'Partner Agencies', bn: 'অংশীদার সংস্থা' }, 'health-service': { en: 'Health Services', bn: 'স্বাস্থ্যসেবা' },
    'loan-product': { en: 'Loan Products', bn: 'ঋণ পণ্য' }, product: { en: 'Products & Services', bn: 'পণ্য ও সেবা' },
    team: { en: 'Team', bn: 'টিম' }, notice: { en: 'Notices', bn: 'নোটিশ' }, report: { en: 'Reports', bn: 'প্রতিবেদন' },
    job: { en: 'Current Vacancies', bn: 'চলমান চাকরির সুযোগ' }, 'success-story': { en: 'Success Stories', bn: 'সাফল্যের গল্প' }, stat: { en: 'Impact Statistics', bn: 'প্রভাবের পরিসংখ্যান' },
  }
  const previous = existingCareerSlot >= 0 ? sections[existingCareerSlot] : undefined
  const feedSection = {
    type: 'contentFeed', visible: previous?.visible !== false, heading: previous?.heading || labels[component],
    components: [component], items: [], columns: Number(previous?.columns) || 3,
    contentCollection: { enabled: true, component, maxItems: 12, layout: 'grid', columns: Number(previous?.columns) || 3, gap: 24, viewportItems: 3 },
    ...(previous?.buttonConfig ? { buttonConfig: previous.buttonConfig } : {}),
  }
  if (existingCareerSlot >= 0) sections[existingCareerSlot] = feedSection
  else sections.push(feedSection)
  const landingTitle = contentData.allPages['/']?.title
  const next = { ...raw, slug: destinationPage, title: raw.title || (destinationPage === '/' && landingTitle ? landingTitle : { en: String(row.title_en || definition.plural), bn: String(row.title_bn || definition.plural) }), sections, status: String(row.status || 'published') }
  await runCms(sql`UPDATE pages SET render_cache = ${JSON.stringify(next)}::jsonb, updated_at = now() WHERE slug = ${destinationPage}`)
  revalidatePath(destinationPage === '/' ? '/' : destinationPage)
  revalidatePath(destinationPage === '/' ? '/bn' : `/bn${destinationPage}`)
  revalidateTag('site-content', 'max')
}

const runCms = (query: ReturnType<typeof sql>) => withDbRetry(() => database().execute(query))

export async function slugTaken(component: ContentComponent, slug: string, excludeId?: number, requestedRouteParent?: string) {
  await ensureCmsSchema()
  const routeParent = FIXED_CONTENT_PARENT[component] || requestedRouteParent || DEFAULT_CONTENT_PARENT[component]
  const publicPath = buildContentRoute(routeParent, slug)
  // Content slugs are unique within their destination page, not globally. This allows
  // the same slug under /project and /about-us while protecting each concrete URL.
  const collision = await withDbRetry(() => database().execute(sql`
    SELECT id FROM cms_content_items
    WHERE slug = ${slug}
      AND (
        COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
          WHEN 'project' THEN '/projects' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise-development'
          WHEN 'partner-agency' THEN '/about-us/partners-networks' WHEN 'health-service' THEN '/social-development/health-program'
          WHEN 'loan-product' THEN '/organizational-development' WHEN 'product' THEN '/enterprise-development' WHEN 'team' THEN '/management-staff'
          WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/resources' WHEN 'job' THEN '/carrer-job'
          WHEN 'success-story' THEN '/success-stories' WHEN 'stat' THEN '/impact/statistics' ELSE '/' END) = ${routeParent}
      )
      ${excludeId ? sql`AND id <> ${excludeId}` : sql``}
    LIMIT 1
  `))
  if (collision.rows.length) return true
  // A menu or a page route always wins over a content detail URL. Do not let an
  // administrator publish content that would be unreachable because of that clash.
  const pageConflict = await withDbRetry(() => database().execute(sql`
    SELECT slug FROM pages WHERE slug = ${publicPath}
    UNION ALL
    SELECT href AS slug FROM nav_items WHERE href = ${publicPath} AND COALESCE(menu_type, 'page') = 'page'
    LIMIT 1
  `))
  return pageConflict.rows.length > 0
}

async function assertPublicRouteAvailable(component: ContentComponent, slug: string, routeParent: string, excludeId?: number) {
  if (await slugTaken(component, slug, excludeId, routeParent)) {
    throw new ContentError(`The route ${routeParent === '/' ? '' : routeParent}/${slug} is already used by another content item or page. Choose a different slug or destination page.`, 409, 'slug')
  }
}

export async function listItems(component?: ContentComponent, q = ''): Promise<ContentRecord[]> {
  await ensureCmsSchema()
  const like = `%${q.trim().toLowerCase()}%`
  const r = await withDbRetry(() => database().execute(sql`
    SELECT * FROM cms_content_items
    WHERE ${component ? sql`component = ${component}` : sql`TRUE`}
      AND (${q.trim() ? sql`lower(title_en || ' ' || title_bn || ' ' || slug) LIKE ${like}` : sql`TRUE`})
    ORDER BY published_at DESC, id DESC LIMIT 1000`))
  return (r.rows as Row[]).map(toRecord)
}

export async function getItem(id: number) {
  await ensureCmsSchema()
  const r = await withDbRetry(() => database().execute(sql`SELECT * FROM cms_content_items WHERE id = ${id} LIMIT 1`))
  return r.rows[0] ? toRecord(r.rows[0] as Row) : null
}

function touch() { revalidatePath('/', 'layout'); revalidateTag('site-content', 'max') }

export async function createItem(component: ContentComponent, slug: string, input: Record<string, unknown>, status: 'published' | 'draft' | 'hidden' = 'published') {
  if (!['published', 'draft', 'hidden'].includes(status)) throw new ContentError('Choose a valid visibility status.', 400, 'status')
  const { clean, attributes, routeParent } = validateValues(component, slug, input)
  await assertPublicRouteAvailable(component, slug, routeParent)
  await ensureCollectionSection(routeParent, component)
  const fixedParent = FIXED_CONTENT_PARENT[component]
  const nextAttributes = {
    ...attributes,
    routeParent,
    ...(fixedParent ? { detailType: component, detailPath: `${fixedParent}/${slug}` } : {}),
    imageManaged: clean.image ? 'true' : 'false',
  }
  const r = await withDbRetry(() => database().execute(sql`
    INSERT INTO cms_content_items (component, slug, title_en, title_bn, summary_en, summary_bn, body_en, body_bn, image_src, published_at, attributes, status)
    VALUES (${component}, ${slug}, ${clean.title_en}, ${clean.title_bn || clean.title_en}, ${clean.summary_en || ''}, ${clean.summary_bn || ''}, ${clean.body_en || ''}, ${clean.body_bn || ''}, ${clean.image || null}, ${clean.date}::date, ${JSON.stringify(nextAttributes)}::jsonb, ${status})
    RETURNING *`))
  touch()
  return toRecord(r.rows[0] as Row)
}

export async function updateItem(id: number, slug: string, input: Record<string, unknown>, expectedUpdatedAt?: string) {
  const existing = await getItem(id)
  if (!existing) throw new ContentError('This item no longer exists.', 404)
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== new Date(existing.updatedAt).getTime()) throw new ContentError('This item changed in another session. Reload it before saving.', 409)
  const { clean, attributes, routeParent } = validateValues(existing.component, slug, input, existing.values.routeParent)
  await assertPublicRouteAvailable(existing.component, slug, routeParent, id)
  await ensureCollectionSection(routeParent, existing.component)
  const preservedSystemAttributes = Object.fromEntries(['fieldNews', 'seedSample', 'seedSource', 'detailPath', 'detailType'].filter((key) => existing.values[key]).map((key) => [key, existing.values[key]])) as Record<string, unknown>
  const canonicalDetailParent = FIXED_CONTENT_PARENT[existing.component]
  if (canonicalDetailParent) {
    preservedSystemAttributes.detailType = existing.component
    preservedSystemAttributes.detailPath = `${canonicalDetailParent}/${slug}`
  } else if (slug !== existing.slug && preservedSystemAttributes.detailType) {
    const routeBase: Record<string, string> = {
      project: '/projects', news: '/news', enterprise: '/enterprise-development', notice: '/notice', 'success-story': '/success-stories',
      'partner-agency': '/about-us/partners-networks', 'health-service': '/social-development/health-program', 'loan-product': '/organizational-development',
    }
    const base = routeBase[String(preservedSystemAttributes.detailType)]
    if (base) preservedSystemAttributes.detailPath = `${base}/${slug}`
  }
  const mergedAttributes = { ...attributes, ...preservedSystemAttributes, routeParent, imageManaged: clean.image ? 'true' : 'false' }
  const r = await withDbRetry(() => database().execute(sql`
    UPDATE cms_content_items SET slug = ${slug}, title_en = ${clean.title_en}, title_bn = ${clean.title_bn || clean.title_en},
      summary_en = ${clean.summary_en || ''}, summary_bn = ${clean.summary_bn || ''}, body_en = ${clean.body_en || ''}, body_bn = ${clean.body_bn || ''},
      image_src = ${clean.image || null}, published_at = ${clean.date}::date, attributes = ${JSON.stringify(mergedAttributes)}::jsonb, updated_at = now()
    WHERE id = ${id} RETURNING *`))
  touch()
  return toRecord(r.rows[0] as Row)
}

export async function setItemStatus(id: number, status: 'published' | 'draft' | 'hidden') {
  await ensureCmsSchema()
  const existing = await getItem(id)
  if (!existing) throw new ContentError('This item no longer exists.', 404)
  if (status === 'published') {
    if (existing.component === 'success-story' && !String(existing.values.image || '').trim()) {
      throw new ContentError('Add an approved image before publishing this Success Story. The landing gallery requires an image for every card.', 400, 'image')
    }
    const routeParent = FIXED_CONTENT_PARENT[existing.component] || existing.values.routeParent || DEFAULT_CONTENT_PARENT[existing.component]
    await assertPublicRouteAvailable(existing.component, existing.slug, routeParent, id)
    await ensureCollectionSection(routeParent, existing.component)
  }
  const fixedParent = FIXED_CONTENT_PARENT[existing.component]
  const r = fixedParent
    ? await withDbRetry(() => database().execute(sql`
        UPDATE cms_content_items
        SET status = ${status},
            attributes = COALESCE(attributes, '{}'::jsonb) || ${JSON.stringify({ routeParent: fixedParent, detailType: existing.component, detailPath: `${fixedParent}/${existing.slug}` })}::jsonb,
            updated_at = now()
        WHERE id = ${id} RETURNING *`))
    : await withDbRetry(() => database().execute(sql`UPDATE cms_content_items SET status = ${status}, updated_at = now() WHERE id = ${id} RETURNING *`))
  if (!r.rows[0]) throw new ContentError('This item no longer exists.', 404)
  touch()
  return toRecord(r.rows[0] as Row)
}

export async function deleteItem(id: number) {
  await ensureCmsSchema()
  const r = await withDbRetry(() => database().execute(sql`DELETE FROM cms_content_items WHERE id = ${id} RETURNING id`))
  if (!r.rows[0]) throw new ContentError('This item no longer exists.', 404)
  touch()
}

/** Hide a set of CMS records in one database statement. IDs are deduplicated so
 * repeated selections cannot inflate the result or cause duplicate work. */
export async function hideItems(ids: number[]): Promise<ContentRecord[]> {
  await ensureCmsSchema()
  const uniqueIds = [...new Set(ids)]
  if (!uniqueIds.length) return []
  const idList = sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)
  const result = await withDbRetry(() => database().execute(sql`
    UPDATE cms_content_items
    SET status = 'hidden', updated_at = now()
    WHERE id IN (${idList}) AND status <> 'hidden'
    RETURNING *
  `))
  const hiddenItems = (result.rows as Row[]).map(toRecord)
  if (hiddenItems.length) touch()
  return hiddenItems
}

/** Permanently delete a set of CMS records in one database statement. */
export async function deleteItems(ids: number[]): Promise<number[]> {
  await ensureCmsSchema()
  const uniqueIds = [...new Set(ids)]
  if (!uniqueIds.length) return []
  const idList = sql.join(uniqueIds.map((id) => sql`${id}`), sql`, `)
  const result = await withDbRetry(() => database().execute(sql`
    DELETE FROM cms_content_items
    WHERE id IN (${idList})
    RETURNING id
  `))
  const deletedIds = (result.rows as Row[]).map((row) => Number(row.id))
  if (deletedIds.length) touch()
  return deletedIds
}

const FIELD_NEWS_ENGLISH: Record<string, { title: string; summary: string }> = {
  'community-health-and-nutrition-update': { title: 'Health and Nutrition Update', summary: 'Community health and nutrition are vital to everyday wellbeing. This update shares information about health awareness, nutrition and access to essential care.' },
  'livelihood-and-enterprise-update': { title: 'Livelihood and Enterprise Update', summary: 'Explore updates on livelihood support, small enterprises, practical skills and financial inclusion that can help households strengthen their economic security.' },
  'education-and-skills-update': { title: 'Education and Skills Update', summary: 'This update brings together information about literacy, access to learning, vocational skills and educational opportunities for children, young people and adults.' },
  'community-rights-and-governance-update': { title: 'Rights and Governance Update', summary: 'Read updates on rights awareness, safeguarding, community participation and accountable local services that support safer, more inclusive communities.' },
  'climate-resilience-update': { title: 'Climate Resilience Update', summary: 'This update covers climate adaptation, environmental care, sustainable agriculture, clean energy and disaster preparedness for resilient livelihoods.' },
  'community-partnership-update': { title: 'Community Partnership Update', summary: 'Discover updates about collaboration between community groups, institutions and development partners working toward shared priorities and local initiatives.' },
}
const hasEnglishCopy = (value: unknown) => typeof value === 'string' && /[A-Za-z]{2}/.test(value) && !/[\u0980-\u09FF]{4}/.test(value)

function toFeed(row: Row): FeedItem {
  const rec = toRecord(row)
  const v = rec.values
  const copy = FIELD_NEWS_ENGLISH[rec.slug]
  const englishTitle = hasEnglishCopy(v.title_en) ? v.title_en : copy?.title || 'Srizony Foundation Update'
  const englishSummary = hasEnglishCopy(v.summary_en) ? v.summary_en : copy?.summary || (hasEnglishCopy(v.body_en) ? v.body_en : `Read the latest information about ${englishTitle.toLowerCase()}, programme activities and community updates from Srizony Foundation.`)
  const banglaTitle = v.title_bn || v.title_en || englishTitle
  const banglaSummary = v.summary_bn || v.body_bn || v.summary_en || englishSummary
  // Card images must come from a CMS-managed media selection. The structural
  // seed catalogue may keep old illustration paths in image_src for data migration,
  // but those are not public card media unless an editor saved them in the CMS.
  const imageWasSelectedInCms = Boolean(v.image) && (String(v.imageManaged || '').toLowerCase() === 'true' || !v.seedSource)
  const image = imageWasSelectedInCms ? String(v.image) : undefined
  const routeParent = FIXED_CONTENT_PARENT[rec.component] || String(v.routeParent || DEFAULT_CONTENT_PARENT[rec.component] || '/')
  const href = buildContentRoute(routeParent, rec.slug)
  return { id: rec.id, component: rec.component, slug: rec.slug, title: { en: englishTitle, bn: banglaTitle }, summary: { en: englishSummary, bn: banglaSummary }, image, date: rec.publishedAt, href, deadline: v.deadline || undefined, projectStatus: v.projectStatus || undefined, location: (v.location_en || v.location_bn) ? { en: v.location_en || '', bn: v.location_bn || v.location_en || '' } : undefined, employmentType: v.employmentType || undefined, vacancies: v.vacancies || undefined, salary: v.salary || undefined, attachment: v.file || undefined, category: (v.category_en || v.category_bn) ? { en: v.category_en || '', bn: v.category_bn || v.category_en || '' } : undefined, metricValue: v.value || undefined, icon: v.icon || undefined, illustration: v.illustration || undefined }
}

/** Published items of the given components, newest first. Used by public pages (server side). */
export async function getPublishedFeed(components: ContentComponent[], limit = 60, parentPath?: string): Promise<FeedItem[]> {
  if (!db || !components.length) return []
  try {
    await ensureCmsSchema()
    const list = sql.join(components.map((c) => sql`${c}`), sql`, `)
    const fixedContentParent = components.length === 1 ? FIXED_CONTENT_PARENT[components[0]] : undefined
    const detailParent = parentPath
      ? (fixedContentParent || (parentPath === DEFAULT_CONTENT_PARENT.news ? (FIXED_CONTENT_PARENT.news || '/news')
        : parentPath === DEFAULT_CONTENT_PARENT['success-story'] ? (FIXED_CONTENT_PARENT['success-story'] || '/success-stories')
        : parentPath))
      : ''
    const r = await withDbRetry(() => database().execute(sql`
      SELECT * FROM cms_content_items WHERE status = 'published' AND component IN (${list})
        ${parentPath ? sql`AND (
          COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
          WHEN 'project' THEN '/projects' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise-development'
          WHEN 'partner-agency' THEN '/about-us/partners-networks' WHEN 'health-service' THEN '/social-development/health-program'
          WHEN 'loan-product' THEN '/organizational-development' WHEN 'product' THEN '/enterprise-development' WHEN 'team' THEN '/management-staff'
          WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/resources' WHEN 'job' THEN '/carrer-job'
          WHEN 'success-story' THEN '/success-stories' WHEN 'stat' THEN '/impact/statistics' ELSE '/' END) = ${detailParent}
        )` : sql``}
        AND (component <> 'job' OR attributes->>'deadline' IS NULL OR (attributes->>'deadline')::date >= CURRENT_DATE)
      ORDER BY
        CASE WHEN COALESCE(attributes->>'displayOrder', '') ~ '^[0-9]{1,6}$' THEN 0 ELSE 1 END ASC,
        CASE WHEN COALESCE(attributes->>'displayOrder', '') ~ '^[0-9]{1,6}$' THEN (attributes->>'displayOrder')::integer ELSE 0 END ASC,
        published_at DESC, sort_order ASC, id DESC LIMIT ${limit}`))
    return (r.rows as Row[]).map(toFeed)
  } catch (error) { console.error('Content feed failed', error); return [] }
}


const LEGACY_LOAN_PATHS = new Set<string>()
const ROUTED_DETAIL_COMPONENTS: Array<{ prefix: string; component: ContentComponent }> = [
  { prefix: '/projects/', component: 'project' },
  { prefix: '/news/', component: 'news' },
  { prefix: '/success-stories/', component: 'success-story' },
  { prefix: '/enterprise-development/', component: 'enterprise' },
  { prefix: '/about-us/partners-networks/', component: 'partner-agency' },
  { prefix: '/social-development/health-program/', component: 'health-service' },
  { prefix: '/management-staff/', component: 'team' },
  { prefix: '/resources/', component: 'report' },
  { prefix: '/notice/', component: 'notice' },
  { prefix: '/carrer-job/', component: 'job' },
]

/**
 * Resolve detail routes from published CMS records. `handled` also distinguishes a
 * missing/hidden CMS record from a normal static page, so stale seeded page snapshots
 * can never make a deleted or hidden article appear publicly.
 */
export async function getPublishedContentDetailPage(path: string): Promise<{ handled: boolean; page: PageData | null }> {
  const normalized = path.length > 1 ? path.replace(/\/$/, '') : path
  const routedCandidate = ROUTED_DETAIL_COMPONENTS.find(({ prefix }) => normalized.startsWith(prefix) && normalized.slice(prefix.length).length > 0 && !normalized.slice(prefix.length).includes('/'))
  let routed = routedCandidate
  const legacyLoan = LEGACY_LOAN_PATHS.has(normalized)
  const segments = normalized.split('/').filter(Boolean)
  let allowedComponents: ContentComponent[] = []
  let genericRoute = false
  let pathSlug = routed ? normalized.slice(routed.prefix.length) : ''

  try {
    await ensureCmsSchema()
    if (routedCandidate) {
      // If the route itself is a menu/submenu, render the page represented by that
      // navigation entry; detail handlers must not shadow it just because a content
      // collection uses the same prefix.
      const exactPage = await withDbRetry(() => database().execute(sql`SELECT slug FROM pages WHERE slug = ${normalized} LIMIT 1`))
      const exactMenu = await withDbRetry(() => database().execute(sql`SELECT href FROM nav_items WHERE href = ${normalized} AND COALESCE(menu_type, 'page') = 'page' LIMIT 1`))
      if (exactPage.rows.length || exactMenu.rows.length) {
        routed = undefined
        pathSlug = ''
      }
    }

    // Generic CMS content details inherit the route of the page whose contentFeed
    // displays them: /item, /menu/item, or /menu/submenu/item. A feed is deliberately
    // limited to one content component so a route can never ambiguously represent types.
    if (!routed && !legacyLoan && segments.length >= 1) {
      const itemSlug = segments[segments.length - 1]
      const parentPath = getContentRouteParent(normalized)
      const parentResult = await withDbRetry(() => database().execute(sql`
        SELECT render_cache FROM pages WHERE slug = ${parentPath} AND status = 'published' LIMIT 1
      `))
      const parentRow = parentResult.rows[0] as Row | undefined
      const parentPage = parentRow?.render_cache && typeof parentRow.render_cache === 'object' ? parentRow.render_cache as Record<string, unknown> : null
      const sectionList = Array.isArray(parentPage?.sections) ? parentPage!.sections as Array<Record<string, unknown>> : []
      allowedComponents = Array.from(new Set(sectionList.flatMap((section) => {
        const feedComponent = section?.type === 'contentFeed' && Array.isArray(section.components) ? section.components[0] : undefined
        const rawCollection = section?.contentCollection
        const collection = rawCollection && typeof rawCollection === 'object' && !Array.isArray(rawCollection)
          ? rawCollection as Record<string, unknown>
          : undefined
        const collectionComponent = collection?.enabled === true ? collection.component : undefined
        return [feedComponent, collectionComponent].filter((component): component is ContentComponent => typeof component === 'string' && component in COMPONENTS)
      })))

      // Career posts are a first-class CMS listing even in older saved page snapshots
      // that predate the contentFeed section configuration.
      if (parentPath === '/carrer-job' || parentPath === '/job-circular' || parentPath === '/career-job') {
        allowedComponents = Array.from(new Set([...allowedComponents, 'job']))
      }
      if (allowedComponents.length) {
        // An actual page/menu route always wins over a colliding content slug. The
        // administrator should use unique public slugs when adding landing-page content.
        const exactPage = await withDbRetry(() => database().execute(sql`
          SELECT slug FROM pages WHERE slug = ${normalized} LIMIT 1
        `))
        const exactMenu = await withDbRetry(() => database().execute(sql`
          SELECT href FROM nav_items WHERE href = ${normalized} AND COALESCE(menu_type, 'page') = 'page' LIMIT 1
        `))
        genericRoute = !exactPage.rows.length && !exactMenu.rows.length
        if (genericRoute) pathSlug = itemSlug
      }
    }

    if (!routed && !legacyLoan && !genericRoute) return { handled: false, page: null }

    let result
    if (genericRoute) {
      const components = sql.join(allowedComponents.map((component) => sql`${component}`), sql`, `)
      result = await withDbRetry(() => database().execute(sql`
        SELECT * FROM cms_content_items
        WHERE slug = ${pathSlug} AND component IN (${components}) AND status = 'published'
          AND (COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
            WHEN 'project' THEN '/projects' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise-development'
            WHEN 'partner-agency' THEN '/about-us/partners-networks' WHEN 'health-service' THEN '/social-development/health-program'
            WHEN 'loan-product' THEN '/organizational-development' WHEN 'product' THEN '/enterprise-development' WHEN 'team' THEN '/management-staff'
            WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/resources' WHEN 'job' THEN '/carrer-job'
            WHEN 'success-story' THEN '/success-stories' WHEN 'stat' THEN '/impact/statistics' ELSE '/' END) = ${getContentRouteParent(normalized)}
          )
          AND (component <> 'job' OR attributes->>'deadline' IS NULL OR (attributes->>'deadline')::date >= CURRENT_DATE)
        ORDER BY id DESC LIMIT 2
      `))
    } else {
      const routeParent = getContentRouteParent(normalized)
      result = await withDbRetry(() => database().execute(sql`
        SELECT * FROM cms_content_items
        WHERE status = 'published' AND (
          (attributes->>'detailPath' = ${normalized})
          OR (${routed ? sql`component = ${routed.component} AND slug = ${pathSlug}
            AND (
              COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
                WHEN 'project' THEN '/projects' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise-development'
                WHEN 'partner-agency' THEN '/about-us/partners-networks' WHEN 'health-service' THEN '/social-development/health-program'
                WHEN 'loan-product' THEN '/organizational-development' WHEN 'product' THEN '/enterprise-development' WHEN 'team' THEN '/management-staff'
                WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/resources' WHEN 'job' THEN '/carrer-job'
                WHEN 'success-story' THEN '/success-stories' WHEN 'stat' THEN '/impact/statistics' ELSE '/' END) = ${routeParent}
            )` : sql`FALSE`})
        )
          AND (component <> 'job' OR attributes->>'deadline' IS NULL OR (attributes->>'deadline')::date >= CURRENT_DATE)
        ORDER BY CASE WHEN attributes->>'detailPath' = ${normalized} THEN 0 ELSE 1 END, id DESC
        LIMIT 1
      `))
    }
    const resultRows = result.rows as Row[]
    const row = resultRows[0]
    if (genericRoute && resultRows.some((candidate) => candidate.component !== row?.component)) {
      console.error('Ambiguous CMS detail slug across content collections', { path: normalized, slug: pathSlug })
      return { handled: true, page: null }
    }
    if (!row || row.status !== 'published') return { handled: true, page: null }

    const attributes = row.attributes && typeof row.attributes === 'object' ? row.attributes as Record<string, unknown> : {}
    const title: Bilingual = { en: String(row.title_en || ''), bn: String(row.title_bn || row.title_en || '') }
    const summary: Bilingual = { en: String(row.summary_en || ''), bn: String(row.summary_bn || row.summary_en || '') }
    const bodyEn = String(row.body_en || '').trim() || summary.en
    const bodyBn = String(row.body_bn || '').trim() || summary.bn
    const englishParagraphs = bodyEn.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
    const banglaParagraphs = bodyBn.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
    const count = Math.max(englishParagraphs.length, banglaParagraphs.length, 1)
    const body: Bilingual[] = Array.from({ length: count }, (_, index) => ({
      en: englishParagraphs[index] || englishParagraphs[englishParagraphs.length - 1] || summary.en,
      bn: banglaParagraphs[index] || banglaParagraphs[banglaParagraphs.length - 1] || summary.bn,
    }))

    const imageSrc = storedImageSource(row, attributes)
    const imageManagedValue = String(attributes.imageManaged ?? '').toLowerCase()
    // Older seed records contain bundled photos, not images selected in the CMS.
    // Hide those until an editor explicitly saves a CMS media selection.
    const cmsMediaManaged = Boolean(imageSrc) && !isSeedCatalogueImage(row, attributes) && (imageManagedValue === 'true' || !attributes.seedSource)
    const locationEn = String(attributes.location_en || attributes.location || '')
    const locationBn = String(attributes.location_bn || attributes.location_en || attributes.location || '')

    const page: PageData = {
      slug: normalized,
      contentComponent: row.component as ContentComponent,
      contentSlug: String(row.slug || pathSlug),
      cmsMediaManaged,
      jobDetails: row.component === 'job' ? {
        ...(locationEn || locationBn ? { location: { en: locationEn, bn: locationBn } } : {}),
        ...(attributes.employmentType ? { employmentType: String(attributes.employmentType) } : {}),
        ...(attributes.vacancies ? { vacancies: String(attributes.vacancies) } : {}),
        ...(attributes.salary ? { salary: String(attributes.salary) } : {}),
        ...(attributes.deadline ? { deadline: String(attributes.deadline) } : {}),
        postedAt: isoDate(row.published_at),
      } : undefined,
      title,
      subtitle: summary.en || summary.bn ? summary : undefined,
      heroImage: cmsMediaManaged ? imageSrc : undefined,
      metaDescription: summary.en || summary.bn ? summary : undefined,
      status: 'published',
      sections: [{
        type: 'richText',
        heading: title,
        body,
        image: cmsMediaManaged ? { src: imageSrc, alt: title } : undefined,
      }],
    }
    return { handled: true, page }
  } catch (error) {
    console.error('CMS detail page read failed', { path: normalized, error })
    // Fail closed for CMS-managed detail routes instead of rendering a stale snapshot.
    return { handled: routed !== undefined || legacyLoan || genericRoute, page: null }
  }
}

/** Published CMS news items for the homepage News rail. Success Stories are excluded. */
export async function getPublishedFieldNews(limit = 12): Promise<FeedItem[]> {
  if (!db) return []
  try {
    await ensureCmsSchema()
    const safeLimit = Math.max(2, Math.min(30, Math.trunc(limit) || 12))
    const r = await withDbRetry(() => database().execute(sql`
      SELECT * FROM cms_content_items
      WHERE status = 'published'
        AND component = 'news'
        AND COALESCE(NULLIF(attributes->>'routeParent', ''), '/news') = '/news'
      ORDER BY
        CASE WHEN COALESCE(attributes->>'displayOrder', '') ~ '^[0-9]{1,6}$' THEN 0 ELSE 1 END ASC,
        CASE WHEN COALESCE(attributes->>'displayOrder', '') ~ '^[0-9]{1,6}$' THEN (attributes->>'displayOrder')::integer ELSE 0 END ASC,
        published_at DESC, sort_order ASC, id DESC
      LIMIT ${safeLimit}
    `))
    return (r.rows as Row[]).map((row) => ({ ...toFeed(row), href: `/news/${String(row.slug || '')}` }))
  } catch (error) {
    console.error('CMS field-news feed failed', error)
    return []
  }
}

/** News = projects + notices + reports + job posts, sorted by date. */
export const getNewsFeed = (limit = 60) => getPublishedFeed(NEWS_COMPONENTS, limit)
