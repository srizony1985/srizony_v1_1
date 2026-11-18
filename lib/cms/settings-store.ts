import type { JsonValue } from '@/types/json'
import 'server-only'
import { eq } from 'drizzle-orm'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'

export type CmsSettingReadResult<T> = {
  value: T | null
  source: 'neon' | 'google-drive-snapshot'
  snapshotAt: string | null
  snapshotAgeMs: number | null
}

/**
 * Read one CMS setting from Neon, falling back to the latest validated Drive
 * snapshot only when Neon is unavailable. A successful Neon read with no row is authoritative
 * and never falls back to stale Drive data. writes must commit to Neon; a JSON snapshot is
 * never a write target.
 */
export async function readCmsSettingValueInfo<T = JsonValue>(key: string): Promise<CmsSettingReadResult<T>> {
  if (!key.trim() || key.length > 240) throw new Error('Invalid CMS setting key.')

  let databaseError: Error | null = null
  const database = db
  if (database) {
    try {
      const rows = await withDbRetry(() => database.select({ value: siteSettings.value })
        .from(siteSettings)
        .where(eq(siteSettings.key, key))
        .limit(1))
      return { value: (rows[0]?.value as T | undefined) ?? null, source: 'neon', snapshotAt: null, snapshotAgeMs: null }
    } catch (error) {
      if (!isTransientDatabaseError(error)) throw error
      databaseError = error instanceof Error ? error : new Error('Neon database request failed.')
      console.warn(`[site-failover] Neon is unavailable while reading ${key}; trying the validated Google Drive snapshot.`, databaseError.message)
    }
  }

  const snapshot = await readDriveTableSnapshotInfo('site_settings')
  const saved = snapshot?.rows.find((row) => row.key === key)
  if (snapshot && saved && Object.prototype.hasOwnProperty.call(saved, 'value')) {
    return {
      value: saved.value as T,
      source: 'google-drive-snapshot',
      snapshotAt: snapshot.exportedAt,
      snapshotAgeMs: snapshot.ageMs,
    }
  }

  if (databaseError) throw databaseError
  if (!database) throw new Error(`Neon is not configured and no recent Google Drive snapshot contains ${key}.`)
  return { value: null, source: 'neon', snapshotAt: null, snapshotAgeMs: null }
}

/** Convenience wrapper for readers that only need the stored value. */
export async function readCmsSettingValue<T = JsonValue>(key: string): Promise<T | null> {
  return (await readCmsSettingValueInfo<T>(key)).value
}
