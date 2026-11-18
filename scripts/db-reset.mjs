#!/usr/bin/env node
/** Destructively recreate public data and clear only Drizzle's migration ledger, then initialize from migrations. */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Pool } from '@neondatabase/serverless'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root)
if (!process.argv.includes('--confirm-reset')) throw new Error('Destructive reset blocked. Re-run with --confirm-reset to DROP and recreate the public schema.')
const url = (process.env.DATABASE_URL || '').trim()
if (!url) throw new Error('DATABASE_URL is required.')
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_DB_RESET !== 'true') throw new Error('Production reset blocked. Set ALLOW_PRODUCTION_DB_RESET=true explicitly to proceed.')
const pool = new Pool({ connectionString: url, max: 1 })
try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DROP SCHEMA IF EXISTS public CASCADE')
    await client.query('CREATE SCHEMA public')
    await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER')
    // The Drizzle ledger lives outside public (drizzle.__drizzle_migrations).
    // Clear it too, or db:init would incorrectly consider the empty schema current.
    await client.query('DROP TABLE IF EXISTS drizzle.__drizzle_migrations')
    await client.query('COMMIT')
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
} finally { await pool.end() }
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: 'inherit' })
    child.once('error', reject); child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} failed with exit code ${code}`)))
  })
}
await run('npm', ['run', 'db:init'])
console.log('Database reset and schema initialization completed. Database content is empty.')
