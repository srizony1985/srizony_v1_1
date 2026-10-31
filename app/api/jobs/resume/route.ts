import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { sql, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { mediaItems } from '@/lib/db/schema'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'
import { enforcePublicJobRateLimit } from '@/lib/cms/jobs'
import { requestIp } from '@/lib/security'
import { deleteObject, getPrivateStorageBucket, sanitizeFileName, uploadObject } from '@/lib/storage'
import { hasPdfSignature, MAX_RESUME_BYTES, safeResumeFileName } from '@/lib/jobApplicationValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true // Non-browser integrations may omit Origin; rate limiting still applies.
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Cross-origin uploads are not accepted.' }, { status: 403, headers: noStore })
  if (!db) return NextResponse.json({ error: 'Resume uploads are unavailable because the database is not configured.' }, { status: 503, headers: noStore })

  try {
    await ensureCmsSchema()
    const allowed = await enforcePublicJobRateLimit('resume-upload', requestIp(request), 5)
    if (!allowed) return NextResponse.json({ error: 'Upload limit reached. Please try again later.' }, { status: 429, headers: noStore })

    const form = await request.formData()
    const file = form.get('resume')
    const honeypot = form.get('website')
    if (typeof honeypot === 'string' && honeypot.trim()) return NextResponse.json({ error: 'Invalid upload.' }, { status: 400, headers: noStore })
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a PDF resume to upload.' }, { status: 400, headers: noStore })
    if (!file.size) return NextResponse.json({ error: 'The selected file is empty.' }, { status: 400, headers: noStore })
    if (file.size > MAX_RESUME_BYTES) return NextResponse.json({ error: 'Resume must be 4 MB or smaller.' }, { status: 413, headers: noStore })
    if (file.type !== 'application/pdf' || !/\.pdf$/i.test(file.name)) return NextResponse.json({ error: 'Only PDF resumes are accepted.' }, { status: 415, headers: noStore })

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!hasPdfSignature(bytes)) return NextResponse.json({ error: 'The file is not a valid PDF document.' }, { status: 415, headers: noStore })

    const safeName = safeResumeFileName(file.name)
    const objectKey = `media/job-resumes/${new Date().getUTCFullYear()}/${String(new Date().getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}-${sanitizeFileName(safeName).replace(/\.pdf$/i, '')}.pdf`
    const bucket = getPrivateStorageBucket()
    await uploadObject(objectKey, bytes, 'application/pdf', 'private, no-store', bucket)

    let mediaId: number | null = null
    try {
      const [media] = await db.insert(mediaItems).values({
        src: objectKey,
        storageKey: objectKey,
        storageBucket: bucket,
        contentType: 'application/pdf',
        sizeBytes: file.size,
        isPublic: false,
        status: 'ready',
        uploadedBy: 'job-applicant',
        altEn: `Applicant resume: ${safeName}`,
        altBn: 'চাকরির আবেদনকারীর জীবনবৃত্তান্ত',
        kind: 'document',
      }).returning({ id: mediaItems.id })
      mediaId = media.id

      const resumeToken = randomBytes(32).toString('base64url')
      const tokenHash = createHash('sha256').update(resumeToken).digest('hex')
      await db.execute(sql`
        INSERT INTO job_resume_uploads (token_hash, media_id, expires_at)
        VALUES (${tokenHash}, ${media.id}, now() + interval '30 minutes')
      `)
      await db.update(mediaItems).set({ src: `/api/media/${media.id}`, updatedAt: new Date() }).where(eq(mediaItems.id, media.id))
      return NextResponse.json({ ok: true, resumeToken, fileName: safeName, sizeBytes: file.size, expiresInMinutes: 30 }, { status: 201, headers: noStore })
    } catch (error) {
      if (mediaId !== null) {
        try { await db.delete(mediaItems).where(eq(mediaItems.id, mediaId)) } catch (cleanupError) { console.error('Failed to clean up incomplete resume media record', cleanupError) }
      }
      try { await deleteObject(objectKey, bucket) } catch (cleanupError) { console.error('Failed to clean up incomplete resume upload', cleanupError) }
      throw error
    }
  } catch (error) {
    console.error('Applicant resume upload failed', error)
    return NextResponse.json({ error: 'Unable to upload the resume. Please retry or contact the foundation.' }, { status: 503, headers: noStore })
  }
}
