import './load-env'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'

async function main() {
  if (!db) throw new Error('DATABASE_URL is not configured. Set it before resetting CMS content.')
  const confirm = process.env.CONFIRM_CONTENT_DETAILS_RESET
  if (confirm !== 'YES') {
    throw new Error('Reset refused. Re-run with CONFIRM_CONTENT_DETAILS_RESET=YES after backing up the database.')
  }
  await ensureCmsSchema()
  const deleted = await db.execute(sql`
    DELETE FROM cms_content_items
    WHERE component IN ('project','news','enterprise','notice','partner-agency','health-service','loan-product','product')
    RETURNING id
  `)
  console.log(`Removed ${deleted.rows.length} public catalogue records. Admin/authentication data was not touched.`)
  console.log('Next run: npm run db:seed')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
