#!/usr/bin/env node
import { createRequire } from 'node:module'
import { Client } from 'pg'
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to remove demo content in production.')
  if (process.env.ALLOW_UI_DEMO_SEED !== 'YES_DEMO_ONLY') throw new Error('Set ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY to confirm this is a demo database.')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.')
  const siteKey = (process.env.CMS_SITE_KEY || 'default').trim()
  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: 'srizony-ui-demo-remove' })
  try {
    await client.connect()
    await client.query('BEGIN')
    const site = await client.query('SELECT id FROM public.cms_sites WHERE site_key = $1 LIMIT 1', [siteKey])
    if (!site.rows[0]) throw new Error(`CMS site "${siteKey}" does not exist.`)
    const result = await client.query(`
      DELETE FROM public.cms_content_items
      WHERE site_id = $1
        AND slug LIKE 'demo-ui-%'
        AND title_en LIKE 'DEMO PREVIEW — %'
      RETURNING id
    `, [Number(site.rows[0].id)])
    await client.query('COMMIT')
    console.log(`Removed ${result.rowCount || 0} UI demo content record(s) from site "${siteKey}".`)
    console.log('Empty collection sections are retained. Remove them in Page Builder only when you no longer need those sections.')
  } catch (error) {
    try { await client.query('ROLLBACK') } catch {}
    throw error
  } finally { await client.end().catch(() => {}) }
}
main().catch((error) => { console.error('UI demo cleanup failed:', error instanceof Error ? error.message : error); process.exitCode = 1 })
