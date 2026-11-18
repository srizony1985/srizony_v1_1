import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/cms/guard'
import { getCmsRegistry, updateActiveCmsSite } from '@/lib/cms/site-config'

export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }

const updateSchema = z.object({
  name: z.string().trim().max(250).optional(),
  primaryDomain: z.string().trim().max(255).nullable().optional(),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  defaultLocale: z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional(),
  supportedLocales: z.array(z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)).min(1).max(12).optional(),
  identity: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export async function GET() {
  const { denied } = await requireAdmin('admin', 'editor', 'analyst')
  if (denied) return denied
  try {
    const registry = await getCmsRegistry()
    return NextResponse.json({ ok: true, ...registry }, { headers: noStore })
  } catch (error) {
    console.error('Unable to read site configuration', error)
    return NextResponse.json({ ok: false, error: 'Unable to load the website configuration. Apply database migrations first.' }, { status: 503, headers: noStore })
  }
}

export async function PUT(request: Request) {
  const { denied, admin } = await requireAdmin('admin')
  if (denied) return denied
  const payload = updateSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) return NextResponse.json({ ok: false, error: 'Invalid site configuration.', issues: payload.error.flatten() }, { status: 400, headers: noStore })
  try {
    const site = await updateActiveCmsSite(payload.data)
    return NextResponse.json({ ok: true, site, updatedBy: admin?.email }, { headers: noStore })
  } catch (error) {
    console.error('Unable to update site configuration', error)
    return NextResponse.json({ ok: false, error: 'Unable to save the website configuration.' }, { status: 503, headers: noStore })
  }
}
