#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root)
const explicitLocal = process.argv.includes('--local')
const explicitDrive = process.argv.includes('--drive')
if (explicitLocal && explicitDrive) throw new Error('Choose either --local or --drive, not both.')
const production = process.env.NODE_ENV === 'production'
const useDrive = explicitDrive || (production && !explicitLocal)
if (production && explicitLocal && process.env.ALLOW_LOCAL_PRODUCTION_BACKUP !== 'true') throw new Error('Local production backup blocked. Set ALLOW_LOCAL_PRODUCTION_BACKUP=true explicitly.')
const args = ['scripts/backup-google-drive-json.mjs', useDrive ? '--full' : '--local']
const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' })
child.once('error', (error) => { console.error(error); process.exitCode = 1 })
child.once('close', (code) => { process.exitCode = code ?? 1 })
