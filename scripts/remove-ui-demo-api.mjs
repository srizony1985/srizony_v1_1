#!/usr/bin/env node
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(process.cwd())
const baseUrl = (process.env.CMS_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
async function parse(response) { const text = await response.text(); try { return JSON.parse(text) } catch { return { error: text.slice(0, 500) } } }
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to remove UI demo content while NODE_ENV=production.')
  if (process.env.ALLOW_UI_DEMO_SEED !== 'YES_DEMO_ONLY') throw new Error('Set ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY to confirm this is a demo site.')
  const url = new URL(baseUrl)
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) && process.env.ALLOW_REMOTE_DEMO_API !== 'YES_REMOTE_DEMO') throw new Error('Remote API cleanup is disabled by default.')
  const email = process.env.CMS_ADMIN_EMAIL?.trim(), password = process.env.CMS_ADMIN_PASSWORD
  if (!email || !password) throw new Error('CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD are required.')
  const login = await fetch(`${baseUrl}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const loginData = await parse(login)
  if (!login.ok) throw new Error(`Login failed (${login.status}): ${loginData.error || 'Invalid credentials.'}`)
  const cookies = typeof login.headers.getSetCookie === 'function' ? login.headers.getSetCookie() : [login.headers.get('set-cookie') || '']
  const session = cookies.map((value) => value.split(';')[0]).find((value) => value.startsWith('sf-cms-session='))
  if (!session) throw new Error('Expected CMS session cookie was not returned.')
  const list = await fetch(`${baseUrl}/api/admin/site-content?component=all`, { headers: { cookie: session, accept: 'application/json' }, cache: 'no-store' })
  const data = await parse(list)
  if (!list.ok || !Array.isArray(data.items)) throw new Error(`Unable to list CMS content (${list.status}).`)
  const targets = data.items.filter((item) => item.slug?.startsWith('demo-ui-') && String(item.values?.title_en || '').startsWith('DEMO PREVIEW —'))
  let removed = 0
  for (const item of targets) {
    const response = await fetch(`${baseUrl}/api/admin/site-content?id=${encodeURIComponent(item.id)}`, { method: 'DELETE', headers: { cookie: session, accept: 'application/json' } })
    const body = await parse(response)
    if (!response.ok) throw new Error(`Could not delete ${item.slug}: ${body.error || response.status}`)
    removed++
  }
  console.log(`Removed ${removed} demo records via CMS API. Collection sections remain in Page Builder.`)
}
main().catch((error) => { console.error('UI demo API cleanup failed:', error instanceof Error ? error.message : error); process.exitCode = 1 })
