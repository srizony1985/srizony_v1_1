#!/usr/bin/env node
/** Initialize an empty database from the committed Drizzle migrations. */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createRequire } from 'node:module'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root)
if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required.')
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: 'inherit' })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`)))
  })
}
await run('npm', ['run', 'db:migrate', ...(process.argv.slice(2).length ? ['--', ...process.argv.slice(2)] : [])])
console.log('Database schema initialized from committed migrations. No content rows were seeded or overwritten.')
