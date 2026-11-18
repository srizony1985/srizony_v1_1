import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
test('database lifecycle commands are defined', () => {
  for (const command of ['db:init', 'db:reset', 'db:migrate', 'db:restore', 'db:backup']) assert.ok(pkg.scripts[command], `${command} is missing`)
})
test('init applies migrations without seeding content', async () => {
  const source = await readFile(new URL('../scripts/db-init.mjs', import.meta.url), 'utf8')
  assert.match(source, /db:migrate/)
  assert.match(source, /db:migrate/)
  assert.doesNotMatch(source, /db:seed/)
})
test('reset requires explicit destructive confirmation and production opt-in', async () => {
  const source = await readFile(new URL('../scripts/db-reset.mjs', import.meta.url), 'utf8')
  assert.match(source, /--confirm-reset/)
  assert.match(source, /ALLOW_PRODUCTION_DB_RESET/)
  assert.match(source, /DROP SCHEMA IF EXISTS public CASCADE/)
  assert.match(source, /DROP TABLE IF EXISTS drizzle\.__drizzle_migrations/)
})
test('JSON restore validates site and does not execute snapshot DDL', async () => {
  const source = await readFile(new URL('../scripts/restore-google-drive-json.mjs', import.meta.url), 'utf8')
  assert.match(source, /CMS_SITE_KEY/)
  assert.match(source, /information_schema\.tables/)
  assert.match(source, /local \? JSON\.parse/)
  assert.doesNotMatch(source, /CREATE TABLE|DROP TABLE|ALTER TABLE/)
})
test('backup routes local exports and production Drive exports', async () => {
  const source = await readFile(new URL('../scripts/run-db-backup.mjs', import.meta.url), 'utf8')
  assert.match(source, /NODE_ENV === 'production'/)
  assert.match(source, /explicitDrive \|\| \(production && !explicitLocal\)/)
  assert.match(source, /useDrive \? '--full' : '--local'/)
  assert.match(source, /--local/)
  assert.match(source, /--full/)
})
test('Drive JSON exporter preserves lossless PostgreSQL numeric values', async () => {
  const source = await readFile(new URL('../scripts/backup-google-drive-json.mjs', import.meta.url), 'utf8')
  assert.match(source, /numericTokens:\s*lossless\.numericTokens/)
  assert.doesNotMatch(source, /numericTokens:\s*lossless\.tokens/)
})
test('JSON restore validates and uploads Base64 image payloads before row insertion', async () => {
  const source = await readFile(new URL('../scripts/restore-google-drive-json.mjs', import.meta.url), 'utf8')
  assert.match(source, /backupSha256/)
  assert.match(source, /PutObjectCommand/)
  assert.match(source, /backupStorageKey/)
})


test('existing-schema migration is explicit and non-destructive', async () => {
  const source = await readFile(new URL('../scripts/db-migrate.mjs', import.meta.url), 'utf8')
  assert.match(source, /--allow-existing-schema/)
  assert.match(source, /zero recorded Drizzle migrations/)
  assert.match(source, /Preserving \$\{existingTables\.length\} existing public tables/)
  assert.doesNotMatch(source, /DROP SCHEMA|DROP TABLE|TRUNCATE TABLE/)
  assert.match(pkg.dependencies.pg, /^\^8\./)
})

test('runtime schema guards are read-only; SQL migrations own schema changes', async () => {
  const operational = await readFile(new URL('../lib/db/ensureOperationalSchema.ts', import.meta.url), 'utf8')
  const cms = await readFile(new URL('../lib/cms/ensureSchema.ts', import.meta.url), 'utf8')
  const validation = await readFile(new URL('../lib/db/schema-validation.ts', import.meta.url), 'utf8')
  const repair = await readFile(new URL('../scripts/repair-cms.ts', import.meta.url), 'utf8')
  const publicRateLimit = await readFile(new URL('../lib/publicRateLimit.ts', import.meta.url), 'utf8')
  const security = await readFile(new URL('../lib/security.ts', import.meta.url), 'utf8')
  const legacyBootstrap = await readFile(new URL('../db/init.sql', import.meta.url), 'utf8')
  for (const source of [operational, cms, validation, repair, publicRateLimit, security]) {
    assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE|DROP TABLE|TRUNCATE TABLE/i)
  }
  assert.doesNotMatch(legacyBootstrap, /\bDROP\s+(TABLE|VIEW|SCHEMA)|\bCREATE\s+TABLE/i)
  assert.match(validation, /information_schema\.columns/)
  assert.match(cms, /assertRequiredColumns/)
  assert.match(operational, /information_schema\.columns/)
  assert.match(publicRateLimit, /assertRequiredColumns/)
  assert.match(security, /assertRequiredColumns/)
})

test('first migration safely validates an already-existing donations table', async () => {
  const migration = await readFile(new URL('../drizzle/0000_ordinary_pixie.sql', import.meta.url), 'utf8')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "donations"/)
  assert.match(migration, /Existing public\.donations table is incompatible/)
  assert.match(migration, /PRIMARY KEY \(id\)/)
  assert.match(migration, /UNIQUE \(transaction_id\)/)
})

test('migration transactions are owned by Drizzle, not embedded BEGIN/COMMIT pairs', async () => {
  for (const file of ['0022_cms_page_behaviour_and_ui_content.sql', '0024_site_configurable_cms.sql']) {
    const migration = await readFile(new URL(`../drizzle/${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(migration, /^\s*(BEGIN|COMMIT);\s*$/im)
  }
})

test('every final physical migration table has a typed Drizzle table declaration', async () => {
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'))
  const migrations = await Promise.all(journal.entries.map((entry) =>
    readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8'),
  ))
  const migrationTables = new Set()
  const createTable = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([A-Za-z_][\w]*)["']?/gi
  for (const migration of migrations) {
    for (const match of migration.matchAll(createTable)) migrationTables.add(match[1])
  }
  // These legacy objects are deliberately converted into compatibility views by migration 0002.
  migrationTables.delete('cms_documents')
  migrationTables.delete('cms_menu_content')
  const schema = await readFile(new URL('../lib/db/schema.ts', import.meta.url), 'utf8')
  const typedTables = new Set([...schema.matchAll(/export const \w+ = pgTable\('([^']+)'/g)].map((match) => match[1]))
  const missing = [...migrationTables].filter((table) => !typedTables.has(table)).sort()
  assert.deepEqual(missing, [], `Missing Drizzle declarations: ${missing.join(', ')}`)
})

test('migration journal entries are sequential and every registered SQL file exists', async () => {
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'))
  assert.equal(journal.entries.length, 29)
  for (let index = 0; index < journal.entries.length; index++) {
    const entry = journal.entries[index]
    assert.equal(entry.idx, index)
    await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8')
  }
  assert.equal(journal.entries.at(-1).tag, '0028_refresh_drive_backup_triggers')
  const triggerRepair = await readFile(new URL('../drizzle/0028_refresh_drive_backup_triggers.sql', import.meta.url), 'utf8')
  assert.match(triggerRepair, /refresh_drive_backup_triggers\(\)/)
})

test('CMS runtime validation matches the migration-defined configurable field and pipeline columns', async () => {
  const guard = await readFile(new URL('../lib/cms/ensureSchema.ts', import.meta.url), 'utf8')
  assert.match(guard, /cms_content_field_definitions:[^\n]*'localized'[^\n]*'options'[^\n]*'validation'[^\n]*'help_text'/)
  assert.doesNotMatch(guard, /cms_content_field_definitions:[^\n]*'config'/)
  assert.match(guard, /cms_data_pipelines:[^\n]*'primary_key_column'[^\n]*'read_enabled'/)
})

test('navigation group key uniqueness exists before migrations use ON CONFLICT (key)', async () => {
  const structural = await readFile(new URL('../drizzle/0002_structural_entity_database.sql', import.meta.url), 'utf8')
  const tasklist = await readFile(new URL('../drizzle/0008_website_tasklist.sql', import.meta.url), 'utf8')
  const indexPosition = structural.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS nav_groups_key_uq ON nav_groups(key)')
  const navItemsPosition = structural.indexOf('CREATE TABLE IF NOT EXISTS nav_items')
  assert.ok(indexPosition > navItemsPosition, 'the index must be added after nav_items exists so duplicate groups can retain their items')
  assert.match(structural, /row_number\(\) OVER \(PARTITION BY key ORDER BY id\)/)
  assert.match(structural, /SET key = replacement_key/)
  assert.ok(tasklist.indexOf('ON CONFLICT (key) DO NOTHING') >= 0)
  assert.ok(indexPosition >= 0, 'nav_groups.key must be unique before migration 0008')
})


test('navigation visibility column is created before migration 0013 first uses it', async () => {
  const migration = await readFile(new URL('../drizzle/0013_landing_only_navigation_root.sql', import.meta.url), 'utf8')
  const alterPosition = migration.indexOf('ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true')
  const updatePosition = migration.indexOf('is_visible = true')
  assert.ok(alterPosition >= 0, 'migration 0013 must create is_visible when missing')
  assert.ok(updatePosition > alterPosition, 'is_visible must exist before the first UPDATE references it')
})
