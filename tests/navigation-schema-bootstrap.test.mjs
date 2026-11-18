import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('navigation schema is installed only by ordered migrations and runtime checks are read-only', async () => {
  const ensure = await read('lib/cms/ensureSchema.ts');
  const migration = await read('drizzle/0026_repair_navigation_tables.sql');
  const typographyMigration = await read('drizzle/0021_navigation_typography.sql');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS nav_groups/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS nav_items/);
  assert.ok(migration.indexOf('CREATE TABLE IF NOT EXISTS nav_groups') < migration.indexOf('CREATE TABLE IF NOT EXISTS nav_items'));
  assert.match(typographyMigration, /ADD COLUMN IF NOT EXISTS typography JSONB/);
  assert.match(ensure, /export function ensureNavigationTypographySchema/);
  assert.match(ensure, /assertRequiredColumns\(db, NAVIGATION_REQUIRED_COLUMNS, 'Navigation'\)/);
  assert.doesNotMatch(ensure, /CREATE TABLE|ALTER TABLE|DROP TABLE/);
});

test('navigation repair migration is registered and statement-split for Neon', async () => {
  const migration = await read('drizzle/0026_repair_navigation_tables.sql');
  const journal = JSON.parse(await read('drizzle/meta/_journal.json'));
  const entry = journal.entries.find((item) => item.tag === '0026_repair_navigation_tables');
  assert.ok(entry, 'migration is registered');
  assert.ok(migration.includes('--> statement-breakpoint'));
  assert.ok(migration.indexOf('CREATE TABLE IF NOT EXISTS nav_groups') < migration.indexOf('CREATE TABLE IF NOT EXISTS nav_items'));
  assert.ok(migration.indexOf('CREATE TABLE IF NOT EXISTS nav_items') < migration.indexOf('ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS typography'));
});
