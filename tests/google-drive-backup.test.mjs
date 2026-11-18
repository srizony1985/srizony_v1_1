import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePostgresJson, stringifyPostgresJson, originalNumericValue } from '../scripts/lib/postgres-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFile(path.join(root, relative), 'utf8');

test('Google Drive backup command targets the personal-Drive JSON mirror without replacing S3 backups', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['backup:google-drive'], 'node scripts/backup-google-drive-json.mjs');
  assert.equal(pkg.scripts['backup:google-drive:full'], 'node scripts/backup-google-drive-json.mjs --full');
  assert.equal(pkg.scripts['drive-data:export'], 'node scripts/backup-google-drive-json.mjs --full --local');
  assert.equal(pkg.scripts['backup:production'], 'bash scripts/backup-production.sh');
});

test('Google Drive mirror updates only pre-created JSON files and never creates new Drive files', async () => {
  const drive = await read('scripts/lib/google-drive-json.mjs');
  assert.match(drive, /files\/\$\{encodeURIComponent\(existing\.id\)\}\?uploadType=multipart/);
  assert.match(drive, /method: 'PATCH'/);
  assert.match(drive, /Missing Drive file/);
  assert.match(drive, /capabilities\?\.canEdit === false/);
  assert.match(drive, /application\/vnd\.google-apps\./);
  assert.doesNotMatch(drive, /UPLOAD_API}\/files\?uploadType=/);
  assert.match(drive, /uploadType=resumable/);
  assert.match(drive, /Content-Range/);
  assert.match(drive, /md5Checksum/);
});

test('service-account authentication accepts JSON and individual credential environment variables', async () => {
  const auth = await read('scripts/lib/google-auth.mjs');
  assert.match(auth, /GOOGLE_SERVICE_ACCOUNT_JSON_BASE64/);
  assert.match(auth, /GOOGLE_SERVICE_ACCOUNT_JSON/);
  assert.match(auth, /GOOGLE_SERVICE_ACCOUNT_EMAIL/);
  assert.match(auth, /GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY/);
  assert.match(auth, /createGoogleJwtAssertion/);
});

test('mirror uses one repeatable-read Neon snapshot and retains PostgreSQL numeric precision', async () => {
  const script = await read('scripts/backup-google-drive-json.mjs');
  assert.match(script, /BACKUP_DATABASE_URL/);
  assert.match(script, /--local/);
  assert.match(script, /srizony-postgresql-table-schema-v1/);
  assert.match(script, /schemaSha256/);
  assert.match(script, /pg_constraint/);
  assert.match(script, /pg_indexes/);
  assert.match(script, /pg_policies/);
  assert.match(script, /pg_get_triggerdef/);
  assert.match(script, /import \{ Pool \} from '@neondatabase\/serverless'/);
  assert.match(script, /pool\.connect\(\)/);
  assert.match(script, /globalThis\.WebSocket/);
  assert.doesNotMatch(script, /spawnSync|child_process|PGPASSWORD|postgresEnvironment|\bpsql\b/);
  assert.match(script, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(script, /media_items/);
  assert.match(script, /backupBase64/);
  assert.match(script, /backupContentType/);
  assert.match(script, /backupSha256/);
  assert.ok(script.includes("String(row.kind || '').toLowerCase() === 'image'"));
  assert.match(script, /classifyImageSource/);
  assert.match(script, /backupStorageKey/);
  assert.match(script, /DRIVE_JSON_IMAGE_FETCH_HOSTS/);
  assert.match(script, /DRIVE_JSON_MAX_IMAGE_BYTES/);
  assert.match(script, /DRIVE_JSON_MAX_FILE_BYTES/);
  assert.match(script, /synced_revision = pending\.revision/);
  assert.match(script, /state\.revision = pending\.revision/);
  assert.doesNotMatch(script, /pg_dump.*-f/i);
});

test('Drive media fallback accepts snapshot-only storage keys for bundled and remote image payloads', async () => {
  const media = await read('lib/google/drive-media.ts');
  assert.match(media, /text\(row\.backupStorageKey\)/);
  assert.match(media, /canonicalMediaKey\(text\(row\.backupStorageKey\)\)/);
  const route = await read('app/api/media/[id]/route.ts');
  assert.match(route, /storageKey: driveMedia\.storageKey/);
});

test('lossless JSON round-trip preserves large identifiers and high precision decimals', () => {
  const input = '{"id":9223372036854775807,"amount":12345678901234567890.123456789,"ratio":1e-20,"label":"ID 9223372036854775807","nested":{"zero":0}}';
  const parsed = parsePostgresJson(input);
  assert.equal(originalNumericValue(parsed.value.id, parsed.numericTokens), '9223372036854775807');
  assert.equal(originalNumericValue(parsed.value.amount, parsed.numericTokens), '12345678901234567890.123456789');
  assert.equal(originalNumericValue(parsed.value.ratio, parsed.numericTokens), '1e-20');
  assert.equal(parsed.value.label, 'ID 9223372036854775807');
  const output = stringifyPostgresJson(parsed.value, parsed.numericTokens).trim();
  assert.equal(output, input);
  assert.equal(JSON.parse(output).id, 9223372036854776000);
});

test('change journal uses matching public table names and omits high-churn tables', async () => {
  const migration = await read('drizzle/0019_google_drive_json_mirror.sql');
  assert.match(migration, /VALUES \(TG_TABLE_NAME, 1, 0, clock_timestamp\(\)\)/);
  assert.doesNotMatch(migration, /TG_TABLE_SCHEMA\s*\|\|\s*'\.'/);
  assert.match(migration, /visitor_events.*site_visitors.*public_api_rate_limits.*admin_login_attempts.*job_public_rate_limits.*enquiry_daily_limits/s);
  assert.match(migration, /revision = public\.drive_sync_state\.revision \+ 1/);
});

test('workflow runs hourly incremental sync and a daily full snapshot', async (t) => {
  let workflow;
  try { workflow = await read('.github/workflows/production-google-drive-backup.yml'); }
  catch { t.skip('The supplied project archive does not include the hidden .github workflow directory.'); return; }
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: '0 0-19,21-23 \* \* \*'/);
  assert.match(workflow, /cron: '0 20 \* \* \*'/);
  assert.match(workflow, /02:00 Asia\/Dhaka/);
  assert.match(workflow, /BACKUP_DATABASE_URL:/);
  assert.match(workflow, /GOOGLE_DRIVE_FOLDER_ID:/);
  assert.match(workflow, /GOOGLE_SERVICE_ACCOUNT_JSON_BASE64:/);
  assert.match(workflow, /concurrency:/);
});

test('admin backup listing endpoint requires administrator access', async () => {
  const route = await read('app/api/admin/database/drive-backups/route.ts');
  assert.match(route, /requireAdmin\('admin'\)/);
  assert.match(route, /listGoogleDriveBackups/);
  assert.match(route, /Cache-Control/);
});


test('CMS exposes the manual full backup, complete restore-point inventory, and selected restore controls', async (t) => {
  const status = await read('lib/google/drive.ts');
  const panel = await read('app/admin/dashboard/settings/SettingsClient.tsx');
  const route = await read('app/api/admin/database/drive-backups/route.ts');
  let workflow;
  try { workflow = await read('.github/workflows/production-google-drive-backup.yml'); }
  catch { t.skip('The supplied project archive does not include the hidden .github workflow directory.'); return; }
  assert.match(status, /backupUtc/);
  assert.doesNotMatch(status, /\.slice\(0, 100\)/);
  assert.match(panel, /Create backup now/);
  assert.match(panel, /pointInTimeBackups\.map/);
  assert.match(panel, /Restore/);
  assert.match(route, /requireAdmin\('admin'\)/);
  assert.match(route, /RESTORE PRODUCTION/);
  assert.match(workflow, /Create pre-restore safety backup/);
});

test('restore validates the selected application archive and both storage buckets before restoring', async () => {
  const restore = await read('scripts/restore-google-drive.mjs');
  assert.match(restore, /downloadDriveBackup\(fileId, archivePath\)/);
  assert.match(restore, /manifest\.database\.sha256/);
  assert.match(restore, /pg_restore', \['--list'/);
  assert.match(restore, /objectStorage\.privateBucket !== privateBucket/);
  assert.match(restore, /'--delete'/);
  assert.match(restore, /'--exit-on-error'/);
});

test('Neon outage fallback is read-only and limited to known transient database errors', async () => {
  const provider = await read('lib/data-provider.ts');
  const db = await read('lib/db/index.ts');
  const site = await read('lib/site.ts');
  const content = await read('lib/cms/content.ts');
  assert.match(provider, /Neon PostgreSQL remains the only writable CMS source of truth/);
  assert.match(db, /export function isTransientDatabaseError/);
  assert.match(site, /if \(!isTransientDatabaseError\(error\)\) throw error/);
  assert.match(content, /if \(!isTransientDatabaseError\(error\)\) throw error/);
  assert.match(content, /readDriveTableSnapshot\('cms_content_items'\)/);
  assert.match(site, /readDriveTableSnapshot\('ui_content'\)/);
  assert.match(site, /uiRowsToDocument/);
});

test('CMS job form fields are configurable and validated server-side', async () => {
  const builder = await read('components/admin/JobApplicationFormBuilder.tsx');
  const api = await read('app/api/admin/job-application-form/route.ts');
  const validation = await read('lib/jobApplicationForm.ts');
  const migration = await read('drizzle/0020_job_application_custom_fields.sql');
  assert.match(builder, /Input field type/);
  assert.match(builder, /Required/);
  assert.match(builder, /Maximum characters/);
  assert.match(api, /requireAdmin\('admin', 'editor'\)/);
  assert.match(validation, /validateCustomJobFields/);
  assert.match(migration, /custom_fields JSONB/);
});

test('public navigation validates migrated typography columns without runtime DDL', async () => {
  const ensure = await read('lib/cms/ensureSchema.ts');
  const site = await read('lib/site.ts');
  const migration = await read('drizzle/0021_navigation_typography.sql');
  assert.match(ensure, /export function ensureNavigationTypographySchema/);
  assert.match(ensure, /typography/);
  assert.match(ensure, /assertRequiredColumns/);
  assert.doesNotMatch(ensure, /CREATE TABLE|ALTER TABLE|DROP TABLE/);
  assert.match(site, /await ensureNavigationTypographySchema\(\)[\s\S]*?i\.typography/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS typography JSONB/);
});

test('typography controls cover pages, sections, content details and navigation', async () => {
  const editor = await read('components/admin/CmsTypographyEditor.tsx');
  const helper = await read('lib/cms/typography.ts');
  const pageBuilder = await read('app/admin/dashboard/page-builder/page.tsx');
  const navBuilder = await read('app/admin/dashboard/navigation/page.tsx');
  const contentEditor = await read('app/admin/dashboard/_components/ContentEditor.tsx');
  assert.match(editor, /Font family/);
  assert.match(editor, /Font weight/);
  assert.match(editor, /Text colour/);
  assert.match(editor, /Line height/);
  assert.match(helper, /normalizeCmsTypography/);
  assert.match(pageBuilder, /title="Page typography"/);
  assert.match(pageBuilder, /title="Section typography"/);
  assert.match(navBuilder, /title="Navigation typography"/);
  assert.match(contentEditor, /title="Content detail typography"/);
});

test('public animation hotspots do not re-render or measure layout every frame', async () => {
  const stats = await read('components/ui/Stats.tsx');
  const rail = await read('components/home/NewsRail.tsx');
  const story = await read('components/home/MissionVisionValues.tsx');
  const map = await read('components/home/LocationMaps.tsx');
  assert.match(stats, /node\.textContent = format/);
  assert.doesNotMatch(stats, /setValue\(/);
  assert.match(rail, /loopWidth\.current/);
  assert.doesNotMatch(rail.slice(rail.indexOf('const tick ='), rail.indexOf('const holdFor')), /offsetLeft|getBoundingClientRect/);
  assert.match(story, /indexRef\.current !== nextIndex/);
  assert.match(map, /measuredSizeRef\.current/);
  assert.match(map, /currentMap\.on\('move zoom resize', updatePinPositions\)/);
  assert.doesNotMatch(map, /setTick\(/);
});


test('Drive API field masks use documented nested capability paths across runtime and backup scripts', async () => {
  const runtime = await read('lib/google/drive.ts')
  const fullBackup = await read('scripts/lib/google-drive.mjs')
  const jsonBackup = await read('scripts/lib/google-drive-json.mjs')
  for (const source of [runtime, fullBackup, jsonBackup]) {
    assert.doesNotMatch(source, /capabilities\([a-zA-Z]/)
    assert.match(source, /capabilities\/can/)
  }
  assert.match(runtime, /capabilities\/canListChildren/)
  assert.match(fullBackup, /!folder\.driveId \|\| folder\.capabilities\?\.canAddChildren !== true/)
  assert.match(jsonBackup, /capabilities\?\.canListChildren === false/)
  assert.match(jsonBackup, /capabilities\?\.canEdit === false/)
})

test('scheduled Google Drive workflow uses the project Node runtime and exposes a safe restore workflow', async () => {
  const workflow = await read('.github/workflows/production-google-drive-backup.yml')
  const nvmrc = (await read('.nvmrc')).trim()
  assert.ok(workflow.includes('node-version-file: .nvmrc'))
  assert.ok(nvmrc.startsWith('24.'), 'The backup workflow must use the project Node 24 runtime.')
  assert.match(workflow, /Create pre-restore safety backup/)
  assert.match(workflow, /RESTORE PRODUCTION/)
  assert.match(workflow, /0 20 \* \* \*/)
})

test('Drive JSON mirror readiness requires every discovered mirror file to be editable', async () => {
  const route = await read('app/api/admin/database/drive-backups/route.ts')
  assert.match(route, /canUpdateJsonMirrors: jsonMirrors\.length > 0 && writableMirrorCount === jsonMirrors\.length/)
})
