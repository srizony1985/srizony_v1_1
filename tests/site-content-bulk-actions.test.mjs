import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Site Content renders the requested selectable content table and per-row actions', () => {
  const page = read('app/admin/dashboard/site-content/page.tsx')
  const table = read('components/admin/cms/AdminTable.tsx')
  assert.match(page, /<AdminTable[\s\S]*?tableClassName="site-content-table/)
  assert.match(page, /selectable/)
  assert.match(page, /selectedIds=\{\[\.\.\.selectedIds\]\.map\(String\)\}/)
  assert.match(page, /onSelectionChange=\{\(ids\) => setSelectedIds/)
  assert.match(table, /Select all visible rows/)
  assert.match(table, /toggleAll\(event\.target\.checked\)/)
  assert.match(table, /toggleOne\(id, event\.target\.checked\)/)
  assert.match(page, /Content title/)
  assert.match(page, /cms-list-route/)
  assert.match(page, /title=\{route\}/)
  assert.match(page, /title="Hide the selected records"/)
  assert.match(page, /title="Permanently delete the selected records"/)
  assert.match(page, /<AdminDataContainer|<AdminTable/)
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

test('Site Content uses the shared shadcn table and responsive Tailwind layout', () => {
  const page = read('app/admin/dashboard/site-content/page.tsx')
  const table = read('components/admin/cms/AdminTable.tsx')
  assert.doesNotMatch(page, /site-content\.css|Admin\.css/)
  assert.match(page, /<AdminTable/)
  assert.match(page, /<Button/)
  assert.match(table, /overflow-auto overscroll-contain/)
  assert.match(table, /data-slot="table"|<Table/)
  assert.match(read('app/admin/layout.tsx'), /AdminThemeShell/)
})
