import type { ExternalValue, JsonValue } from '@/types/json'
import 'server-only'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { readCmsSettingValue } from '@/lib/cms/settings-store'

/** JSON-shaped CMS documents live in Neon and have a read-only Google Drive snapshot fallback. */
function validateDocumentName(name: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(name)) throw new Error('Document names must be safe .json filenames.')
  return name
}

export async function readCmsDocument<T = JsonValue>(name: string): Promise<T | null> {
  name = validateDocumentName(name)
  const key = `cms-document:${name}`
  return readCmsSettingValue<T>(key)
}

export async function writeCmsDocument(name: string, value: ExternalValue): Promise<void> {
  name = validateDocumentName(name)
  if (!db) throw new Error('Neon is not configured. Set DATABASE_URL.')
  const key = `cms-document:${name}`
  await db.insert(siteSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({
    target: siteSettings.key,
    set: { value, updatedAt: new Date() },
  })
}
