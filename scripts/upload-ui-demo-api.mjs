#!/usr/bin/env node
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())

const datasetPath = path.join(process.cwd(), 'data', 'ui-demo-content.v1.json')
const baseUrl = (process.env.CMS_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

async function parseResponse(response) {
  const body = await response.text()
  let value
  try { value = JSON.parse(body) } catch { value = { error: body.slice(0, 1000) } }
  return value
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to upload UI demo content while NODE_ENV=production.')
  if (process.env.ALLOW_UI_DEMO_SEED !== 'YES_DEMO_ONLY') throw new Error('Set ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY to confirm this is a local or staging preview.')
  const url = new URL(baseUrl)
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) && process.env.ALLOW_REMOTE_DEMO_API !== 'YES_REMOTE_DEMO') {
    throw new Error('Remote API uploads are disabled by default. For a staging site only, set ALLOW_REMOTE_DEMO_API=YES_REMOTE_DEMO and verify the API URL.')
  }
  let email = process.env.CMS_ADMIN_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim()
  let password = process.env.CMS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
  if ((!email || !password) && process.env.CMS_ADMIN_USERS_JSON?.trim()) {
    let configured
    try { configured = JSON.parse(process.env.CMS_ADMIN_USERS_JSON) } catch { throw new Error('CMS_ADMIN_USERS_JSON is not valid JSON.') }
    const user = Array.isArray(configured) ? configured.find((candidate) => candidate && ['admin', 'editor'].includes(candidate.role || 'admin')) : null
    if (user) { email ||= String(user.email || '').trim(); password ||= String(user.password || '') }
  }
  if (!email || !password) throw new Error('Configure CMS_ADMIN_EMAIL/CMS_ADMIN_PASSWORD or an admin/editor entry in CMS_ADMIN_USERS_JSON.')

  const dataset = JSON.parse(await readFile(datasetPath, 'utf8'))
  if (dataset.format !== 'srizony-cms-ui-demo-content' || dataset.version !== 1 || !Array.isArray(dataset.items)) throw new Error('Unsupported UI demo dataset.')

  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const loginData = await parseResponse(login)
  if (!login.ok) throw new Error(`CMS login failed (${login.status}): ${loginData.error || 'Check the configured admin credentials.'}`)
  const setCookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [login.headers.get('set-cookie') || '']
  const session = setCookies.map((value) => value.split(';')[0]).find((value) => value.startsWith('sf-cms-session='))
  if (!session) throw new Error('CMS login succeeded but did not return the expected sf-cms-session cookie.')

  const listResponse = await fetch(`${baseUrl}/api/admin/site-content?component=all`, { headers: { cookie: session, accept: 'application/json' }, cache: 'no-store' })
  const listData = await parseResponse(listResponse)
  if (!listResponse.ok || !Array.isArray(listData.items)) throw new Error(`Unable to inspect existing CMS content (${listResponse.status}).`)
  const existing = new Map(listData.items.map((item) => [`${item.component}::${item.slug}`, item]))

  const conflicts = []
  const toCreate = []
  for (const item of dataset.items) {
    const found = existing.get(`${item.component}::${item.slug}`)
    if (!found) toCreate.push(item)
    else if (String(found.values?.title_en || '').startsWith('DEMO PREVIEW —')) continue
    else conflicts.push(`${item.component}/${item.slug}`)
  }
  if (conflicts.length) throw new Error(`Refusing to overwrite existing non-demo CMS content. Conflicts: ${conflicts.join(', ')}`)

  let inserted = 0
  const skipped = dataset.items.length - toCreate.length
  const failures = []
  for (const item of toCreate) {
    const response = await fetch(`${baseUrl}/api/admin/site-content`, {
      method: 'POST',
      headers: { cookie: session, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(item),
    })
    const data = await parseResponse(response)
    if (!response.ok || data.ok !== true) {
      failures.push(`${item.component}/${item.slug}: ${data.error || `HTTP ${response.status}`}`)
      console.error(`FAILED ${item.slug}: ${data.error || response.status}`)
      continue
    }
    inserted++
    console.log(`Imported ${item.component}: ${item.slug}`)
  }
  console.log(`\nAPI demo upload completed. Inserted: ${inserted}; already present and skipped: ${skipped}; total: ${dataset.items.length}.`)
  if (failures.length) {
    console.error(`\n${failures.length} record(s) failed. Re-run after fixing the errors; existing demo records will be skipped.`)
    process.exitCode = 1
  } else {
    console.log('The CMS content API created each record and attached its content type to the matching collection page. All records are fictional preview content.')
  }
}
main().catch((error) => { console.error('UI demo API upload failed:', error instanceof Error ? error.message : error); process.exitCode = 1 })
