import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/cms/guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireAdmin('admin')
  if (access.denied) return access.denied
  return NextResponse.json({ selected: 'neon', providers: [{ id: 'neon', label: 'Neon PostgreSQL', configured: Boolean(process.env.DATABASE_URL?.trim()) }], locked: true, note: 'All CMS domains use Neon PostgreSQL as the single source of truth.' }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST() {
  const access = await requireAdmin('admin')
  if (access.denied) return access.denied
  return NextResponse.json({ error: 'CMS storage is fixed to Neon PostgreSQL. External JSON providers are not supported.' }, { status: 400 })
}
