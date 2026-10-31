import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { sql } from 'drizzle-orm'
import { db, withDbRetry } from '@/lib/db'
import { requireAdmin, failure } from '@/lib/cms/guard'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { CMS_TRANSFER_FORMAT, CMS_TRANSFER_MAX_BYTES, CMS_TRANSFER_MAX_ROWS_PER_TABLE, CMS_TRANSFER_TABLES, CMS_TRANSFER_VERSION, quoteIdentifier } from '@/lib/cms/dataTransfer'
import { auditAdminAction } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

export async function POST(req: Request) {
  const guard = await requireAdmin('admin')
  if (guard.denied) return guard.denied
  const database = db
  if (database === null) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  const raw = await req.text()
  if (new TextEncoder().encode(raw).byteLength > CMS_TRANSFER_MAX_BYTES) return NextResponse.json({ error: 'JSON file exceeds the 20 MB import limit.' }, { status: 413 })
  let payload: any
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'The selected file is not valid JSON.' }, { status: 400 }) }
  if (!isPlainObject(payload) || payload.format !== CMS_TRANSFER_FORMAT || payload.version !== CMS_TRANSFER_VERSION || !isPlainObject(payload.data)) {
    return NextResponse.json({ error: 'Unsupported file. Select an Srizony CMS site-data JSON export (format version 1).' }, { status: 400 })
  }
  const allowed = new Set<string>(CMS_TRANSFER_TABLES)
  const requestedTables = Object.keys(payload.data)
  const unsupported = requestedTables.filter((table) => !allowed.has(table))
  if (unsupported.length) return NextResponse.json({ error: `The file contains unsupported tables: ${unsupported.join(', ')}.` }, { status: 400 })
  for (const table of requestedTables) {
    const rows = payload.data[table]
    if (!Array.isArray(rows) || rows.length > CMS_TRANSFER_MAX_ROWS_PER_TABLE || !rows.every(isPlainObject)) {
      return NextResponse.json({ error: `The ${table} dataset must be an array of no more than ${CMS_TRANSFER_MAX_ROWS_PER_TABLE} records.` }, { status: 400 })
    }
    if (table === 'site_settings' && rows.some((row: Record<string, unknown>) => typeof row.key !== 'string' || !/^cms-document:[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(row.key))) {
      return NextResponse.json({ error: 'Only named cms-document JSON records may be imported from site_settings. Operational and demo-backup keys are excluded.' }, { status: 400 })
    }
  }

  try {
    await ensureCmsSchema()

    // Preflight every table, column and primary key before making the first write.
    // This prevents malformed or incompatible files from partially applying simply
    // because an error was discovered late in the import order.
    const tablePlans = new Map<string, {
      rows: Array<Record<string, unknown>>
      columns: Map<string, { column_name: string; data_type: string; udt_name: string; column_default: string | null; is_identity: string }>
      primaryKeys: string[]
      identityPrimaryKey: boolean
      groups: Map<string, { keys: string[]; rows: Array<Record<string, unknown>>; hasPrimaryKey: boolean }>
    }>()

    for (const table of CMS_TRANSFER_TABLES) {
      const rows = payload.data[table] as Array<Record<string, unknown>> | undefined
      if (!rows?.length) {
        if (rows) tablePlans.set(table, { rows, columns: new Map(), primaryKeys: [], identityPrimaryKey: false, groups: new Map() })
        continue
      }

      const columnsResult = await withDbRetry(() => database.execute(sql`
        SELECT column_name, data_type, udt_name, column_default, is_identity
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table}
        ORDER BY ordinal_position`))
      const columns = new Map((columnsResult.rows as Array<{ column_name: string; data_type: string; udt_name: string; column_default: string | null; is_identity: string }>).map((column) => [column.column_name, column]))
      if (!columns.size) return NextResponse.json({ error: `The destination database does not contain the table ${table}. Run database migrations before importing.` }, { status: 409 })

      const pkResult = await withDbRetry(() => database.execute(sql`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name
        WHERE tc.table_schema = 'public' AND tc.table_name = ${table} AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position`))
      const primaryKeys = (pkResult.rows as Array<{ column_name: string }>).map((row) => row.column_name)
      if (!primaryKeys.length) return NextResponse.json({ error: `The destination table ${table} has no primary key; the import was stopped before writing any records.` }, { status: 409 })

      const groups = new Map<string, { keys: string[]; rows: Array<Record<string, unknown>>; hasPrimaryKey: boolean }>()
      const seenKeys = new Set<string>()
      const identityPrimaryKey = primaryKeys.length === 1 && columns.get(primaryKeys[0])?.is_identity === 'YES'
      const generatedPrimaryKey = primaryKeys.length === 1 && (identityPrimaryKey || /nextval\s*\(/i.test(String(columns.get(primaryKeys[0])?.column_default || '')))
      for (const row of rows) {
        const unknownColumns = Object.keys(row).filter((key) => !columns.has(key))
        if (unknownColumns.length) return NextResponse.json({ error: `The ${table} record contains unknown column(s): ${unknownColumns.join(', ')}. Check the export version and destination schema.` }, { status: 400 })
        const hasPrimaryKey = primaryKeys.every((key) => Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== '')
        if (!hasPrimaryKey && !generatedPrimaryKey) {
          return NextResponse.json({ error: `A record in ${table} is missing its primary key (${primaryKeys.join(', ')}), and the table cannot generate one automatically.` }, { status: 400 })
        }
        if (hasPrimaryKey) {
          const identity = JSON.stringify(primaryKeys.map((key) => row[key]))
          if (seenKeys.has(identity)) return NextResponse.json({ error: `The ${table} dataset contains duplicate primary key ${identity}. Remove duplicate rows before importing.` }, { status: 400 })
          seenKeys.add(identity)
        }
        const keys = Object.keys(row).filter((key) => !(primaryKeys.includes(key) && (row[key] === null || row[key] === undefined || row[key] === '')))
        if (!keys.length) return NextResponse.json({ error: `A record in ${table} has no importable values.` }, { status: 400 })
        const groupKey = JSON.stringify([keys, hasPrimaryKey])
        const group = groups.get(groupKey) ?? { keys, rows: [], hasPrimaryKey }
        group.rows.push(row)
        groups.set(groupKey, group)
      }
      tablePlans.set(table, { rows, columns, primaryKeys, identityPrimaryKey, groups })
    }

    const imported: Record<string, number> = {}
    // Import parents before children. Existing records are updated by primary key;
    // records absent from the file are deliberately left untouched.
    for (const table of CMS_TRANSFER_TABLES) {
      const plan = tablePlans.get(table)
      if (!plan) continue
      if (!plan.rows.length) { imported[table] = 0; continue }
      const quotedTable = quoteIdentifier(table)
      const pkSet = new Set(plan.primaryKeys)
      let count = 0

      for (const group of plan.groups.values()) {
        const { keys, rows } = group
        const quotedColumns = keys.map(quoteIdentifier).join(', ')
        const conflictSql = plan.primaryKeys.map(quoteIdentifier).join(', ')
        const updates = keys.filter((key) => !pkSet.has(key))
        const updateSql = updates.length
          ? sql`DO UPDATE SET ${sql.join(updates.map((key) => sql`${sql.raw(quoteIdentifier(key))} = EXCLUDED.${sql.raw(quoteIdentifier(key))}`), sql`, `)}`
          : sql`DO NOTHING`

        // Batch records with an identical column set to avoid one database round-trip
        // per row while still allowing hand-edited JSON to omit optional columns.
        for (let offset = 0; offset < rows.length; offset += 100) {
          const chunk = rows.slice(offset, offset + 100)
          const tuples = chunk.map((row) => sql`(${sql.join(keys.map((key) => {
            const info = plan.columns.get(key)!
            const value = row[key]
            return info.data_type === 'json' || info.data_type === 'jsonb'
              ? sql`${JSON.stringify(value ?? null)}::${sql.raw(info.data_type)}`
              : sql`${value === undefined ? null : value}`
          }), sql`, `)})`)
          const valuesSql = sql.join(tuples, sql`, `)
          const identityOverride = group.hasPrimaryKey && plan.identityPrimaryKey ? sql`OVERRIDING SYSTEM VALUE` : sql``
          const query = group.hasPrimaryKey
            ? sql`INSERT INTO ${sql.raw(quotedTable)} (${sql.raw(quotedColumns)}) ${identityOverride} VALUES ${valuesSql} ON CONFLICT (${sql.raw(conflictSql)}) ${updateSql}`
            : sql`INSERT INTO ${sql.raw(quotedTable)} (${sql.raw(quotedColumns)}) VALUES ${valuesSql}`
          await withDbRetry(() => database.execute(query))
          count += chunk.length
        }
      }
      imported[table] = count
    }

    // Keep serial/identity counters above imported IDs. Discover sequences from
    // the destination schema rather than maintaining a second hand-written list.
    for (const table of Object.keys(imported)) {
      if (!imported[table]) continue
      const idColumn = await withDbRetry(() => database.execute(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ${table} AND column_name = 'id' LIMIT 1`))
      if (!idColumn.rows.length) continue
      const qualifiedTable = quoteIdentifier(table)
      const relationName = `public.${table}`
      await withDbRetry(() => database.execute(sql`
        SELECT CASE
          WHEN pg_get_serial_sequence(${relationName}, 'id') IS NOT NULL THEN
            setval(
              pg_get_serial_sequence(${relationName}, 'id'),
              GREATEST(COALESCE((SELECT MAX(id)::bigint FROM ${sql.raw(qualifiedTable)}), 1), 1),
              EXISTS(SELECT 1 FROM ${sql.raw(qualifiedTable)})
            )
          ELSE NULL
        END`))
    }

    // Make updated pages and content visible without waiting for the regular cache TTL.
    revalidatePath('/', 'layout')
    revalidateTag('site-content', 'max')

    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'database.cms_import', entity: 'cms_site_data', metadata: { sourceVersion: payload.version, tables: Object.keys(imported).length, records: Object.values(imported).reduce((total, count) => total + count, 0) }, request: req })
    return NextResponse.json({ ok: true, imported, mode: 'merge-upsert', message: 'CMS site data imported. Records absent from this file were not deleted.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to import CMS site data.') }
}
