import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure } from '@/lib/cms/guard'
import { enforcePublicJobRateLimit, submitApplication } from '@/lib/cms/jobs'
import { requestIp } from '@/lib/security'
import { readCmsDocument } from '@/lib/cms/document-store'
import { queueJobEmail } from '@/lib/cms/job-mail-outbox'
import { applicationReceivedEmail } from '@/lib/mail/job-templates'
import {
  DEFAULT_JOB_APPLICATION_FORM,
  getMappedJobApplicationValues,
  normalizeJobApplicationFormConfig,
  validateCustomJobFields,
  type JobApplicationFormConfig,
} from '@/lib/jobApplicationForm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }
const schema = z.object({
  jobSlug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  jobRouteParent: z.string().trim().max(240).regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/),
  resumeToken: z.string().min(40).max(100).optional(),
  website: z.string().max(200).optional().default(''), // honeypot field
  customFields: z.record(z.string(), z.union([z.string().max(5000), z.number().finite(), z.boolean()])).optional().default({}),
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
  if (!body.success) return NextResponse.json({ error: 'Please review the application form and submit valid values.' }, { status: 400, headers: noStore })
  if (body.data.website.trim()) return NextResponse.json({ error: 'Automated submission detected.' }, { status: 400, headers: noStore })

  try {
    const saved = await readCmsDocument<JobApplicationFormConfig>('job-application-form.json')
    const formConfig = normalizeJobApplicationFormConfig(saved || DEFAULT_JOB_APPLICATION_FORM)
    const resumeField = formConfig.fields.find((field) => field.type === 'resume')
    if (body.data.resumeToken && !resumeField) return NextResponse.json({ error: 'This form does not accept resume uploads.' }, { status: 400, headers: noStore })

    const fieldErrors = validateCustomJobFields(formConfig, body.data.customFields, body.data.resumeToken || '')
    if (Object.keys(fieldErrors).length) return NextResponse.json({ error: 'Please review the application form.', fields: fieldErrors }, { status: 400, headers: noStore })
    const allowed = await enforcePublicJobRateLimit('apply', requestIp(req), 8)
    if (!allowed) return NextResponse.json({ error: 'Too many applications were submitted from this connection. Please try again later.' }, { status: 429, headers: noStore })

    const mapped = getMappedJobApplicationValues(formConfig, body.data.customFields)
    // Every applicant must provide an email address: it is the destination for
    // application receipt, review decisions and interview appointments.
    if (!mapped.name.trim() || mapped.name.trim().length > 160 || !mapped.email.trim() || mapped.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mapped.email.trim())) {
      return NextResponse.json({ error: 'The application form must collect a valid applicant name and email address so we can confirm receipt and send recruitment updates.' }, { status: 400, headers: noStore })
    }
    const submission = await submitApplication({
      jobSlug: body.data.jobSlug,
      jobRouteParent: body.data.jobRouteParent,
      ...mapped,
      resumeToken: body.data.resumeToken,
      customFields: body.data.customFields,
    })
    let emailDelivery: string = 'not-configured'
    if (mapped.email) {
      try {
        const message = applicationReceivedEmail({
          applicationId: submission.id,
          name: mapped.name,
          email: mapped.email,
          jobTitle: submission.jobTitle,
          jobRole: submission.jobRole,
        })
        emailDelivery = (await queueJobEmail(message)).delivery
      } catch (error) {
        emailDelivery = 'queue-error'
        console.error('Application confirmation email could not be queued.', error)
      }
    }
    return NextResponse.json({
      ok: true,
      reference: `SF-JOB-${String(submission.id).padStart(6, '0')}`,
      emailDelivery,
    }, { status: 201, headers: noStore })
  } catch (e) { return failure(e, 'Unable to submit your application.') }
}
