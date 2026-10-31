import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { allPages, contentEntries, contentDetails, validateContentDetailsDataset, themes, homeHero, primaryNav, ui, contactInfo, SDGsteps, donationInfo, systemData, openImageUrlForPath, imageForSlug, BRANCHES } from '@/lib/cms/fallback-gateway'
import { DEFAULT_WEBSITE_ESSENTIALS } from '@/lib/websiteEssentials'
import { CONTENT_COLLECTION_ROUTES, DEFAULT_CONTENT_PARENT } from '@/lib/cms/components'
import { canonicalizeCmsRoute } from '@/lib/cms/routes'

const database = db
if (!database) { throw new Error('DATABASE_URL is not configured. Set DATABASE_URL in .env.local before running database commands.') }
const RESET_SEED = process.argv.includes('--reset')


const bilingual = (v: any) => ({ en: String(v?.en ?? ''), bn: String(v?.bn ?? '') })

function normalizeSeedDate(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`
  return '2026-01-01'
}

async function rowCount(table: string): Promise<number> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`Unsafe table identifier: ${table}`)
  const result = await database!.execute(sql.raw(`SELECT count(*)::int AS count FROM ${table}`))
  return Number((result.rows[0] as any)?.count || 0)
}

type ImageContext = { slug?: string; kind?: 'project' | 'news' | 'enterprise' | 'article-related' }

function contextForRecord(value: any, inherited: ImageContext = {}): ImageContext {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return inherited
  let slug = inherited.slug
  let kind = inherited.kind
  const directSlug = typeof value.slug === 'string' ? value.slug.trim() : ''
  const href = typeof value.href === 'string' ? value.href : ''
  const route = href.match(/^\/(projects|news|enterprise)\/([^/?#]+)/i)
  const pageRoute = directSlug.match(/^\/(projects|news|enterprise)\/([^/?#]+)/i)
  if (route) {
    slug = route[2]
    kind = route[1].toLowerCase() === 'news' ? 'news' : route[1].toLowerCase() === 'enterprise' ? 'enterprise' : 'project'
  } else if (pageRoute) {
    slug = pageRoute[2]
    kind = pageRoute[1].toLowerCase() === 'news' ? 'news' : pageRoute[1].toLowerCase() === 'enterprise' ? 'enterprise' : 'project'
  } else if (directSlug && !directSlug.includes('/')) {
    slug = directSlug
  }
  if (value.category === 'news' || value.component === 'report') kind = 'news'
  else if (value.category === 'enterprise' || value.component === 'product') kind = 'enterprise'
  else if (value.category === 'project' || value.component === 'project') kind = 'project'
  return { slug, kind }
}

function normalizePageImages(value: any, inherited: ImageContext = {}): any {
  const context = contextForRecord(value, inherited)
  if (typeof value === 'string') {
    if (!value.startsWith('/images/') || /logo-sf\./i.test(value)) return value
    // Prefer the content record's slug over generic legacy filenames such as project1.svg.
    if (context.slug) return imageForSlug(context.slug, context.kind || 'project')
    return openImageUrlForPath(value)
  }
  if (Array.isArray(value)) return value.map((item) => normalizePageImages(item, context))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizePageImages(item, context)]))
  return value
}

function normalizeLegacySeedCopy(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeLegacySeedCopy)
  if (!value || typeof value !== 'object') return value
  const next: Record<string, any> = {}
  for (const [key, item] of Object.entries(value)) next[key] = normalizeLegacySeedCopy(item)
  // Fix only known old seed placeholders; do not replace arbitrary CMS-authored copy.
  if (typeof next.en === 'string') {
    if (next.en.includes('Add a dated field report, location and approved photographs before publishing')) {
      next.en = 'Community health and nutrition are important to everyday wellbeing. This section shares approved information about health awareness, nutrition and access to essential care.'
      next.bn = 'কমিউনিটি স্বাস্থ্য ও পুষ্টি দৈনন্দিন সুস্থতার গুরুত্বপূর্ণ অংশ। এই অংশে স্বাস্থ্য সচেতনতা, পুষ্টি ও প্রয়োজনীয় সেবায় প্রবেশাধিকার সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'
    } else if (next.en.includes('Publish only activities and outcomes confirmed by the responsible team')) {
      next.en = 'Livelihood support, enterprise development and practical skills can help households strengthen economic security. This section shares approved information about these program areas.'
      next.bn = 'জীবিকা সহায়তা, উদ্যোগ উন্নয়ন ও ব্যবহারিক দক্ষতা পরিবারগুলোর অর্থনৈতিক নিরাপত্তা বাড়াতে সহায়তা করতে পারে। এই অংশে এসব কর্মসূচি সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'
    } else if (next.en.includes('Confirm dates, locations and participation figures before publication')) {
      next.en = 'Education and practical skills help children, young people and adults build knowledge and confidence. This section brings together approved information about literacy, learning and vocational opportunities.'
      next.bn = 'শিক্ষা ও ব্যবহারিক দক্ষতা শিশু, তরুণ ও প্রাপ্তবয়স্কদের জ্ঞান ও আত্মবিশ্বাস গড়ে তুলতে সাহায্য করে। এই অংশে সাক্ষরতা, শেখা ও কারিগরি সুযোগ সম্পর্কে অনুমোদিত তথ্য একত্র করা হয়।'
    } else if (next.en.includes('Do not publish identifiable case details without appropriate consent')) {
      next.en = 'Rights awareness, safeguarding and good governance support safer, more inclusive communities. This section shares approved information about rights education and community participation.'
      next.bn = 'অধিকার সচেতনতা, সুরক্ষা ও সুশাসন আরও নিরাপদ ও অন্তর্ভুক্তিমূলক কমিউনিটি গড়ে তুলতে সহায়তা করে। এই অংশে অধিকার শিক্ষা ও কমিউনিটির অংশগ্রহণ সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'
    } else if (next.en.includes('distinguish planned work from completed results')) {
      next.en = 'Climate resilience and environmental care are closely linked to sustainable livelihoods. This section shares approved information about adaptation, clean energy, agriculture and disaster preparedness.'
      next.bn = 'জলবায়ু সহনশীলতা ও পরিবেশের যত্ন টেকসই জীবিকার সঙ্গে ঘনিষ্ঠভাবে যুক্ত। এই অংশে অভিযোজন, পরিচ্ছন্ন জ্বালানি, কৃষি ও দুর্যোগ প্রস্তুতি সম্পর্কে অনুমোদিত তথ্য প্রকাশ করা হয়।'
    } else if (next.en.includes('Confirm all details with the responsible team')) {
      next.en = 'Partnerships connect communities, institutions and development partners around shared priorities. This section features approved information about collaboration and joint initiatives.'
      next.bn = 'অংশীদারিত্ব কমিউনিটি, প্রতিষ্ঠান ও উন্নয়ন সহযোগীদের অভিন্ন অগ্রাধিকারে যুক্ত করে। এই অংশে সহযোগিতা ও যৌথ উদ্যোগ সম্পর্কে অনুমোদিত তথ্য তুলে ধরা হয়।'
    } else if (next.en.includes('Each story should be checked and approved by the responsible team before publication')) {
      next.en = 'Explore published updates on health, livelihoods, education, rights, climate resilience and community partnerships.'
      next.bn = 'স্বাস্থ্য, জীবিকা, শিক্ষা, অধিকার, জলবায়ু সহনশীলতা ও কমিউনিটি অংশীদারিত্বের প্রকাশিত আপডেট দেখুন।'
    } else if (next.en === 'M. Harun or Rashid') {
      next.en = 'Prof. Dr. Harun Or Rashid'
      next.bn = 'প্রফেসর ড. হারুন অর রশীদ'
    } else if (next.en === 'M. Harun or Rashid founded Srizony Foundation to respond to the needs of marginalized communities and build opportunities through grassroots development.') {
      next.en = 'Prof. Dr. Harun Or Rashid has helped shape Srizony Foundation’s development approach, with an emphasis on responding to the needs of marginalized communities through grassroots work.'
      next.bn = 'প্রফেসর ড. হারুন অর রশীদ প্রান্তিক মানুষের প্রয়োজনের প্রতি সাড়া দিতে তৃণমূলভিত্তিক কাজের মাধ্যমে সৃজনী ফাউন্ডেশনের উন্নয়ন-দৃষ্টিভঙ্গি গঠনে ভূমিকা রেখেছেন।'
    } else if (next.en === 'This section records awards and institutional milestones verified and approved by Srizony Foundation.') {
      next.en = 'Verified awards and institutional milestones will be featured here as official details become available.'
      next.bn = 'অফিসিয়াল তথ্য পাওয়া গেলে যাচাইকৃত পুরস্কার ও প্রাতিষ্ঠানিক মাইলস্টোন এখানে প্রকাশ করা হবে।'
    }
  }
  if (next.label && typeof next.label === 'object' && next.label.en === 'Districts reached') {
    next.value = '16'
    next.label = { en: 'Districts', bn: 'জেলা' }
  }
  return next
}

function fillMissingDefaults(defaults: any, current: any): any {
  if (Array.isArray(defaults)) return Array.isArray(current) ? current : defaults
  if (defaults && typeof defaults === 'object') {
    const result: Record<string, any> = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {}
    for (const [key, value] of Object.entries(defaults)) {
      if (!(key in result) || result[key] === undefined || result[key] === null) result[key] = value
      else if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = fillMissingDefaults(value, result[key])
    }
    return result
  }
  return current === undefined || current === null ? defaults : current
}

async function seedGlobalState(defaults: any) {
  const result = await database!.execute(sql`SELECT value FROM site_global_state WHERE id = 1 LIMIT 1`)
  if (!result.rows[0]) {
    const normalized = normalizePageImages(defaults)
    await database!.execute(sql`INSERT INTO site_global_state(id,value,updated_at) VALUES(1,${JSON.stringify(normalized)}::jsonb,now()) ON CONFLICT(id) DO NOTHING`)
    return
  }
  const row = result.rows[0] as any
  const current = typeof row.value === 'string' ? JSON.parse(row.value) : row.value
  // Fill missing configuration fields and externalize old image paths, but keep every value already edited in the CMS.
  const next = normalizePageImages(fillMissingDefaults(defaults, current))
  // Required visual slots must remain usable even if an earlier CMS edit saved an empty/partial array.
  // Existing entries stay first and unchanged; missing slots are appended from the seed into PostgreSQL.
  if (next.homeHero && defaults.homeHero) {
    const currentSlides = Array.isArray(next.homeHero.slides) ? next.homeHero.slides : []
    const baselineSlides = Array.isArray(defaults.homeHero.slides) ? defaults.homeHero.slides : []
    const obsoleteIds = new Set(['community-development', 'women-and-livelihoods', 'health-and-education'])
    const customSlides = currentSlides.filter((item: any) => !obsoleteIds.has(String(item?.id || '')) && !/development with dignity/i.test(String(item?.title?.en || '')))
    const byId = new Map(customSlides.map((item: any) => [String(item?.id || ''), item]))
    const wordCount = (value: unknown) => String(value || '').split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
    const projectSlides = baselineSlides.map((base: any) => {
      const existing: any = byId.get(String(base?.id || ''))
      return existing ? { ...base, ...existing, image: base.image, href: base.href, title: existing.title?.en && wordCount(existing.title.en) <= 4 && wordCount(existing.title.bn) <= 4 ? existing.title : base.title, description: existing.description?.en ? existing.description : base.description } : base
    })
    const projectIds = new Set(baselineSlides.map((item: any) => String(item?.id || '')))
    // The hero rail is a curated set of unique-picture slides; older project slides (24-slide rail) are retired. Custom CMS slides stay.
    next.homeHero.slides = [...projectSlides, ...customSlides.filter((item: any) => !projectIds.has(String(item?.id || '')) && !/^project-/.test(String(item?.id || '')))]

    for (const [key, minimum] of [['stats', 3]] as const) {
      const currentItems = Array.isArray(next.homeHero[key]) ? [...next.homeHero[key]] : []
      const baseItems = Array.isArray(defaults.homeHero[key]) ? defaults.homeHero[key] : []
      const known = new Set(currentItems.map((item: any) => String(item?.id || item?.href || item?.label?.en || '')))
      for (const item of baseItems) {
        if (currentItems.length >= minimum) break
        const id = String((item as any)?.id || (item as any)?.href || (item as any)?.label?.en || '')
        if (!id || known.has(id)) continue
        currentItems.push(item)
        known.add(id)
      }
      next.homeHero[key] = currentItems
    }
  }
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    await database!.execute(sql`UPDATE site_global_state SET value = ${JSON.stringify(next)}::jsonb, updated_at = now() WHERE id = 1`)
    console.log('Updated missing global configuration defaults and migrated legacy image URLs without replacing existing CMS values.')
  }
}

async function migrateLegacyImageSources() {
  const media = await database!.execute(sql`SELECT id, src, hover_src FROM media_items WHERE src LIKE '/images/%' OR hover_src LIKE '/images/%'`)
  for (const row of media.rows as any[]) {
    const src = openImageUrlForPath(String(row.src || ''))
    const hover = row.hover_src ? openImageUrlForPath(String(row.hover_src)) : null
    if (src !== row.src || hover !== row.hover_src) {
      await database!.execute(sql`UPDATE media_items SET src = ${src}, hover_src = ${hover}, updated_at = now() WHERE id = ${Number(row.id)}`)
    }
  }
  const items = await database!.execute(sql`SELECT id, slug, component, image_src FROM cms_content_items WHERE image_src LIKE '/images/%'`)
  for (const row of items.rows as any[]) {
    const kind = row.component === 'product' ? 'enterprise' : row.component === 'report' ? 'news' : 'project'
    const image = imageForSlug(String(row.slug || ''), kind)
    if (image !== row.image_src) await database!.execute(sql`UPDATE cms_content_items SET image_src = ${image}, updated_at = now() WHERE id = ${Number(row.id)}`)
  }

  // CMS-created pages can also contain older local media paths inside their JSON snapshot.
  // Normalize those recursively so public routes do not need local public/images content.
  const pages = await database!.execute(sql`SELECT id, render_cache FROM pages WHERE render_cache IS NOT NULL`)
  for (const row of pages.rows as any[]) {
    const current = typeof row.render_cache === 'string' ? JSON.parse(row.render_cache) : row.render_cache
    const normalized = normalizePageImages(normalizeLegacySeedCopy(current))
    if (JSON.stringify(current) !== JSON.stringify(normalized)) {
      await database!.execute(sql`UPDATE pages SET render_cache = ${JSON.stringify(normalized)}::jsonb, updated_at = now() WHERE id = ${Number(row.id)}`)
    }
  }
}

function sectionKey(section: any): string {
  const heading = String(section?.heading?.en || '').trim().toLowerCase()
  if (section?.type === 'timeline' && heading === 'our journey') return 'journey'
  if (section?.type === 'richText' && heading.includes('development with dignity')) return 'journey'
  if (section?.type === 'richText' && heading.includes('legacy of srizony foundation')) return 'legacy'
  if (section?.type === 'diagram' && section?.variant === 'sdg') return 'sdg'
  if (section?.type === 'carousel' && (section?.homeComponent === 'successStories' || (section?.collectionKind === 'success-stories' && heading.includes('success stories')))) return 'success-stories'
  if (section?.type === 'cards' && section?.variant === 'impact') return 'who-we-are'
  if (section?.type === 'cards' && (heading === 'srizony enterprises' || (section?.items || []).some((item: any) => String(item?.href || '').startsWith('/enterprise-development/')))) return 'enterprises'
  if (section?.type === 'carousel' && (section?.homeComponent === 'stories' || heading.includes('news') || section?.collectionKind === 'news' || (section?.items || []).some((item: any) => String(item?.href || '').startsWith('/news/') || String(item?.href || '').startsWith('/what-we-do/news/')))) return 'field-news'
  return `${String(section?.type || 'unknown')}:${heading}`
}

function mergeUniqueItems(existing: any[], baseline: any[], minimum: number): any[] {
  const identity = (item: any) => String(item?.href || item?.slug || item?.title?.en || item?.title?.bn || '').trim().toLowerCase()
  // Ignore empty shells; they should not count toward the minimum number of usable cards.
  const result: any[] = []
  const known = new Set<string>()
  for (const item of (Array.isArray(existing) ? existing : [])) {
    const key = identity(item)
    if (!key || known.has(key)) continue
    result.push(item)
    known.add(key)
  }
  for (const item of baseline) {
    if (result.length >= minimum) break
    const key = identity(item)
    if (key && known.has(key)) continue
    result.push(item)
    if (key) known.add(key)
  }
  return result
}

/** Repair only structural gaps and old local image URLs; never replace CMS-edited prose or titles. */
function repairSeededPage(existingRaw: any, baselineRaw: any, slug: string): any {
  const current = normalizePageImages(existingRaw && typeof existingRaw === 'object' ? existingRaw : {})
  const baseline = normalizePageImages(baselineRaw)
  if (!current || typeof current !== 'object') return baseline
  // When an older snapshot has lost its section array, restore only that structure
  // while preserving any page metadata/title the CMS already saved.
  if (!Array.isArray(current.sections)) return { ...baseline, ...current, sections: baseline.sections || [] }
  if (slug === '/') {
    const sections = [...current.sections]
    const requiredKeys = new Set(['legacy', 'journey', 'sdg', 'who-we-are', 'enterprises', 'field-news', 'success-stories'])
    const required = (baseline.sections || []).filter((section: any) => requiredKeys.has(sectionKey(section)))
    for (const seedSection of required) {
      const key = sectionKey(seedSection)
      const index = sections.findIndex((section: any) => sectionKey(section) === key)
      if (index < 0) {
        const donateIndex = key === 'success-stories'
          ? sections.findIndex((section: any) => section?.homeComponent === 'donate' || (section?.type === 'cta' && String(section?.heading?.en || '').trim().toLowerCase() === 'support srizony'))
          : -1
        sections.splice(donateIndex >= 0 ? donateIndex : sections.length, 0, seedSection)
        continue
      }
      const present: any = sections[index]
      if (key === 'journey') {
        // Replace old “Development with Dignity” prose with the four complete Journey milestones.
        // Remove any second legacy Journey block so the homepage has exactly one timeline heading.
        const before = sections.slice(0, index).filter((item: any) => sectionKey(item) !== 'journey')
        const after = sections.slice(index + 1).filter((item: any) => sectionKey(item) !== 'journey')
        sections.splice(0, sections.length, ...before, seedSection, ...after)
      } else if (key === 'legacy') {
        const usableBody = Array.isArray(present.body) && present.body.some((paragraph: any) => String(paragraph?.en || paragraph?.bn || '').trim())
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...present,
          heading: usableHeading ? present.heading : seedSection.heading,
          body: usableBody ? present.body : seedSection.body,
          image: present.image?.src ? present.image : seedSection.image,
        }
      } else if (key === 'sdg') {
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = { ...present, heading: usableHeading ? present.heading : seedSection.heading }
      } else if (key === 'who-we-are') {
        const items = Array.isArray(present.items) ? present.items : []
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...present,
          heading: usableHeading ? present.heading : seedSection.heading,
          items: mergeUniqueItems(items, seedSection.items || [], Math.max(2, Math.min(6, (seedSection.items || []).length))),
        }
      } else if (key === 'enterprises') {
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...present,
          heading: usableHeading ? present.heading : seedSection.heading,
          columns: present.columns || seedSection.columns || 4,
          items: mergeUniqueItems(Array.isArray(present.items) ? present.items : [], seedSection.items || [], Math.min(8, (seedSection.items || []).length)),
        }
      } else if (key === 'field-news') {
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...present,
          heading: usableHeading ? present.heading : seedSection.heading,
          homeComponent: 'news',
          presentation: 'scroller',
          collectionKind: 'news',
          dataSource: 'published-news',
          items: Array.isArray(present.items) ? present.items : (seedSection.items || []),
        }
      } else if (key === 'success-stories') {
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...seedSection,
          ...present,
          heading: usableHeading ? present.heading : seedSection.heading,
          homeComponent: 'successStories',
          presentation: 'collection',
          collectionKind: 'success-stories',
          dataSource: 'published-success-stories',
          items: Array.isArray(present.items) ? present.items : [],
          buttonConfig: present.buttonConfig || seedSection.buttonConfig,
        }
      }
    }
    // Semantic landing sections must not duplicate after previous migrations.
    const seen = new Set<string>()
    const deduplicated = sections.filter((section: any) => {
      const key = sectionKey(section)
      if (!requiredKeys.has(key)) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return { ...baseline, ...current, sections: deduplicated }
  }
  if (slug === '/enterprise-development') {
    const base = (baseline.sections || []).find((section: any) => sectionKey(section) === 'enterprises')
    if (base) {
      const sections = [...current.sections]
      const index = sections.findIndex((section: any) => sectionKey(section) === 'enterprises')
      if (index < 0) sections.push(base)
      else {
        const present = sections[index]
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...present,
          heading: usableHeading ? present.heading : base.heading,
          items: mergeUniqueItems(Array.isArray(present.items) ? present.items : [], base.items || [], 8),
        }
      }
      return { ...current, sections }
    }
  }
  if (slug === '/social-development') {
    const base = (baseline.sections || []).find((section: any) => sectionKey(section) === 'field-news')
    if (base) {
      const sections = [...current.sections]
      const index = sections.findIndex((section: any) => sectionKey(section) === 'field-news')
      if (index < 0) sections.push(base)
      else {
        const present = sections[index]
        const usableHeading = String(present.heading?.en || present.heading?.bn || '').trim()
        sections[index] = {
          ...present,
          heading: usableHeading ? present.heading : base.heading,
          items: mergeUniqueItems(Array.isArray(present.items) ? present.items : [], base.items || [], Math.min(6, (base.items || []).length)),
        }
      }
      return { ...current, sections }
    }
  }
  return current
}

/**
 * Build a PostgreSQL text[] expression explicitly. Drizzle expands a native
 * JavaScript array passed directly into sql`` as a parenthesized list, which
 * PostgreSQL interprets as a record/value tuple rather than a text[] value.
 */
const textArray = (values: unknown[] | null | undefined) => {
  const items = (values ?? []).map((value) => sql`${String(value ?? '')}`)
  return items.length
    ? sql`ARRAY[${sql.join(items, sql`, `)}]::text[]`
    : sql`ARRAY[]::text[]`
}

let contentRelatedMode: 'slug' | 'entry_id' = 'slug'

async function detectContentRelatedMode() {
  const result = await database!.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'content_entry_related'
      AND column_name IN ('related_slug', 'related_entry_id')
  `)
  const columns = new Set(result.rows.map((row: any) => String(row.column_name)))
  if (columns.has('related_slug')) {
    contentRelatedMode = 'slug'
    return
  }
  if (columns.has('related_entry_id')) {
    contentRelatedMode = 'entry_id'
    return
  }
  await database!.execute(sql`
    CREATE TABLE IF NOT EXISTS content_entry_related (
      content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
      related_slug VARCHAR(255) NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(content_entry_id, related_slug)
    )
  `)
  contentRelatedMode = 'slug'
}

async function insertMedia(media: any, cache: Map<string, number>): Promise<number | null> {
  if (!media?.src) return null
  const normalizedMedia = { ...media, src: normalizePageImages(media.src) }
  const key = `${normalizedMedia.src}|${normalizedMedia.hoverSrc ?? ''}|${normalizedMedia.alt?.en ?? ''}|${normalizedMedia.alt?.bn ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached
  const existing = await database!.execute(sql`SELECT id FROM media_items WHERE src = ${String(normalizedMedia.src)} ORDER BY id LIMIT 1`)
  if (existing.rows[0]) {
    const id = Number((existing.rows[0] as any).id)
    cache.set(key, id)
    return id
  }
  const result = await database!.execute(sql`
    INSERT INTO media_items (src, alt_en, alt_bn, caption_en, caption_bn, kind, hover_src)
    VALUES (
      ${String(normalizedMedia.src)},
      ${String(normalizedMedia.alt?.en ?? '')},
      ${String(normalizedMedia.alt?.bn ?? '')},
      ${normalizedMedia.caption?.en ?? null},
      ${normalizedMedia.caption?.bn ?? null},
      ${normalizedMedia.kind ?? 'image'},
      ${normalizedMedia.hoverSrc ? normalizePageImages(normalizedMedia.hoverSrc) : null}
    )
    RETURNING id
  `)
  const id = Number((result.rows[0] as any).id)
  cache.set(key, id)
  return id
}

async function seedPage(page: any, mediaCache: Map<string, number>) {
  const existing = await database!.execute(sql`SELECT id, render_cache FROM pages WHERE slug = ${page.slug} LIMIT 1`)
  if (existing.rows[0] && !RESET_SEED) {
    const row = existing.rows[0] as any
    const parsed = typeof row.render_cache === 'string' ? JSON.parse(row.render_cache) : row.render_cache
    const repaired = repairSeededPage(parsed, page, page.slug)
    const before = JSON.stringify(parsed ?? null)
    const after = JSON.stringify(repaired ?? null)
    if (before !== after) {
      await database!.execute(sql`UPDATE pages SET render_cache = ${after}::jsonb, updated_at = now() WHERE id = ${Number(row.id)}`)
      console.log(`Repaired missing seed content / external images without replacing CMS prose: ${page.slug}`)
    }
    return Number(row.id)
  }
  const seededPage = normalizePageImages(page)
  const heroId = await insertMedia(seededPage.heroImage ? { src: seededPage.heroImage, alt: seededPage.title } : null, mediaCache)
  const pageResult = await database!.execute(sql`
    INSERT INTO pages
      (slug,title_en,title_bn,subtitle_en,subtitle_bn,hero_image_id,hero_tone,meta_description_en,meta_description_bn,render_cache,status,sort_order)
    VALUES
      (${seededPage.slug},${seededPage.title.en},${seededPage.title.bn},${seededPage.subtitle?.en ?? null},${seededPage.subtitle?.bn ?? null},
       ${heroId},${seededPage.heroTone ?? null},${seededPage.metaDescription?.en ?? null},${seededPage.metaDescription?.bn ?? null},${JSON.stringify(seededPage)}::jsonb,'published',0)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id
  `)
  const pageId = Number((pageResult.rows[0] as any).id)

  for (let i=0; i<(seededPage.sections ?? []).length; i++) {
    const section = seededPage.sections[i]
    const sectionResult = await database!.execute(sql`
      INSERT INTO sections (page_id,section_type,sort_order) VALUES (${pageId},${section.type},${i}) RETURNING id
    `)
    const sectionId = Number((sectionResult.rows[0] as any).id)
    const b=(v:any)=>bilingual(v)

    if(section.type==='richText'){
      const imageId=await insertMedia(section.image,mediaCache)
      await database!.execute(sql`INSERT INTO rich_text_sections(section_id,eyebrow_en,eyebrow_bn,heading_en,heading_bn,body_en,body_bn,image_id,reverse)
        VALUES(${sectionId},${section.eyebrow?.en??null},${section.eyebrow?.bn??null},${section.heading?.en??null},${section.heading?.bn??null},${textArray(section.body?.map((x:any)=>x.en))},${textArray(section.body?.map((x:any)=>x.bn))},${imageId},${section.reverse??false})`)
    } else if(section.type==='stats'){
      await database!.execute(sql`INSERT INTO stats_sections(section_id) VALUES(${sectionId})`)
      for(let j=0;j<(section.items??[]).length;j++){const x=section.items[j];await database!.execute(sql`INSERT INTO stat_items(section_id,value,label_en,label_bn,note_en,note_bn,sort_order) VALUES(${sectionId},${x.value},${x.label.en},${x.label.bn},${x.note?.en??null},${x.note?.bn??null},${j})`)}
    } else if(section.type==='cards'){
      await database!.execute(sql`INSERT INTO cards_sections(section_id,eyebrow_en,eyebrow_bn,heading_en,heading_bn,columns) VALUES(${sectionId},${section.eyebrow?.en??null},${section.eyebrow?.bn??null},${section.heading?.en??null},${section.heading?.bn??null},${section.columns??null})`)
      for(let j=0;j<(section.items??[]).length;j++){const x=section.items[j];const imageId=await insertMedia(x.image,mediaCache);await database!.execute(sql`INSERT INTO card_items(section_id,title_en,title_bn,body_en,body_bn,icon,image_id,illustration,href,tag_en,tag_bn,sort_order) VALUES(${sectionId},${x.title.en},${x.title.bn},${x.body?.en??null},${x.body?.bn??null},${x.icon??null},${imageId},${x.illustration??null},${x.href??null},${x.tag?.en??null},${x.tag?.bn??null},${j})`)}
    } else if(section.type==='gallery'){
      await database!.execute(sql`INSERT INTO gallery_sections(section_id,heading_en,heading_bn,columns) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null},${section.columns??null})`)
      for(let j=0;j<(section.items??[]).length;j++){const imageId=await insertMedia(section.items[j],mediaCache);if(imageId)await database!.execute(sql`INSERT INTO gallery_items(section_id,media_id,sort_order) VALUES(${sectionId},${imageId},${j})`)}
    } else if(section.type==='timeline'){
      await database!.execute(sql`INSERT INTO timeline_sections(section_id,heading_en,heading_bn) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null})`)
      for(let j=0;j<(section.items??[]).length;j++){const x=section.items[j];await database!.execute(sql`INSERT INTO timeline_items(section_id,year,title_en,title_bn,body_en,body_bn,sort_order) VALUES(${sectionId},${x.year},${x.title.en},${x.title.bn},${x.body.en},${x.body.bn},${j})`)}
    } else if(section.type==='diagram'){
      await database!.execute(sql`INSERT INTO diagram_sections(section_id,heading_en,heading_bn,body_en,body_bn,variant) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null},${section.body?.en??null},${section.body?.bn??null},${section.variant})`)
    } else if(section.type==='table'){
      await database!.execute(sql`INSERT INTO table_sections(section_id,heading_en,heading_bn) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null})`)
      for(let j=0;j<(section.headers??[]).length;j++){const x=section.headers[j];await database!.execute(sql`INSERT INTO table_section_headers(section_id,label_en,label_bn,sort_order) VALUES(${sectionId},${x.en},${x.bn},${j})`)}
      for(let r=0;r<(section.rows??[]).length;r++){const row=(await database!.execute(sql`INSERT INTO table_section_rows(section_id,sort_order) VALUES(${sectionId},${r}) RETURNING id`)).rows[0] as any;for(let c=0;c<(section.rows[r]??[]).length;c++){const x=section.rows[r][c];await database!.execute(sql`INSERT INTO table_section_cells(row_id,value_en,value_bn,column_order) VALUES(${Number(row.id)},${x.en},${x.bn},${c})`)}}
    } else if(section.type==='video'){
      await database!.execute(sql`INSERT INTO video_sections(section_id,heading_en,heading_bn,body_en,body_bn,poster,embed_url,source_url) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null},${section.body?.en??null},${section.body?.bn??null},${section.poster},${section.embedUrl??null},${section.sourceUrl??null})`)
    } else if(section.type==='cta'){
      await database!.execute(sql`INSERT INTO cta_sections(section_id,heading_en,heading_bn,body_en,body_bn,primary_label_en,primary_label_bn,primary_href,secondary_label_en,secondary_label_bn,secondary_href) VALUES(${sectionId},${section.heading.en},${section.heading.bn},${section.body.en},${section.body.bn},${section.primary.label.en},${section.primary.label.bn},${section.primary.href},${section.secondary?.label?.en??null},${section.secondary?.label?.bn??null},${section.secondary?.href??null})`)
    } else if(section.type==='noticeList'){
      await database!.execute(sql`INSERT INTO notice_list_sections(section_id,heading_en,heading_bn) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null})`)
      for(let j=0;j<(section.items??[]).length;j++){const x=section.items[j];await database!.execute(sql`INSERT INTO notice_items(section_id,date_value,title_en,title_bn,body_en,body_bn,href,sort_order) VALUES(${sectionId},${x.date},${x.title.en},${x.title.bn},${x.body?.en??null},${x.body?.bn??null},${x.href??null},${j})`)}
    } else if(section.type==='contact'){
      await database!.execute(sql`INSERT INTO contact_sections(section_id,heading_en,heading_bn,address_en,address_bn,phones,emails,map_label_en,map_label_bn) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null},${section.address.en},${section.address.bn},${textArray(section.phones)},${textArray(section.emails)},${section.mapLabel?.en??null},${section.mapLabel?.bn??null})`)
      for(let j=0;j<(section.locations??[]).length;j++){const x=section.locations[j];await database!.execute(sql`INSERT INTO contact_locations(section_id,name_en,name_bn,address_en,address_bn,map_query,phone,email,kind,sort_order) VALUES(${sectionId},${x.name.en},${x.name.bn},${x.address.en},${x.address.bn},${x.mapQuery},${x.phone??null},${x.email??null},${x.kind??null},${j})`)}
    } else if(section.type==='donation'){
      await database!.execute(sql`INSERT INTO donation_sections(section_id,heading_en,heading_bn,body_en,body_bn) VALUES(${sectionId},${section.heading?.en??null},${section.heading?.bn??null},${section.body?.en??null},${section.body?.bn??null})`)
    } else if(section.type==='carousel'){
      await database!.execute(sql`INSERT INTO carousel_sections(section_id,eyebrow_en,eyebrow_bn,heading_en,heading_bn,body_en,body_bn) VALUES(${sectionId},${section.eyebrow?.en??null},${section.eyebrow?.bn??null},${section.heading?.en??null},${section.heading?.bn??null},${section.body?.en??null},${section.body?.bn??null})`)
      for(let j=0;j<(section.items??[]).length;j++){const x=section.items[j];const imageId=await insertMedia(x.image,mediaCache);if(imageId)await database!.execute(sql`INSERT INTO carousel_items(section_id,title_en,title_bn,body_en,body_bn,image_id,href,tag_en,tag_bn,sort_order) VALUES(${sectionId},${x.title.en},${x.title.bn},${x.body?.en??null},${x.body?.bn??null},${imageId},${x.href??null},${x.tag?.en??null},${x.tag?.bn??null},${j})`)}
    }
  }
}


function systemDataForSeed(){
  return {
    ...systemData,
    donationInfo: donationInfo.map(({ icon: _icon, ...item }) => ({ ...item, icon: item.id })),
    SDGsteps: SDGsteps.map(({ Icon: _Icon, ...step }) => step),
    paymentInfo: donationInfo.map(({ icon: _icon, ...item }) => item),
  }
}

async function ensureSeedSchema() {
  // Repair schema drift before the destructive structural seed starts.
  // Existing databases can have the pages table from an older schema without
  // the JSON projection used by the current CMS.
  await database!.execute(sql`
    CREATE TABLE IF NOT EXISTS pages (
      id BIGSERIAL PRIMARY KEY,
      slug VARCHAR(255) NOT NULL UNIQUE,
      title_en TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      subtitle_en TEXT,
      subtitle_bn TEXT,
      hero_image_id BIGINT,
      hero_tone VARCHAR(20),
      meta_description_en TEXT,
      meta_description_bn TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'published',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS render_cache JSONB`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`)

  // Keep the seed command self-contained for existing databases that skipped
  // part of the structural migration. These are additive/idempotent changes.
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS hero_image_id BIGINT`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS hero_tone VARCHAR(20)`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description_en TEXT`)
  await database!.execute(sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS meta_description_bn TEXT`)
  await database!.execute(sql`
    CREATE TABLE IF NOT EXISTS content_entry_related (
      content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
      related_slug VARCHAR(255),
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  await detectContentRelatedMode()
}

async function ensureGroup(key: string, labelEn: string, labelBn: string, sort: number): Promise<number> {
  const existing = await database!.execute(sql`SELECT id,label_en,label_bn,sort_order FROM nav_groups WHERE key = ${key} LIMIT 1`)
  if (existing.rows[0]) {
    const row = existing.rows[0] as any
    // Navigation labels and hierarchy are a versioned site structure. Sync these known groups
    // to the requested menu so old seeded menus no longer silently render stale labels.
    if (row.label_en !== labelEn || row.label_bn !== labelBn || Number(row.sort_order ?? 0) !== sort) {
      await database!.execute(sql`UPDATE nav_groups SET label_en = ${labelEn}, label_bn = ${labelBn}, sort_order = ${sort} WHERE id = ${Number(row.id)}`)
    }
    return Number(row.id)
  }
  const inserted = await database!.execute(sql`INSERT INTO nav_groups(key,label_en,label_bn,sort_order) VALUES(${key},${labelEn},${labelBn},${sort}) ON CONFLICT(key) DO NOTHING RETURNING id`)
  if (inserted.rows[0]) return Number((inserted.rows[0] as any).id)
  const resolved = await database!.execute(sql`SELECT id FROM nav_groups WHERE key = ${key} LIMIT 1`)
  if (!resolved.rows[0]) throw new Error(`Could not create navigation group ${key}`)
  return Number((resolved.rows[0] as any).id)
}

async function seedCmsContentItems() {
  // Content is seeded by component + slug, but public detail slugs are scoped to the
  // selected parent route. Avoid `ON CONFLICT(component, slug)` because route-scoped
  // uniqueness is now enforced by cms_content_items_route_slug_uq.
  for (const entry of contentDetails as any[]) {
    const component = String(entry.component)
    const slug = String(entry.slug)
    const attributes = {
      routeParent: DEFAULT_CONTENT_PARENT[component as keyof typeof DEFAULT_CONTENT_PARENT] || '/',
      ...(entry.attributes || {}),
      seedSource: 'contentDetails-v1',
    }
    const existing = (await database!.execute(sql`
      SELECT id, attributes, image_src FROM cms_content_items WHERE component = ${component} AND slug = ${slug} LIMIT 1
    `)).rows[0] as any
    const existingAttributes = existing?.attributes && typeof existing.attributes === 'object' ? existing.attributes : {}
    // Once marked as a seeded catalogue record, later seed runs deliberately preserve
    // administrator edits (including route parent and visibility). Backfill only missing /
    // unmanaged project artwork from the original local asset paths; never overwrite an image
    // explicitly selected in the CMS (imageManaged=true).
    if (existing && existingAttributes.seedSource === 'contentDetails-v1') {
      const isCmsImage = String(existingAttributes.imageManaged || '').toLowerCase() === 'true'
      const wantedProjectArt = component === 'project' ? String(entry.image_src || '') : ''
      if (wantedProjectArt && !isCmsImage && String(existing.image_src || '') !== wantedProjectArt) {
        await database!.execute(sql`UPDATE cms_content_items SET image_src = ${wantedProjectArt}, updated_at = now() WHERE id = ${Number(existing.id)}`)
      }
      continue
    }

    const values = {
      titleEn: String(entry.title_en), titleBn: String(entry.title_bn),
      summaryEn: String(entry.summary_en || ''), summaryBn: String(entry.summary_bn || ''),
      bodyEn: String(entry.body_en || ''), bodyBn: String(entry.body_bn || ''),
      // Use the locally bundled curated artwork for project cards; do not transform it
      // into a generated/stock photo URL. Detail-page media remains hidden unless CMS-managed.
      image: entry.image_src ? String(entry.image_src) : null,
      date: normalizeSeedDate(entry.published_at), status: String(entry.status || 'published'),
      attributes: JSON.stringify(existing ? { ...existingAttributes, ...attributes, routeParent: existingAttributes.routeParent || attributes.routeParent } : attributes),
      sortOrder: Number(entry.sort_order || 0),
    }
    if (existing) {
      await database!.execute(sql`
        UPDATE cms_content_items SET title_en=${values.titleEn}, title_bn=${values.titleBn},
          summary_en=${values.summaryEn}, summary_bn=${values.summaryBn}, body_en=${values.bodyEn}, body_bn=${values.bodyBn},
          image_src=${values.image}, published_at=${values.date}::date, status=${values.status},
          attributes=${values.attributes}::jsonb, sort_order=${values.sortOrder}, updated_at=now()
        WHERE id=${Number(existing.id)}
      `)
    } else {
      await database!.execute(sql`
        INSERT INTO cms_content_items
          (component,slug,title_en,title_bn,summary_en,summary_bn,body_en,body_bn,image_src,published_at,status,attributes,sort_order)
        VALUES
          (${component},${slug},${values.titleEn},${values.titleBn},${values.summaryEn},${values.summaryBn},
           ${values.bodyEn},${values.bodyBn},${values.image},${values.date}::date,${values.status},${values.attributes}::jsonb,${values.sortOrder})
      `)
    }
  }

  // Keep support for separately-authored career entries from the legacy catalogue.
  for (const entry of contentEntries as any[]) {
    if (String(entry.category) !== 'career') continue
    const slug = String(entry.slug)
    const existingCareer = await database!.execute(sql`SELECT id FROM cms_content_items WHERE component = 'job' AND slug = ${slug} LIMIT 1`)
    if (existingCareer.rows.length) continue
    const bodyEn = (entry.body || []).map((paragraph: any) => paragraph.en).filter(Boolean).join('\n\n')
    const bodyBn = (entry.body || []).map((paragraph: any) => paragraph.bn).filter(Boolean).join('\n\n')
    const imageUrl = entry.image?.src ? openImageUrlForPath(String(entry.image.src)) : null
    const attributes = { routeParent: '/carrer-job', ...(entry.deadline ? { deadline: String(entry.deadline) } : {}), detailPath: `/job-circular/${slug}` }
    await database!.execute(sql`
      INSERT INTO cms_content_items
        (component,slug,title_en,title_bn,summary_en,summary_bn,body_en,body_bn,image_src,published_at,status,attributes,sort_order)
      VALUES ('job',${slug},${String(entry.title.en)},${String(entry.title.bn || entry.title.en)},
        ${String(entry.excerpt?.en || '')},${String(entry.excerpt?.bn || '')},${bodyEn},${bodyBn},${imageUrl},
        ${normalizeSeedDate(entry.date)}::date,'published',${JSON.stringify(attributes)}::jsonb,${Number(entry.sortOrder || 0)})
    `)
  }
}

function normalizeRouteValues(value: any): any {
  if (typeof value === 'string') return value.startsWith('/') ? canonicalizeCmsRoute(value) : value
  if (Array.isArray(value)) return value.map(normalizeRouteValues)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key.startsWith('/') ? canonicalizeCmsRoute(key) : key, normalizeRouteValues(child)]))
  return value
}

const hiddenNavigationPaths = new Set([
  '/executive-secretariat', '/executive-secratariat', '/senior-management',
  '/public-relation', '/public-relations', '/public-relations-office', '/public-relations-unit', '/social-enterprise',
])
const hiddenNavigationLabels = new Set([
  'executive secretariat', 'senior management', 'public relation', 'public relations', 'social enterprise',
  'নির্বাহী সচিবালয়', 'নির্বাহী সচিবালয়', 'সিনিয়র ম্যানেজমেন্ট', 'সিনিয়র ম্যানেজমেন্ট', 'জনসংযোগ', 'সামাজিক উদ্যোগ',
])
const normalizeNavigationLabel = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')

function walkNavigation(items: any[], paths: Set<string>, labels = new Map<string, { en: string; bn: string }>(), parentHidden = false) {
  for (const item of items || []) {
    const href = typeof item.href === 'string' ? item.href : ''
    const rawPath = href.split(/[?#]/, 1)[0].replace(/\/+$/, '').toLocaleLowerCase() || '/'
    const hidden = parentHidden || hiddenNavigationPaths.has(rawPath)
      || hiddenNavigationLabels.has(normalizeNavigationLabel(item.label?.en))
      || hiddenNavigationLabels.has(normalizeNavigationLabel(item.label?.bn))
    if (!hidden && href.startsWith('/') && item.menuType !== 'external') {
      const path = canonicalizeCmsRoute(href)
      paths.add(path)
      labels.set(path, { en: String(item.label?.en || path), bn: String(item.label?.bn || item.label?.en || path) })
    }
    if (!hidden && Array.isArray(item.children)) walkNavigation(item.children, paths, labels)
  }
  return labels
}

function bundledNavigationPaths() {
  // Canonical content collection pages remain valid even when not linked from navigation.
  const paths = new Set<string>(['/', ...CONTENT_COLLECTION_ROUTES.map((route) => route.slug)])
  const labels = new Map<string, { en: string; bn: string }>()
  walkNavigation(primaryNav, paths, labels)
  return { paths, labels }
}

async function migrateLegacyRoutes() {
  // Canonicalize old page slugs and route-bearing links in cached page JSON. If both
  // the old and new page exist, preserve the canonical target and remove the alias row.
  const pageRows = (await database!.execute(sql`SELECT id, slug, render_cache FROM pages ORDER BY id`)).rows as any[]
  const rowBySlug = new Map(pageRows.map((row) => [String(row.slug), row]))
  for (const row of pageRows) {
    const oldSlug = String(row.slug)
    const nextSlug = canonicalizeCmsRoute(oldSlug)
    const normalizedCache = row.render_cache ? normalizeRouteValues(row.render_cache) : null
    if (normalizedCache && typeof normalizedCache === 'object') normalizedCache.slug = nextSlug
    if (oldSlug !== nextSlug) {
      const target = rowBySlug.get(nextSlug)
      if (target) {
        if (normalizedCache) {
          const targetCache = target.render_cache && typeof target.render_cache === 'object' ? target.render_cache as Record<string, any> : {}
          const sourceCache = normalizedCache as Record<string, any>
          const targetSections = Array.isArray(targetCache.sections) ? [...targetCache.sections] : []
          const sourceSections = Array.isArray(sourceCache.sections) ? sourceCache.sections : []
          const collectionComponent = nextSlug === '/news' ? 'news' : nextSlug === '/success-stories' ? 'success-story' : undefined
          const isCollectionSection = (section: any) => {
            if (!collectionComponent) return false
            const configured = section?.contentCollection?.component
            const feed = Array.isArray(section?.components) ? section.components[0] : undefined
            const kind = section?.collectionKind
            return configured === collectionComponent || feed === collectionComponent
              || (collectionComponent === 'news' && kind === 'news')
              || (collectionComponent === 'success-story' && kind === 'success-stories')
          }
          const missingCollectionSections = sourceSections.filter((section: any) => isCollectionSection(section) && !targetSections.some((current: any) => isCollectionSection(current)))
          if (!target.render_cache || missingCollectionSections.length) {
            const isBlankPlaceholder = (section: any) => section?.type === 'richText'
              && !section?.image?.src
              && Array.isArray(section?.body)
              && section.body.every((paragraph: any) => !String(paragraph?.en || paragraph?.bn || '').trim())
            const onlyBlankPlaceholders = targetSections.length > 0 && targetSections.every(isBlankPlaceholder)
            const mergedSections = onlyBlankPlaceholders && missingCollectionSections.length
              ? missingCollectionSections
              : [...targetSections, ...missingCollectionSections]
            const mergedCache = { ...sourceCache, ...targetCache, slug: nextSlug, sections: mergedSections.length ? mergedSections : targetSections }
            await database!.execute(sql`UPDATE pages SET render_cache = ${JSON.stringify(mergedCache)}::jsonb, updated_at = now() WHERE id = ${Number(target.id)}`)
            rowBySlug.set(nextSlug, { ...target, render_cache: mergedCache })
          }
        }
        await database!.execute(sql`DELETE FROM pages WHERE id = ${Number(row.id)}`)
      } else {
        await database!.execute(sql`UPDATE pages SET slug = ${nextSlug}, render_cache = ${normalizedCache ? JSON.stringify(normalizedCache) : null}::jsonb, updated_at = now() WHERE id = ${Number(row.id)}`)
        rowBySlug.delete(oldSlug); rowBySlug.set(nextSlug, { ...row, slug: nextSlug, render_cache: normalizedCache })
      }
    } else if (normalizedCache && JSON.stringify(normalizedCache) !== JSON.stringify(row.render_cache)) {
      await database!.execute(sql`UPDATE pages SET render_cache = ${JSON.stringify(normalizedCache)}::jsonb, updated_at = now() WHERE id = ${Number(row.id)}`)
    }
  }

  // Normalize internal menu URLs immediately so route gating works even before the
  // bundled navigation sync finishes. External destinations are never rewritten.
  const menuRows = (await database!.execute(sql`SELECT id, href, menu_type FROM nav_items`)).rows as any[]
  for (const row of menuRows) {
    const href = String(row.href || '')
    if (row.menu_type !== 'external' && href.startsWith('/')) {
      const canonical = canonicalizeCmsRoute(href)
      if (canonical !== href) await database!.execute(sql`UPDATE nav_items SET href = ${canonical} WHERE id = ${Number(row.id)}`)
    }
  }

  // Rewrite routeParent/detailPath metadata while keeping duplicate legacy records out
  // of public URLs. A duplicate route is hidden and assigned a private archive key;
  // no published content is allowed to claim the same canonical URL twice.
  const contentRows = (await database!.execute(sql`SELECT id, component, slug, status, attributes FROM cms_content_items ORDER BY id`)).rows as any[]
  const normalized = contentRows.map((row) => {
    const attrs = row.attributes && typeof row.attributes === 'object' ? { ...row.attributes } : {}
    const component = String(row.component || '') as keyof typeof DEFAULT_CONTENT_PARENT
    const rawParent = typeof attrs.routeParent === 'string' && attrs.routeParent ? attrs.routeParent : (DEFAULT_CONTENT_PARENT[component] || '/')
    attrs.routeParent = canonicalizeCmsRoute(String(rawParent))
    // News and Success Stories are separate collections with fixed detail routes.
    // Rehome every legacy row, including previously customized/root-assigned URLs.
    const fixedParent = component === 'news' ? '/news' : component === 'success-story' ? '/success-stories' : undefined
    if (fixedParent) {
      attrs.routeParent = fixedParent
      attrs.detailType = component
      attrs.detailPath = `${fixedParent}/${String(row.slug || '').trim()}`
    } else if (typeof attrs.detailPath === 'string' && attrs.detailPath) {
      attrs.detailPath = canonicalizeCmsRoute(attrs.detailPath)
    }
    return { ...row, attrs, canonicalParent: String(attrs.routeParent), canonicalSlug: String(row.slug || '') }
  })
  const groups = new Map<string, any[]>()
  for (const row of normalized) {
    const key = `${row.canonicalParent}\u0000${row.canonicalSlug}`
    const group = groups.get(key) || []
    group.push(row); groups.set(key, group)
  }
  const priority: Record<string, number> = { project: 1, news: 2, enterprise: 3, 'partner-agency': 4, 'health-service': 5, 'loan-product': 6, product: 7, team: 8, notice: 9, report: 10, job: 11, 'success-story': 12, stat: 13 }
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aSeed = a.attrs.seedSource === 'contentDetails-v1' ? 0 : 1
      const bSeed = b.attrs.seedSource === 'contentDetails-v1' ? 0 : 1
      return aSeed - bSeed || (priority[String(a.component)] || 99) - (priority[String(b.component)] || 99) || Number(a.id) - Number(b.id)
    })
    // Move duplicate losers to private unique parents first. This avoids a transient
    // unique-index conflict when one record is already on the new root parent and
    // another record is being migrated from the old nested parent.
    for (let index = 1; index < group.length; index++) {
      const row = group[index]
      row.attrs.routeParent = `/__legacy-content-${Number(row.id)}`
      await database!.execute(sql`UPDATE cms_content_items SET status = 'hidden', attributes = ${JSON.stringify(row.attrs)}::jsonb, updated_at = now() WHERE id = ${Number(row.id)}`)
    }
    const canonical = group[0]
    await database!.execute(sql`UPDATE cms_content_items SET attributes = ${JSON.stringify(canonical.attrs)}::jsonb, updated_at = now() WHERE id = ${Number(canonical.id)}`)
  }
}

async function ensureAndPruneMenuPages() {
  const excludedPaths = new Set(['/executive-secretariat', '/executive-secratariat', '/senior-management', '/public-relation', '/public-relations', '/public-relations-office', '/public-relations-unit', '/social-enterprise'])
  const excludedLabels = new Set(['executive secretariat', 'senior management', 'public relation', 'public relations', 'social enterprise', 'নির্বাহী সচিবালয়', 'নির্বাহী সচিবালয়', 'সিনিয়র ম্যানেজমেন্ট', 'সিনিয়র ম্যানেজমেন্ট', 'জনসংযোগ', 'সামাজিক উদ্যোগ'])
  const normalizeLabel = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')
  const rows = (await database!.execute(sql`SELECT id, parent_id, href, menu_type, label_en, label_bn FROM nav_items ORDER BY sort_order, id`)).rows as any[]
  const excludedIds = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      const id = Number(row.id)
      if (excludedIds.has(id)) continue
      const href = String(row.href || '')
      const path = href.startsWith('/') ? canonicalizeCmsRoute(href) : href
      const excludedByLabel = excludedLabels.has(normalizeLabel(row.label_en)) || excludedLabels.has(normalizeLabel(row.label_bn))
      const parentId = row.parent_id == null ? null : Number(row.parent_id)
      if (excludedPaths.has(path) || excludedByLabel || (parentId != null && excludedIds.has(parentId))) {
        excludedIds.add(id)
        changed = true
      }
    }
  }

  // Canonical content collection pages remain valid even when not linked from navigation.
  const paths = new Set<string>(['/', ...CONTENT_COLLECTION_ROUTES.map((route) => route.slug)])
  const labels = new Map<string, { en: string; bn: string }>()
  for (const row of rows) {
    const href = String(row.href || '')
    if (row.menu_type === 'external' || !href.startsWith('/') || excludedIds.has(Number(row.id))) continue
    const path = canonicalizeCmsRoute(href)
    paths.add(path)
    labels.set(path, { en: String(row.label_en || path), bn: String(row.label_bn || row.label_en || path) })
  }

  for (const path of paths) {
    const exists = (await database!.execute(sql`SELECT id FROM pages WHERE slug = ${path} LIMIT 1`)).rows.length > 0
    if (exists) continue
    const collection = CONTENT_COLLECTION_ROUTES.find((route) => route.slug === path)
    const title = collection?.title || labels.get(path) || (path === '/' ? { en: 'Srizony Foundation', bn: 'সৃজনী ফাউন্ডেশন' } : { en: path.split('/').pop()!.replace(/-/g, ' '), bn: path.split('/').pop()!.replace(/-/g, ' ') })
    const page = allPages[path] || { slug: path, title, ...(collection ? { subtitle: collection.subtitle } : {}), status: 'published', sortOrder: path === '/' ? -1 : 0, sections: collection ? [{ type: 'contentFeed', visible: true, heading: collection.heading, components: [collection.component], items: [], columns: 3 }] : [{ type: 'richText', visible: true, heading: title, body: [{ en: '', bn: '' }] }] }
    await database!.execute(sql`INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at) VALUES (${path}, ${title.en}, ${title.bn}, '', '', ${JSON.stringify(page)}::jsonb, 'published', ${path === '/' ? -1 : 0}, now()) ON CONFLICT (slug) DO NOTHING`)
  }
  const pageRows = (await database!.execute(sql`SELECT slug FROM pages`)).rows as any[]
  let removed = 0
  for (const row of pageRows) {
    const storedSlug = String(row.slug)
    const slug = canonicalizeCmsRoute(storedSlug)
    // A legacy alias may redirect to a valid canonical page, but it must never remain
    // as a second page row. The earlier migration merges its sections into the root.
    if (storedSlug !== slug || !paths.has(slug)) {
      await database!.execute(sql`DELETE FROM pages WHERE slug = ${storedSlug}`)
      removed++
    }
  }
  console.log(`Navigation route cleanup complete: ${paths.size} visible menu pages retained, ${removed} unlinked page rows removed.`)
}
async function seedWebsiteEssentials() {
  const key = 'cms-document:website-essentials.json'
  const existing = await database!.execute(sql`SELECT key FROM site_settings WHERE key = ${key} LIMIT 1`)
  if (existing.rows.length) return
  const initial = { ...DEFAULT_WEBSITE_ESSENTIALS, locations: BRANCHES }
  await database!.execute(sql`INSERT INTO site_settings(key, value, updated_at) VALUES(${key}, ${JSON.stringify(initial)}::jsonb, now()) ON CONFLICT(key) DO NOTHING`)
  console.log(`Seeded Website Essentials with ${BRANCHES.length} bootstrap locations. Future location changes are managed only in PostgreSQL.`)
}

async function main() {
  const catalogue = validateContentDetailsDataset()
  for (const [slug, page] of Object.entries(allPages)) {
    if (!page.title?.en?.trim() || !page.title?.bn?.trim()) throw new Error(`Page ${slug} is missing a bilingual title.`)
    if (!Array.isArray(page.sections)) throw new Error(`Page ${slug} must define its sections as an array.`)
  }
  console.log(`Validated canonical CMS dataset: ${catalogue.total} bilingual catalogue records across ${Object.keys(catalogue.counts).length} content types and ${Object.keys(allPages).length} page routes.`)
  await ensureSeedSchema()
  await ensureCmsSchema()
  if (RESET_SEED) {
    console.warn('SEED RESET MODE: clearing seeded page/config/legacy content tables. CMS items and job applications are preserved.')
    await database!.execute(sql`TRUNCATE pages RESTART IDENTITY CASCADE`)
    await database!.execute(sql`TRUNCATE site_global_state,hero_data,hero_slides,hero_stats,nav_items,nav_groups,themes,ui_content,contact_info,contact_phones,contact_socials,contact_footprint,sdg_steps,payment_info,content_entry_video,content_entry_gallery,content_entry_related,content_entry_tags,content_entry_bodies,content_entries RESTART IDENTITY CASCADE`)
  }

  await migrateLegacyRoutes()
  const mediaCache = new Map<string, number>()
  const { paths: bundledMenuPaths, labels: bundledMenuLabels } = bundledNavigationPaths()
  for (const path of bundledMenuPaths) {
    const page = allPages[path]
    if (page) await seedPage(page, mediaCache)
    else {
      const title = bundledMenuLabels.get(path) || { en: 'Page', bn: 'পেজ' }
      await seedPage({ slug: path, title, status: 'published', sortOrder: 0, sections: [{ type: 'richText', visible: true, heading: title, body: [{ en: '', bn: '' }] }] }, mediaCache)
    }
  }

  const globalState = { ...systemDataForSeed() }
  await seedGlobalState(globalState)
  await seedWebsiteEssentials()

  await database!.execute(sql`INSERT INTO hero_data(id,eyebrow_en,eyebrow_bn,heading_line_one_en,heading_line_one_bn,heading_line_two_en,heading_line_two_bn,description_en,description_bn,primary_action_label_en,primary_action_label_bn,primary_action_href,secondary_action_label_en,secondary_action_label_bn,secondary_action_href,autoplay,autoplay_interval,video_href)
    VALUES(1,${homeHero.eyebrow.en},${homeHero.eyebrow.bn},${homeHero.headingLineOne.en},${homeHero.headingLineOne.bn},${homeHero.headingLineTwo.en},${homeHero.headingLineTwo.bn},${homeHero.description.en},${homeHero.description.bn},${homeHero.primaryAction.label.en},${homeHero.primaryAction.label.bn},${homeHero.primaryAction.href},${homeHero.secondaryAction.label.en},${homeHero.secondaryAction.label.bn},${homeHero.secondaryAction.href},${homeHero.autoplay??true},${homeHero.autoplayInterval??null},${homeHero.videoHref??null})
    ON CONFLICT(id) DO NOTHING`)
  for (let i = 0; i < homeHero.slides.length; i++) {
    const x = homeHero.slides[i]
    const imageId = await insertMedia({ src: x.image, alt: x.title }, mediaCache)
    await database!.execute(sql`INSERT INTO hero_slides(id,image_id,title_en,title_bn,description_en,description_bn,href,sort_order) VALUES(${x.id},${imageId},${x.title.en},${x.title.bn},${x.description.en},${x.description.bn},${x.href},${i}) ON CONFLICT(id) DO NOTHING`)
  }
  for (let i = 0; i < homeHero.stats.length; i++) {
    const x = homeHero.stats[i]
    await database!.execute(sql`INSERT INTO hero_stats(id,icon,value_en,value_bn,label_en,label_bn,sort_order) VALUES(${x.id},${x.icon},${x.value.en},${x.value.bn},${x.label.en},${x.label.bn},${i}) ON CONFLICT(id) DO NOTHING`)
  }

  // The website has one navigation tree: Home is fixed at the root, and every
  // editable item (folders and page slugs) is stored beneath that same row.
  const primaryId = await ensureGroup('primary', 'Site Navigation', 'সাইট নেভিগেশন', 0)
  const landingSeed = primaryNav.find((item) => item.href === '/')
  if (!landingSeed) throw new Error('The static navigation must contain the Home route /.')
  // seedNav recursively writes the complete one-tree structure, including URL-less folders.
  await seedNav(landingSeed, primaryId, null, 0)

  await enforceLandingRootHierarchy()

  for (const [name, t] of Object.entries(themes)) await database!.execute(sql`
    INSERT INTO themes(name,label_en,label_bn,primary_color,secondary_color,accent_color,background,surface,surface_alt,surface_raised,border,ink,muted,header_bg,header_ink,footer_bg,footer_ink,success,warning,danger,focus,dark_background,dark_surface,dark_surface_alt,dark_surface_raised,dark_border,dark_ink,dark_muted,dark_header_bg,dark_header_ink,dark_footer_bg,dark_footer_ink,typography_body,typography_display,typography_tracking,typography_radius)
    VALUES(${name},${t.label.en},${t.label.bn},${t.primary},${t.secondary},${t.accent},${t.background},${t.surface},${t.surfaceAlt},${t.surfaceRaised},${t.border},${t.ink},${t.muted},${t.headerBg},${t.headerInk},${t.footerBg},${t.footerInk},${t.success},${t.warning},${t.danger},${t.focus},${t.darkBackground},${t.darkSurface},${t.darkSurfaceAlt},${t.darkSurfaceRaised},${t.darkBorder},${t.darkInk},${t.darkMuted},${t.darkHeaderBg},${t.darkHeaderInk},${t.darkFooterBg},${t.darkFooterInk},${t.typography.body},${t.typography.display},${t.typography.tracking},${t.typography.radius})
    ON CONFLICT(name) DO NOTHING`)

  for (const lang of ['en', 'bn'] as const) for (const [key, value] of Object.entries(ui[lang])) {
    await database!.execute(sql`INSERT INTO ui_content(key,value_en,value_bn) VALUES(${key},${lang === 'en' ? value : ''},${lang === 'bn' ? value : ''}) ON CONFLICT(key) DO NOTHING`)
  }

  await database!.execute(sql`INSERT INTO contact_info(id,email,primary_phone,address_en,address_bn,head_office_map) VALUES(1,${contactInfo.email},${contactInfo.primaryPhone},${contactInfo.address.en},${contactInfo.address.bn},${contactInfo.maps.headOffice}) ON CONFLICT(id) DO NOTHING`)
  for (let i = 0; i < contactInfo.phones.length; i++) {
    const phone = contactInfo.phones[i]
    await database!.execute(sql`INSERT INTO contact_phones(contact_id,phone,sort_order) SELECT 1,${phone},${i} WHERE NOT EXISTS (SELECT 1 FROM contact_phones WHERE contact_id = 1 AND phone = ${phone})`)
  }
  for (const [network, url] of Object.entries(contactInfo.socials)) {
    await database!.execute(sql`INSERT INTO contact_socials(contact_id,network,url) SELECT 1,${network},${url} WHERE NOT EXISTS (SELECT 1 FROM contact_socials WHERE contact_id = 1 AND network = ${network})`)
  }
  for (let i = 0; i < contactInfo.footprint.length; i++) {
    const item = contactInfo.footprint[i]
    await database!.execute(sql`INSERT INTO contact_footprint(contact_id,name_en,name_bn,address_en,address_bn,map_query,kind,sort_order) SELECT 1,${item.name.en},${item.name.bn},${item.address.en},${item.address.bn},${item.mapQuery},${item.kind ?? null},${i} WHERE NOT EXISTS (SELECT 1 FROM contact_footprint WHERE contact_id = 1 AND map_query = ${item.mapQuery})`)
  }
  for (let i = 0; i < SDGsteps.length; i++) {
    const x = SDGsteps[i]
    await database!.execute(sql`
      INSERT INTO sdg_steps(id,number_value,en,bn,en_text,bn_text,sort_order)
      VALUES(${x.n},${x.n},${x.en},${x.bn},${x.enText},${x.bnText},${i})
      ON CONFLICT(id) DO UPDATE SET
        number_value = CASE WHEN btrim(sdg_steps.number_value) = '' THEN EXCLUDED.number_value ELSE sdg_steps.number_value END,
        en = CASE WHEN btrim(sdg_steps.en) = '' THEN EXCLUDED.en ELSE sdg_steps.en END,
        bn = CASE WHEN btrim(sdg_steps.bn) = '' THEN EXCLUDED.bn ELSE sdg_steps.bn END,
        en_text = CASE WHEN btrim(sdg_steps.en_text) = '' THEN EXCLUDED.en_text ELSE sdg_steps.en_text END,
        bn_text = CASE WHEN btrim(sdg_steps.bn_text) = '' THEN EXCLUDED.bn_text ELSE sdg_steps.bn_text END
    `)
  }
  for (let i = 0; i < donationInfo.length; i++) {
    const x = donationInfo[i]
    await database!.execute(sql`INSERT INTO payment_info(id,label_en,label_bn,note_en,note_bn,sort_order) VALUES(${x.id},${x.en},${x.bn},${x.noteEn},${x.noteBn},${i}) ON CONFLICT(id) DO NOTHING`)
  }

  const contentEntryIds = new Map<string, number>()
  const pendingRelated: Array<{ contentEntryId: number; relatedSlug: string; sortOrder: number }> = []
  for (const entry of contentEntries as any[]) {
    const existing = await database!.execute(sql`SELECT id FROM content_entries WHERE slug = ${entry.slug} LIMIT 1`)
    if (existing.rows[0]) {
      contentEntryIds.set(entry.slug, Number((existing.rows[0] as any).id))
      continue
    }
    const imageId = await insertMedia(entry.image, mediaCache)
    const r = await database!.execute(sql`INSERT INTO content_entries(slug,title_en,title_bn,excerpt_en,excerpt_bn,date_value,category,image_id,href) VALUES(${entry.slug},${entry.title.en},${entry.title.bn},${entry.excerpt.en},${entry.excerpt.bn},${entry.date??null},${entry.category},${imageId},${entry.href??null}) RETURNING id`)
    const id = Number((r.rows[0] as any).id)
    contentEntryIds.set(entry.slug, id)
    for (let i = 0; i < (entry.body || []).length; i++) await database!.execute(sql`INSERT INTO content_entry_bodies(content_entry_id,body_en,body_bn,sort_order) VALUES(${id},${entry.body[i].en},${entry.body[i].bn},${i})`)
    for (let i = 0; i < (entry.tags || []).length; i++) await database!.execute(sql`INSERT INTO content_entry_tags(content_entry_id,tag_en,tag_bn,sort_order) VALUES(${id},${entry.tags[i].en},${entry.tags[i].bn},${i})`)
    for (let i = 0; i < (entry.related || []).length; i++) pendingRelated.push({ contentEntryId: id, relatedSlug: String(entry.related[i]), sortOrder: i })
    for (const [i, gallery] of (entry.gallery || []).entries()) {
      const galleryId = await insertMedia(gallery, mediaCache)
      if (galleryId) await database!.execute(sql`INSERT INTO content_entry_gallery(content_entry_id,media_id,sort_order) SELECT ${id},${galleryId},${i} WHERE NOT EXISTS (SELECT 1 FROM content_entry_gallery WHERE content_entry_id = ${id} AND media_id = ${galleryId})`)
    }
    if (entry.video) await database!.execute(sql`INSERT INTO content_entry_video(content_entry_id,embed_url,source_url) SELECT ${id},${entry.video.embedUrl},${entry.video.sourceUrl??null} WHERE NOT EXISTS (SELECT 1 FROM content_entry_video WHERE content_entry_id = ${id})`)
  }
  for (const relation of pendingRelated) {
    const relatedId = contentEntryIds.get(relation.relatedSlug)
    if (!relatedId) { console.warn(`Skipping unresolved related content: ${relation.relatedSlug}`); continue }
    if (contentRelatedMode === 'entry_id') {
      await database!.execute(sql`INSERT INTO content_entry_related(content_entry_id,related_entry_id,sort_order) SELECT ${relation.contentEntryId},${relatedId},${relation.sortOrder} WHERE NOT EXISTS (SELECT 1 FROM content_entry_related WHERE content_entry_id = ${relation.contentEntryId} AND related_entry_id = ${relatedId})`)
    } else {
      await database!.execute(sql`INSERT INTO content_entry_related(content_entry_id,related_slug,sort_order) SELECT ${relation.contentEntryId},${relation.relatedSlug},${relation.sortOrder} WHERE NOT EXISTS (SELECT 1 FROM content_entry_related WHERE content_entry_id = ${relation.contentEntryId} AND related_slug = ${relation.relatedSlug})`)
    }
  }

  await seedCmsContentItems()
  await ensureAndPruneMenuPages()
  await migrateLegacyImageSources()
  const [pageCount, cmsItemCount] = await Promise.all([rowCount('pages'), rowCount('cms_content_items')])
  console.log(`Database bootstrap complete (${RESET_SEED ? 'reset/reseed' : 'non-destructive seed'}): ${pageCount} pages, ${cmsItemCount} CMS content items.`)
}

/** Idempotent data migration: Landing is the only row with parent_id = NULL. */
async function enforceLandingRootHierarchy() {
  const primary = (await database!.execute(sql`SELECT id FROM nav_groups WHERE key = 'primary' LIMIT 1`)).rows[0] as any
  if (!primary) throw new Error('Primary navigation group is missing while enforcing the Landing root.')
  const primaryId = Number(primary.id)
  let landing = (await database!.execute(sql`SELECT id FROM nav_items WHERE group_id = ${primaryId} AND href = '/' ORDER BY id LIMIT 1`)).rows[0] as any
  if (!landing) {
    const inserted = await database!.execute(sql`INSERT INTO nav_items(group_id,parent_id,label_en,label_bn,href,content_types,menu_type,sort_order,is_visible) VALUES(${primaryId},NULL,'Home','হোম','/','[]'::jsonb,'page',0,true) RETURNING id`)
    landing = inserted.rows[0] as any
  }
  const landingId = Number(landing.id)
  const duplicateHomes = (await database!.execute(sql`SELECT id FROM nav_items WHERE href = '/' AND id <> ${landingId}`)).rows as any[]
  for (const duplicate of duplicateHomes) {
    const duplicateId = Number(duplicate.id)
    await database!.execute(sql`UPDATE nav_items SET parent_id = ${landingId} WHERE parent_id = ${duplicateId}`)
    await database!.execute(sql`DELETE FROM nav_items WHERE id = ${duplicateId}`)
  }
  await database!.execute(sql`UPDATE nav_items SET parent_id = ${landingId} WHERE parent_id IS NULL AND id <> ${landingId}`)
  await database!.execute(sql`UPDATE nav_items SET parent_id = NULL, sort_order = 0 WHERE id = ${landingId}`)
}

async function seedNav(item: any, groupId: number, parentId: number | null, sort: number): Promise<number> {
  const menuType = item.menuType === 'folder' ? 'folder' : item.menuType === 'external' ? 'external' : 'page'
  const href = menuType === 'folder' ? '' : String(item.href || '')
  const fields = 'id,parent_id,sort_order,label_en,label_bn,featured,href,menu_type'
  let existing = menuType === 'folder'
    ? await database!.execute(sql`SELECT ${sql.raw(fields)} FROM nav_items WHERE group_id = ${groupId} AND parent_id IS NOT DISTINCT FROM ${parentId} AND menu_type = 'folder' AND label_en = ${item.label.en} ORDER BY id LIMIT 1`)
    : await database!.execute(sql`SELECT ${sql.raw(fields)} FROM nav_items WHERE group_id = ${groupId} AND href = ${href} AND COALESCE(menu_type, 'page') = ${menuType} ORDER BY id LIMIT 1`)
  // If an older row has a changed destination, reuse a same-parent item with the same bilingual label.
  if (!existing.rows[0]) {
    existing = await database!.execute(sql`SELECT ${sql.raw(fields)} FROM nav_items WHERE group_id = ${groupId} AND parent_id IS NOT DISTINCT FROM ${parentId} AND COALESCE(menu_type, 'page') = ${menuType} AND (label_en = ${item.label.en} OR label_bn = ${item.label.bn}) ORDER BY id LIMIT 1`)
  }
  let id: number
  if (existing.rows[0]) {
    const row = existing.rows[0] as any
    id = Number(row.id)
    const existingParent = row.parent_id == null ? null : Number(row.parent_id)
    if (String(row.href ?? '') !== href || existingParent !== parentId || Number(row.sort_order ?? 0) !== sort || row.label_en !== item.label.en || row.label_bn !== item.label.bn || Boolean(row.featured) !== Boolean(item.featured ?? false) || row.menu_type !== menuType) {
      await database!.execute(sql`UPDATE nav_items SET href = ${href}, parent_id = ${parentId}, label_en = ${item.label.en}, label_bn = ${item.label.bn}, sort_order = ${sort}, featured = ${item.featured ?? false}, menu_type = ${menuType} WHERE id = ${id}`)
    }
  } else {
    const inserted = await database!.execute(sql`INSERT INTO nav_items(group_id,parent_id,label_en,label_bn,href,featured,sort_order,menu_type) VALUES(${groupId},${parentId},${item.label.en},${item.label.bn},${href},${item.featured??false},${sort},${menuType}) RETURNING id`)
    id = Number((inserted.rows[0] as any).id)
  }
  for (let i = 0; i < (item.children ?? []).length; i++) await seedNav(item.children[i], groupId, id, i)
  return id
}

main().then(()=>console.log('Structural database seed complete.')).catch((error)=>{console.error(error);process.exit(1)})
