import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure, requireAdmin } from '@/lib/cms/guard'
import { listApplicantNotifications, listApplications, listJobSummaries, setApplicationStatus } from '@/lib/cms/jobs'

const noStore = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  const { denied } = await requireAdmin()
  if (denied) return denied
  const p = new URL(req.url).searchParams
  try {
    if (p.get('view') === 'notifications') return NextResponse.json(await listApplicantNotifications(), { headers: noStore })
    if (p.get('view') === 'applications') return NextResponse.json({ items: await listApplications(Number(p.get('jobId')) || undefined, p.get('status') || undefined) }, { headers: noStore })
    return NextResponse.json({ items: await listJobSummaries() }, { headers: noStore })
  } catch (e) { return failure(e, 'Unable to load jobs.') }
}

export async function PATCH(req: Request) {
  const { denied } = await requireAdmin('admin', 'editor')
  if (denied) return denied
  const body = z.object({ id: z.number().int().positive(), status: z.string() }).safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid application update.' }, { status: 400 })
  try { await setApplicationStatus(body.data.id, body.data.status); return NextResponse.json({ ok: true }) } catch (e) { return failure(e, 'Unable to update the application.') }
}
