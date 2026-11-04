import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { assertDriveJsonConfigured, checkDriveJsonFolder, listDriveJsonFiles, readExistingDriveJson, writeExistingDriveJson, writeExistingDriveJsonText } from './lib/google-drive-json.mjs';
import { parsePostgresJson, stringifyPostgresJson, originalNumericValue } from './lib/postgres-json.mjs';

loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });

const databaseUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '').trim();
const excludedHotTables = new Set(['visitor_events', 'site_visitors', 'public_api_rate_limits', 'admin_login_attempts', 'job_public_rate_limits', 'enquiry_daily_limits']);
const args = new Set(process.argv.slice(2));
const fullSnapshot = args.has('--full') || process.env.DRIVE_JSON_FULL_SNAPSHOT === 'true';
const listRequiredOnly = args.has('--list-required');
const maxBytes = Number(process.env.DRIVE_JSON_MAX_FILE_BYTES || 200 * 1024 * 1024);

if (!databaseUrl) throw new Error('Set BACKUP_DATABASE_URL or DATABASE_URL to a direct PostgreSQL connection URL.');
if (!Number.isInteger(maxBytes) || maxBytes < 1024 * 1024 || maxBytes > 5 * 1024 * 1024 * 1024) {
  throw new Error('DRIVE_JSON_MAX_FILE_BYTES must be between 1 MiB and 5 GiB.');
}

function postgresEnvironment() {
  let url
  try { url = new URL(databaseUrl) }
  catch { throw new Error('BACKUP_DATABASE_URL must be a PostgreSQL URL.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('BACKUP_DATABASE_URL must use postgres:// or postgresql://.')
  const query = url.searchParams
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    PGSSLMODE: process.env.PGSSLMODE || query.get('sslmode') || 'require',
    PGAPPNAME: query.get('application_name') || 'sf-drive-json-backup',
    ...(query.get('options') ? { PGOPTIONS: query.get('options') } : {}),
  }
}

function psql(query, label = 'PostgreSQL query') {
  const result = spawnSync('psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', query], {
    encoding: 'utf8',
    maxBuffer: Math.min(Math.max(maxBytes * 2, 32 * 1024 * 1024), 1024 * 1024 * 1024),
    env: postgresEnvironment(),
  })
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${label} failed: ${(result.stderr || result.stdout || 'psql exited non-zero').trim().slice(0, 1200)}`)
  return String(result.stdout || '').trim()
}

function parseTabRows(raw) {
  return raw ? raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const tab = line.indexOf('\t');
    return tab < 0 ? [line] : [line.slice(0, tab), line.slice(tab + 1)];
  }) : [];
}

function qIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
function qLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getTables({ includeHot = fullSnapshot } = {}) {
  const exclude = includeHot ? [] : [...excludedHotTables];
  const exclusionSql = exclude.length ? `AND table_name NOT IN (${exclude.map(qLiteral).join(',')})` : '';
  const raw = psql(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'drive_sync_state' ${exclusionSql} ORDER BY table_name;`, 'Listing public tables');
  return raw.split(/\r?\n/).filter(Boolean);
}

function refreshTriggers() {
  psql('SELECT public.refresh_drive_backup_triggers();', 'Refreshing Drive backup triggers');
}

function getPendingTables() {
  const raw = psql(`SELECT table_name || E'\\t' || revision::text FROM public.drive_sync_state WHERE revision > synced_revision ORDER BY changed_at ASC, table_name ASC;`, 'Reading changed-table queue');
  return parseTabRows(raw).map(([table, revision]) => ({ table, revision: Number(revision) }));
}

function getTableRevisions() {
  const raw = psql(`SELECT table_name || E'\\t' || revision::text FROM public.drive_sync_state ORDER BY table_name;`, 'Reading table revisions')
  return new Map(parseTabRows(raw).map(([table, revision]) => [table, Number(revision)]))
}

function preflightExistingJsonFiles(listing, names) {
  for (const name of names) {
    const matches = listing.files.filter((file) => file.name === name)
    if (!matches.length) throw new Error(`Required Drive file "${name}" is missing. Create a real .json file from your Gmail account and share the folder with the service account as Editor.`)
    if (matches.length > 1) throw new Error(`Drive folder contains ${matches.length} files named "${name}". Keep exactly one file.`)
    if (matches[0].mimeType === 'application/vnd.google-apps.folder' || matches[0].mimeType?.startsWith('application/vnd.google-apps.')) throw new Error(`"${name}" must be an uploaded JSON file, not a Google Docs/Sheets item.`)
    if (matches[0].capabilities?.canEdit === false) throw new Error(`The service account cannot edit "${name}". Share this file or its parent folder with the service account as Editor.`)
  }
}


function exportTablesSnapshot(tables) {
  if (!tables.length) return new Map()
  // One repeatable-read, read-only transaction gives every table file the same
  // PostgreSQL MVCC snapshot. Numeric tokens are temporarily replaced before
  // JSON.parse so BIGINT IDs and high-precision NUMERIC values stay exact.
  const statements = ['BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;']
  for (const item of tables) {
    statements.push(`SELECT ${qLiteral(`__SF_TABLE__${item.table}__`)};`)
    statements.push(`SELECT COALESCE(json_agg(to_jsonb(t)), '[]'::json)::text FROM public.${qIdent(item.table)} AS t;`)
  }
  statements.push('COMMIT;')
  const output = psql(statements.join('\n'), 'Exporting a consistent PostgreSQL snapshot')
  const lines = output.split(/\r?\n/).filter(Boolean)
  const rowsByTable = new Map()
  for (let index = 0; index < lines.length; index += 1) {
    const marker = lines[index].match(/^__SF_TABLE__(.+)__$/)
    if (!marker) continue
    const table = marker[1]
    const raw = lines[index + 1]
    if (typeof raw !== 'string') throw new Error(`PostgreSQL did not return data for ${table}.`)
    let lossless
    try { lossless = parsePostgresJson(raw) }
    catch { throw new Error(`PostgreSQL returned invalid JSON while exporting ${table}.`) }
    const rows = lossless.value
    if (!Array.isArray(rows)) throw new Error(`Expected ${table} export to be a JSON array.`)
    rowsByTable.set(table, { rows, numericTokens: lossless.tokens })
    index += 1
  }
  if (rowsByTable.size !== tables.length) throw new Error(`Consistent database snapshot incomplete: expected ${tables.length} tables, received ${rowsByTable.size}.`)
  return rowsByTable
}

async function addImagePayloads(rows, numericTokens = new Map()) {
  const imageRows = rows.filter((row) => (typeof row.content_type === 'string' && row.content_type.toLowerCase().startsWith('image/')) || String(row.kind || '').toLowerCase() === 'image')
  if (!imageRows.length) return { images: 0, bytes: 0 }
  const getKey = (row) => {
    for (const raw of [row.storage_key, row.src]) {
      const candidate = String(raw || '').trim().replace(/^\//, '')
      if (!candidate) continue
      if (candidate.startsWith('media/')) return candidate
      try {
        const parsed = new URL(candidate)
        const match = parsed.pathname.match(/(?:^|\/)(?:uploads|public-assets)\/(media\/.+)$/i)
          || parsed.pathname.match(/(?:^|\/)(media\/.+)$/)
        if (match) return match[1].split('/').map((part) => decodeURIComponent(part)).join('/')
      } catch { /* continue with the next stored source */ }
    }
    return ''
  }
  const inferImageType = (row, key, storedType) => {
    const declared = String(row.content_type || '').trim().toLowerCase()
    if (declared.startsWith('image/')) return declared
    if (storedType?.toLowerCase().startsWith('image/')) return storedType.toLowerCase()
    const extension = key.toLowerCase().split('.').pop()
    return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml' })[extension] || ''
  }
  for (const row of imageRows) {
    if (!getKey(row)) throw new Error(`Image media_items row ${row.id ?? '(unknown)'} has no recoverable media storage key; refusing an incomplete image backup.`)
  }
  const [{ S3Client, GetObjectCommand }] = await Promise.all([import('@aws-sdk/client-s3')]);
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('Image rows exist, so set AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to embed the originals as Base64.');
  }
  const client = new S3Client({
    region, endpoint, forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  let bytesTotal = 0;
  try {
    for (const row of imageRows) {
      const bucket = String(row.storage_bucket || process.env.NEON_OBJECT_STORAGE_BUCKET || 'uploads');
      const key = getKey(row);
      if (!key.startsWith('media/') || key.startsWith('/') || key.includes('..') || key.includes('\\')) {
        throw new Error(`Unsafe media storage key in media_items row ${row.id ?? '(unknown)'}.`);
      }
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!result.Body) throw new Error(`Image object ${bucket}/${key} has no readable body.`);
      const payload = Buffer.from(await result.Body.transformToByteArray());
      if (payload.byteLength === 0) throw new Error(`Image object ${bucket}/${key} is empty.`);
      const declared = Number(originalNumericValue(row.size_bytes, numericTokens) || 0);
      if (declared > 0 && declared !== payload.byteLength) throw new Error(`Image size mismatch for media_items row ${row.id ?? '(unknown)'}.`);
      const backupContentType = inferImageType(row, key, result.ContentType);
      if (!backupContentType) throw new Error(`Could not determine the image MIME type for media_items row ${row.id ?? '(unknown)'}.`);
      row.backupEncoding = 'base64';
      row.backupContentType = backupContentType;
      row.backupBase64 = payload.toString('base64');
      row.backupSha256 = createHash('sha256').update(payload).digest('hex');
      bytesTotal += payload.byteLength;
    }
  } finally {
    client.destroy();
  }
  return { images: imageRows.length, bytes: bytesTotal };
}

async function main() {
  psql('SELECT 1;', 'Checking Neon database connection');
  if (listRequiredOnly) {
    const tables = getTables({ includeHot: true });
    process.stdout.write(['backup-manifest.json', ...tables.map((table) => `${table}.json`)].join('\n') + '\n');
    return;
  }
  assertDriveJsonConfigured();
  const folder = await checkDriveJsonFolder();
  refreshTriggers();
  const listing = await listDriveJsonFiles();
  const allTables = getTables({ includeHot: true });
  const revisions = getTableRevisions();
  const tables = fullSnapshot
    ? allTables.map((table) => ({ table, revision: revisions.get(table) || 0 }))
    : getPendingTables();
  if (!tables.length) {
    process.stdout.write(`No changed tables to mirror. Drive folder: ${folder.name}\n`);
    return;
  }
  preflightExistingJsonFiles(listing, [...tables.map((item) => `${item.table}.json`), 'backup-manifest.json'])
  const oldManifest = await readExistingDriveJson('backup-manifest.json', listing)
  const existingSnapshots = new Map(
    (Array.isArray(oldManifest?.snapshots) ? oldManifest.snapshots : [])
      .filter((snapshot) => snapshot && typeof snapshot.table === 'string' && allTables.includes(snapshot.table))
      .map((snapshot) => [snapshot.table, snapshot]),
  )
  const exportedAt = new Date().toISOString();
  const rowsByTable = exportTablesSnapshot(tables);
  const snapshots = [];
  for (const item of tables) {
    const exported = rowsByTable.get(item.table);
    if (!exported) throw new Error(`Table ${item.table} was not included in the consistent snapshot.`);
    const { rows, numericTokens } = exported;
    const revision = item.revision;
    const images = item.table === 'media_items' ? await addImagePayloads(rows, numericTokens) : { images: 0, bytes: 0 };
    const document = {
      format: 'srizony-postgresql-table-v1',
      table: item.table,
      exportedAt,
      revision,
      rowCount: rows.length,
      imageEncoding: item.table === 'media_items' ? 'base64' : undefined,
      rows,
    };
    const jsonText = stringifyPostgresJson(document, numericTokens)
    const jsonBytes = Buffer.byteLength(jsonText, 'utf8')
    if (jsonBytes > maxBytes) throw new Error(`${item.table}.json is ${jsonBytes} bytes, exceeding DRIVE_JSON_MAX_FILE_BYTES=${maxBytes}. Split this table or raise the configured limit.`)
    const uploaded = await writeExistingDriveJsonText(`${item.table}.json`, jsonText, listing)
    const snapshotInfo = { table: item.table, file: uploaded.name, fileId: uploaded.id, rowCount: rows.length, sizeBytes: uploaded.sizeBytes, sha256: uploaded.sha256, revision, imageCount: images.images, imageBytes: images.bytes, lastUpdated: exportedAt };
    existingSnapshots.set(item.table, snapshotInfo);
    snapshots.push(snapshotInfo);
    process.stdout.write(`Mirrored ${item.table}: ${rows.length} rows, ${uploaded.sizeBytes} bytes${images.images ? `, ${images.images} Base64 images` : ''}\n`);
  }
  const manifest = {
    format: 'srizony-drive-database-manifest-v1',
    exportedAt,
    source: 'Neon PostgreSQL',
    folderName: folder.name,
    mode: fullSnapshot ? 'full' : 'incremental',
    images: 'image objects copied into media_items rows as Base64; source object storage is not required for those images after restore',
    highChurnTables: [...excludedHotTables],
    changedTables: tables.map((item) => item.table),
    snapshots: [...existingSnapshots.values()].sort((a, b) => a.table.localeCompare(b.table)),
  };
  await writeExistingDriveJson('backup-manifest.json', manifest, listing);
  // Mark revisions complete only after all table files and the manifest are verified.
  // A partial Drive outage leaves the queue dirty so the next run safely retries.
  if (!fullSnapshot) {
    const values = tables.map((item) => `(${qLiteral(item.table)}, ${Math.trunc(item.revision)}::bigint)`).join(', ')
    psql(`UPDATE public.drive_sync_state AS state SET synced_revision = pending.revision, last_synced_at = now() FROM (VALUES ${values}) AS pending(table_name, revision) WHERE state.table_name = pending.table_name AND state.revision = pending.revision;`, 'Acknowledging mirrored table revisions')
  } else {
    const values = tables.filter((item) => revisions.has(item.table)).map((item) => `(${qLiteral(item.table)}, ${Math.trunc(item.revision)}::bigint)`).join(', ')
    if (values) psql(`UPDATE public.drive_sync_state AS state SET synced_revision = pending.revision, last_synced_at = now() FROM (VALUES ${values}) AS pending(table_name, revision) WHERE state.table_name = pending.table_name AND state.revision = pending.revision;`, 'Acknowledging full snapshot revisions')
  }
  process.stdout.write(`Google Drive JSON mirror completed: ${snapshots.length} table(s), mode=${manifest.mode}, folder=${folder.name}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
