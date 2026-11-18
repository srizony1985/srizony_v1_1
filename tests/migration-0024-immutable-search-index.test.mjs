import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('migration 0024 full-text GIN index uses immutable text expression', async () => {
  const migration = await readFile(new URL('../drizzle/0024_site_configurable_cms.sql', import.meta.url), 'utf8')
  const indexStart = migration.indexOf('CREATE INDEX IF NOT EXISTS cms_content_items_search_idx')
  assert.notEqual(indexStart, -1, 'search GIN index must exist')
  const indexSql = migration.slice(indexStart, migration.indexOf(';', indexStart) + 1)
  assert.match(indexSql, /to_tsvector\(\s*'simple'::regconfig/s)
  assert.match(indexSql, /COALESCE\(title_en, ''\)\s*\|\|/s)
  assert.match(indexSql, /COALESCE\(attributes->>'category_bn', ''\)/s)
  assert.doesNotMatch(indexSql, /concat_ws|concat\s*\(/i)
})
