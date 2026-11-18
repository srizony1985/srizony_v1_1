import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { getAdminSession } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { donations } from '@/lib/db/schema'
import { ensureDonationsSchema } from '@/lib/db/ensureOperationalSchema'

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  if (database) {
    try {
      await ensureDonationsSchema()
      const items = await withDbRetry(() => database.select().from(donations).orderBy(desc(donations.createdAt)).limit(200))
      return NextResponse.json({ items, dataSource: 'neon' }, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      if (!isTransientDatabaseError(error)) {
        console.error('Unable to load donations from Neon.', error)
        return NextResponse.json({ error: 'Unable to load donations.' }, { status: 503 })
      }
    }
  }

  const snapshot = await readDriveTableSnapshotInfo('donations')
  if (!snapshot) return NextResponse.json({ error: 'Donations are unavailable: Neon is offline and no recent verified Google Drive snapshot is available.' }, { status: 503 })
  const items = snapshot.rows
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 200)
    .map((row) => ({
      id: Number(row.id), transactionId: String(row.transaction_id || ''), amount: String(row.amount ?? '0'), status: String(row.status || 'pending'),
      donor: row.donor ?? null, receiptSentAt: row.receipt_sent_at ?? null, idempotencyKey: row.idempotency_key ?? null,
      idempotencyFingerprint: row.idempotency_fingerprint ?? null, gatewayPageUrl: row.gateway_page_url ?? null,
      gatewayRiskLevel: row.gateway_risk_level ?? null, gatewayRiskTitle: row.gateway_risk_title ?? null, createdAt: row.created_at ?? null,
    }))
  return NextResponse.json({ items, dataSource: 'google-drive-snapshot', snapshotAt: snapshot.exportedAt, snapshotAgeMs: snapshot.ageMs }, {
    headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': snapshot.exportedAt, Warning: '110 - "Response is stale"' },
  })
}
