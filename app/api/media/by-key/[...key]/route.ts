import { and, eq, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, isTransientDatabaseError } from '@/lib/db'
import { mediaItems } from '@/lib/db/schema'
import { getObject, getPrivateStorageBucket, getPublicAssetsBucket, getPublicObjectUrl } from '@/lib/storage'
import { readDriveBackedMediaByKey } from '@/lib/google/drive-media'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeContentType(value: string | null | undefined, key: string) {
  if (value && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(value)) return value
  const extension = key.toLowerCase().split('.').pop()
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml',
  }
  return extension ? types[extension] || 'application/octet-stream' : 'application/octet-stream'
}

/**
 * Compatibility endpoint for legacy page fields containing uploads-bucket URLs.
 * It never grants access by object key alone: a ready, public image row must match.
 * Once a row has been migrated to `public-assets`, it redirects to the public URL
 * and no longer streams the image through the Next.js server.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params
  const key = Array.isArray(parts) ? parts.join('/') : ''
  if (!key.startsWith('media/') || key.split('/').some((part) => !part || part === '.' || part === '..' || part.includes('\\'))) {
    return new NextResponse('Not found', { status: 404 })
  }

  type MediaRecord = {
    storageKey: string | null
    storageBucket: string | null
    src: string | null
    contentType: string | null
    sizeBytes: number | null
    status: string
    isPublic: boolean
    kind: string
  }

  let media: MediaRecord | null = null
  let driveMedia = null as Awaited<ReturnType<typeof readDriveBackedMediaByKey>>
  let databaseUnavailable = !db

  if (db) {
    try {
      const [record] = await db.select({
        storageKey: mediaItems.storageKey,
        storageBucket: mediaItems.storageBucket,
        src: mediaItems.src,
        contentType: mediaItems.contentType,
        sizeBytes: mediaItems.sizeBytes,
        status: mediaItems.status,
        isPublic: mediaItems.isPublic,
        kind: mediaItems.kind,
      }).from(mediaItems).where(and(
        or(eq(mediaItems.storageKey, key), eq(mediaItems.src, key)),
        eq(mediaItems.status, 'ready'),
        eq(mediaItems.isPublic, true),
        eq(mediaItems.kind, 'image'),
      )).limit(1)
      media = record ?? null
    } catch (error) {
      if (!isTransientDatabaseError(error)) {
        console.error('Legacy media metadata query failed', { key, error })
        return new NextResponse('Media metadata is temporarily unavailable.', { status: 503 })
      }
      databaseUnavailable = true
    }
  }

  if (databaseUnavailable) {
    driveMedia = await readDriveBackedMediaByKey(key)
    if (!driveMedia || !driveMedia.isPublic) return new NextResponse('Public image is unavailable in the verified Drive snapshot.', { status: 503 })
    media = {
      storageKey: driveMedia.storageKey,
      storageBucket: driveMedia.storageBucket,
      src: driveMedia.src,
      contentType: driveMedia.contentType,
      sizeBytes: driveMedia.sizeBytes,
      status: driveMedia.status,
      isPublic: true,
      kind: 'image',
    }
  }

  if (!media || media.status !== 'ready' || !media.isPublic || media.kind !== 'image') {
    return new NextResponse('Public image not found', { status: 404 })
  }

  const serveDriveImage = (backup: NonNullable<typeof driveMedia>) => new Response(new Uint8Array(backup.data), {
    status: 200,
    headers: {
      'Content-Type': safeContentType(backup.contentType, key),
      'Content-Length': String(backup.data.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'X-Srizony-Data-Source': 'google-drive-snapshot',
      'X-Snapshot-Updated-At': backup.snapshotAt,
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  })

  if (driveMedia) return serveDriveImage(driveMedia)

  const objectKey = media.storageKey || media.src
  if (!objectKey || /^https?:\/\//i.test(objectKey) || objectKey.startsWith('data:') || objectKey.startsWith('/')) {
    return new NextResponse('Media storage key is invalid', { status: 404 })
  }
  const bucket = media.storageBucket || getPrivateStorageBucket()

  if (bucket === getPublicAssetsBucket()) {
    return NextResponse.redirect(getPublicObjectUrl(objectKey, bucket), {
      status: 307,
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400' },
    })
  }

  try {
    const object = await getObject(objectKey, bucket)
    if (!object.Body || object.ContentLength === 0) {
      const backup = await readDriveBackedMediaByKey(key)
      if (backup?.isPublic) return serveDriveImage(backup)
      return new NextResponse('Media object is empty or unavailable', { status: 502 })
    }

    const headers = new Headers({
      'Content-Type': safeContentType(object.ContentType || media.contentType, objectKey),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    })
    const contentLength = object.ContentLength ?? media.sizeBytes
    if (typeof contentLength === 'number' && Number.isFinite(contentLength) && contentLength >= 0) {
      headers.set('Content-Length', String(contentLength))
    }
    if (object.ETag) headers.set('ETag', object.ETag)
    if (object.LastModified) headers.set('Last-Modified', object.LastModified.toUTCString())
    return new Response(object.Body.transformToWebStream(), { status: 200, headers })
  } catch (error) {
    const backup = await readDriveBackedMediaByKey(key).catch(() => null)
    if (backup?.isPublic) return serveDriveImage(backup)
    const details = error && typeof error === 'object'
      ? error as { name?: string; $metadata?: { httpStatusCode?: number } }
      : {}
    const code = details.name || 'UnknownStorageError'
    const upstreamStatus = details.$metadata?.httpStatusCode
    console.error('Legacy public media resolution failed', { key, code, upstreamStatus })
    if (code === 'NoSuchKey' || code === 'NotFound' || upstreamStatus === 404) {
      return new NextResponse('Media object not found in configured storage bucket', { status: 404 })
    }
    if (code === 'AccessDenied' || upstreamStatus === 403) {
      return new NextResponse('Server storage credentials cannot read this object. Verify that the credentials belong to this branch and include storage:read.', { status: 502 })
    }
    return new NextResponse('Media storage is unavailable. Check the storage configuration.', { status: 503 })
  }
}
