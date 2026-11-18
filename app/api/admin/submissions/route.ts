import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getAdminSession } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { submissions } from '@/lib/db/schema'

const patchSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(['new', 'read', 'resolved', 'archived']),
})

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  if (database) {
    try {
      const items = await withDbRetry(() => database.select().from(submissions).where(eq(submissions.type, 'query')).orderBy(desc(submissions.createdAt)).limit(200))
      return NextResponse.json({ items, dataSource: 'neon' }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (!isTransientDatabaseError(error)) {
        console.error('Unable to load contact requests from Neon.', error)
        return NextResponse.json({ error: 'Unable to load contact requests.' }, { status: 503 })
      }
    }
  }

  const snapshot = await readDriveTableSnapshotInfo('submissions')
  if (!snapshot) return NextResponse.json({ error: 'Contact requests are unavailable: Neon is offline and no recent verified Google Drive snapshot is available.' }, { status: 503 })
  const items = snapshot.rows
    .filter((row) => row.type === 'query')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 200)
    .map((row) => ({
      id: Number(row.id), type: String(row.type || 'query'), name: row.name ?? null, email: row.email ?? null,
      phone: row.phone ?? null, message: row.message ?? null, payload: row.payload ?? null,
      status: String(row.status || 'new'), createdAt: row.created_at ?? null,
    }))
  return NextResponse.json({ items, dataSource: 'google-drive-snapshot', snapshotAt: snapshot.exportedAt, snapshotAgeMs: snapshot.ageMs }, {
    headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': snapshot.exportedAt, Warning: '110 - "Response is stale"' },
  })
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
