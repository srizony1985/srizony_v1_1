import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { siteSettings } from '@/lib/db/schema'

/** JSON-shaped CMS documents still persist in PostgreSQL, never in an external file provider. */
function validateDocumentName(name: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}\.json$/.test(name)) throw new Error('Document names must be safe .json filenames.')
  return name
}

export async function readCmsDocument<T = unknown>(name: string): Promise<T | null> {
  name = validateDocumentName(name)
  if (!db) throw new Error('Neon is not configured. Set DATABASE_URL.')
  const key = `cms-document:${name}`
  const result = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key)).limit(1)
  return (result[0]?.value as T | undefined) ?? null
}

export async function writeCmsDocument(name: string, value: unknown): Promise<void> {
  name = validateDocumentName(name)
  if (!db) throw new Error('Neon is not configured. Set DATABASE_URL.')
  const key = `cms-document:${name}`
  await db.insert(siteSettings).values({ key, value, updatedAt: new Date() }).onConflictDoUpdate({
    target: siteSettings.key,
    set: { value, updatedAt: new Date() },
  })
}
