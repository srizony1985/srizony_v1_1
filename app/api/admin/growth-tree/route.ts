import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/cms/guard'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { auditAdminAction } from '@/lib/security'
import { readCmsSettingValueInfo } from '@/lib/cms/settings-store'
import {
  DEFAULT_GROWTH_MILESTONES,
  END_YEAR,
  GROWTH_TREE_SETTING_KEY,
  GROWTH_TREE_YEAR_COUNT,
  START_YEAR,
  normalizeGrowthMilestones,
} from '@/lib/GrowthMilestones'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
const bilingualSchema = z.object({
  en: z.string().trim().max(1200).optional(),
  bn: z.string().trim().max(1200).optional(),
}).strict()
const milestoneSchema = z.object({
  year: z.number().int().min(START_YEAR).max(END_YEAR),
  title: bilingualSchema.optional(),
  summary: bilingualSchema.optional(),
  achievements: z.array(bilingualSchema).max(12).optional(),
  stats: z.array(z.object({ label: bilingualSchema, value: z.string().trim().max(60) }).strict()).max(8).optional(),
  photo: z.object({
    src: z.string().trim().max(1000).refine((value) => /^\/(?!\/)/.test(value) || /^https:\/\//i.test(value), 'Use a site-relative path or HTTPS image URL.'),
    alt: bilingualSchema,
  }).strict().optional(),
  featured: z.boolean().optional(),
}).strict()
const updateSchema = z.object({
  milestones: z.array(milestoneSchema).length(GROWTH_TREE_YEAR_COUNT),
}).strict().superRefine(({ milestones }, context) => {
  milestones.forEach((item, index) => {
    const expectedYear = START_YEAR + index
    if (item.year !== expectedYear) {
      context.addIssue({
        code: 'custom',
        path: ['milestones', index, 'year'],
        message: `Growth-tree branches must remain in chronological order from ${START_YEAR} to ${END_YEAR}.`,
      })
    }
  })
})

export async function GET() {
  const guard = await requireAdmin('admin', 'editor', 'analyst')
  if (guard.denied) return guard.denied
  try {
    const result = await readCmsSettingValueInfo<unknown>(GROWTH_TREE_SETTING_KEY)
    return NextResponse.json({
      ok: true,
      milestones: normalizeGrowthMilestones(result.value),
      dataSource: result.source,
      readOnly: result.source === 'google-drive-snapshot',
      snapshotAt: result.snapshotAt,
    }, { headers })
  } catch (error) {
    console.error('[Admin growth tree API] Unable to read milestones.', error)
    return NextResponse.json({
      ok: true,
      milestones: DEFAULT_GROWTH_MILESTONES,
      dataSource: 'defaults',
      readOnly: true,
      warning: 'The primary database and a recent Google Drive snapshot are unavailable. Showing bootstrap content in read-only mode.',
    }, { headers })
  }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  if (!db) {
    return NextResponse.json({ ok: false, error: 'Neon database is not configured. Growth-tree edits cannot be saved.' }, { status: 503, headers })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid growth-tree data.', issues: parsed.error.flatten() }, { status: 400, headers })
  }

  const milestones = normalizeGrowthMilestones(parsed.data.milestones)
  try {
    await db.insert(siteSettings)
      .values({ key: GROWTH_TREE_SETTING_KEY, value: milestones, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: milestones, updatedAt: new Date() },
      })

    revalidateTag('site-content', { expire: 0 })
    revalidatePath('/', 'layout')
    await auditAdminAction({
      actorEmail: guard.admin!.email,
      action: 'growth-tree.update',
      entity: 'homepage-growth-tree',
      entityId: `${START_YEAR}-${END_YEAR}`,
      metadata: { branchCount: milestones.length, featuredYears: milestones.filter((item) => item.featured).map((item) => item.year) },
      request,
    })

    return NextResponse.json({ ok: true, milestones, message: 'Growth-tree branch data saved.' }, { headers })
  } catch (error) {
    console.error('[Admin growth tree API] Unable to save milestones.', error)
    return NextResponse.json({ ok: false, error: 'Unable to save growth-tree records.' }, { status: 503, headers })
  }
}
