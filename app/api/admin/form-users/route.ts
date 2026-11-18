import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { getAdminSession } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { formUsers } from '@/lib/db/schema'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  if (database) {
    try {
      const items = await withDbRetry(() => database.select().from(formUsers).orderBy(desc(formUsers.updatedAt)).limit(500))
      return NextResponse.json({ items, dataSource: 'neon' }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (!isTransientDatabaseError(error)) {
        console.error('Unable to load form users from Neon.', error)
        return NextResponse.json({ error: 'Unable to load form users.' }, { status: 503 })
      }
    }
  }

  const snapshot = await readDriveTableSnapshotInfo('form_users')
  if (!snapshot) return NextResponse.json({ error: 'Form users are unavailable: Neon is offline and no recent verified Google Drive snapshot is available.' }, { status: 503 })
  const items = snapshot.rows
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
    .slice(0, 500)
    .map((row) => ({
      id: Number(row.id), provider: row.provider ?? null, providerId: row.provider_id ?? null,
      emailVerifiedAt: row.email_verified_at ?? null, name: row.name ?? null, email: String(row.email || ''),
      phone: row.phone ?? null, createdAt: row.created_at ?? null, updatedAt: row.updated_at ?? null,
    }))
  return NextResponse.json({ items, dataSource: 'google-drive-snapshot', snapshotAt: snapshot.exportedAt, snapshotAgeMs: snapshot.ageMs }, {
    headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': snapshot.exportedAt, Warning: '110 - "Response is stale"' },
  })
}
