#!/usr/bin/env node
/**
 * Restore validated JSON snapshots from local ./drive-data or the configured Drive folder.
 *
 * Safety model:
 * - Validate the whole manifest and all table files before the first DELETE/INSERT.
 * - Never execute DDL from snapshots.
 * - Refuse to replace nonempty tables unless --replace-existing is explicit.
 * - Restore only the manifest tables; unrelated migration-created data is untouched.
 * - Resolve reconstructed hero_slides media FKs using exact source URL mappings.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Pool } from '@neondatabase/serverless'
import { createHash } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { listDriveJsonFiles, readExistingDriveJson } from './lib/google-drive-json.mjs'
import { assertSnapshotRowRequiredColumns, validateSnapshotRelationshipTransforms } from './lib/restore-validation.mjs'
import { compareSnapshotColumnType } from './lib/schema-type-compat.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { loadEnvConfig } = require('@next/env')
loadEnvConfig(root)

const args = new Set(process.argv.slice(2))
const local = args.has('--local') || (process.env.NODE_ENV !== 'production' && !args.has('--drive'))
const replaceExisting = args.has('--replace-existing')
const databaseUrl = (process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '').trim()
if (!databaseUrl) throw new Error('DATABASE_URL or BACKUP_DATABASE_URL is required.')
if (args.has('--overwrite')) throw new Error('The old --overwrite option is no longer supported. Use --replace-existing only after taking a verified backup.')
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_JSON_RESTORE !== 'true') {
  throw new Error('Production database restore blocked. Set ALLOW_PRODUCTION_JSON_RESTORE=true only after taking and verifying a separate backup.')
}

let storageClient = null
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`
const safeName = (value) => typeof value === 'string' && /^[a-z_][a-z0-9_]*$/i.test(value)
const markerPattern = /^__SF_LOSSLESS_[A-Za-z0-9]+_\d+__$/
const digest = (value) => createHash('sha256').update(value).digest('hex')

function findLosslessMarker(value, location = '$') {
  if (typeof value === 'string') return markerPattern.test(value) ? location : null
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findLosslessMarker(value[index], `${location}[${index}]`)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const found = findLosslessMarker(item, `${location}.${key}`)
      if (found) return found
    }
  }
  return null
}

function orderByForeignKeys(tables, dependencies) {
  const ordered = []
  const remaining = new Set(tables)
  while (remaining.size) {
    const ready = [...remaining].filter((table) =>
      [...(dependencies.get(table) || [])].every((parent) => !remaining.has(parent) || parent === table),
    )
    if (!ready.length) {
      throw new Error(`Foreign-key dependency cycle detected among: ${[...remaining].join(', ')}. No rows were changed.`)
    }
    for (const table of ready.sort()) {
      ordered.push(table)
      remaining.delete(table)
    }
  }
  return ordered
}

async function loadSnapshot(table, snapshot, listing) {
  if (snapshot.file !== `${table}.json`) throw new Error(`Unsafe or unexpected snapshot filename for ${table}.`)
  let raw = null
  let doc
  if (local) {
    raw = await readFile(path.join(root, 'drive-data', snapshot.file))
    if (snapshot.sha256 && digest(raw) !== String(snapshot.sha256).toLowerCase()) {
      throw new Error(`SHA-256 mismatch for ${snapshot.file}. The file may be incomplete or modified.`)
    }
    try {
      doc = JSON.parse(raw.toString('utf8'))
    } catch (error) {
      throw new Error(`Invalid JSON in ${snapshot.file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  } else {
    doc = await readExistingDriveJson(snapshot.file, listing)
  }

  if (!doc || doc.table !== table || !Array.isArray(doc.rows) || !['srizony-postgresql-table-v1', 'srizony-postgresql-table-v2'].includes(doc.format)) {
    throw new Error(`Invalid snapshot document for ${table}.`)
  }
  if (doc.siteKey && doc.siteKey !== (process.env.CMS_SITE_KEY || 'default').trim()) {
    throw new Error(`Table ${table} belongs to site "${doc.siteKey}", not the configured site.`)
  }
  if (Number.isInteger(doc.rowCount) && doc.rowCount !== doc.rows.length) {
    throw new Error(`Row count mismatch in ${table}.json: declared ${doc.rowCount}, actual ${doc.rows.length}.`)
  }
  if (Number.isInteger(snapshot.rowCount) && snapshot.rowCount !== doc.rows.length) {
    throw new Error(`Manifest row count mismatch in ${table}.json.`)
  }
  if (!doc.schema || typeof doc.schema !== 'object') throw new Error(`Snapshot ${table}.json has no schema description.`)
  const schemaDigest = digest(JSON.stringify(doc.schema))
  if (!doc.schemaSha256 || schemaDigest !== String(doc.schemaSha256).toLowerCase()) {
    throw new Error(`Schema SHA-256 mismatch inside ${table}.json.`)
  }
  if (snapshot.schemaSha256 && schemaDigest !== String(snapshot.schemaSha256).toLowerCase()) {
    throw new Error(`Schema SHA-256 mismatch between manifest and ${table}.json.`)
  }
  const markerLocation = findLosslessMarker(doc.rows)
  if (markerLocation) throw new Error(`Unresolved lossless numeric placeholder in ${table}.json at ${markerLocation}. Do not import corrupted numeric values.`)
  return { doc, raw }
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 })
try {
  const listing = local ? null : await listDriveJsonFiles()
  const manifest = local ? JSON.parse(await readFile(path.join(root, 'drive-data', 'backup-manifest.json'), 'utf8')) : await readExistingDriveJson('backup-manifest.json', listing)
  if (!['srizony-drive-database-manifest-v2', 'srizony-drive-database-manifest-v1'].includes(manifest?.format)) {
    throw new Error('Unsupported or missing Drive JSON manifest.')
  }
  const siteKey = (process.env.CMS_SITE_KEY || 'default').trim()
  if (manifest.site?.key && manifest.site.key !== siteKey) {
    throw new Error(`Snapshot belongs to site "${manifest.site.key}", not configured site "${siteKey}".`)
  }
  const snapshots = Array.isArray(manifest.snapshots) ? manifest.snapshots : []
  if (!snapshots.length) throw new Error('Manifest contains no table snapshots.')
  const tableNames = snapshots.map((snapshot) => snapshot.table)
  if (new Set(tableNames).size !== tableNames.length) throw new Error('Manifest contains duplicate table entries.')
  if (tableNames.some((table) => !safeName(table))) throw new Error('Manifest contains an unsafe table name.')

  // Preload and validate every snapshot before connecting to a write transaction.
  const snapshotData = new Map()
  for (const snapshot of snapshots) {
    snapshotData.set(snapshot.table, await loadSnapshot(snapshot.table, snapshot, listing))
  }
  // Validate reconstructed foreign keys before opening the write transaction.
  validateSnapshotRelationshipTransforms(snapshotData)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SET CONSTRAINTS ALL DEFERRED')

    const siteResult = await client.query('SELECT id FROM public.cms_sites WHERE site_key = $1 LIMIT 1', [siteKey])
    if (!siteResult.rows.length) throw new Error(`Configured CMS site \"${siteKey}\" does not exist in cms_sites.`)
    const configuredSiteId = siteResult.rows[0].id

    const existingResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `)
    const existing = new Set(existingResult.rows.map((row) => row.table_name))
    const missing = tableNames.filter((table) => !existing.has(table))
    if (missing.length) throw new Error(`Snapshot tables are absent from the current migrated schema: ${missing.join(', ')}. Apply migrations first.`)

    const fkResult = await client.query(`
      SELECT tc.table_name AS child, ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.constraint_schema = tc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_schema = 'public'
    `)
    const dependencies = new Map()
    for (const { child, parent } of fkResult.rows) {
      if (!dependencies.has(child)) dependencies.set(child, new Set())
      dependencies.get(child).add(parent)
    }
    const ordered = orderByForeignKeys(tableNames, dependencies)

    const tableMetadata = new Map()
    for (const table of ordered) {
      const columns = await client.query(`
        SELECT column_name, data_type, character_maximum_length,
               is_nullable, column_default, is_identity, is_generated
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, [table])
      const metadata = new Map(columns.rows.map((column) => [column.column_name, column]))
      const allowed = new Set(metadata.keys())
      const doc = snapshotData.get(table).doc
      const declaredColumns = Array.isArray(doc.schema.columns)
        ? doc.schema.columns.map((column) => column?.name).filter((name) => typeof name === 'string')
        : []
      if (doc.schema.tableName !== table || !declaredColumns.length || new Set(declaredColumns).size !== declaredColumns.length) {
        throw new Error(`Snapshot ${table}.json has invalid target-schema metadata.`)
      }
      const declaredSet = new Set(declaredColumns)
      const missingFromSnapshotSchema = [...allowed].filter((column) => !declaredSet.has(column))
      const missingFromDatabase = declaredColumns.filter((column) => !allowed.has(column))
      if (missingFromSnapshotSchema.length || missingFromDatabase.length) {
        throw new Error(`Schema drift for ${table}: missing from snapshot schema [${missingFromSnapshotSchema.join(', ')}], missing from database [${missingFromDatabase.join(', ')}]. No rows were changed.`)
      }
      for (const declared of doc.schema.columns) {
        const actual = metadata.get(declared.name)
        const typeCompatibility = compareSnapshotColumnType(
          declared.dataType,
          actual?.data_type,
          actual?.character_maximum_length,
        )
        if (!actual || !typeCompatibility.compatible) {
          if (typeCompatibility.kind === 'length') {
            throw new Error(`Column length drift for ${table}.${declared.name}: snapshot has ${typeCompatibility.declaredLength}, database has ${actual?.character_maximum_length}.`)
          }
          throw new Error(`Column type drift for ${table}.${declared.name}: snapshot has ${declared.dataType}, database has ${actual?.data_type || 'missing'}.`)
        }
        if (typeCompatibility.kind === 'safe-widening') {
          console.warn(`[restore] Safe schema widening accepted for ${table}.${declared.name}: ${declared.dataType} -> text.`)
        }
        if (Boolean(declared.nullable) !== (actual.is_nullable === 'YES')) {
          throw new Error(`Nullability drift for ${table}.${declared.name}: snapshot nullable=${Boolean(declared.nullable)}, database nullable=${actual.is_nullable === 'YES'}.`)
        }
      }
      for (let rowIndex = 0; rowIndex < doc.rows.length; rowIndex += 1) {
        const row = doc.rows[rowIndex]
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${table}.json row ${rowIndex + 1} is not an object.`)
        const keys = Object.keys(row)
        const unknown = keys.filter((key) => !allowed.has(key) && !(table === 'hero_slides' && key === '_restore_image_src'))
        if (unknown.length) throw new Error(`${table}.json row ${rowIndex + 1} contains unknown database columns: ${unknown.join(', ')}.`)
        assertSnapshotRowRequiredColumns(table, row, rowIndex, metadata)
      }
      tableMetadata.set(table, metadata)
    }

    // Protect existing rows by default. Only manifest-listed tables are considered.
    const rowCounts = new Map()
    for (const table of ordered) {
      const count = await client.query(`SELECT count(*)::bigint AS count FROM public.${quote(table)}`)
      const rowCount = Number(count.rows[0].count)
      rowCounts.set(table, rowCount)
      if (rowCount > 0 && !replaceExisting) {
        throw new Error(`Target table ${table} already contains ${rowCount} rows. No data was changed. Take a backup, inspect it, then rerun with --replace-existing only if replacement is intended.`)
      }
    }

    if (replaceExisting) {
      for (const table of [...ordered].reverse()) {
        await client.query(`DELETE FROM public.${quote(table)}`)
      }
    }

    const mediaIdBySrc = new Map()
    for (const table of ordered) {
      const { doc } = snapshotData.get(table)
      for (let index = 0; index < doc.rows.length; index += 1) {
        const restoredRow = { ...doc.rows[index] }
        if (Object.hasOwn(restoredRow, 'site_id')) restoredRow.site_id = configuredSiteId

        if (table === 'hero_slides') {
          const source = String(restoredRow._restore_image_src || '')
          const mediaId = mediaIdBySrc.get(source)
          if (!source || !mediaId) throw new Error(`Cannot rebuild hero slide media reference for ${restoredRow.id || `row ${index + 1}`}. No matching restored media_items.src was found.`)
          restoredRow.image_id = mediaId
          delete restoredRow._restore_image_src
        }

        if (table === 'media_items' && restoredRow.backupEncoding === 'base64') {
          const base64 = String(restoredRow.backupBase64 || '')
          const bytes = Buffer.from(base64, 'base64')
          const expected = String(restoredRow.backupSha256 || '').toLowerCase()
          const actual = digest(bytes)
          if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '') || !/^[a-f0-9]{64}$/.test(expected) || actual !== expected || Number(restoredRow.backupSizeBytes) !== bytes.length) {
            throw new Error(`Image payload integrity check failed for media_items row ${index + 1}.`)
          }
          const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim()
          const region = process.env.AWS_REGION?.trim()
          const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim()
          const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim()
          if (!endpoint || !region || !accessKeyId || !secretAccessKey) throw new Error('Base64 media restore requires AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
          if (!storageClient) storageClient = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey }, requestChecksumCalculation: 'WHEN_REQUIRED' })
          const bucket = String(restoredRow.storage_bucket || (restoredRow.is_public ? process.env.NEON_PUBLIC_ASSETS_BUCKET || 'public-assets' : process.env.NEON_OBJECT_STORAGE_BUCKET || 'uploads'))
          const key = String(restoredRow.storage_key || restoredRow.backupStorageKey || '')
          if (!/^media\/[A-Za-z0-9._/-]+$/.test(key) || key.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe or missing media storage key for media_items row ${index + 1}.`)
          await storageClient.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: String(restoredRow.backupContentType || restoredRow.content_type || 'application/octet-stream'), CacheControl: 'private, max-age=300' }))
          restoredRow.storage_key = key
          restoredRow.storage_bucket = bucket
          restoredRow.size_bytes = bytes.length
        }

        for (const key of Object.keys(restoredRow)) if (key.startsWith('backup')) delete restoredRow[key]
        const keys = Object.keys(restoredRow)
        if (!keys.length || keys.some((key) => !tableMetadata.get(table).has(key))) throw new Error(`Snapshot ${table}.json contains unknown columns.`)
        const values = keys.map((key) => restoredRow[key])
        const placeholders = values.map((_, valueIndex) => `$${valueIndex + 1}`).join(',')
        const columns = keys.map(quote).join(',')
        const insert = await client.query(
          `INSERT INTO public.${quote(table)} (${columns}) VALUES (${placeholders})${table === 'media_items' ? ' RETURNING id, src' : ''}`,
          values,
        )
        if (table === 'media_items') {
          const inserted = insert.rows[0]
          if (!inserted?.src || inserted.id === undefined || mediaIdBySrc.has(inserted.src)) {
            throw new Error(`Media URL mapping is missing or duplicated for ${inserted?.src || `row ${index + 1}`}.`)
          }
          mediaIdBySrc.set(inserted.src, inserted.id)
        }
      }

      // Advance serial/identity sequences when explicit IDs were imported.
      const serials = await client.query(`
        SELECT column_name,
               pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS sequence_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
          AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')
      `, [table])
      for (const serial of serials.rows) {
        if (!serial.sequence_name) continue
        await client.query(
          `SELECT setval($1::regclass, COALESCE((SELECT MAX(${quote(serial.column_name)}) FROM public.${quote(table)}), 1), EXISTS (SELECT 1 FROM public.${quote(table)}))`,
          [serial.sequence_name],
        )
      }
      console.log(`Restored ${table}: ${doc.rows.length} rows`)
    }

    await client.query('COMMIT')
    console.log(`JSON restore completed from ${local ? 'local ./drive-data' : 'Google Drive'} (${ordered.length} tables, ${ordered.reduce((sum, table) => sum + snapshotData.get(table).doc.rows.length, 0)} rows).`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} finally {
  await pool.end()
  if (storageClient) await storageClient.destroy()
}
