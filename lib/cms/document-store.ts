import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'
import { getSelectedDataProvider } from '@/lib/data-provider'
import { readDriveJson, writeDriveJson } from '@/lib/google/drive'

/**
 * Provider-neutral storage for JSON-shaped CMS documents.
 * Existing relational repositories intentionally continue using Drizzle/Neon.
 * Use this adapter for new document-shaped content and migrate domains explicitly.
 */
function validateDocumentName(name: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(name)) throw new Error('Document names must be safe .json filenames.')
  return name
}

export async function readCmsDocument<T = unknown>(name: string): Promise<T | null> {
  name = validateDocumentName(name)
  const provider = await getSelectedDataProvider()
  if (provider === 'google-drive') return readDriveJson<T>(name)
  if (!db) throw new Error('Neon is not configured. Set DATABASE_URL.')
  const key = `cms-document:${name}`
  const result = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1)
  return (result[0]?.value as T | undefined) ?? null
}

export async function writeCmsDocument(name: string, value: unknown): Promise<void> {
  name = validateDocumentName(name)
  const provider = await getSelectedDataProvider()
  if (provider === 'google-drive') {
    await writeDriveJson(name, value)
    return
  }
  if (!db) throw new Error('Neon is not configured. Set DATABASE_URL.')
  const key = `cms-document:${name}`
  await db.insert(siteSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({
    target: siteSettings.key,
    set: { value, updatedAt: new Date() },
  })
}
