import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db, withDbRetry } from '@/lib/db'
import { requireAdmin, failure } from '@/lib/cms/guard'
import { auditAdminAction } from '@/lib/security'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uiContentSchema = z.object({
  key: z.string().trim().min(2).max(128).regex(/^[a-z][a-z0-9_.-]+$/i),
  valueEn: z.string().max(8000),
  valueBn: z.string().max(8000),
})

export async function GET() {
  const guard = await requireAdmin('admin', 'editor', 'analyst')
  if (guard.denied) return guard.denied
  const database = db
  if (!database) return NextResponse.json({ error: 'Neon is not configured. UI content is read-only while the primary database is unavailable.' }, { status: 503 })
  try {
    const result = await withDbRetry(() => database.execute(sql`
      SELECT key, value_en AS "valueEn", value_bn AS "valueBn", updated_at AS "updatedAt"
      FROM ui_content ORDER BY key ASC
    `))
    return NextResponse.json({ items: result.rows, readOnly: false }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to load bilingual UI content.') }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const database = db
  if (!database) return NextResponse.json({ error: 'Neon is unavailable. UI content cannot be changed in the read-only Drive fallback.' }, { status: 503 })
  const parsed = uiContentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid UI key and English/Bangla values.' }, { status: 400 })
  const { key, valueEn, valueBn } = parsed.data
  try {
    await withDbRetry(() => database.execute(sql`
      INSERT INTO ui_content (key, value_en, value_bn, updated_at)
      VALUES (${key}, ${valueEn}, ${valueBn}, now())
      ON CONFLICT (key) DO UPDATE SET
        value_en = EXCLUDED.value_en,
        value_bn = EXCLUDED.value_bn,
        updated_at = now()
    `))
    revalidateTag('site-content', { expire: 0 })
    revalidatePath('/', 'layout')
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'ui_content.update', entity: 'ui_content', entityId: key, metadata: { englishLength: valueEn.length, banglaLength: valueBn.length }, request })
    return NextResponse.json({ ok: true, key }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to save UI content.') }
}
