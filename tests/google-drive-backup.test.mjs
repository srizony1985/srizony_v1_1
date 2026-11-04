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
  assert.match(script, /PGPASSWORD/);
  assert.match(script, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
  assert.match(script, /media_items/);
  assert.match(script, /backupBase64/);
  assert.match(script, /backupContentType/);
  assert.match(script, /backupSha256/);
  assert.ok(script.includes("String(row.kind || '').toLowerCase() === 'image'"));
  assert.match(script, /DRIVE_JSON_MAX_FILE_BYTES/);
  assert.match(script, /synced_revision = pending\.revision/);
  assert.match(script, /state\.revision = pending\.revision/);
  assert.doesNotMatch(script, /pg_dump.*-f/i);
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

test('workflow runs hourly incremental sync and a daily full snapshot', async () => {
  const workflow = await read('.github/workflows/production-google-drive-backup.yml');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: '0 \* \* \* \*'/);
  assert.match(workflow, /cron: '35 20 \* \* \*'/);
  assert.match(workflow, /BACKUP_DATABASE_URL:/);
  assert.match(workflow, /GOOGLE_DRIVE_FOLDER_ID:/);
  assert.match(workflow, /GOOGLE_SERVICE_ACCOUNT_JSON_BASE64:/);
  assert.match(workflow, /postgresql-client/);
  assert.match(workflow, /concurrency:/);
});

test('admin backup listing endpoint requires administrator access', async () => {
  const route = await read('app/api/admin/database/drive-backups/route.ts');
  assert.match(route, /requireAdmin\('admin'\)/);
  assert.match(route, /listGoogleDriveBackups/);
  assert.match(route, /Cache-Control/);
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
  assert.match(map, /map\.on\('move zoom resize', updatePinPositions\)/);
  assert.doesNotMatch(map, /setTick\(/);
});
