import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { CMS_DDL } from './ddl'

let ready: Promise<void> | null = null

/** Applies idempotent CMS runtime schema repair once per server instance. Index failures are logged, not fatal. */
export function ensureCmsSchema() {
  if (!db) return Promise.reject(new Error('Database is not configured.'))
  const database = db
  ready ??= (async () => {
    for (const statement of CMS_DDL) {
      try { await database.execute(sql.raw(statement)) }
      catch (error) {
        if (/^CREATE (UNIQUE )?INDEX/i.test(statement)) console.warn('CMS index skipped:', statement.slice(0, 80), error instanceof Error ? error.message : error)
        else throw error
      }
    }
  })().catch((error) => { ready = null; throw error })
  return ready
}
