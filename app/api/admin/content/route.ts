import type { ExternalValue, JsonObject, JsonValue } from '@/types/json'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { deleteDocument, getCmsEditorData, saveDocument } from '@/lib/site'
import { setMenuVisibilityBySlug, deleteMenu, getNavigationTree, type NavNode } from '@/lib/cms/navigation'
import { canonicalizeCmsRoute } from '@/lib/cms/routes'
import { CONTENT_COLLECTION_ROUTES } from '@/lib/cms/components'
import { auditAdminAction } from '@/lib/security'

const slugSchema = z.string().regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/)
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number(), z.boolean(), z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]))
const jsonObjectSchema = z.record(z.string(), jsonValueSchema)
const pageSchema = z.object({ scope: z.literal('page'), slug: slugSchema, data: jsonObjectSchema, expectedUpdatedAt: z.string().datetime().optional() })
const globalSchema = z.object({ scope: z.literal('global'), data: jsonObjectSchema, expectedUpdatedAt: z.string().datetime().optional() })
const pageVisibilitySchema = z.object({ action: z.literal('navigation-visibility'), slug: slugSchema, visible: z.boolean() })
const deletePageSchema = z.object({ slug: slugSchema })

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
function findEmbeddedMediaPaths(value: ExternalValue, path = 'body'): string[] {
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
      const submitted = globalResult.data.data as unknown as Record<string, unknown>
      const currentGlobal = current.global as unknown as Record<string, unknown>
      const currentIdentity = currentGlobal.siteIdentity && typeof currentGlobal.siteIdentity === 'object' && !Array.isArray(currentGlobal.siteIdentity) ? currentGlobal.siteIdentity as Record<string, unknown> : {}
      const submittedPortfolio = submitted.portfolio && typeof submitted.portfolio === 'object' && !Array.isArray(submitted.portfolio) ? submitted.portfolio as Record<string, unknown> : {}
      const brand = submittedPortfolio.brandIdentity && typeof submittedPortfolio.brandIdentity === 'object' && !Array.isArray(submittedPortfolio.brandIdentity) ? submittedPortfolio.brandIdentity as Record<string, unknown> : {}
      const submittedImages = submitted.images && typeof submitted.images === 'object' && !Array.isArray(submitted.images) ? submitted.images as Record<string, unknown> : {}
      const brandLogo = typeof brand.logo === 'string' ? brand.logo.trim() : ''
      const imageLogo = typeof submittedImages.logo === 'string' ? submittedImages.logo.trim() : ''
      const logo = brandLogo || imageLogo || undefined
      const siteIdentity = { ...currentIdentity, ...(logo ? { logo } : {}) }
      const normalizedGlobal = {
        ...submitted,
        ...(logo ? { siteIdentity, images: { ...submittedImages, logo }, portfolio: { ...submittedPortfolio, brandIdentity: { ...brand, logo } } } : {}),
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


export async function PATCH(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  if (!hasAdminRole(admin, 'admin', 'editor')) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Editor permission required.' } }, { status: 403 })
  const parsed = pageVisibilitySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'Invalid page visibility settings.' } }, { status: 400 })
  try {
    const result = await setMenuVisibilityBySlug(parsed.data.slug, parsed.data.visible)
    await auditAdminAction({ actorEmail: admin.email, action: 'page.navigation_visibility', entity: 'page', entityId: canonicalizeCmsRoute(parsed.data.slug), metadata: { visible: result.visible }, request: req })
    return NextResponse.json({ ok: true, visible: result.visible }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 503
    return NextResponse.json({ ok: false, error: { code: 'PAGE_VISIBILITY_FAILED', message: error instanceof Error ? error.message : 'Unable to update page visibility.' } }, { status: status >= 400 && status < 600 ? status : 503 })
  }
}

export async function DELETE(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  if (!hasAdminRole(admin, 'admin', 'editor')) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Editor permission required.' } }, { status: 403 })
  const parsed = deletePageSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: { code: 'INVALID_PAYLOAD', message: 'A valid page slug is required.' } }, { status: 400 })
  const slug = canonicalizeCmsRoute(parsed.data.slug)
  if (slug === '/') return NextResponse.json({ ok: false, error: { code: 'PROTECTED_PAGE', message: 'The homepage is fixed and cannot be deleted.' } }, { status: 409 })
  if (CONTENT_COLLECTION_ROUTES.some((route) => route.slug === slug)) {
    return NextResponse.json({ ok: false, error: { code: 'PROTECTED_PAGE', message: 'This is a system collection route. Manage its content through Site Content instead of deleting the route.' } }, { status: 409 })
  }

  try {
    const groups = await getNavigationTree()
    const matchingMenuRoots: number[] = []
    const collectMatches = (nodes: NavNode[], matchedAncestor = false) => {
      for (const node of nodes) {
        const matchesPage = node.menuType === 'page' && canonicalizeCmsRoute(node.slug) === slug
        // A matching parent already removes its complete subtree. Otherwise,
        // remove every duplicate page route found in separate branches.
        if (matchesPage && !matchedAncestor) matchingMenuRoots.push(node.id)
        collectMatches(node.children, matchedAncestor || matchesPage)
      }
    }
    for (const group of groups) collectMatches(group.items)
    let result: { menus?: number; pages?: number } = {}
    if (matchingMenuRoots.length) {
      let menus = 0
      let pages = 0
      for (const menuId of matchingMenuRoots) {
        const removed = await deleteMenu(menuId)
        menus += removed.menus || 0
        pages += removed.pages || 0
      }
      result = { menus, pages }
      // Remove any canonical/legacy page records left by duplicate route aliases.
      await deleteDocument(`page:${slug}`)
    } else {
      await deleteDocument(`page:${slug}`)
      result.pages = 1
    }
    await auditAdminAction({ actorEmail: admin.email, action: 'page.delete', entity: 'page', entityId: slug, metadata: result, request: req })
    return NextResponse.json({ ok: true, slug, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('CMS page deletion failed', error)
    return NextResponse.json({ ok: false, error: { code: 'PAGE_DELETE_FAILED', message: error instanceof Error ? error.message : 'Unable to delete this page.' } }, { status: 503 })
  }
}
