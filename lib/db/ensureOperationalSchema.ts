import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

/**
 * Non-destructive guard for deployments where the base migration was only
 * partially applied. It creates/repairs the donations table shape required by
 * the donation UI and admin reports. Full migrations are still recommended.
 */
export async function ensureDonationsSchema() {
  if (!db) throw new Error('Database is not configured.')
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(64) NOT NULL UNIQUE,
      amount NUMERIC(12,2) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      donor JSONB,
      receipt_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS donor JSONB`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'pending'`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) NOT NULL DEFAULT 0`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(64)`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64)`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS idempotency_fingerprint VARCHAR(64)`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS gateway_page_url TEXT`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS gateway_risk_level SMALLINT`)
  await db.execute(sql`ALTER TABLE donations ADD COLUMN IF NOT EXISTS gateway_risk_title VARCHAR(50)`)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS donations_idempotency_key_uq ON donations(idempotency_key)`)
  await db.execute(sql`CREATE TABLE IF NOT EXISTS donation_receipt_jobs (
    id BIGSERIAL PRIMARY KEY, donation_id INTEGER NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
    recipient_email VARCHAR(254) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(), locked_until TIMESTAMPTZ,
    sent_at TIMESTAMPTZ, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS donation_receipt_jobs_due_idx ON donation_receipt_jobs(next_attempt_at) WHERE sent_at IS NULL`)
  await db.execute(sql`UPDATE donations SET status = 'pending' WHERE status IS NULL`)
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS donations_transaction_id_unique_idx ON donations(transaction_id)`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS donations_created_idx ON donations(created_at DESC)`)
}
