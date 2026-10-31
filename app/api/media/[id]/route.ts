import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mediaItems } from '@/lib/db/schema'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { getObject, getPrivateStorageBucket, getPublicAssetsBucket, getPublicObjectUrl, resolveStoredObjectKey } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeContentType(value: string | undefined | null, key: string) {
  if (value && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(value)) return value
  const extension = key.toLowerCase().split('.').pop()
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml', pdf: 'application/pdf',
  }
  return extension ? types[extension] || 'application/octet-stream' : 'application/octet-stream'
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isSafeInteger(numericId) || numericId <= 0 || !db) {
    return new NextResponse('Not found', { status: 404 })
  }

  const [media] = await db.select({
    storageKey: mediaItems.storageKey,
    storageBucket: mediaItems.storageBucket,
    src: mediaItems.src,
    contentType: mediaItems.contentType,
    sizeBytes: mediaItems.sizeBytes,
    isPublic: mediaItems.isPublic,
    status: mediaItems.status,
    kind: mediaItems.kind,
  }).from(mediaItems).where(eq(mediaItems.id, numericId)).limit(1)

  if (!media || media.status !== 'ready') return new NextResponse('Not found', { status: 404 })

  // Public media may be requested anonymously only when explicitly approved in CMS.
  // Public documents are limited to PDF; every other document remains admin-only.
  const publicMedia = media.isPublic && (media.kind === 'image' || (media.kind === 'document' && (media.contentType === 'application/pdf' || String(media.src).toLowerCase().includes('.pdf'))))
  if (!publicMedia) {
    const admin = await getAdminSession()
    if (!admin) return new NextResponse('Authentication required to access this media.', { status: 401 })
    if (!hasAdminRole(admin, 'admin', 'editor')) return new NextResponse('Forbidden.', { status: 403 })
  }

  const key = resolveStoredObjectKey(media.storageKey, media.src)
  if (!key) return new NextResponse('Media storage key is missing or invalid.', { status: 404 })
  const bucket = media.storageBucket || getPrivateStorageBucket()

  // New public images load directly from Neon Object Storage. This redirect is
  // only used for known-public images in the public_read bucket. Uploads in the
  // previous private bucket continue to stream until the migration script runs.
  if (publicMedia && bucket === getPublicAssetsBucket()) {
    try {
      const publicUrl = getPublicObjectUrl(key, bucket)
      return NextResponse.redirect(publicUrl, {
        status: 307,
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' },
      })
    } catch (error) {
      console.error('Public media URL could not be created', { mediaId: numericId, error })
      return new NextResponse('Public media URL is not configured.', { status: 503 })
    }
  }

  try {
    const object = await getObject(key, bucket)
    if (!object.Body || object.ContentLength === 0) {
      console.error('Media object has an empty body', { mediaId: numericId, contentLength: object.ContentLength ?? null, bucket })
      return new NextResponse('Media object is empty or unavailable in the configured bucket.', { status: 502 })
    }

    const headers = new Headers()
    headers.set('Content-Type', safeContentType(object.ContentType || media.contentType, key))
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Cache-Control', publicMedia
      ? 'public, max-age=300, stale-while-revalidate=86400'
      : 'private, no-store')
    const contentLength = object.ContentLength ?? media.sizeBytes
    if (typeof contentLength === 'number' && Number.isFinite(contentLength) && contentLength >= 0) {
      headers.set('Content-Length', String(contentLength))
    }
    if (object.ETag) headers.set('ETag', object.ETag)
    if (object.LastModified) headers.set('Last-Modified', object.LastModified.toUTCString())

    return new Response(object.Body.transformToWebStream(), { status: 200, headers })
  } catch (error) {
    const details = error && typeof error === 'object'
      ? error as { name?: string; $metadata?: { httpStatusCode?: number } }
      : {}
    const code = details.name || 'UnknownStorageError'
    const upstreamStatus = details.$metadata?.httpStatusCode
    console.error('Media object fetch failed', { mediaId: numericId, bucket, code, upstreamStatus })

    if (code === 'NoSuchKey' || code === 'NotFound' || upstreamStatus === 404) {
      return new NextResponse('Media object not found in the configured object storage bucket.', { status: 404 })
    }
    if (code === 'AccessDenied' || upstreamStatus === 403) {
      return new NextResponse('Media storage denied server access. Check the bucket name, branch and storage:read credential.', { status: 502 })
    }
    return new NextResponse('Media storage is unavailable. Check object storage configuration.', { status: 503 })
  }
}
