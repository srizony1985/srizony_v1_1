import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

let donationsSchemaReady: Promise<void> | null = null

/**
 * Validate the migrated donation schema without creating or altering tables.
 * Schema changes belong exclusively to the ordered Drizzle migrations; runtime
 * API requests must never become a second, competing schema-management path.
 */
export function ensureDonationsSchema(): Promise<void> {
  if (!db) return Promise.reject(new Error('Database is not configured.'))
  const database = db
  donationsSchemaReady ??= (async () => {
    const result = await database.execute(sql`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('donations', 'donation_receipt_jobs')
    `)

    const columns = new Map<string, Set<string>>()
    for (const row of result.rows as Array<{ table_name: string; column_name: string }>) {
      const table = String(row.table_name)
      const values = columns.get(table) ?? new Set<string>()
      values.add(String(row.column_name))
      columns.set(table, values)
    }

    const required: Record<string, string[]> = {
      donations: [
        'id', 'site_id', 'transaction_id', 'amount', 'status', 'donor',
        'receipt_sent_at', 'idempotency_key', 'idempotency_fingerprint',
        'gateway_page_url', 'gateway_risk_level', 'gateway_risk_title', 'created_at',
      ],
      donation_receipt_jobs: [
        'id', 'donation_id', 'recipient_email', 'attempts', 'next_attempt_at',
        'locked_until', 'sent_at', 'last_error', 'created_at', 'updated_at',
      ],
    }
    const missing = Object.entries(required).flatMap(([table, names]) =>
      names.filter((name) => !columns.get(table)?.has(name)).map((name) => `${table}.${name}`),
    )

    if (missing.length) {
      throw new Error(
        `Donation database schema is incomplete (${missing.join(', ')}). ` +
        'Create and verify a backup, then review the guarded migration warning. If the migration ledger is empty, explicitly opt in with npm run db:init -- --allow-existing-schema.',
      )
    }
  })().catch((error) => {
    donationsSchemaReady = null
    throw error
  })

  return donationsSchemaReady
}
