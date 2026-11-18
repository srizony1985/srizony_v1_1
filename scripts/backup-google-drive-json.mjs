import { Pool } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { checkDriveJsonFolder, listDriveJsonFiles, readExistingDriveJson, writeExistingDriveJson, writeExistingDriveJsonText } from './lib/google-drive-json.mjs';
import { parsePostgresJson, stringifyPostgresJson, originalNumericValue } from './lib/postgres-json.mjs';
import { allowedRemoteImageHosts, classifyImageSource, createBackupStorageKey, fetchApprovedRemoteImage } from './lib/media-source.mjs';


const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const databaseUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '').trim();
const excludedHotTables = new Set(['visitor_events', 'site_visitors', 'public_api_rate_limits', 'admin_login_attempts', 'job_public_rate_limits', 'enquiry_daily_limits']);
const args = new Set(process.argv.slice(2));
const localOnly = args.has('--local');
const fullSnapshot = args.has('--full') || localOnly || process.env.DRIVE_JSON_FULL_SNAPSHOT === 'true';
const listRequiredOnly = args.has('--list-required');
const maxBytes = Number(process.env.DRIVE_JSON_MAX_FILE_BYTES || 200 * 1024 * 1024);

if (!databaseUrl) throw new Error('Set BACKUP_DATABASE_URL or DATABASE_URL to a direct PostgreSQL connection URL.');
if (!Number.isInteger(maxBytes) || maxBytes < 1024 * 1024 || maxBytes > 5 * 1024 * 1024 * 1024) {
  throw new Error('DRIVE_JSON_MAX_FILE_BYTES must be between 1 MiB and 5 GiB.');
}

let pool = null;
let databaseClient = null;

async function connectDatabase() {
  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error('BACKUP_DATABASE_URL or DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error('BACKUP_DATABASE_URL or DATABASE_URL must use postgres:// or postgresql://.');
  }
  if (typeof globalThis.WebSocket !== 'function') {
    throw new Error(`The Neon WebSocket driver requires a Node.js runtime with built-in WebSocket support. Current runtime: ${process.version}. Use the project Node.js 24.21.0 version from .nvmrc.`);
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 5_000,
    application_name: 'sf-drive-json-backup',
  });
  pool.on('error', (error) => {
    process.stderr.write(`Neon backup pool error: ${error instanceof Error ? error.message : String(error)}\n`);
  });

  try {
    databaseClient = await pool.connect();
    await databaseClient.query('SELECT 1 AS connected');
  } catch (error) {
    await closeDatabase();
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Checking Neon database connection failed: ${detail}`, { cause: error });
  }
}

async function closeDatabase() {
  if (databaseClient) {
    try { databaseClient.release(); } catch { /* pool may already be closed */ }
    databaseClient = null;
  }
  if (pool) {
    const currentPool = pool;
    pool = null;
    try { await currentPool.end(); } catch { /* preserve the original backup error */ }
  }
}

async function queryRows(statement, label = 'PostgreSQL query') {
  if (!databaseClient) throw new Error('Neon database connection is not initialized.');
  try {
    const result = await databaseClient.query(statement);
    return result.rows;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} failed: ${detail}`, { cause: error });
  }
}

async function execute(statement, label = 'PostgreSQL command') {
  if (!databaseClient) throw new Error('Neon database connection is not initialized.');
  try {
    return await databaseClient.query(statement);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} failed: ${detail}`, { cause: error });
  }
}

function qIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
function qLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function getTables({ includeHot = fullSnapshot } = {}) {
  const exclude = includeHot ? [] : [...excludedHotTables];
  const exclusionSql = exclude.length ? `AND table_name NOT IN (${exclude.map(qLiteral).join(',')})` : '';
  const rows = await queryRows(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> 'drive_sync_state' ${exclusionSql} ORDER BY table_name;`,
    'Listing public tables',
  );
  return rows.map((row) => String(row.table_name));
}

async function refreshTriggers() {
  await execute('SELECT public.refresh_drive_backup_triggers();', 'Refreshing Drive backup triggers');
}

async function getPendingTables() {
  const rows = await queryRows(
    'SELECT table_name, revision::text AS revision FROM public.drive_sync_state WHERE revision > synced_revision ORDER BY changed_at ASC, table_name ASC;',
    'Reading changed-table queue',
  );
  return rows.map((row) => ({ table: String(row.table_name), revision: Number(row.revision) }));
}

async function getTableRevisions() {
  const rows = await queryRows(
    'SELECT table_name, revision::text AS revision FROM public.drive_sync_state ORDER BY table_name;',
    'Reading table revisions',
  );
  return new Map(rows.map((row) => [String(row.table_name), Number(row.revision)]));
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


function tableSchemaSelect(table) {
  const tableName = qLiteral(table);
  return `SELECT json_build_object(
    'format', 'srizony-postgresql-table-schema-v1',
    'schemaName', n.nspname,
    'tableName', c.relname,
    'owner', pg_get_userbyid(c.relowner),
    'tableComment', obj_description(c.oid, 'pg_class'),
    'relationKind', CASE c.relkind WHEN 'r' THEN 'table' WHEN 'p' THEN 'partitioned-table' ELSE c.relkind::text END,
    'persistence', CASE c.relpersistence WHEN 'p' THEN 'permanent' WHEN 'u' THEN 'unlogged' WHEN 't' THEN 'temporary' ELSE c.relpersistence::text END,
    'accessMethod', am.amname,
    'tablespace', NULLIF(ts.spcname, 'pg_default'),
    'relationOptions', c.reloptions,
    'partitionKey', CASE WHEN c.relkind = 'p' THEN pg_get_partkeydef(c.oid) ELSE NULL END,
    'partitionParent', (SELECT format('%I.%I', pn.nspname, pc.relname) FROM pg_inherits inh JOIN pg_class pc ON pc.oid = inh.inhparent JOIN pg_namespace pn ON pn.oid = pc.relnamespace WHERE inh.inhrelid = c.oid LIMIT 1),
    'grants', COALESCE((
      SELECT json_agg(json_build_object(
        'grantee', CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END,
        'grantor', pg_get_userbyid(acl.grantor),
        'privilege', acl.privilege_type,
        'grantable', acl.is_grantable
      ) ORDER BY acl.grantee, acl.privilege_type)
      FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) AS acl
    ), '[]'::json),
    'rowSecurity', c.relrowsecurity,
    'forceRowSecurity', c.relforcerowsecurity,
    'columns', COALESCE((
      SELECT json_agg(json_build_object(
        'ordinalPosition', a.attnum,
        'name', a.attname,
        'dataType', format_type(a.atttypid, a.atttypmod),
        'udtSchema', type_ns.nspname,
        'udtName', typ.typname,
        'typeKind', typ.typtype,
        'enumValues', CASE WHEN typ.typtype = 'e' THEN (SELECT json_agg(en.enumlabel ORDER BY en.enumsortorder) FROM pg_enum en WHERE en.enumtypid = typ.oid) ELSE NULL END,
        'domainBaseType', CASE WHEN typ.typtype = 'd' THEN format_type(typ.typbasetype, typ.typtypmod) ELSE NULL END,
        'domainNotNull', CASE WHEN typ.typtype = 'd' THEN typ.typnotnull ELSE NULL END,
        'nullable', NOT a.attnotnull,
        'default', pg_get_expr(ad.adbin, ad.adrelid),
        'identity', NULLIF(a.attidentity, ''),
        'generated', NULLIF(a.attgenerated, ''),
        'comment', col_description(a.attrelid, a.attnum),
        'collation', CASE WHEN a.attcollation = 0 THEN NULL ELSE format('%I.%I', coll_ns.nspname, coll.collname) END,
        'storage', a.attstorage,
        'compression', NULLIF(a.attcompression, ''),
        'statisticsTarget', NULLIF(a.attstattarget, -1)
      ) ORDER BY a.attnum)
      FROM pg_attribute a
      JOIN pg_type typ ON typ.oid = a.atttypid
      JOIN pg_namespace type_ns ON type_ns.oid = typ.typnamespace
      LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
      LEFT JOIN pg_namespace coll_ns ON coll_ns.oid = coll.collnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
      WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    ), '[]'::json),
    'constraints', COALESCE((
      SELECT json_agg(json_build_object(
        'name', con.conname,
        'kind', CASE con.contype WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY' WHEN 'u' THEN 'UNIQUE' WHEN 'c' THEN 'CHECK' WHEN 'x' THEN 'EXCLUSION' ELSE con.contype::text END,
        'definition', pg_get_constraintdef(con.oid, true),
        'deferrable', con.condeferrable,
        'initiallyDeferred', con.condeferred,
        'validated', con.convalidated
      ) ORDER BY con.conname)
      FROM pg_constraint con WHERE con.conrelid = c.oid
    ), '[]'::json),
    'indexes', COALESCE((
      SELECT json_agg(json_build_object('name', ix.indexname, 'definition', ix.indexdef) ORDER BY ix.indexname)
      FROM pg_indexes ix WHERE ix.schemaname = n.nspname AND ix.tablename = c.relname
    ), '[]'::json),
    'triggers', COALESCE((
      SELECT json_agg(json_build_object(
        'name', tg.tgname,
        'definition', pg_get_triggerdef(tg.oid, true),
        'enabled', CASE tg.tgenabled WHEN 'O' THEN 'origin' WHEN 'D' THEN 'disabled' WHEN 'R' THEN 'replica' WHEN 'A' THEN 'always' ELSE tg.tgenabled::text END
      ) ORDER BY tg.tgname)
      FROM pg_trigger tg WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal
    ), '[]'::json),
    'policies', COALESCE((
      SELECT json_agg(json_build_object(
        'name', pol.policyname, 'command', pol.cmd, 'permissive', pol.permissive,
        'roles', pol.roles, 'using', pol.qual, 'withCheck', pol.with_check
      ) ORDER BY pol.policyname)
      FROM pg_policies pol WHERE pol.schemaname = n.nspname AND pol.tablename = c.relname
    ), '[]'::json)
  )::text AS schema_json
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_am am ON am.oid = c.relam
  LEFT JOIN pg_tablespace ts ON ts.oid = c.reltablespace
  WHERE n.nspname = 'public' AND c.relname = ${tableName} AND c.relkind IN ('r', 'p');`;
}

async function exportTablesSnapshot(tables) {
  if (!tables.length) return new Map();

  // A single pinned Neon WebSocket client keeps all reads in one MVCC snapshot.
  // This avoids external executables and preserves lossless numeric JSON text while exporting.
  await execute('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;', 'Starting consistent PostgreSQL snapshot');
  const rowsByTable = new Map();

  try {
    for (const item of tables) {
      const rowsResult = await queryRows(
        `SELECT COALESCE(json_agg(to_jsonb(t)), '[]'::json)::text AS rows_json FROM public.${qIdent(item.table)} AS t;`,
        `Exporting rows from ${item.table}`,
      );
      const schemaResult = await queryRows(tableSchemaSelect(item.table), `Exporting schema for ${item.table}`);
      const rawRows = rowsResult[0]?.rows_json;
      const rawSchema = schemaResult[0]?.schema_json;
      if (typeof rawRows !== 'string' || typeof rawSchema !== 'string') {
        throw new Error(`PostgreSQL did not return a complete row/schema document for ${item.table}.`);
      }

      let lossless;
      let schema;
      try {
        lossless = parsePostgresJson(rawRows);
        schema = JSON.parse(rawSchema);
      } catch {
        throw new Error(`PostgreSQL returned invalid JSON while exporting ${item.table}.`);
      }

      const rows = lossless.value;
      if (!Array.isArray(rows)) throw new Error(`Expected ${item.table} export to be a JSON array.`);
      if (schema?.tableName !== item.table || schema?.schemaName !== 'public' || !Array.isArray(schema.columns)) {
        throw new Error(`Neon did not return a valid public table definition for ${item.table}.`);
      }
      rowsByTable.set(item.table, { rows, numericTokens: lossless.numericTokens, schema });
    }

    if (rowsByTable.size !== tables.length) {
      throw new Error(`Consistent database snapshot incomplete: expected ${tables.length} tables, received ${rowsByTable.size}.`);
    }
    await execute('COMMIT;', 'Committing consistent PostgreSQL snapshot');
    return rowsByTable;
  } catch (error) {
    try { await execute('ROLLBACK;', 'Rolling back incomplete PostgreSQL snapshot'); } catch { /* retain the original export error */ }
    throw error;
  }
}

async function addImagePayloads(rows, numericTokens = new Map()) {
  const imageRows = rows.filter((row) => (
    (typeof row.content_type === 'string' && row.content_type.toLowerCase().startsWith('image/'))
    || String(row.kind || '').toLowerCase() === 'image'
  ) && (!row.status || String(row.status).toLowerCase() === 'ready'));
  if (!imageRows.length) return { images: 0, bytes: 0, sources: { objectStorage: 0, projectPublic: 0, approvedRemote: 0 } };

  const hosts = allowedRemoteImageHosts(process.env.DRIVE_JSON_IMAGE_FETCH_HOSTS || '');
  const projectRoot = process.cwd();
  const maxImageBytes = Number(process.env.DRIVE_JSON_MAX_IMAGE_BYTES || 25 * 1024 * 1024);
  if (!Number.isInteger(maxImageBytes) || maxImageBytes < 1024 || maxImageBytes > 250 * 1024 * 1024) {
    throw new Error('DRIVE_JSON_MAX_IMAGE_BYTES must be between 1 KiB and 250 MiB.');
  }

  const resolved = imageRows.map((row) => ({
    row,
    id: String(originalNumericValue(row.id, numericTokens) ?? row.id ?? 'unknown'),
    source: classifyImageSource(row, { allowedHosts: hosts, projectRoot }),
  }));
  const unresolved = resolved.filter(({ source }) => source.type === 'unresolved');
  if (unresolved.length) {
    const details = unresolved.slice(0, 12).map(({ row, id }) => `id=${id}, src=${String(row.src || '(empty)').slice(0, 180)}, storage_key=${String(row.storage_key || '(empty)').slice(0, 120)}`);
    const more = unresolved.length > details.length ? `\n…and ${unresolved.length - details.length} more row(s).` : '';
    throw new Error(
      `Cannot safely back up ${unresolved.length} ready image row(s) in media_items because their source cannot be resolved. `
      + `Expected a media/... object key, a project /photos or /images asset, or an HTTPS URL from an approved host. `
      + `Add a trusted host to DRIVE_JSON_IMAGE_FETCH_HOSTS or repair the media row's storage_key/src. `
      + `For genuinely keyless/stale image rows, first preview cleanup with \`npm run db:media:cleanup-unrecoverable\`, `
      + `then explicitly apply safe deletions with \`npm run db:media:cleanup-unrecoverable:apply\`.\n${details.join('\n')}${more}`,
    );
  }

  const objectStorageRows = resolved.filter(({ source }) => source.type === 'object-storage');
  let storageClient = null;
  if (objectStorageRows.length) {
    const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
    const region = process.env.AWS_REGION?.trim();
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
      throw new Error('Object-storage image rows exist. Set AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to embed those originals as Base64.');
    }
    const [{ S3Client }] = await Promise.all([import('@aws-sdk/client-s3')]);
    storageClient = new S3Client({
      region, endpoint, forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }

  let bytesTotal = 0;
  const sourceCounts = { objectStorage: 0, projectPublic: 0, approvedRemote: 0 };
  const inferImageType = (row, key, storedType) => {
    const declared = String(row.content_type || '').trim().toLowerCase();
    if (declared.startsWith('image/')) return declared;
    if (storedType?.toLowerCase().startsWith('image/')) return storedType.toLowerCase();
    const sourcePath = String(row.src || key || '');
    const extension = extname(sourcePath.split(/[?#]/, 1)[0]).slice(1).toLowerCase();
    return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml' })[extension] || '';
  };

  try {
    for (const item of resolved) {
      const { row, id, source } = item;
      let payload;
      let contentType = '';
      let storageKey = source.key || '';
      let sourceLabel = source.type;

      if (source.type === 'object-storage') {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const bucket = String(row.storage_bucket || process.env.NEON_OBJECT_STORAGE_BUCKET || 'uploads');
        if (!storageKey.startsWith('media/') || storageKey.startsWith('/') || storageKey.includes('..') || storageKey.includes('\\')) {
          throw new Error(`Unsafe media storage key in media_items row ${id}.`);
        }
        const result = await storageClient.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
        if (!result.Body) throw new Error(`Image object ${bucket}/${storageKey} for media_items row ${id} has no readable body.`);
        payload = Buffer.from(await result.Body.transformToByteArray());
        contentType = inferImageType(row, storageKey, result.ContentType);
        sourceCounts.objectStorage += 1;
      } else if (source.type === 'project-public') {
        try {
          const publicRoot = await realpath(resolve(projectRoot, 'public'));
          const realAssetPath = await realpath(source.path);
          const assetRelativePath = relative(publicRoot, realAssetPath);
          if (!assetRelativePath || assetRelativePath === '..' || assetRelativePath.startsWith(`..${sep}`) || assetRelativePath.startsWith(sep)) {
            throw new Error('Resolved public asset path escapes the project public directory.');
          }
          payload = await readFile(realAssetPath);
        } catch (error) {
          throw new Error(`Project public image for media_items row ${id} is missing or resolves outside /public: ${row.src}.`, { cause: error });
        }
        contentType = inferImageType(row, source.path, '');
        storageKey = createBackupStorageKey(id, row.src, contentType);
        row.backupStorageKey = storageKey;
        row.backupSourceType = 'project-public';
        sourceCounts.projectPublic += 1;
      } else {
        let fetched;
        try {
          fetched = await fetchApprovedRemoteImage(source.url.toString(), {
            allowedHosts: hosts,
            maxBytes: maxImageBytes,
          });
        } catch (error) {
          throw new Error(`Could not download approved remote image for media_items row ${id} (${source.url.hostname}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
        payload = fetched.data;
        contentType = inferImageType(row, source.url.pathname, fetched.contentType);
        storageKey = createBackupStorageKey(id, row.src, contentType);
        row.backupStorageKey = storageKey;
        row.backupSourceType = 'approved-remote';
        sourceCounts.approvedRemote += 1;
      }

      if (!payload?.byteLength) throw new Error(`Image payload for media_items row ${id} is empty.`);
      if (payload.byteLength > maxImageBytes) throw new Error(`Image payload for media_items row ${id} exceeds DRIVE_JSON_MAX_IMAGE_BYTES (${maxImageBytes}).`);
      const declared = Number(originalNumericValue(row.size_bytes, numericTokens) || 0);
      // Legacy seeded/remote assets may not have size_bytes metadata. A declared size,
      // however, must always match the bytes copied into the snapshot.
      if (declared > 0 && declared !== payload.byteLength) {
        throw new Error(`Image size mismatch for media_items row ${id}: database=${declared}, backup=${payload.byteLength}.`);
      }
      if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`Could not determine the image MIME type for media_items row ${id}.`);
      }

      row.backupEncoding = 'base64';
      row.backupContentType = contentType.toLowerCase();
      row.backupBase64 = payload.toString('base64');
      row.backupSha256 = createHash('sha256').update(payload).digest('hex');
      row.backupSizeBytes = payload.byteLength;
      row.backupSourceType = row.backupSourceType || sourceLabel;
      bytesTotal += payload.byteLength;
    }
  } finally {
    storageClient?.destroy();
  }
  return { images: imageRows.length, bytes: bytesTotal, sources: sourceCounts };
}

async function main() {
  await connectDatabase();
  try {
    if (listRequiredOnly) {
      const tables = await getTables({ includeHot: true });
      process.stdout.write(['backup-manifest.json', ...tables.map((table) => `${table}.json`)].join('\n') + '\n');
      return;
    }

    const folder = localOnly ? { name: 'local drive-data directory' } : await checkDriveJsonFolder();
    if (!localOnly) await refreshTriggers();

    const listing = localOnly ? { files: [] } : await listDriveJsonFiles();
    const allTables = await getTables({ includeHot: true });
    const revisions = localOnly ? new Map() : await getTableRevisions();
    const tables = localOnly || fullSnapshot
      ? allTables.map((table) => ({ table, revision: revisions.get(table) || 0 }))
      : await getPendingTables();

    if (!tables.length) {
      process.stdout.write(`No changed tables to mirror. Drive folder: ${folder.name}\n`);
      return;
    }

    if (!localOnly) {
      preflightExistingJsonFiles(listing, [...tables.map((item) => `${item.table}.json`), 'backup-manifest.json']);
    }

    const oldManifest = localOnly ? null : await readExistingDriveJson('backup-manifest.json', listing);
    const existingSnapshots = new Map(
      (Array.isArray(oldManifest?.snapshots) ? oldManifest.snapshots : [])
        .filter((snapshot) => snapshot && typeof snapshot.table === 'string' && allTables.includes(snapshot.table))
        .map((snapshot) => [snapshot.table, snapshot]),
    );

    const exportedAt = new Date().toISOString();
    const rowsByTable = await exportTablesSnapshot(tables);
    const outputDirectory = resolve(process.cwd(), 'drive-data');
    if (localOnly) await mkdir(outputDirectory, { recursive: true });

    const snapshots = [];
    for (const item of tables) {
      const exported = rowsByTable.get(item.table);
      if (!exported) throw new Error(`Table ${item.table} was not included in the consistent snapshot.`);
      const { rows, numericTokens, schema } = exported;
      const schemaSha256 = createHash('sha256').update(JSON.stringify(schema)).digest('hex');
      const revision = item.revision;
      const images = item.table === 'media_items' ? await addImagePayloads(rows, numericTokens) : { images: 0, bytes: 0 };
      const siteKey = (process.env.CMS_SITE_KEY || 'default').trim().slice(0, 120) || 'default';
      const document = {
        format: 'srizony-postgresql-table-v2',
        table: item.table,
        schemaVersion: 2,
        siteKey,
        siteSchemaVersion: 1,
        pipelineFormat: 'cms-data-pipeline-v1',
        schema,
        schemaSha256,
        exportedAt,
        revision,
        rowCount: rows.length,
        imageEncoding: item.table === 'media_items' ? 'base64' : undefined,
        rows,
      };
      const jsonText = stringifyPostgresJson(document, numericTokens);
      const jsonBytes = Buffer.byteLength(jsonText, 'utf8');
      if (jsonBytes > maxBytes) {
        throw new Error(`${item.table}.json is ${jsonBytes} bytes, exceeding DRIVE_JSON_MAX_FILE_BYTES=${maxBytes}. Split this table or raise the configured limit.`);
      }

      const contentSha256 = createHash('sha256').update(jsonText).digest('hex');
      const uploaded = localOnly
        ? { name: `${item.table}.json`, id: null, sizeBytes: jsonBytes, sha256: contentSha256 }
        : await writeExistingDriveJsonText(`${item.table}.json`, jsonText, listing);
      if (localOnly) await writeFile(resolve(outputDirectory, `${item.table}.json`), jsonText, 'utf8');

      const snapshotInfo = {
        table: item.table,
        file: uploaded.name,
        ...(uploaded.id ? { fileId: uploaded.id } : {}),
        rowCount: rows.length,
        sizeBytes: uploaded.sizeBytes,
        sha256: uploaded.sha256,
        schemaSha256,
        revision,
        imageCount: images.images,
        imageBytes: images.bytes,
        lastUpdated: exportedAt,
      };
      existingSnapshots.set(item.table, snapshotInfo);
      snapshots.push(snapshotInfo);
      process.stdout.write(`${localOnly ? 'Exported' : 'Mirrored'} ${item.table}: ${rows.length} rows, ${uploaded.sizeBytes} bytes, ${schema.columns.length} columns${images.images ? `, ${images.images} Base64 images (${images.sources.objectStorage} object-storage, ${images.sources.projectPublic} project assets, ${images.sources.approvedRemote} approved remote)` : ''}\n`);
    }

    const siteKey = (process.env.CMS_SITE_KEY || 'default').trim().slice(0, 120) || 'default';
    const manifest = {
      format: 'srizony-drive-database-manifest-v2',
      manifestVersion: 2,
      site: { key: siteKey, schemaVersion: 1, pipelineFormat: 'cms-data-pipeline-v1' },
      exportedAt,
      source: 'Neon PostgreSQL',
      folderName: folder.name,
      mode: fullSnapshot ? 'full' : 'incremental',
      schemaFormat: 'srizony-postgresql-table-schema-v1',
      images: 'ready image payloads are embedded as Base64 with SHA-256; sources include object storage, project public assets and explicitly allow-listed HTTPS image hosts. backupStorageKey is a snapshot-only key for project/remote images.',
      highChurnTables: [...excludedHotTables],
      changedTables: tables.map((item) => item.table),
      snapshots: [...existingSnapshots.values()].sort((a, b) => a.table.localeCompare(b.table)),
    };

    if (localOnly) {
      await writeFile(resolve(outputDirectory, 'backup-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      process.stdout.write(`Local Neon schema/data export completed: ${snapshots.length} table(s), directory=${outputDirectory}.\n`);
      return;
    }

    await writeExistingDriveJson('backup-manifest.json', manifest, listing);

    // Mark revisions complete only after all table files and the manifest are verified.
    // A partial Drive outage leaves the queue dirty so the next run safely retries.
    if (!fullSnapshot) {
      const values = tables.map((item) => `(${qLiteral(item.table)}, ${Math.trunc(item.revision)}::bigint)`).join(', ');
      await execute(
        `UPDATE public.drive_sync_state AS state SET synced_revision = pending.revision, last_synced_at = now() FROM (VALUES ${values}) AS pending(table_name, revision) WHERE state.table_name = pending.table_name AND state.revision = pending.revision;`,
        'Acknowledging mirrored table revisions',
      );
    } else {
      const values = tables
        .filter((item) => revisions.has(item.table))
        .map((item) => `(${qLiteral(item.table)}, ${Math.trunc(item.revision)}::bigint)`)
        .join(', ');
      if (values) {
        await execute(
          `UPDATE public.drive_sync_state AS state SET synced_revision = pending.revision, last_synced_at = now() FROM (VALUES ${values}) AS pending(table_name, revision) WHERE state.table_name = pending.table_name AND state.revision = pending.revision;`,
          'Acknowledging full snapshot revisions',
        );
      }
    }

    process.stdout.write(`Google Drive JSON mirror completed: ${snapshots.length} table(s), mode=${manifest.mode}, folder=${folder.name}\n`);
  } finally {
    await closeDatabase();
  }
}

main().catch(async (error) => {
  await closeDatabase();
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
