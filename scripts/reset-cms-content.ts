import './load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/** Destructive for public CMS content only. Authentication/admin accounts are deliberately untouched. */
async function main() {
  if (!db) throw new Error('DATABASE_URL is not configured. Set DATABASE_URL before running this command.')
  if (process.env.CONFIRM_CMS_RESET !== 'YES') throw new Error('Refusing to delete CMS content. Re-run with CONFIRM_CMS_RESET=YES after taking a database backup.')
  // Keep job posts intact because job_applications reference them with ON DELETE CASCADE.
  // The canonical dataset seeder will refresh all non-job catalogue types after this reset.
  await db.execute(sql`DELETE FROM cms_content_items WHERE component <> 'job'`)
  await db.execute(sql`TRUNCATE TABLE pages, site_global_state, hero_data, hero_slides, hero_stats, nav_items, nav_groups, themes, ui_content, contact_info, contact_phones, contact_socials, contact_footprint, sdg_steps, payment_info, content_entry_video, content_entry_gallery, content_entry_related, content_entry_tags, content_entry_bodies, content_entries RESTART IDENTITY CASCADE`)
  console.log('CMS page/global/navigation/theme and non-job catalogue content cleared. Job posts and job applications were preserved; admin accounts/authentication tables were not targeted. Run npm run db:seed to repopulate defaults, or npm run db:rebuild-cms for the full confirmed reset-and-reseed workflow.')
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
