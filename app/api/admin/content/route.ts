import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { getCmsEditorData, saveDocument } from '@/lib/site'
import { auditAdminAction } from '@/lib/security'

const slugSchema = z.string().regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/)
const pageSchema = z.object({ scope: z.literal('page'), slug: slugSchema, data: z.record(z.string(), z.unknown()), expectedUpdatedAt: z.string().datetime().optional() })
const globalSchema = z.object({ scope: z.literal('global'), data: z.record(z.string(), z.unknown()), expectedUpdatedAt: z.string().datetime().optional() })

export async function GET(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  const url = new URL(req.url)
  const slug = url.searchParams.get('slug')
  const scope = url.searchParams.get('scope')
  if (slug) return NextResponse.json(await getCmsEditorData(slug), { headers: { 'Cache-Control': 'no-store' } })
  if (scope === 'global') {
    const content = await getCmsEditorData()
    return NextResponse.json({ global: content.global || {}, updatedAt: content.updatedAt || undefined }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Use /api/admin/content/index for the CMS index.' } }, { status: 400 })
}

/**
 * Embedded data/blob media cannot be saved as CMS content; uploaded media must
 * use a URL returned by the media API. Ordinary HTTPS URLs are intentionally
 * allowed because existing remote assets are supported by the CMS editor.
 * Return paths so editors can locate the offending field without parsing JSON.
 */
function findEmbeddedMediaPaths(value: unknown, path = 'body'): string[] {
  if (typeof value === 'string') {
    // Detect media data URLs even when embedded inside HTML, plus object URLs.
    // Do not reject normal https:// URLs or local /api/media/... URLs.
    const embeddedMedia = /(?:^|[\s"'(=])(?:data:(?:image|video|audio)\/[^,]*,|data:application\/(?:pdf|octet-stream)[^,]*,|data:[^,;]+;base64,|blob:)[^\s"'<>)]*/i
    return embeddedMedia.test(value) ? [path] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findEmbeddedMediaPaths(item, `${path}[${index}]`))
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => findEmbeddedMediaPaths(child, `${path}.${childKey}`))
  }
  return []
}

export async function PUT(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  if (!hasAdminRole(admin, 'admin', 'editor')) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Editor permission required.' } }, { status: 403 })
  const body = await req.json().catch(() => null)
  const embeddedMediaPaths = findEmbeddedMediaPaths(body)
  if (embeddedMediaPaths.length) {
    const affectedFields = embeddedMediaPaths.slice(0, 5).join(', ')
    const extra = embeddedMediaPaths.length > 5 ? ` and ${embeddedMediaPaths.length - 5} more` : ''
    return NextResponse.json({
      ok: false,
      error: {
        code: 'MEDIA_UPLOAD_REQUIRED',
        message: `Embedded Base64/blob media is not accepted (${affectedFields}${extra}). Upload the file through the CMS Media Library and use its returned media URL. Ordinary HTTPS and /api/media/... URLs are supported.`,
        fields: embeddedMediaPaths,
      },
    }, { status: 400 })
  }

  const pageResult = pageSchema.safeParse(body)
  const globalResult = globalSchema.safeParse(body)
  try {
    if (pageResult.success) {
      await saveDocument(`page:${pageResult.data.slug}`, pageResult.data.data, 'page', admin.email, pageResult.data.expectedUpdatedAt)
      await auditAdminAction({ actorEmail: admin.email, action: 'content.save', entity: 'page', entityId: pageResult.data.slug, request: req })
      return NextResponse.json({ ok: true })
    }
    if (globalResult.success) {
      const current = await getCmsEditorData()
      const submitted = globalResult.data.data as Record<string, any>
      const currentIdentity = (current.global as Record<string, any> | undefined)?.siteIdentity || {}
      const brand = submitted.portfolio?.brandIdentity
      const logo = typeof brand?.logo === 'string' && brand.logo.trim()
        ? brand.logo.trim()
        : typeof submitted.images?.logo === 'string' && submitted.images.logo.trim() ? submitted.images.logo.trim() : undefined
      const siteIdentity = { ...currentIdentity, ...(logo ? { logo } : {}) }
      const normalizedGlobal = {
        ...submitted,
        ...(logo ? { siteIdentity, images: { ...(submitted.images || {}), logo }, portfolio: { ...(submitted.portfolio || {}), brandIdentity: { ...(brand || {}), logo } } } : {}),
      }
      await saveDocument('site-global', normalizedGlobal, 'global', admin.email, globalResult.data.expectedUpdatedAt)
      await auditAdminAction({ actorEmail: admin.email, action: 'content.save', entity: 'site-global', request: req })
      return NextResponse.json({ ok: true })
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'CMS_CONFLICT') return NextResponse.json({ ok: false, error: { code: 'CMS_CONFLICT', message: 'This content changed in another session. Reload the latest version before saving.' } }, { status: 409 })
    console.error('CMS content update failed', error)
    return NextResponse.json({ ok: false, error: { code: 'CMS_WRITE_FAILED', message: error instanceof Error ? error.message : 'Database update failed.' } }, { status: 503 })
  }
  return NextResponse.json({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid CMS payload.' } }, { status: 400 })
}
