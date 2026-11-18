import type { JsonObject } from '@/types/json'
import { createHash } from 'node:crypto'
import 'server-only'
import { readDriveJson, readDriveJsonWithDigest } from '@/lib/google/drive'

type DriveTableBackup = {
  format?: string
  table?: string
  schemaVersion?: number
  siteKey?: string
  siteSchemaVersion?: number
  pipelineFormat?: string
  schema?: { format?: string; schemaName?: string; tableName?: string; columns?: unknown[] }
  schemaSha256?: string
  exportedAt?: string
  rowCount?: number
  revision?: number
  rows?: JsonObject[]
}
type DriveSnapshotManifestEntry = { table?: string; file?: string; fileId?: string; lastUpdated?: string; rowCount?: number; sizeBytes?: number; sha256?: string; schemaSha256?: string; revision?: number; imageCount?: number; imageBytes?: number }

type DriveBackupManifest = { format?: string; manifestVersion?: number; site?: { key?: string; schemaVersion?: number; pipelineFormat?: string }; exportedAt?: string; mode?: string; source?: string; snapshots?: DriveSnapshotManifestEntry[] }
type SnapshotCacheEntry = {
  rows: JsonObject[] | null
  snapshotUpdatedAt: number
  revision: number
  fetchedAt: number
  request?: Promise<JsonObject[] | null>
  lastWarningAt?: number
}

const snapshotCache = new Map<string, SnapshotCacheEntry>()
let manifestCache: { value: DriveBackupManifest | null; fetchedAt: number; request?: Promise<DriveBackupManifest | null> } | null = null

function configuredFolder() {
  return Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || process.env.SCARLETLABS_DRIVE_FOLDER_ID?.trim())
}

function boundedMilliseconds(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback
}

function maxSnapshotAgeMs() {
  const hours = boundedMilliseconds(process.env.DRIVE_READ_FALLBACK_MAX_AGE_HOURS, 168, 1, 24 * 90)
  return hours * 60 * 60 * 1000
}

function cacheTtlMs() {
  return boundedMilliseconds(process.env.DRIVE_READ_FALLBACK_CACHE_MS, 180_000, 5_000, 5 * 60_000)
}

async function readManifest(): Promise<DriveBackupManifest | null> {
  const now = Date.now()
  if (manifestCache && now - manifestCache.fetchedAt < 30_000) return manifestCache.value
  if (manifestCache?.request) return manifestCache.request

  const request = readDriveJson<DriveBackupManifest>('backup-manifest.json')
    .then((value) => ['srizony-drive-database-manifest-v1', 'srizony-drive-database-manifest-v2'].includes(value?.format || '') ? value : null)
    .then((value) => {
      manifestCache = { value, fetchedAt: Date.now() }
      return value
    })
    .catch((error) => {
      const previous = manifestCache?.value ?? null
      // Clear the in-flight promise on failure. Keep a previously validated
      // manifest briefly, but allow a later request to retry Drive instead of
      // pinning a rejected/resolved promise forever.
      manifestCache = { value: previous, fetchedAt: Date.now() }
      if (previous) return previous
      throw error
    })

  manifestCache = { value: manifestCache?.value ?? null, fetchedAt: manifestCache?.fetchedAt ?? 0, request }
  return request
}

async function fetchValidatedSnapshot(table: string): Promise<{ rows: JsonObject[]; snapshotUpdatedAt: number; revision: number } | null> {
  const manifest = await readManifest()
  const marker = manifest?.snapshots?.find((item) => item.table === table)
  if (!marker) return null

  const snapshotUpdatedAt = Date.parse(String(marker.lastUpdated || ''))
  const now = Date.now()
  if (!Number.isFinite(snapshotUpdatedAt) || snapshotUpdatedAt > now + 5 * 60_000 || now - snapshotUpdatedAt > maxSnapshotAgeMs()) return null

  const document = await readDriveJsonWithDigest<DriveTableBackup>(`${table}.json`)
  const backup = document?.value
  if (marker.sha256 && document?.sha256 !== marker.sha256.toLowerCase()) return null
  const supportedFormat = backup?.format === 'srizony-postgresql-table-v1' || backup?.format === 'srizony-postgresql-table-v2'
  if (!supportedFormat || backup?.table !== table || !Array.isArray(backup.rows)) return null
  if (backup.format === 'srizony-postgresql-table-v2') {
    if (backup.schemaVersion !== 2 || !backup.siteKey || backup.pipelineFormat !== 'cms-data-pipeline-v1') return null
    const activeSiteKey = (process.env.CMS_SITE_KEY || 'default').trim().slice(0, 120) || 'default'
    if (backup.siteKey !== activeSiteKey) return null
    if (manifest?.site?.key && manifest.site.key !== backup.siteKey) return null
  }
  if (Number.isFinite(backup.rowCount) && backup.rowCount !== backup.rows.length) return null
  if (Number.isFinite(marker.rowCount) && marker.rowCount !== backup.rows.length) return null
  if (Number.isFinite(marker.revision) && Number.isFinite(backup.revision) && marker.revision !== backup.revision) return null
  // Schema metadata is optional for backwards compatibility with older v1 files.
  // New snapshots must carry their own table identity and a SHA-256 schema digest.
  if (backup.schema !== undefined) {
    if (backup.schema.format !== 'srizony-postgresql-table-schema-v1'
      || backup.schema.schemaName !== 'public'
      || backup.schema.tableName !== table
      || !Array.isArray(backup.schema.columns)
      || typeof backup.schemaSha256 !== 'string'
      || !/^[a-f0-9]{64}$/i.test(backup.schemaSha256)) return null
    const actualSchemaSha256 = createHash('sha256').update(JSON.stringify(backup.schema)).digest('hex')
    if (actualSchemaSha256 !== backup.schemaSha256.toLowerCase()) return null
    if (marker.schemaSha256 && marker.schemaSha256.toLowerCase() !== backup.schemaSha256.toLowerCase()) return null
  }

  return { rows: backup.rows, snapshotUpdatedAt, revision: Number(backup.revision ?? marker.revision ?? 0) }
}

/**
 * Read a recent, manifest-verified PostgreSQL table mirror from Drive.
 * A process cache coalesces concurrent reads and retains the last valid copy
 * during short Drive outages. Snapshots are intentionally read-only: they are
 * not a transactional write target and must not acknowledge CMS mutations.
 */
export async function readDriveTableSnapshot(table: string): Promise<JsonObject[] | null> {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(table) || !configuredFolder()) return null

  const now = Date.now()
  const cached = snapshotCache.get(table)
  if (cached && now - cached.fetchedAt < cacheTtlMs()) return cached.rows
  if (cached?.request) return cached.request

  const request = fetchValidatedSnapshot(table)
    .then((snapshot) => {
      const entry: SnapshotCacheEntry = snapshot
        ? { rows: snapshot.rows, snapshotUpdatedAt: snapshot.snapshotUpdatedAt, revision: snapshot.revision, fetchedAt: Date.now() }
        : { rows: null, snapshotUpdatedAt: 0, revision: 0, fetchedAt: Date.now() }
      snapshotCache.set(table, entry)
      return entry.rows
    })
    .catch((error) => {
      const previous = snapshotCache.get(table)
      const previousStillValid = previous?.rows
        && previous.snapshotUpdatedAt > 0
        && Date.now() - previous.snapshotUpdatedAt <= maxSnapshotAgeMs()
      if (previousStillValid) {
        if (!previous.lastWarningAt || Date.now() - previous.lastWarningAt > 60_000) {
          console.warn(`[site-failover] Google Drive refresh failed for ${table}; retaining the last validated snapshot.`, error instanceof Error ? error.message : error)
        }
        snapshotCache.set(table, { ...previous, fetchedAt: Date.now(), request: undefined, lastWarningAt: Date.now() })
        return previous.rows
      }
      console.warn(`[site-failover] Google Drive snapshot unavailable for ${table}:`, error instanceof Error ? error.message : error)
      snapshotCache.set(table, { rows: null, snapshotUpdatedAt: 0, revision: 0, fetchedAt: Date.now() })
      return null
    })

  snapshotCache.set(table, { ...(cached ?? { rows: null, snapshotUpdatedAt: 0, revision: 0, fetchedAt: 0 }), request })
  return request
}

/** Return the validated snapshot with its age/revision metadata for degraded-mode UI. */
export async function readDriveTableSnapshotInfo(table: string): Promise<{
  rows: JsonObject[]
  exportedAt: string
  revision: number
  ageMs: number
} | null> {
  const rows = await readDriveTableSnapshot(table)
  if (!rows) return null
  const entry = snapshotCache.get(table)
  if (!entry || !entry.snapshotUpdatedAt) return null
  return {
    rows,
    exportedAt: new Date(entry.snapshotUpdatedAt).toISOString(),
    revision: entry.revision,
    ageMs: Math.max(0, Date.now() - entry.snapshotUpdatedAt),
  }
}


/**
 * Read only the manifest index. This is intentionally cheaper than fetching
 * every table JSON file and is used by the CMS database-status screen.
 */
export async function readDriveSnapshotManifestInfo(): Promise<{
  exportedAt: string | null
  mode: string | null
  tables: Array<{
    table: string
    rowCount: number | null
    sizeBytes: number | null
    revision: number | null
    updatedAt: string | null
    ageMs: number | null
    available: boolean
    sha256: string | null
    imageCount: number | null
    imageBytes: number | null
  }>
} | null> {
  const manifest = await readManifest()
  if (!manifest || !Array.isArray(manifest.snapshots)) return null
  const now = Date.now()
  const tables = manifest.snapshots.flatMap((entry) => {
    const table = typeof entry.table === 'string' ? entry.table : ''
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(table)) return []
    const updatedMs = Date.parse(String(entry.lastUpdated || ''))
    const hasDate = Number.isFinite(updatedMs) && updatedMs <= now + 5 * 60_000
    const ageMs = hasDate ? Math.max(0, now - updatedMs) : null
    const rowCount = Number(entry.rowCount)
    const sizeBytes = Number(entry.sizeBytes)
    const revision = Number(entry.revision)
    const imageCount = Number(entry.imageCount)
    const imageBytes = Number(entry.imageBytes)
    return [{
      table,
      rowCount: Number.isSafeInteger(rowCount) && rowCount >= 0 ? rowCount : null,
      sizeBytes: Number.isSafeInteger(sizeBytes) && sizeBytes >= 0 ? sizeBytes : null,
      revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : null,
      updatedAt: hasDate ? new Date(updatedMs).toISOString() : null,
      ageMs,
      available: hasDate && ageMs !== null && ageMs <= maxSnapshotAgeMs(),
      sha256: typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(entry.sha256) ? entry.sha256.toLowerCase() : null,
      imageCount: Number.isSafeInteger(imageCount) && imageCount >= 0 ? imageCount : null,
      imageBytes: Number.isSafeInteger(imageBytes) && imageBytes >= 0 ? imageBytes : null,
    }]
  })
  const exportedAt = typeof manifest.exportedAt === 'string' && Number.isFinite(Date.parse(manifest.exportedAt))
    ? new Date(manifest.exportedAt).toISOString()
    : null
  return { exportedAt, mode: typeof manifest.mode === 'string' ? manifest.mode : null, tables }
}

/** Clear cached snapshots after a verified mirror or restore operation. */
export function invalidateDriveTableSnapshotCache(table?: string) {
  if (table) snapshotCache.delete(table)
  else snapshotCache.clear()
  manifestCache = null
}
