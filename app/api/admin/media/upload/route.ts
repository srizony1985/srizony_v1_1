import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { db } from '@/lib/db'
import { mediaItems } from '@/lib/db/schema'
import { deleteObject, uploadObject, sanitizeFileName, getPrivateStorageBucket, getPublicAssetsBucket, getPublicObjectUrl } from '@/lib/storage'
import { auditAdminAction } from '@/lib/security'

export const runtime = 'nodejs'

const kinds = new Set(['image', 'document'])
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'])
const documentTypes = new Set(['application/pdf'])
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024

function extensionFor(type: string, name: string) {
  const fromName = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'pdf'].includes(fromName)) return fromName
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif', 'application/pdf': 'pdf' } as Record<string, string>)[type] || 'bin'
}

export async function POST(req: Request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized.' } }, { status: 401 })
  if (!hasAdminRole(admin, 'admin', 'editor')) return NextResponse.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Editor permission required.' } }, { status: 403 })
  if (!db) return NextResponse.json({ ok: false, error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not configured.' } }, { status: 503 })

  try {
    const form = await req.formData()
    const file = form.get('file')
    const altEn = z.string().trim().max(500).optional().parse(form.get('altEn') || undefined)
    const altBn = z.string().trim().max(500).optional().parse(form.get('altBn') || undefined)
    const kind = z.enum(['image', 'document']).default('image').parse(String(form.get('kind') || 'image'))
    const visibility = z.enum(['private', 'public']).default('private').parse(String(form.get('visibility') || 'private'))
    const isPublicUpload = kind === 'image' || (kind === 'document' && visibility === 'public')
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: { code: 'FILE_REQUIRED', message: 'Choose a file.' } }, { status: 400 })
    if (!kinds.has(kind)) return NextResponse.json({ ok: false, error: { code: 'INVALID_KIND', message: 'Unsupported media kind.' } }, { status: 400 })
    if (!file.size) return NextResponse.json({ ok: false, error: { code: 'EMPTY_FILE', message: 'The uploaded file is empty.' } }, { status: 400 })
    const validType = kind === 'image' ? imageTypes.has(file.type) : documentTypes.has(file.type)
    const max = kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES
    if (!validType) return NextResponse.json({ ok: false, error: { code: 'UNSUPPORTED_TYPE', message: kind === 'image' ? 'Only JPG, PNG, WebP, AVIF and GIF images are supported.' : 'Only PDF reports/documents are supported.' } }, { status: 415 })
    if (file.size > max) return NextResponse.json({ ok: false, error: { code: 'FILE_TOO_LARGE', message: `The file exceeds the ${Math.round(max / 1024 / 1024)} MB limit. Uploads are capped at 4 MB for reliable Vercel deployment.` } }, { status: 413 })

    const bytes = new Uint8Array(await file.arrayBuffer())
    const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
    const isPdf = file.type === 'application/pdf' && ascii(0, 5) === '%PDF-'
    const isJpeg = file.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng = file.type === 'image/png' && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
    const isGif = file.type === 'image/gif' && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')
    const isWebp = file.type === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
    const avifBrands = new Set(['avif', 'avis'])
    const isAvif = file.type === 'image/avif' && ascii(4, 8) === 'ftyp' && (avifBrands.has(ascii(8, 12)) || avifBrands.has(ascii(16, 20)))
    if (!(isPdf || isJpeg || isPng || isGif || isWebp || isAvif)) return NextResponse.json({ ok: false, error: { code: 'INVALID_FILE_SIGNATURE', message: 'The uploaded file does not match its declared file type.' } }, { status: 415 })

    const extension = extensionFor(file.type, file.name)
    const objectKey = `media/${new Date().getUTCFullYear()}/${String(new Date().getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}-${sanitizeFileName(file.name).replace(/\.[^.]+$/, '')}.${extension}`
    // Public-facing PDFs may be placed in the public-read bucket only when an authorized
    // editor explicitly requests public visibility. Other documents stay private.
    const storageBucket = isPublicUpload ? getPublicAssetsBucket() : getPrivateStorageBucket()
    const cacheControl = isPublicUpload
      ? 'public, max-age=300, must-revalidate'
      : 'private, max-age=300, must-revalidate'
    const publicSrc = isPublicUpload ? getPublicObjectUrl(objectKey, storageBucket) : ''

    await uploadObject(objectKey, bytes, file.type, cacheControl, storageBucket)
    let insertedId: number | null = null
    try {
      const [row] = await db.insert(mediaItems).values({
        src: publicSrc || objectKey,
        storageKey: objectKey,
        storageBucket,
        contentType: file.type,
        sizeBytes: file.size,
        isPublic: isPublicUpload,
        status: 'ready',
        uploadedBy: admin.email.toLowerCase(),
        altEn: altEn || '',
        altBn: altBn || '',
        kind,
      }).returning({ id: mediaItems.id })
      insertedId = row.id

      // Private documents get an authenticated application URL, never a raw storage key.
      const src = publicSrc || `/api/media/${row.id}`
      if (!publicSrc) {
        await db.update(mediaItems).set({ src, updatedAt: new Date() }).where(eq(mediaItems.id, row.id))
      }

      await auditAdminAction({ actorEmail: admin.email, action: 'media.upload', entity: 'media_items', entityId: String(row.id), metadata: { kind, contentType: file.type, sizeBytes: file.size, storageBucket, isPublic: isPublicUpload }, request: req })
      return NextResponse.json({ ok: true, id: row.id, src, kind, contentType: file.type, sizeBytes: file.size, storageBucket, isPublic: isPublicUpload }, { status: 201 })
    } catch (databaseError) {
      // Do not leave a database row or storage object behind if the upload record
      // cannot be finalized. Storage deletion is best effort; errors are logged.
      if (insertedId !== null) {
        try { await db.delete(mediaItems).where(eq(mediaItems.id, insertedId)) } catch (cleanupError) { console.error('Failed to remove incomplete media row', cleanupError) }
      }
      try { await deleteObject(objectKey, storageBucket) } catch (cleanupError) { console.error('Orphaned media cleanup failed', cleanupError) }
      throw databaseError
    }
  } catch (error) {
    console.error('Media upload failed', error)
    return NextResponse.json({ ok: false, error: { code: 'UPLOAD_FAILED', message: error instanceof Error ? error.message : 'Unable to upload the file.' } }, { status: 500 })
  }
}
