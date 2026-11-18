import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { failure, requireAdmin } from '@/lib/cms/guard'
import { readCmsDocument, writeCmsDocument } from '@/lib/cms/document-store'
import { auditAdminAction } from '@/lib/security'
import {
  DEFAULT_JOB_APPLICATION_PROCESS,
  normalizeJobApplicationProcessConfig,
  type JobApplicationProcessConfig,
} from '@/lib/jobApplicationProcess'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const stepSchema = z.object({
  id: z.enum(['details', 'resume', 'submit']),
  visible: z.boolean(),
  titleEn: z.string().trim().min(1).max(100),
  titleBn: z.string().max(100),
  descriptionEn: z.string().max(240),
  descriptionBn: z.string().max(240),
})
const configSchema = z.object({
  version: z.literal(1),
  visible: z.boolean(),
  steps: z.array(stepSchema).length(3),
}).superRefine((config, context) => {
  const ids = config.steps.map((step) => step.id)
  if (new Set(ids).size !== 3) context.addIssue({ code: 'custom', path: ['steps'], message: 'Each application process step must appear exactly once.' })
})

export async function GET() {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  try {
    const saved = await readCmsDocument<JobApplicationProcessConfig>('job-application-process.json')
    return NextResponse.json(normalizeJobApplicationProcessConfig(saved || DEFAULT_JOB_APPLICATION_PROCESS), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to load application process visibility.') }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const parsed = configSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid application process configuration.' }, { status: 400 })
  try {
    const config = normalizeJobApplicationProcessConfig(parsed.data)
    await writeCmsDocument('job-application-process.json', config)
    revalidateTag('job-application-process', 'max')
    revalidateTag('site-content', 'max')
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'jobs.application_process.visibility.update', entity: 'job_application_process', metadata: { visible: config.visible, visibleSteps: config.steps.filter((step) => step.visible).map((step) => step.id) }, request })
    return NextResponse.json({ ok: true, config }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to save application process visibility.') }
}
