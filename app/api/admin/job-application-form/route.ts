import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { failure, requireAdmin } from '@/lib/cms/guard'
import { readCmsDocument, writeCmsDocument } from '@/lib/cms/document-store'
import { auditAdminAction } from '@/lib/security'
import {
  DEFAULT_JOB_APPLICATION_FORM,
  MAX_JOB_APPLICATION_FIELDS,
  normalizeJobApplicationFormConfig,
  type JobApplicationFormConfig,
  type JobApplicationSystemField,
} from '@/lib/jobApplicationForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const systemFieldTypes: Record<JobApplicationSystemField, string[]> = {
  name: ['text'], email: ['email'], phone: ['tel'], coverLetter: ['textarea'], resume: ['resume'],
}
const fieldSchema = z.object({
  id: z.string().regex(/^custom_[a-z0-9_-]{4,48}$/),
  labelEn: z.string().trim().min(1).max(100),
  labelBn: z.string().trim().max(100).default(''),
  type: z.enum(['text', 'email', 'tel', 'number', 'date', 'url', 'textarea', 'select', 'checkbox', 'resume']),
  required: z.boolean().default(false),
  systemField: z.enum(['name', 'email', 'phone', 'coverLetter', 'resume']).optional(),
  minLength: z.number().int().min(0).max(5000).optional(),
  maxLength: z.number().int().min(1).max(5000).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  placeholderEn: z.string().max(160).optional(),
  placeholderBn: z.string().max(160).optional(),
  selectPlaceholderEn: z.string().max(80).optional(),
  selectPlaceholderBn: z.string().max(80).optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
}).superRefine((field, context) => {
  if (field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) context.addIssue({ code: 'custom', path: ['minLength'], message: 'Minimum characters cannot exceed maximum characters.' })
  if (field.min !== undefined && field.max !== undefined && field.min > field.max) context.addIssue({ code: 'custom', path: ['min'], message: 'Minimum value cannot exceed maximum value.' })
  if (field.type === 'select' && !field.options?.length) context.addIssue({ code: 'custom', path: ['options'], message: 'Select fields require at least one option.' })
  if (field.type !== 'select' && field.options?.length) context.addIssue({ code: 'custom', path: ['options'], message: 'Options are only supported for select fields.' })
  if (field.systemField && !systemFieldTypes[field.systemField].includes(field.type)) context.addIssue({ code: 'custom', path: ['systemField'], message: `The ${field.systemField} field must use the ${systemFieldTypes[field.systemField].join(' or ')} input type.` })
  if (field.type === 'resume' && field.systemField !== 'resume') context.addIssue({ code: 'custom', path: ['systemField'], message: 'PDF resume uploads must be mapped to Resume / CV upload.' })
  if (field.type !== 'resume' && field.systemField === 'resume') context.addIssue({ code: 'custom', path: ['type'], message: 'Resume / CV mapping requires the PDF resume upload type.' })
})
const configSchema = z.object({
  version: z.literal(2).default(2),
  headingEn: z.string().max(140).default(DEFAULT_JOB_APPLICATION_FORM.headingEn),
  headingBn: z.string().max(140).default(DEFAULT_JOB_APPLICATION_FORM.headingBn),
  descriptionEn: z.string().max(300).default(DEFAULT_JOB_APPLICATION_FORM.descriptionEn),
  descriptionBn: z.string().max(300).default(DEFAULT_JOB_APPLICATION_FORM.descriptionBn),
  submitLabelEn: z.string().trim().min(1).max(60).default(DEFAULT_JOB_APPLICATION_FORM.submitLabelEn),
  submitLabelBn: z.string().max(60).default(DEFAULT_JOB_APPLICATION_FORM.submitLabelBn),
  fields: z.array(fieldSchema).min(1, 'Add at least one application field.').max(MAX_JOB_APPLICATION_FIELDS),
}).superRefine((config, context) => {
  const ids = config.fields.map((field) => field.id)
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['fields'], message: 'Each field must have a unique ID.' })
  const mapped = config.fields.flatMap((field) => field.systemField ? [field.systemField] : [])
  if (new Set(mapped).size !== mapped.length) context.addIssue({ code: 'custom', path: ['fields'], message: 'Each applicant data mapping can only be used once.' })
  if (config.fields.filter((field) => field.type === 'resume').length > 1) context.addIssue({ code: 'custom', path: ['fields'], message: 'Only one PDF resume upload field can be configured.' })
})

export async function GET() {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  try {
    const saved = await readCmsDocument<JobApplicationFormConfig>('job-application-form.json')
    return NextResponse.json(normalizeJobApplicationFormConfig(saved || DEFAULT_JOB_APPLICATION_FORM), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to load application form configuration.') }
}

export async function PUT(request: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const parsed = configSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid form configuration.' }, { status: 400 })
  try {
    await writeCmsDocument('job-application-form.json', parsed.data)
    revalidateTag('job-application-form', 'max')
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'jobs.application_form.update', entity: 'job_application_form', metadata: { fields: parsed.data.fields.length }, request })
    return NextResponse.json({ ok: true, config: parsed.data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error, 'Unable to save application form configuration.') }
}
