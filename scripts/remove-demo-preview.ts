import { eq, sql } from 'drizzle-orm'
import { siteSettings } from '@/lib/db/schema'
import { db } from '@/lib/db'

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo preview cleanup should be reviewed and run manually outside production.')
  if (process.env.ALLOW_DEMO_PREVIEW_SEED !== 'YES_DEMO_ONLY') throw new Error('Set ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY to confirm this is a demo database.')
  if (!db) throw new Error('DATABASE_URL is required.')
  await db.execute(sql`DELETE FROM job_applications WHERE email = 'demo.applicant@example.com' AND cover_letter LIKE 'DEMO ONLY%'`)
  await db.execute(sql`DELETE FROM cms_content_items WHERE component = 'job' AND slug = 'demo-community-field-officer-preview-only' AND title_en LIKE '[DEMO PREVIEW]%'`)
  const backupKey = 'cms-demo-backup:website-essentials.json'
  const backup = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, backupKey)).limit(1)
  if (backup.length) {
    const saved = backup[0].value as { existed?: boolean; value?: unknown }
    if (saved.existed) {
      await db.insert(siteSettings).values({ key: 'cms-document:website-essentials.json', value: saved.value ?? {}, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value: saved.value ?? {}, updatedAt: new Date() } })
    } else {
      await db.delete(siteSettings).where(eq(siteSettings.key, 'cms-document:website-essentials.json'))
    }
    await db.delete(siteSettings).where(eq(siteSettings.key, backupKey))
  }
  console.log('Demo preview job/application records removed and prior Website Essentials settings restored when a backup was created. This does not remove uploaded media or unrelated CMS content.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
