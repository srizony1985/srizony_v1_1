import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
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

export async function GET() {
  const access = await requireAdmin()
  if (access.denied) return access.denied
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured. Neon PostgreSQL is required for the CMS.' }, { status: 503 })

  try {
    await ensureCmsSchema()
    const [globalResult, pageCount, navGroups, navItems, media, content, settings, applications, submissions, donations, workflows] = await Promise.all([
      db.execute(sql`SELECT value, updated_at FROM site_global_state WHERE id = 1 LIMIT 1`),
      count('pages'), count('nav_groups'), count('nav_items'), count('media_items'), count('cms_content_items'), count('site_settings'),
      count('job_applications'), count('submissions'), count('donations'), countWorkflowSections(),
    ])
    const globalValue = (globalResult.rows[0] as { value?: Record<string, unknown>; updated_at?: string | Date } | undefined)?.value ?? {}
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
      fallback: { gateway: 'lib/cms/fallback-gateway.ts', runtimeMode: process.env.CMS_STATIC_FALLBACK === 'true' ? 'enabled' : 'disabled', identitySource: identityInDb ? 'database' : 'fallback' },
      identity,
      identityUpdatedAt: updatedAtRaw instanceof Date ? updatedAtRaw.toISOString() : updatedAtRaw ? String(updatedAtRaw) : null,
      domains,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure(error, 'Unable to inspect the CMS data pipeline.')
  }
}

export async function PUT(request: Request) {
  const access = await requireAdmin('admin', 'editor')
  if (access.denied) return access.denied
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  const body = await request.json().catch(() => null) as { siteIdentity?: unknown } | null
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
