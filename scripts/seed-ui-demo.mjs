#!/usr/bin/env node
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'

const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())

const DATASET_PATH = path.join(process.cwd(), 'data', 'ui-demo-content.v1.json')
const DATASET_ID = 'srizony-ui-demo-2026-11-v1'
const ROUTES = {
  project: ['/projects', 'Projects', 'প্রকল্পসমূহ', 'Explore fictional project cards and detail pages.', 'কাল্পনিক প্রকল্প কার্ড ও বিস্তারিত পৃষ্ঠা দেখুন।'],
  news: ['/news', 'Latest News', 'সর্বশেষ সংবাদ', 'Fictional news and field updates.', 'কাল্পনিক সংবাদ ও মাঠপর্যায়ের আপডেট।'],
  enterprise: ['/enterprise-development', 'Enterprises', 'উদ্যোগসমূহ', 'Fictional enterprise profiles.', 'কাল্পনিক উদ্যোগের প্রোফাইল।'],
  'partner-agency': ['/about-us/partners-networks', 'Partner Agencies', 'অংশীদার সংস্থা', 'Fictional partner profiles.', 'কাল্পনিক অংশীদার প্রোফাইল।'],
  'health-service': ['/social-development/health-program', 'Health Services', 'স্বাস্থ্যসেবা', 'Fictional health information cards.', 'কাল্পনিক স্বাস্থ্য তথ্য কার্ড।'],
  'loan-product': ['/organizational-development', 'Loan Products', 'ঋণ পণ্য', 'Fictional finance product previews.', 'কাল্পনিক অর্থায়ন পণ্যের প্রিভিউ।'],
  product: ['/enterprise-development', 'Products & Services', 'পণ্য ও সেবা', 'Fictional products and services.', 'কাল্পনিক পণ্য ও সেবা।'],
  team: ['/management-staff', 'Our Team', 'আমাদের টিম', 'Fictional team profiles for layout testing.', 'বিন্যাস পরীক্ষার জন্য কাল্পনিক টিম প্রোফাইল।'],
  notice: ['/notice', 'Notices', 'নোটিশ', 'Fictional public notices.', 'কাল্পনিক পাবলিক নোটিশ।'],
  report: ['/resources', 'Reports', 'প্রতিবেদন', 'Fictional reports and resources.', 'কাল্পনিক প্রতিবেদন ও রিসোর্স।'],
  job: ['/carrer-job', 'Current Vacancies', 'চলমান চাকরির সুযোগ', 'Fictional vacancies for form preview only.', 'শুধু ফর্ম প্রিভিউয়ের জন্য কাল্পনিক চাকরির বিজ্ঞপ্তি।'],
  'success-story': ['/success-stories', 'Success Stories', 'সাফল্যের গল্প', 'Fictional composite stories.', 'কাল্পনিক সম্মিলিত গল্প।'],
  stat: ['/impact/statistics', 'Impact Statistics', 'প্রভাবের পরিসংখ্যান', 'Fictional metrics for visual testing.', 'ভিজ্যুয়াল পরীক্ষার জন্য কাল্পনিক পরিসংখ্যান।'],
}
const CORE_KEYS = new Set(['title_en', 'title_bn', 'summary_en', 'summary_bn', 'body_en', 'body_bn', 'date', 'image', 'routeParent'])

function assertDemoEnvironment() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed UI demo content in production.')
  if (process.env.ALLOW_UI_DEMO_SEED !== 'YES_DEMO_ONLY') {
    throw new Error('Set ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY to confirm this is a local or staging demo database.')
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is missing.')
}

function safeJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {} } catch { return {} }
  }
  return {}
}

function collectionSection(component, label, labelBn) {
  return {
    type: 'contentFeed',
    visible: true,
    heading: { en: label, bn: labelBn },
    components: [component],
    items: [],
    columns: 3,
    contentCollection: { enabled: true, component, maxItems: 12, layout: 'grid', columns: 3, gap: 24, viewportItems: 3 },
  }
}

async function ensureCollectionPage(client, siteId, component) {
  const [slug, headingEn, headingBn, subtitleEn, subtitleBn] = ROUTES[component]
  const seedSection = collectionSection(component, headingEn, headingBn)
  const initialCache = { slug, title: { en: headingEn, bn: headingBn }, subtitle: { en: subtitleEn, bn: subtitleBn }, status: 'published', sortOrder: 0, sections: [seedSection] }
  await client.query(`
    INSERT INTO public.pages (site_id, slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'published',0)
    ON CONFLICT (slug) DO NOTHING
  `, [siteId, slug, headingEn, headingBn, subtitleEn, subtitleBn, JSON.stringify(initialCache)])

  const pageResult = await client.query('SELECT render_cache FROM public.pages WHERE slug = $1 LIMIT 1', [slug])
  if (!pageResult.rows[0]) throw new Error(`Collection page ${slug} could not be created.`)
  const cache = safeJsonObject(pageResult.rows[0].render_cache)
  const sections = Array.isArray(cache.sections) ? [...cache.sections] : []
  const existingIndex = sections.findIndex((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return false
    const value = section
    const collection = value.contentCollection && typeof value.contentCollection === 'object' ? value.contentCollection : null
    return collection?.component === component || (value.type === 'contentFeed' && Array.isArray(value.components) && value.components[0] === component)
  })
  let changed = false
  if (existingIndex >= 0) {
    const current = sections[existingIndex]
    if (current?.type === 'contentFeed' && !current.contentCollection) {
      sections[existingIndex] = { ...current, components: [component], contentCollection: seedSection.contentCollection }
      changed = true
    }
  } else {
    const existingCareerIndex = component === 'job' ? sections.findIndex((section) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) return false
      const heading = section.heading && typeof section.heading === 'object' ? section.heading.en : section.heading
      return section.type === 'noticeList' && /career|job|open opportunities|current vacancies/i.test(String(heading || ''))
    }) : -1
    if (existingCareerIndex >= 0) sections[existingCareerIndex] = seedSection
    else sections.push(seedSection)
    changed = true
  }
  if (changed) {
    const nextCache = {
      ...cache,
      slug,
      title: cache.title || { en: headingEn, bn: headingBn },
      sections,
    }
    await client.query('UPDATE public.pages SET render_cache = $2::jsonb, updated_at = now() WHERE slug = $1', [slug, JSON.stringify(nextCache)])
  }
}

async function main() {
  assertDemoEnvironment()
  const dataset = JSON.parse(await readFile(DATASET_PATH, 'utf8'))
  if (dataset.format !== 'srizony-cms-ui-demo-content' || dataset.version !== 1 || dataset.datasetId !== DATASET_ID || !Array.isArray(dataset.items)) {
    throw new Error('Unsupported or modified UI demo dataset file.')
  }

  const siteKey = (process.env.CMS_SITE_KEY || dataset.siteKey || 'default').trim()
  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: 'srizony-ui-demo-seed' })
  let inserted = 0
  let skipped = 0
  try {
    await client.connect()
    await client.query('BEGIN')
    const site = await client.query('SELECT id FROM public.cms_sites WHERE site_key = $1 LIMIT 1', [siteKey])
    if (!site.rows[0]) throw new Error(`CMS site "${siteKey}" does not exist. Run the CMS registry seed and verify CMS_SITE_KEY first.`)
    const siteId = Number(site.rows[0].id)

    const slugs = dataset.items.map((item) => item.slug)
    if (new Set(slugs).size !== slugs.length) throw new Error('The dataset contains duplicate slugs.')

    // Preflight collisions before the first write. Existing non-demo records are never overwritten.
    for (const item of dataset.items) {
      const parent = ROUTES[item.component]?.[0]
      if (!parent || item.values?.routeParent !== parent) throw new Error(`Invalid component route for ${item.component}/${item.slug}.`)
      const existing = await client.query(
        'SELECT id, title_en, attributes FROM public.cms_content_items WHERE site_id = $1 AND component = $2 AND slug = $3 LIMIT 1',
        [siteId, item.component, item.slug],
      )
      if (existing.rows[0] && !String(existing.rows[0].title_en || '').startsWith('DEMO PREVIEW —')) {
        throw new Error(`Refusing to overwrite non-demo content: ${item.component}/${item.slug}.`)
      }
    }

    for (const item of dataset.items) {
      const values = item.values
      const existing = await client.query(
        'SELECT id FROM public.cms_content_items WHERE site_id = $1 AND component = $2 AND slug = $3 LIMIT 1',
        [siteId, item.component, item.slug],
      )
      if (existing.rows[0]) {
        skipped++
        continue
      }

      const extras = Object.fromEntries(Object.entries(values).filter(([key]) => !CORE_KEYS.has(key)))
      const routeParent = ROUTES[item.component][0]
      const attributes = {
        ...extras,
        routeParent,
        imageManaged: values.image ? 'true' : 'false',
        demoOnly: true,
        demoDataset: DATASET_ID,
        ...(item.component === 'news' || item.component === 'success-story'
          ? { detailType: item.component, detailPath: `${routeParent}/${item.slug}` }
          : {}),
      }
      const order = Number(values.displayOrder ?? values.order ?? 0)
      await client.query(`
        INSERT INTO public.cms_content_items (
          site_id, component, slug, route_parent, title_en, title_bn,
          summary_en, summary_bn, body_en, body_bn, image_src,
          published_at, status, attributes, sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13,$14::jsonb,$15)
      `, [
        siteId, item.component, item.slug, routeParent,
        values.title_en, values.title_bn || values.title_en,
        values.summary_en || '', values.summary_bn || '',
        values.body_en || '', values.body_bn || '', values.image || null,
        values.date, item.status || 'published', JSON.stringify(attributes),
        Number.isSafeInteger(order) && order >= 0 ? order : 0,
      ])
      inserted++
    }

    for (const component of [...new Set(dataset.items.map((item) => item.component))]) {
      await ensureCollectionPage(client, siteId, component)
    }

    await client.query('COMMIT')
    console.log(`UI demo dataset applied to CMS site "${siteKey}" (id=${siteId}).`)
    console.log(`Inserted: ${inserted}; already present and skipped: ${skipped}; total dataset rows: ${dataset.items.length}.`)
    console.log('All imported records are published for preview and clearly labeled DEMO PREVIEW. Do not use this dataset as official content.')
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* original error is more useful */ }
    throw error
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((error) => { console.error('UI demo DB seed failed:', error instanceof Error ? error.message : error); process.exitCode = 1 })
