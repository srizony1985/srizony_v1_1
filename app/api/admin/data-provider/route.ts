import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/cms/guard'
import { db, isTransientDatabaseError } from '@/lib/db'
import { readDriveSnapshotManifestInfo } from '@/lib/google/drive-snapshot'

export const dynamic = 'force-dynamic'

function hasDriveCredentials() {
  const hasAccount = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64?.trim()
    || process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()
    || (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && (
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
      || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64?.trim()
    )),
  )
  return hasAccount && Boolean((process.env.GOOGLE_DRIVE_FOLDER_ID || process.env.SCARLETLABS_DRIVE_FOLDER_ID)?.trim())
}

export async function GET() {
  const access = await requireAdmin('admin', 'editor', 'analyst')
  if (access.denied) return access.denied

  let primaryConnected = false
  let primaryError: string | null = null
  if (db) {
    try {
      await db.execute(sql`SELECT 1`)
      primaryConnected = true
    } catch (error) {
      if (!isTransientDatabaseError(error)) primaryError = 'Primary database returned a non-transient error.'
      else primaryError = 'Primary database is temporarily unavailable or quota-limited.'
    }
  } else {
    primaryError = 'DATABASE_URL is not configured.'
  }

  let manifest: Awaited<ReturnType<typeof readDriveSnapshotManifestInfo>> = null
  let driveError: string | null = null
  if (hasDriveCredentials()) {
    try { manifest = await readDriveSnapshotManifestInfo() }
    catch { driveError = 'Google Drive manifest could not be read.' }
  } else {
    driveError = 'Google Drive credentials or folder are not configured.'
  }
  const availableSnapshots = manifest?.tables.filter((entry) => entry.available).length ?? 0
  const fallbackAvailable = availableSnapshots > 0
  const mode = primaryConnected ? 'neon-primary' : fallbackAvailable ? 'google-drive-read-only' : 'unavailable'

  return NextResponse.json({
    mode,
    selected: 'neon',
    providers: [
      { id: 'neon', label: 'Neon PostgreSQL', role: 'primary', configured: Boolean(db), connected: primaryConnected, error: primaryError },
      { id: 'google-drive', label: 'Google Drive JSON snapshots', role: 'read-failover', configured: hasDriveCredentials(), available: fallbackAvailable, availableTables: availableSnapshots, totalTables: manifest?.tables.length ?? 0, exportedAt: manifest?.exportedAt ?? null, error: driveError },
    ],
    writesEnabled: primaryConnected,
    readOnly: !primaryConnected && fallbackAvailable,
    authentication: 'Database-backed sessions require Neon. Environment-configured break-glass administrators remain available during a Neon outage.',
    note: primaryConnected
      ? 'Neon is serving live reads and writes. Google Drive provides validated read failover and point-in-time recovery.'
      : fallbackAvailable
        ? 'Google Drive snapshots are serving read-only data. CMS mutations, uploads, authentication changes and transactional submissions remain disabled until Neon recovers.'
        : 'Neither the primary database nor a usable Google Drive snapshot is currently available.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST() {
  const access = await requireAdmin('admin')
  if (access.denied) return access.denied
  return NextResponse.json({ error: 'Provider selection is intentionally locked. Neon remains the transactional primary; Google Drive is the validated read-failover and recovery provider.' }, { status: 409 })
}
