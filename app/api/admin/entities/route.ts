import type { DatabaseColumnMetadata, DatabaseCountRow } from '@/types/database'
import type { JsonObject } from '@/types/json'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'

const TABLES = [
  'media_items','pages','sections','rich_text_sections','stats_sections','stat_items',
  'cards_sections','card_items','gallery_sections','gallery_items','timeline_sections','timeline_items',
  'diagram_sections','table_sections','table_section_headers','table_section_rows','table_section_cells',
  'video_sections','cta_sections','notice_list_sections','notice_items','contact_sections','contact_locations',
  'donation_sections','carousel_sections','carousel_items','hero_data','hero_slides','hero_stats',
  'nav_groups','nav_items','content_entries','content_entry_bodies','content_entry_tags','content_entry_related',
  'content_entry_gallery','content_entry_video','ui_content','site_global_state','contact_info','contact_phones',
  'contact_socials','contact_footprint','sdg_steps','payment_info',
  'site_visitors','visitor_events','form_users','enquiry_daily_limits','submissions','cookie_consents',
  'donations','site_settings',
] as const
type TableName = typeof TABLES[number]

function tableName(value: string | null): TableName | null {
  return value && (TABLES as readonly string[]).includes(value) ? value as TableName : null
}
function col(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('Invalid column.')
  return sql.raw(`"${value.replaceAll('"','""')}"`)
}
function tbl(value: string) {
  if (!tableName(value)) throw new Error('Invalid table.')
  return sql.raw(`"${value}"`)
}

async function columns(table: TableName) {
  const result = await withDbRetry(() => db!.execute(sql`
    SELECT c.column_name, c.data_type, c.udt_name, c.is_nullable, c.column_default,
           EXISTS (
             SELECT 1 FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name
               AND kcu.table_schema=tc.table_schema
             WHERE tc.table_schema='public' AND tc.table_name=${table}
               AND tc.constraint_type='PRIMARY KEY' AND kcu.column_name=c.column_name
           ) AS is_primary_key,
           (
             SELECT json_build_object('table', ccu.table_name, 'column', ccu.column_name)
             FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
             JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
             WHERE tc.table_schema='public' AND tc.table_name=${table} AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name=c.column_name
             LIMIT 1
           ) AS foreign_key
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=${table}
    ORDER BY c.ordinal_position
  `))
  return result.rows as DatabaseColumnMetadata[]
}

function inferSnapshotColumnType(values: Array<JsonObject[string] | undefined>): string {
  const present = values.filter((value) => value !== undefined && value !== null)
  if (!present.length) return 'unknown'
  if (present.every((value) => typeof value === 'boolean')) return 'boolean'
  if (present.every((value) => typeof value === 'number')) return 'numeric'
  if (present.every((value) => typeof value === 'object')) return 'jsonb'
  if (present.every((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))) return 'timestamp with time zone'
  return 'text'
}

async function readEntityFromDrive(table: TableName, requestUrl: URL) {
  const snapshot = await readDriveTableSnapshotInfo(table)
  if (!snapshot) return NextResponse.json({ error: `No verified Google Drive snapshot is available for ${table}.`, dataSource: 'unavailable' }, { status: 503 })
  const limit = Math.min(Math.max(Number(requestUrl.searchParams.get('limit') || 50), 1), 200)
  const offset = Math.max(Number(requestUrl.searchParams.get('offset') || 0), 0)
  const search = requestUrl.searchParams.get('search')?.trim().toLowerCase() || ''
  const filtered = search
    ? snapshot.rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search))
    : snapshot.rows
  const first = filtered[0] ?? snapshot.rows[0] ?? {}
  const columnNames = Array.from(new Set(filtered.flatMap((row) => Object.keys(row))))
  const columns: DatabaseColumnMetadata[] = columnNames.map((columnName) => {
    const values = filtered.slice(0, 100).map((row) => row[columnName])
    const dataType = inferSnapshotColumnType(values)
    return {
      column_name: columnName,
      data_type: dataType,
      udt_name: dataType === 'timestamp with time zone' ? 'timestamptz' : dataType,
      is_nullable: values.some((value) => value === null || value === undefined) ? 'YES' : 'NO',
      column_default: null,
      is_primary_key: columnName === 'id',
      foreign_key: null,
    }
  })
  const sortKey = Object.prototype.hasOwnProperty.call(first, 'id') ? 'id' : columnNames[0]
  const sorted = [...filtered].sort((left, right) => {
    const a = sortKey ? left[sortKey] : ''
    const b = sortKey ? right[sortKey] : ''
    if (typeof a === 'number' && typeof b === 'number') return b - a
    return String(b ?? '').localeCompare(String(a ?? ''))
  })
  return NextResponse.json({
    table,
    columns,
    rows: sorted.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
    dataSource: 'google-drive-snapshot',
    readOnly: true,
    metadataSource: 'inferred-from-json-snapshot',
    snapshotAt: snapshot.exportedAt,
    snapshotAgeMs: snapshot.ageMs,
  }, { headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': snapshot.exportedAt, Warning: '110 - \"Response is stale\"' } })
}

export async function GET(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasAdminRole(admin, 'admin', 'analyst', 'editor')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url=new URL(req.url)
  const selected=url.searchParams.get('table')
  if(!selected){
    return NextResponse.json({ tables: TABLES.map(name=>({name})), dataSource: db ? 'neon' : 'google-drive-snapshot', readOnly: !db })
  }
  const table=tableName(selected)
  if(!table) return NextResponse.json({error:'Unknown entity table.'},{status:400})
  if (!db) return readEntityFromDrive(table, url)
  try{
    const meta=await columns(table)
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||50),1),200)
    const offset=Math.max(Number(url.searchParams.get('offset')||0),0)
    const search=url.searchParams.get('search')?.trim()||''
    const textCols = meta.filter((column) => ['text', 'character varying', 'character'].includes(column.data_type)).map((column) => column.column_name)
    const where=search&&textCols.length
      ? sql`WHERE ${sql.join(textCols.map((name:string)=>sql`CAST(${col(name)} AS TEXT) ILIKE ${`%${search}%`}`),sql` OR `)}`
      : sql``
    const result=await withDbRetry(()=>db!.execute(sql`SELECT * FROM ${tbl(table)} ${where} ORDER BY 1 DESC LIMIT ${limit} OFFSET ${offset}`))
    const count=await withDbRetry(()=>db!.execute(sql`SELECT COUNT(*)::int AS count FROM ${tbl(table)} ${where}`))
    return NextResponse.json({table,columns:meta,rows:result.rows,total: Number((count.rows[0] as DatabaseCountRow | undefined)?.count || 0),limit,offset},{headers:{'Cache-Control':'no-store'}})
  }catch(error){
    if (isTransientDatabaseError(error)) return readEntityFromDrive(table, url)
    return NextResponse.json({error:error instanceof Error?error.message:'Unable to read entity.'},{status:503})
  }
}

export async function POST(req: Request) {
  return mutationDisabled(req)
}

export async function PATCH(req: Request) {
  return mutationDisabled(req)
}

export async function DELETE(req: Request) {
  return mutationDisabled(req)
}

async function mutationDisabled(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  return NextResponse.json({
    ok: false,
    error: {
      code: 'RAW_ENTITY_MUTATION_DISABLED',
      message: 'Raw entity mutations are disabled. Use the validated CMS editor or dedicated report/action endpoint.',
    },
  }, { status: 403 })
}
