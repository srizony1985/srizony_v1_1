import type { ExternalValue, JsonObject } from '@/types/json'
import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db, isTransientDatabaseError } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { requireAdmin, failure } from '@/lib/cms/guard'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { auditAdminAction } from '@/lib/security'
import { SITE_FALLBACKS } from '@/lib/cms/fallback-gateway'
import type { SiteIdentity } from '@/types/site'

export const dynamic = 'force-dynamic'

const identitySchema = z.object({
  name: z.string().trim().min(1).max(160),
  alternateName: z.string().trim().max(160).default(''),
  canonicalUrl: z.string().trim().url().max(500).refine((value) => /^https?:\/\//i.test(value), 'Use an http:// or https:// URL.'),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(1000),
  keywords: z.array(z.string().trim().min(1).max(80)).max(30),
  foundingDate: z.string().trim().max(20).default(''),
  logo: z.string().trim().min(1).max(1000),
  ogImage: z.string().trim().min(1).max(1000),
})

async function count(table: string): Promise<number | null> {
  if (!db) return null
  try {
    // Table identifiers below are fixed application constants, never request input.
    const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM ${table}`))
    return Number((result.rows[0] as { count?: number } | undefined)?.count ?? 0)
  } catch {
    return null
  }
}

async function countWorkflowSections(): Promise<number | null> {
  if (!db) return null
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM pages p
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(p.render_cache->'sections') = 'array' THEN p.render_cache->'sections' ELSE '[]'::jsonb END
      ) section
      WHERE section->>'type' IN ('contact', 'donation', 'cta', 'contentFeed')
    `)
    return Number((result.rows[0] as { count?: number } | undefined)?.count ?? 0)
  } catch { return null }
}

function objectValue(value: JsonObject[string] | undefined): JsonObject | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as JsonObject
  if (typeof value === 'string') {
    try {
      const parsed: ExternalValue = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as JsonObject : null
    } catch { return null }
  }
  return null
}

async function readPipelineFromDrive() {
  const tableNames = ['site_global_state', 'pages', 'nav_groups', 'nav_items', 'media_items', 'cms_content_items', 'site_settings', 'job_applications', 'submissions', 'donations'] as const
  const snapshots = await Promise.all(tableNames.map(async (table) => ({ table, snapshot: await readDriveTableSnapshotInfo(table) })))
  const missing = snapshots.filter((item) => !item.snapshot).map((item) => item.table)
  if (missing.length) return NextResponse.json({ error: 'The Drive mirror is incomplete for CMS pipeline inspection.', missingSnapshots: missing }, { status: 503 })

  const byTable = new Map(snapshots.map((item) => [item.table, item.snapshot!]))
  const globalRows = byTable.get('site_global_state')!.rows
  const globalRow = globalRows.find((row) => Number(row.id) === 1) ?? globalRows[0]
  const globalValue = objectValue(globalRow?.value) ?? {}
  const identityValue = objectValue(globalValue.siteIdentity)
  const identity = (identityValue ?? SITE_FALLBACKS.systemData.siteIdentity) as SiteIdentity
  const pages = byTable.get('pages')!.rows
  const workflowCount = pages.reduce((total, page) => {
    const renderCache = objectValue(page.render_cache)
    const sections = Array.isArray(renderCache?.sections) ? renderCache.sections : []
    return total + sections.filter((section) => {
      const record = section && typeof section === 'object' && !Array.isArray(section) ? section as JsonObject : null
      return Boolean(record && ['contact', 'donation', 'cta', 'contentFeed'].includes(String(record.type)))
    }).length
  }, 0)
  const snapshotAgeMs = Math.max(...snapshots.map((item) => item.snapshot!.ageMs))
  const snapshotAt = new Date(Math.min(...snapshots.map((item) => Date.parse(item.snapshot!.exportedAt)))).toISOString()
  const count = (table: typeof tableNames[number]) => byTable.get(table)!.rows.length
  const domains = [
    { id: 'identity', label: 'Site identity & global settings', table: 'site_global_state', records: globalRows.length, state: identityValue ? 'google-drive-snapshot' : 'fallback', href: '/admin/dashboard/cms-pipeline' },
    { id: 'pages', label: 'Landing and slug pages', table: 'pages', records: count('pages'), state: 'google-drive-snapshot', href: '/admin/dashboard/page-builder' },
    { id: 'navigation', label: 'Single navigation tree', table: 'nav_items (one primary tree)', records: count('nav_items'), state: 'google-drive-snapshot', href: '/admin/dashboard/navigation' },
    { id: 'media', label: 'Media library', table: 'media_items', records: count('media_items'), state: 'google-drive-snapshot', href: '/admin/dashboard/settings?view=database' },
    { id: 'collections', label: 'Managed content collections', table: 'cms_content_items', records: count('cms_content_items'), state: 'google-drive-snapshot', href: '/admin/dashboard/site-content' },
    { id: 'settings', label: 'Website essentials and settings', table: 'site_settings', records: count('site_settings'), state: 'google-drive-snapshot', href: '/admin/dashboard/website-essentials' },
    { id: 'workflows', label: 'Page workflows and forms', table: 'pages.render_cache', records: workflowCount, state: 'google-drive-snapshot', href: '/admin/dashboard/page-builder' },
    { id: 'submissions', label: 'Job applications, submissions and donations', table: 'job_applications + submissions + donations', records: count('job_applications') + count('submissions') + count('donations'), state: 'google-drive-snapshot', href: '/admin/dashboard/reports/submissions' },
  ]
  return NextResponse.json({
    database: { provider: 'Neon PostgreSQL', connected: false },
    fallback: { gateway: 'lib/cms/fallback-gateway.ts', runtimeMode: 'active-drive-snapshot', identitySource: identityValue ? 'google-drive-snapshot' : 'fallback' },
    identity,
    identityUpdatedAt: globalRow?.updated_at ? String(globalRow.updated_at) : null,
    domains,
    dataSource: 'google-drive-snapshot',
    readOnly: true,
    snapshotAt,
    snapshotAgeMs,
  }, { headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': snapshotAt, Warning: '110 - \"Response is stale\"' } })
}

export async function GET() {
  const access = await requireAdmin()
  if (access.denied) return access.denied
  if (!db) return readPipelineFromDrive()

  try {
    await ensureCmsSchema()
    const [globalResult, pageCount, navGroups, navItems, media, content, settings, applications, submissions, donations, workflows] = await Promise.all([
      db.execute(sql`SELECT value, updated_at FROM site_global_state WHERE id = 1 LIMIT 1`),
      count('pages'), count('nav_groups'), count('nav_items'), count('media_items'), count('cms_content_items'), count('site_settings'),
      count('job_applications'), count('submissions'), count('donations'), countWorkflowSections(),
    ])
    const globalValue = (globalResult.rows[0] as { value?: JsonObject; updated_at?: string | Date } | undefined)?.value ?? {}
    const identityInDb = globalValue.siteIdentity && typeof globalValue.siteIdentity === 'object'
    const identity = (identityInDb ? globalValue.siteIdentity : SITE_FALLBACKS.systemData.siteIdentity) as SiteIdentity
    const updatedAtRaw = (globalResult.rows[0] as { updated_at?: string | Date } | undefined)?.updated_at
    const domains = [
      { id: 'identity', label: 'Site identity & global settings', table: 'site_global_state', records: Number(globalResult.rows.length), state: identityInDb ? 'database' : 'fallback', href: '/admin/dashboard/cms-pipeline' },
      { id: 'pages', label: 'Landing and slug pages', table: 'pages', records: pageCount, state: pageCount === null ? 'unavailable' : pageCount > 0 ? 'database' : 'empty', href: '/admin/dashboard/page-builder' },
      { id: 'navigation', label: 'Single navigation tree', table: 'nav_items (one primary tree)', records: navItems, state: navItems === null ? 'unavailable' : navItems > 0 ? 'database' : 'empty', href: '/admin/dashboard/navigation' },
      { id: 'media', label: 'Media library', table: 'media_items', records: media, state: media === null ? 'unavailable' : 'database', href: '/admin/dashboard/settings?view=database' },
      { id: 'collections', label: 'Managed content collections', table: 'cms_content_items', records: content, state: content === null ? 'unavailable' : 'database', href: '/admin/dashboard/site-content' },
      { id: 'settings', label: 'Website essentials and settings', table: 'site_settings', records: settings, state: settings === null ? 'unavailable' : 'database', href: '/admin/dashboard/website-essentials' },
      { id: 'workflows', label: 'Page workflows and forms', table: 'pages.render_cache', records: workflows, state: workflows === null ? 'unavailable' : 'database', href: '/admin/dashboard/page-builder' },
      { id: 'submissions', label: 'Job applications, submissions and donations', table: 'job_applications + submissions + donations', records: [applications, submissions, donations].some((v) => v === null) ? null : (applications || 0) + (submissions || 0) + (donations || 0), state: [applications, submissions, donations].some((v) => v === null) ? 'unavailable' : 'database', href: '/admin/dashboard/reports/submissions' },
    ]
    return NextResponse.json({
      database: { provider: 'Neon PostgreSQL', connected: true },
      fallback: { gateway: 'lib/cms/fallback-gateway.ts', runtimeMode: process.env.NODE_ENV === 'production' ? 'disabled-in-production' : process.env.CMS_STATIC_FALLBACK === 'true' ? 'enabled' : 'disabled', identitySource: identityInDb ? 'database' : 'fallback' },
      identity,
      identityUpdatedAt: updatedAtRaw instanceof Date ? updatedAtRaw.toISOString() : updatedAtRaw ? String(updatedAtRaw) : null,
      domains,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isTransientDatabaseError(error)) return readPipelineFromDrive()
    return failure(error, 'Unable to inspect the CMS data pipeline.')
  }
}

export async function PUT(request: Request) {
  const access = await requireAdmin('admin', 'editor')
  if (access.denied) return access.denied
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { siteIdentity?: ExternalValue } | null
  const parsed = identitySchema.safeParse(body?.siteIdentity)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid site identity.', issues: parsed.error.flatten() }, { status: 400 })

  try {
    await ensureCmsSchema()
    const identity = parsed.data
    await db.execute(sql`
      INSERT INTO site_global_state (id, value, updated_at)
      VALUES (1, jsonb_build_object(
        'siteIdentity', ${JSON.stringify(identity)}::jsonb,
        'images', jsonb_build_object('logo', ${identity.logo}),
        'portfolio', jsonb_build_object('brandIdentity', jsonb_build_object('logo', ${identity.logo}))
      ), now())
      ON CONFLICT (id) DO UPDATE SET
        value = COALESCE(site_global_state.value, '{}'::jsonb)
          || jsonb_build_object('siteIdentity', ${JSON.stringify(identity)}::jsonb)
          || jsonb_build_object('images', COALESCE(site_global_state.value->'images', '{}'::jsonb) || jsonb_build_object('logo', ${identity.logo}))
          || jsonb_build_object('portfolio', COALESCE(site_global_state.value->'portfolio', '{}'::jsonb) || jsonb_build_object(
            'brandIdentity', COALESCE(site_global_state.value->'portfolio'->'brandIdentity', '{}'::jsonb) || jsonb_build_object('logo', ${identity.logo})
          )),
        updated_at = now()
    `)
    await auditAdminAction({ actorEmail: access.admin.email, action: 'cms.site-identity.update', entity: 'site_global_state', entityId: 'siteIdentity', metadata: { name: identity.name }, request })
    revalidatePath('/', 'layout')
    revalidateTag('site-content', 'max')
    return NextResponse.json({ ok: true, siteIdentity: identity })
  } catch (error) {
    return failure(error, 'Unable to save site identity.')
  }
}
