import { NextResponse } from 'next/server'
import { z } from 'zod'
import { COMPONENTS } from '@/lib/cms/components'
import { createItem, deleteItem, getItem, isComponent, listItems, setItemStatus, slugTaken, updateItem } from '@/lib/cms/content'
import { failure, requireAdmin } from '@/lib/cms/guard'
import { auditAdminAction } from '@/lib/security'

const noStore = { 'Cache-Control': 'no-store' }
const values = z.record(z.string(), z.union([z.string(), z.number(), z.null()]))
const saveSchema = z.object({ component: z.string().optional(), id: z.number().int().positive().optional(), slug: z.string().trim().min(1).max(160), values, status: z.enum(['published', 'draft', 'hidden']).default('published'), expectedUpdatedAt: z.string().optional() })
const statusSchema = z.object({ id: z.number().int().positive(), status: z.enum(['published', 'draft', 'hidden']) })

export async function GET(req: Request) {
  const { denied } = await requireAdmin()
  if (denied) return denied
  const p = new URL(req.url).searchParams
  try {
    if (p.get('checkSlug') !== null) {
      const component = p.get('component')
      if (!isComponent(component)) return NextResponse.json({ error: 'Unknown component.' }, { status: 400 })
      const excludeId = Number(p.get('excludeId')) || undefined
      return NextResponse.json({ taken: await slugTaken(component, p.get('checkSlug') || '', excludeId, p.get('routeParent') || undefined) }, { headers: noStore })
    }
    const component = p.get('component')
    if (component && component !== 'all' && !isComponent(component)) return NextResponse.json({ error: 'Unknown component.' }, { status: 400 })
    const items = await listItems(component && component !== 'all' ? (component as never) : undefined, p.get('q') || '')
    return NextResponse.json({ items, components: Object.values(COMPONENTS).map(({ key, label, plural, description }) => ({ key, label, plural, description })) }, { headers: noStore })
  } catch (e) { return failure(e, 'Unable to load content.') }
}

export async function POST(req: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const admin = guard.admin!
  const body = saveSchema.safeParse(await req.json().catch(() => null))
  if (!body.success || !isComponent(body.data.component)) return NextResponse.json({ error: 'Invalid content payload.' }, { status: 400 })
  try {
    const item = await createItem(body.data.component, body.data.slug, body.data.values, body.data.status)
    await auditAdminAction({ actorEmail: admin.email, action: 'content.create', entity: body.data.component, entityId: item.slug, request: req })
    return NextResponse.json({ ok: true, item })
  } catch (e) { return failure(e, 'Unable to create the item.') }
}

export async function PUT(req: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const admin = guard.admin!
  const body = saveSchema.safeParse(await req.json().catch(() => null))
  if (!body.success || !body.data.id) return NextResponse.json({ error: 'Invalid content payload.' }, { status: 400 })
  try {
    const item = await updateItem(body.data.id, body.data.slug, body.data.values, body.data.expectedUpdatedAt)
    await auditAdminAction({ actorEmail: admin.email, action: 'content.update', entity: item.component, entityId: item.slug, request: req })
    return NextResponse.json({ ok: true, item })
  } catch (e) { return failure(e, 'Unable to save the item.') }
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const admin = guard.admin!
  const body = statusSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: 'Invalid visibility value.' }, { status: 400 })
  try {
    const item = await setItemStatus(body.data.id, body.data.status)
    await auditAdminAction({ actorEmail: admin.email, action: 'content.visibility', entity: item.component, entityId: item.slug, metadata: { status: item.status }, request: req })
    return NextResponse.json({ ok: true, item })
  } catch (e) { return failure(e, 'Unable to change visibility.') }
}

export async function DELETE(req: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const admin = guard.admin!
  const id = Number(new URL(req.url).searchParams.get('id'))
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Item id is required.' }, { status: 400 })
  try {
    const item = await getItem(id)
    await deleteItem(id)
    await auditAdminAction({ actorEmail: admin.email, action: 'content.delete', entity: item?.component, entityId: item?.slug, request: req })
    return NextResponse.json({ ok: true })
  } catch (e) { return failure(e, 'Unable to delete the item.') }
}
