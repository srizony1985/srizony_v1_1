import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { getAdminSession } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { siteVisitors } from '@/lib/db/schema'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  if (database) {
    try {
      const items = await withDbRetry(() => database.select().from(siteVisitors).orderBy(desc(siteVisitors.lastSeenAt)).limit(500))
      return NextResponse.json({ items, dataSource: 'neon' }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (!isTransientDatabaseError(error)) {
        console.error('Unable to load visitors from Neon.', error)
        return NextResponse.json({ error: 'Unable to load visitors.' }, { status: 503 })
      }
    }
  }

  const snapshot = await readDriveTableSnapshotInfo('site_visitors')
  if (!snapshot) return NextResponse.json({ error: 'Visitor analytics are unavailable: the latest complete Google Drive snapshot is missing or too old.' }, { status: 503 })
  const items = snapshot.rows
    .sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
    .slice(0, 500)
    .map((row) => ({
      id: Number(row.id), visitorId: String(row.visitor_id || ''), firstSeenAt: row.first_seen_at ?? null,
      lastSeenAt: row.last_seen_at ?? null, pageViews: Number(row.page_views || 0), lastPath: row.last_path ?? null,
      referrer: row.referrer ?? null, userAgent: row.user_agent ?? null,
    }))
  return NextResponse.json({ items, dataSource: 'google-drive-snapshot', snapshotAt: snapshot.exportedAt, snapshotAgeMs: snapshot.ageMs }, {
    headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': snapshot.exportedAt, Warning: '110 - "Response is stale"' },
  })
}
