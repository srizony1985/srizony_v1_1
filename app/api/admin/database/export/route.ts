import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db, withDbRetry } from '@/lib/db'
import { requireAdmin, failure } from '@/lib/cms/guard'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { CMS_TRANSFER_FORMAT, CMS_TRANSFER_MAX_BYTES, CMS_TRANSFER_MAX_ROWS_PER_TABLE, CMS_TRANSFER_TABLES, CMS_TRANSFER_VERSION } from '@/lib/cms/dataTransfer'
import { auditAdminAction } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const guard = await requireAdmin('admin')
  if (guard.denied) return guard.denied
  const database = db
  if (database === null) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 })
  try {
    await ensureCmsSchema()
    const existing = await withDbRetry(() => database.execute(sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`))
    const existingNames = new Set((existing.rows as Array<{ table_name: string }>).map((row) => row.table_name))
    const data: Record<string, unknown[]> = {}
    const counts: Record<string, number> = {}
    for (const table of CMS_TRANSFER_TABLES) {
      if (!existingNames.has(table)) continue
      // site_settings also contains non-content operational keys (for example
      // demo-preview backups). Export only the explicitly named CMS documents.
      const query = table === 'site_settings'
        ? sql`SELECT key, value, updated_at FROM site_settings WHERE key LIKE 'cms-document:%' ORDER BY key LIMIT ${CMS_TRANSFER_MAX_ROWS_PER_TABLE + 1}`
        : sql.raw(`SELECT * FROM "${table}" LIMIT ${CMS_TRANSFER_MAX_ROWS_PER_TABLE + 1}`)
      const result = await withDbRetry(() => database.execute(query))
      if (result.rows.length > CMS_TRANSFER_MAX_ROWS_PER_TABLE) {
        return NextResponse.json({ error: `The table ${table} exceeds the export row limit. Export it through a dedicated backup process.` }, { status: 413 })
      }
      data[table] = result.rows as unknown[]
      counts[table] = result.rows.length
    }
    const payload = {
      format: CMS_TRANSFER_FORMAT,
      version: CMS_TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      mode: 'merge-upsert',
      includedTables: Object.keys(data),
      data,
    }
    const body = JSON.stringify(payload, (_key, value) => typeof value === 'bigint' ? value.toString() : value)
    if (new TextEncoder().encode(body).byteLength > CMS_TRANSFER_MAX_BYTES) return NextResponse.json({ error: 'The editable CMS export exceeds 20 MB. Reduce the media or content dataset and export again.' }, { status: 413 })
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'database.cms_export', entity: 'cms_site_data', metadata: { tables: Object.keys(data).length, records: Object.values(counts).reduce((total, count) => total + count, 0) }, request: req })
    return new Response(body, { status: 200, headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="srizony-cms-site-data-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    } })
  } catch (error) { return failure(error, 'Unable to export CMS site data.') }
}
