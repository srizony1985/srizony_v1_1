import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Site Content renders the requested selectable content table and per-row actions', () => {
  const page = read('app/admin/dashboard/site-content/page.tsx')
  assert.match(page, /<table className="site-content-table">/)
  assert.match(page, /Select all visible content records/)
  assert.match(page, /toggleAll\(event\.target\.checked\)/)
  assert.match(page, /toggleRow\(record\.id, event\.target\.checked\)/)
  assert.match(page, /Content title/)
  assert.match(page, /Slug/)
  assert.match(page, /Hide selected/)
  assert.match(page, /Delete selected/)
  assert.match(page, /cms-list-route/)
})

test('bulk content actions update the local table and protect destructive deletes with confirmation', () => {
  const page = read('app/admin/dashboard/site-content/page.tsx')
  assert.match(page, /await hideContentItems\(ids\)/)
  assert.match(page, /await deleteContentItems\(ids\)/)
  assert.match(page, /window\.confirm\(`Permanently delete/)
  assert.match(page, /setData\(\(current\) => \(current \?\? \[\]\)\.filter/)
  assert.match(page, /result\.ids\.forEach\(\(id\) => next\.delete\(id\)\)/)
})

test('bulk API endpoints are authenticated, bounded, audited and use a single database statement', () => {
  const route = read('app/api/admin/site-content/route.ts')
  const service = read('lib/cms/content.ts')
  assert.match(route, /bulkHideSchema = z\.object\(\{ ids: z\.array\(z\.number\(\)\.int\(\)\.positive\(\)\)\.min\(1\)\.max\(500\)/)
  assert.match(route, /bulkDeleteSchema = z\.object\(\{ ids: z\.array\(z\.number\(\)\.int\(\)\.positive\(\)\)\.min\(1\)\.max\(500\)/)
  assert.match(route, /requireAdmin\('admin', 'editor'\)/)
  assert.match(route, /content\.bulk_visibility/)
  assert.match(route, /content\.bulk_delete/)
  assert.match(service, /export async function hideItems\(ids: number\[\]\)/)
  assert.match(service, /UPDATE cms_content_items[\s\S]*SET status = 'hidden'/)
  assert.match(service, /RETURNING \*[\s\S]*map\(toRecord\)/)
  assert.match(service, /export async function deleteItems\(ids: number\[\]\)/)
  assert.match(service, /DELETE FROM cms_content_items[\s\S]*WHERE id IN \(\$\{idList\}\)/)
})

test('Site Content styles are route-scoped and responsive', () => {
  const page = read('app/admin/dashboard/site-content/page.tsx')
  const css = read('app/admin/dashboard/site-content/site-content.css')
  assert.match(page, /import '\.\/site-content\.css'/)
  assert.match(css, /\.site-content-table/)
  assert.match(css, /\.site-content-bulk-actions/)
  assert.match(css, /@media \(max-width: 680px\)/)
  assert.match(css, /var\(--admin-surface/)
})
