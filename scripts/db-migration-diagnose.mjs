#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Client } from 'pg';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const root = process.cwd();
const databaseUrl = process.env.DATABASE_URL?.trim();
const backupUrl = process.env.BACKUP_DATABASE_URL?.trim();

if (!databaseUrl) throw new Error('DATABASE_URL is missing.');

function safeTarget(value) {
  try {
    const u = new URL(value);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

async function inspect(label, url) {
  if (!url) {
    console.log(`\n${label}: Not configured`);
    return null;
  }

  const client = new Client({ connectionString: url });
  try {
    await client.connect();

    const identity = await client.query(`
      SELECT current_database() AS database_name,
             current_user AS database_user,
             current_schema() AS current_schema,
             to_regclass('drizzle.__drizzle_migrations') AS migration_ledger
    `);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`\n=== ${label}: ${safeTarget(url)} ===`);
    console.table(identity.rows);
    console.log(`Public tables: ${tables.rowCount}`);
    console.log(tables.rows.map(x => x.table_name).join(', ') || '(none)');

    return identity.rows[0];
  } finally {
    await client.end();
  }
}

const mainIdentity = await inspect('DATABASE_URL', databaseUrl);
const backupIdentity = await inspect(
  'BACKUP_DATABASE_URL',
  backupUrl || databaseUrl
);

if (backupUrl && safeTarget(backupUrl) !== safeTarget(databaseUrl)) {
  console.error('\nWARNING: Backup and migration URLs point to different targets.');
}

const journal = JSON.parse(
  await readFile(path.join(root, 'drizzle/meta/_journal.json'), 'utf8')
);

const client = new Client({
  connectionString: databaseUrl,
  application_name: 'sf-migration-diagnostic'
});

let inTransaction = false;
let failed = false;
let safetyStop = false;

function splitStatements(sql) {
  return sql
    .split(/^\s*-->\s*statement-breakpoint\s*$/gim)
    .map(s => s.trim())
    .filter(Boolean);
}

try {
  await client.connect();

  const ledger = await client.query(`
    SELECT to_regclass('drizzle.__drizzle_migrations') AS ledger
  `);

  let latest = 0;
  if (ledger.rows[0]?.ledger) {
    const result = await client.query(`
      SELECT COALESCE(MAX(created_at), 0)::bigint AS latest
      FROM drizzle.__drizzle_migrations
    `);
    latest = Number(result.rows[0].latest || 0);
  }

  const pending = journal.entries.filter(
    item => Number(item.when) > latest
  );

  console.log('\n=== MIGRATION DIAGNOSTIC ===');
  console.log('Database:', mainIdentity?.database_name);
  console.log('Latest recorded migration timestamp:', latest);
  console.log('Pending migrations:', pending.length);

  await client.query('BEGIN');
  inTransaction = true;

  for (const entry of pending) {
    const file = path.join(root, 'drizzle', `${entry.tag}.sql`);
    const sql = await readFile(file, 'utf8');

    if (
      /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(sql) ||
      /CREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY/i.test(sql)
    ) {
      console.log(`\nSAFETY STOP: ${entry.tag}`);
      console.log('This migration contains transaction control or a non-transactional index operation.');
      safetyStop = true;
      break;
    }

    const statements = splitStatements(sql);

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
      } catch (error) {
        failed = true;
        console.error(`\nFAILED MIGRATION: ${entry.tag}`);
        console.error(`SQL chunk: ${i + 1}/${statements.length}`);
        console.error('PostgreSQL code:', error.code || '(none)');
        console.error('Message:', error.message);
        console.error('Detail:', error.detail || '(none)');
        console.error('Hint:', error.hint || '(none)');
        console.error('\nFailing SQL:\n', statements[i].slice(0, 10000));
        break;
      }
    }

    if (failed) break;
    console.log(`PASS ${entry.tag}`);
  }
} finally {
  if (inTransaction) {
    try {
      await client.query('ROLLBACK');
      console.log('\nDiagnostic transaction rolled back. No migration changes were saved.');
    } catch (error) {
      console.error('CRITICAL: Rollback failed:', error.message);
      process.exitCode = 3;
    }
  }

  await client.end();
}

if (failed) process.exitCode = 2;
else if (safetyStop) process.exitCode = 4;
else if (!process.exitCode) {
  console.log('\nAll checked pending migration SQL passed.');
}
