import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure } from '@/lib/cms/guard'
import { enforcePublicJobRateLimit, submitApplication } from '@/lib/cms/jobs'
import { requestIp } from '@/lib/security'
import { validateJobApplicationFields } from '@/lib/jobApplicationValidation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
const schema = z.object({
  jobSlug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  jobRouteParent: z.string().trim().max(240).regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/),
  name: z.string().trim().min(2).max(160),
  email: z.email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  coverLetter: z.string().trim().max(5000).optional().default(''),
  resumeToken: z.string().min(40).max(100),
  website: z.string().max(200).optional().default(''), // honeypot field
})

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try { return new URL(origin).origin === new URL(request.url).origin } catch { return false }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Cross-origin submissions are not accepted.' }, { status: 403, headers: noStore })
  const raw = await req.json().catch(() => null)
  const body = schema.safeParse(raw)
  if (!body.success) return NextResponse.json({ error: 'Please complete the required fields and upload a PDF resume.' }, { status: 400, headers: noStore })
  const fieldErrors = validateJobApplicationFields(body.data)
  if (Object.keys(fieldErrors).length) return NextResponse.json({ error: 'Please review the application form.', fields: fieldErrors }, { status: 400, headers: noStore })
  try {
    const allowed = await enforcePublicJobRateLimit('apply', requestIp(req), 8)
    if (!allowed) return NextResponse.json({ error: 'Too many applications were submitted from this connection. Please try again later.' }, { status: 429, headers: noStore })
    const id = await submitApplication(body.data)
    return NextResponse.json({ ok: true, reference: `SF-JOB-${String(id).padStart(6, '0')}` }, { status: 201, headers: noStore })
  } catch (e) { return failure(e, 'Unable to submit your application.') }
}
