import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/cms/guard'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { auditAdminAction } from '@/lib/security'
import { DEFAULT_WEBSITE_ESSENTIALS, isSafePublicUrl, normalizeWebsiteEssentials } from '@/lib/websiteEssentials'
import { BRANCHES } from '@/lib/cms/fallback-gateway'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const documentSchema = z.object({ titleEn: z.string().trim().max(180), titleBn: z.string().trim().max(180), url: z.string().trim().max(2000) })
const staffSchema = z.object({
  id: z.string().trim().min(1).max(100), nameEn: z.string().trim().max(180), nameBn: z.string().trim().max(180),
  designationEn: z.string().trim().max(180), designationBn: z.string().trim().max(180),
  bioEn: z.string().trim().max(3000).optional().default(''), bioBn: z.string().trim().max(3000).optional().default(''),
  photoUrl: z.string().trim().max(2000).optional().default(''), published: z.boolean().default(true), sortOrder: z.number().int().min(0).max(10000).default(0),
})
const locationSchema = z.object({
  id: z.string().trim().min(1).max(100), kind: z.enum(['head', 'branch']).default('branch'),
  name: z.object({ en: z.string().trim().min(1).max(180), bn: z.string().trim().min(1).max(180) }),
  district: z.object({ en: z.string().trim().min(1).max(180), bn: z.string().trim().min(1).max(180) }),
  division: z.object({ en: z.string().trim().min(1).max(180), bn: z.string().trim().min(1).max(180) }),
  address: z.object({ en: z.string().trim().max(500), bn: z.string().trim().max(500) }).optional(),
  lat: z.number().min(20).max(27), lng: z.number().min(87).max(93),
  manager: z.object({
    name: z.object({ en: z.string().trim().max(180), bn: z.string().trim().max(180) }).optional(),
    title: z.object({ en: z.string().trim().max(180), bn: z.string().trim().max(180) }).optional(),
    phone: z.string().trim().max(40).optional(), email: z.string().trim().max(180).optional(),
  }).optional(),
})
const payloadSchema = z.object({
  socials: z.object({ facebook: z.string().trim().max(1000), instagram: z.string().trim().max(1000), youtube: z.string().trim().max(1000), linkedin: z.string().trim().max(1000) }),
  documents: z.object({ staffListPdf: documentSchema, locationsPdf: documentSchema }),
  staff: z.array(staffSchema).max(300), locations: z.array(locationSchema).max(500),
}).superRefine((value, ctx) => {
  const assertUniqueIds = <T extends { id: string }>(field: 'staff' | 'locations', records: T[]) => {
    const seen = new Set<string>()
    records.forEach((record, index) => {
      if (seen.has(record.id)) ctx.addIssue({ code: 'custom', path: [field, index, 'id'], message: `Duplicate ${field} record ID.` })
      seen.add(record.id)
    })
  }
  assertUniqueIds('staff', value.staff)
  assertUniqueIds('locations', value.locations)
  value.staff.forEach((person, index) => {
    if (person.published && !person.nameEn.trim() && !person.nameBn.trim()) {
      ctx.addIssue({ code: 'custom', path: ['staff', index, 'nameEn'], message: 'A published staff member must have a name.' })
    }
    if (person.published && !person.designationEn.trim() && !person.designationBn.trim()) {
      ctx.addIssue({ code: 'custom', path: ['staff', index, 'designationEn'], message: 'A published staff member must have a designation.' })
    }
  })
})

export async function GET() {
  try {
    const bootstrapDefaults = { ...DEFAULT_WEBSITE_ESSENTIALS, locations: BRANCHES }
    if (!db) return NextResponse.json(bootstrapDefaults, { headers: { 'Cache-Control': 'no-store', 'X-Website-Essentials-Configured': 'false' } })
    const rows = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, 'cms-document:website-essentials.json')).limit(1)
    const configured = rows.length > 0
    const essentials = normalizeWebsiteEssentials(rows[0]?.value ?? bootstrapDefaults)
    // Keep draft staff records private. Signed-in admins/editors use this same API to edit drafts.
    const admin = await getAdminSession()
    const canManage = hasAdminRole(admin, 'admin', 'editor')
    const responseValue = canManage ? essentials : { ...essentials, staff: essentials.staff.filter((person) => person.published) }
    return NextResponse.json(responseValue, {
      headers: { 'Cache-Control': 'no-store', 'X-Website-Essentials-Configured': configured ? 'true' : 'false' },
    })
  } catch (error) {
    // Public pages remain usable while a database/provider is being configured.
    console.error('Website essentials unavailable; using safe defaults.', error instanceof Error ? error.message : error)
    return NextResponse.json({ ...DEFAULT_WEBSITE_ESSENTIALS, locations: BRANCHES }, { headers: { 'Cache-Control': 'no-store', 'X-Website-Essentials-Configured': 'false' } })
  }
}

export async function PUT(req: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const raw = await req.json().catch(() => null)
  const parsed = payloadSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid website essentials data.', details: parsed.error.flatten() }, { status: 400 })
  const value = parsed.data
  for (const [name, url] of Object.entries(value.socials)) {
    if (!isSafePublicUrl(url, false) && url.trim()) return NextResponse.json({ error: `${name} must be a secure HTTPS URL.` }, { status: 400 })
  }
  for (const [name, document] of Object.entries(value.documents)) {
    if (document.url && !isSafePublicUrl(document.url)) return NextResponse.json({ error: `${name} must use a safe relative path or HTTPS URL.` }, { status: 400 })
  }
  for (const person of value.staff) {
    if (person.photoUrl && !isSafePublicUrl(person.photoUrl)) return NextResponse.json({ error: `Photo URL for ${person.nameEn || 'a staff member'} must use HTTPS or a same-origin path.` }, { status: 400 })
  }
  try {
    if (!db) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })
    await db.insert(siteSettings).values({ key: 'cms-document:website-essentials.json', value, updatedAt: new Date() }).onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: new Date() } })
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'website_essentials.update', entity: 'website-essentials', metadata: { staffCount: value.staff.length, locationCount: value.locations.length }, request: req })
    return NextResponse.json({ ok: true, data: normalizeWebsiteEssentials(value) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Unable to save website essentials.', error)
    return NextResponse.json({ error: 'Unable to save website essentials. Check the database connection and server logs.' }, { status: 503 })
  }
}
