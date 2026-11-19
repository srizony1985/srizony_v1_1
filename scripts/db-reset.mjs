#!/usr/bin/env node
/**
 * Guarded full application-data reset for a dedicated Srizony test database.
 * This drops/recreates the public application schema and Drizzle migration schema,
 * then optionally re-applies migrations + canonical seed. Unexpected user schemas
 * block the reset so a multi-schema database is never partially wiped by accident.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Client } from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root)

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
if (has('--restore-local') && !has('--seed')) {
  throw new Error('--restore-local requires --seed so the migrated database and CMS site identity exist before the curated recovery pack is imported.')
}
const valueAfter = (flag) => {
  const index = args.indexOf(flag)
  if (index >= 0) return args[index + 1] || ''
  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  return inline ? inline.slice(flag.length + 1) : ''
}

const url = String(process.env.DATABASE_URL || '').trim()
if (!url) throw new Error('DATABASE_URL is required.')

let parsedUrl
try {
  parsedUrl = new URL(url)
} catch {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.')
}
if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
  throw new Error('DATABASE_URL must use postgres:// or postgresql://.')
}

const client = new Client({ connectionString: url, application_name: 'srizony-guarded-database-reset' })
let connected = false
let databaseName = ''
let databaseUser = ''
let currentSchema = ''
let extraSchemaObjects = []

try {
  await client.connect()
  connected = true
  const identity = await client.query(`
    SELECT current_database() AS database_name,
           current_user AS database_user,
           current_schema() AS current_schema
  `)
  databaseName = String(identity.rows[0]?.database_name || '')
  databaseUser = String(identity.rows[0]?.database_user || '')
  currentSchema = String(identity.rows[0]?.current_schema || '')
  // The reset owns only public + Drizzle. Fail closed if application-like
  // relations were created in another schema rather than silently leaving them.
  const extraRelations = await client.query(`
    SELECT n.nspname AS schemaname,
           c.relname AS objectname,
           CASE c.relkind
             WHEN 'r' THEN 'table'
             WHEN 'p' THEN 'partitioned table'
             WHEN 'v' THEN 'view'
             WHEN 'm' THEN 'materialized view'
             WHEN 'S' THEN 'sequence'
             WHEN 'f' THEN 'foreign table'
             ELSE c.relkind::text
           END AS object_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('public', 'drizzle', 'pg_catalog', 'information_schema')
      AND left(n.nspname, 3) <> 'pg_'
      AND NOT (
        n.nspname = 'neon_auth'
        AND c.relname IN ('account', 'invitation', 'jwks', 'member', 'organization', 'project_config', 'session', 'user', 'verification')
      )
      AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
    ORDER BY n.nspname, c.relname
  `)
  extraSchemaObjects = extraRelations.rows.map((row) => `${row.schemaname}.${row.objectname} (${row.object_type})`)
} catch (error) {
  if (connected) await client.end()
  throw error
}

if (currentSchema && currentSchema !== 'public') {
  await client.end()
  throw new Error(`Reset blocked: the connection current schema is ${currentSchema}, not public. Use the intended test database connection with public as its current schema.`)
}

const targetToken = `${databaseName}@${parsedUrl.hostname}`
console.log('\nSrizony database target')
console.log(`  Database : ${databaseName}`)
console.log(`  User     : ${databaseUser}`)
console.log(`  Schema   : ${currentSchema}`)
console.log(`  Host     : ${parsedUrl.hostname}`)
console.log(`  Confirm  : ${targetToken}`)
console.log(`  Relations outside reset scope: ${extraSchemaObjects.length ? extraSchemaObjects.join(', ') : 'none detected'}`)

if (has('--print-target')) {
  await client.end()
  process.exit(0)
}

if (extraSchemaObjects.length) {
  await client.end()
  throw new Error(`Reset blocked: relations exist outside public/drizzle (${extraSchemaObjects.join(', ')}). Review and back up those schemas separately; this script deliberately will not drop them.`)
}

if (!has('--confirm-reset')) {
  await client.end()
  throw new Error('Destructive reset blocked. Inspect the target, then pass --confirm-reset and --confirm-target "DATABASE@HOST".')
}

const confirmedTarget = valueAfter('--confirm-target')
if (!confirmedTarget || confirmedTarget !== targetToken) {
  await client.end()
  throw new Error(`Target confirmation mismatch. Re-run with --confirm-target "${targetToken}" after verifying this is the intended disposable test database.`)
}

const productionMode = process.env.NODE_ENV === 'production'
if (productionMode && (process.env.ALLOW_PRODUCTION_DB_RESET !== 'true' || process.env.DISPOSABLE_TEST_DATABASE !== 'true')) {
  await client.end()
  throw new Error('Production-mode reset blocked. For a disposable production-test database branch only, set both ALLOW_PRODUCTION_DB_RESET=true and DISPOSABLE_TEST_DATABASE=true after taking a verified backup.')
}
if (has('--restore-local') && productionMode && process.env.ALLOW_PRODUCTION_JSON_RESTORE !== 'true') {
  await client.end()
  throw new Error('Local recovery-pack restore blocked in production mode. Set ALLOW_PRODUCTION_JSON_RESTORE=true only after verifying the curated snapshot and taking a separate backup.')
}
console.warn('\nDANGER: This operation deletes EVERY table and row in the public application schema, plus the Drizzle migration ledger.')
console.warn('This includes page content, users/admins, accounts, CMS records, uploads metadata, forms, applications, audit records and all other application tables.')
console.warn('Neon/system schemas, database roles and object-storage buckets are not dropped by this script. Uploaded files in object storage remain untouched.')
if (productionMode) console.warn('PRODUCTION MODE: disposable-test database confirmation flags were explicitly supplied.')

try {
  await client.query('BEGIN')
  await client.query('DROP SCHEMA IF EXISTS public CASCADE')
  await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER')
  await client.query('GRANT ALL PRIVILEGES ON SCHEMA public TO CURRENT_USER')
  // Drizzle stores its migration ledger in a separate schema. The migration runner
  // recreates this schema and ledger when it applies the committed migrations.
  await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE')
  await client.query('COMMIT')
} catch (error) {
  try { await client.query('ROLLBACK') } catch { /* retain original failure */ }
  throw error
} finally {
  await client.end()
}

function run(command, commandArgs, envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: { ...process.env, ...envOverrides },
      stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed with exit code ${code}`)))
  })
}

await run('npm', ['run', 'db:init'])
if (has('--seed')) {
  await run('npm', ['run', 'db:seed'])
  if (has('--restore-local')) {
    // These maintenance commands prefer BACKUP_DATABASE_URL when set. Force them
    // onto the exact DATABASE_URL target that was just reset, never the source backup.
    await run('npm', ['run', 'db:restore:local', '--', '--replace-existing'], { BACKUP_DATABASE_URL: '' })
    await run('npm', ['run', 'db:seed:registry'], { BACKUP_DATABASE_URL: '' })
    console.log('\nFull public-schema reset, migrations, canonical seed and curated local recovery-pack restore completed.')
  } else {
    console.log('\nFull public-schema reset, migrations and canonical Srizony seed completed.')
  }
} else {
  console.log('\nFull public-schema reset and migrations completed. Database content is empty; run npm run db:seed to load the canonical dataset.')
}
