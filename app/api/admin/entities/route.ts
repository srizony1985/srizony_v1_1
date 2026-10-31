import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { db, withDbRetry } from '@/lib/db'

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
  return result.rows
}

export async function GET(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasAdminRole(admin, 'admin', 'analyst', 'editor')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!db) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })
  const url=new URL(req.url)
  const selected=url.searchParams.get('table')
  if(!selected){
    return NextResponse.json({ tables: TABLES.map(name=>({name})) })
  }
  const table=tableName(selected)
  if(!table) return NextResponse.json({error:'Unknown entity table.'},{status:400})
  try{
    const meta=await columns(table)
    const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||50),1),200)
    const offset=Math.max(Number(url.searchParams.get('offset')||0),0)
    const search=url.searchParams.get('search')?.trim()||''
    const textCols=meta.filter((x:any)=>['text','character varying','character'].includes(x.data_type)).map((x:any)=>x.column_name)
    const where=search&&textCols.length
      ? sql`WHERE ${sql.join(textCols.map((name:string)=>sql`CAST(${col(name)} AS TEXT) ILIKE ${`%${search}%`}`),sql` OR `)}`
      : sql``
    const result=await withDbRetry(()=>db!.execute(sql`SELECT * FROM ${tbl(table)} ${where} ORDER BY 1 DESC LIMIT ${limit} OFFSET ${offset}`))
    const count=await withDbRetry(()=>db!.execute(sql`SELECT COUNT(*)::int AS count FROM ${tbl(table)} ${where}`))
    return NextResponse.json({table,columns:meta,rows:result.rows,total:Number((count.rows[0] as any)?.count||0),limit,offset},{headers:{'Cache-Control':'no-store'}})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to read entity.'},{status:503})}
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
