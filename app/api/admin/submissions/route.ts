import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAdminSession } from '@/lib/adminAuth'
import { db, withDbRetry } from '@/lib/db'
import { submissions } from '@/lib/db/schema'

const patchSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(['new', 'read', 'resolved', 'archived']),
})

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  if (!database) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })

  try {
    const items = await withDbRetry(() => database.select().from(submissions).where(eq(submissions.type, 'query')).orderBy(desc(submissions.createdAt)).limit(200))
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to load contact requests.' }, { status: 503 })
  }
}

export async function PATCH(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  if (!database) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })

  const result = patchSchema.safeParse(await req.json().catch(() => null))
  if (!result.success) return NextResponse.json({ error: 'Invalid update.' }, { status: 400 })

  try {
    await withDbRetry(() => database.update(submissions).set({ status: result.data.status }).where(eq(submissions.id, result.data.id)))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Unable to update the contact request.' }, { status: 503 })
  }
}
