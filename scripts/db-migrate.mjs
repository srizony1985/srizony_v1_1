#!/usr/bin/env node
/** Guarded Drizzle migration runner for empty and previously provisioned databases. */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root)

const databaseUrl = String(process.env.DATABASE_URL || '').trim()
if (!databaseUrl) throw new Error('DATABASE_URL is required.')
const allowExisting = process.argv.includes('--allow-existing-schema')
const client = new Client({ connectionString: databaseUrl })
let connected = false

try {
  await client.connect()
  connected = true
  const identity = await client.query(`
    SELECT current_database() AS database_name,
           current_user AS database_user,
           current_schema() AS current_schema
  `)
  const ledgerCheck = await client.query(`
    SELECT to_regclass('drizzle.__drizzle_migrations') AS ledger
  `)
  let appliedCount = 0
  if (ledgerCheck.rows[0]?.ledger) {
    const result = await client.query('SELECT COUNT(*)::int AS count FROM drizzle.__drizzle_migrations')
    appliedCount = Number(result.rows[0]?.count || 0)
  }
  const tablesResult = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const existingTables = tablesResult.rows.map((row) => String(row.table_name))

  if (appliedCount === 0 && existingTables.length > 0) {
    if (!allowExisting) {
      const preview = existingTables.slice(0, 24).join(', ')
      throw new Error(
        `This database (${identity.rows[0].database_name}) has ${existingTables.length} existing public tables ` +
        `but zero recorded Drizzle migrations. Refusing to replay migrations without an explicit opt-in. ` +
        `Back it up first, inspect the tables, then run: npm run db:init -- --allow-existing-schema. ` +
        `Existing tables: ${preview}${existingTables.length > 24 ? ', …' : ''}`,
      )
    }

    const donationColumns = await client.query(`
      SELECT table_name, column_name, data_type, character_maximum_length,
             numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('donations', 'donation_receipt_jobs')
    `)
    const byTable = new Map()
    for (const row of donationColumns.rows) {
      const values = byTable.get(row.table_name) || new Map()
      values.set(row.column_name, row)
      byTable.set(row.table_name, values)
    }
    const requiredDonationColumns = [
      ['id', (c) => c.data_type === 'integer' && c.is_nullable === 'NO'],
      ['transaction_id', (c) => c.data_type === 'character varying' && Number(c.character_maximum_length) === 64 && c.is_nullable === 'NO'],
      ['amount', (c) => c.data_type === 'numeric' && Number(c.numeric_precision) === 12 && Number(c.numeric_scale) === 2 && c.is_nullable === 'NO'],
      ['status', (c) => c.data_type === 'character varying' && Number(c.character_maximum_length) === 24 && c.is_nullable === 'NO'],
      ['donor', (c) => c.data_type === 'jsonb'],
      ['created_at', (c) => c.data_type === 'timestamp with time zone' && c.is_nullable === 'NO'],
    ]
    const requiredReceiptColumns = [
      ['id', (c) => c.data_type === 'bigint' && c.is_nullable === 'NO'],
      ['donation_id', (c) => c.data_type === 'integer' && c.is_nullable === 'NO'],
      ['recipient_email', (c) => c.data_type === 'character varying' && Number(c.character_maximum_length) === 254 && c.is_nullable === 'NO'],
      ['attempts', (c) => c.data_type === 'integer' && c.is_nullable === 'NO'],
      ['next_attempt_at', (c) => c.data_type === 'timestamp with time zone' && c.is_nullable === 'NO'],
      ['locked_until', (c) => c.data_type === 'timestamp with time zone'],
      ['sent_at', (c) => c.data_type === 'timestamp with time zone'],
      ['last_error', (c) => c.data_type === 'text'],
      ['created_at', (c) => c.data_type === 'timestamp with time zone' && c.is_nullable === 'NO'],
      ['updated_at', (c) => c.data_type === 'timestamp with time zone' && c.is_nullable === 'NO'],
    ]
    const donations = byTable.get('donations')
    const receiptJobs = byTable.get('donation_receipt_jobs')
    const incompatibleDonationColumns = donations
      ? requiredDonationColumns.filter(([name, validate]) => !donations.has(name) || !validate(donations.get(name))).map(([name]) => name)
      : []
    const incompatibleReceiptColumns = receiptJobs
      ? requiredReceiptColumns.filter(([name, validate]) => !receiptJobs.has(name) || !validate(receiptJobs.get(name))).map(([name]) => name)
      : []
    if (donations && incompatibleDonationColumns.length) {
      throw new Error(`Existing donations table is incompatible (${incompatibleDonationColumns.join(', ')}). No migrations were run.`)
    }
    if (receiptJobs && incompatibleReceiptColumns.length) {
      throw new Error(`Existing donation_receipt_jobs table is incompatible (${incompatibleReceiptColumns.join(', ')}). No migrations were run.`)
    }
    if (receiptJobs && !donations) {
      throw new Error('donation_receipt_jobs exists without donations. Resolve this foreign-key dependency before migration.')
    }
    if (receiptJobs && donations) {
      const fk = await client.query(`
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.donation_receipt_jobs'::regclass
          AND confrelid = 'public.donations'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (donation_id) REFERENCES donations(id)%'
        LIMIT 1
      `)
      if (!fk.rowCount) {
        throw new Error('Existing donation_receipt_jobs table has no valid donation_id foreign key to donations(id). No migrations were run.')
      }
      const uniqueDonation = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_index i
          JOIN pg_attribute a
            ON a.attrelid = i.indrelid
           AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = 'public.donation_receipt_jobs'::regclass
            AND i.indisunique
            AND i.indisvalid
            AND i.indnatts = 1
            AND a.attname = 'donation_id'
        ) AS exists
      `)
      if (!uniqueDonation.rows[0]?.exists) {
        throw new Error('Existing donation_receipt_jobs.donation_id is not unique. No migrations were run; resolve duplicate receipt jobs before migration.')
      }
    }

    console.warn('\nExisting-schema migration mode enabled.')
    console.warn(`Database: ${identity.rows[0].database_name}; user: ${identity.rows[0].database_user}`)
    console.warn(`Preserving ${existingTables.length} existing public tables. No reset or table drop will be performed by this runner.`)
    console.warn('The SQL migrations may still apply reviewed additive changes and data transformations.\n')
  }
} finally {
  if (connected) await client.end()
}

const forwarded = process.argv.slice(2).filter((arg) => arg !== '--allow-existing-schema')
const child = spawn('npm', ['run', 'db:migrate:drizzle', ...(forwarded.length ? ['--', ...forwarded] : [])], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})
child.once('error', (error) => {
  console.error('Unable to start Drizzle migration runner:', error)
  process.exitCode = 1
})
child.once('close', (code) => {
  process.exitCode = code ?? 1
})
