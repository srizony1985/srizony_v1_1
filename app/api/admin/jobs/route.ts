import { NextResponse } from 'next/server'
import { z } from 'zod'
import { failure, requireAdmin } from '@/lib/cms/guard'
import {
  APPLICATION_STATUSES,
  closeVacancyInterview,
  extendVacancyInterview,
  listApplicantNotifications,
  listApplications,
  listJobSummaries,
  listVacancyInterview,
  scheduleVacancyInterview,
  setApplicationStatus,
  updateVacancyDeadline,
} from '@/lib/cms/jobs'
import { queueJobEmail } from '@/lib/cms/job-mail-outbox'
import { readCmsDocument } from '@/lib/cms/document-store'
import { auditAdminAction } from '@/lib/security'
import { applicationStatusEmail, interviewAppointmentEmail } from '@/lib/mail/job-templates'
import { DEFAULT_JOB_APPLICATION_FORM, normalizeJobApplicationFormConfig, type JobApplicationFormConfig } from '@/lib/jobApplicationForm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

async function withCustomFieldLabels<T extends { customFields?: Record<string, unknown> }>(items: T[]) {
  const saved = await readCmsDocument<JobApplicationFormConfig>('job-application-form.json').catch(() => null)
  const config = normalizeJobApplicationFormConfig(saved || DEFAULT_JOB_APPLICATION_FORM)
  const labels = Object.fromEntries(config.fields.filter((field) => !field.systemField && field.type !== 'resume').map((field) => [field.id, field.labelEn]))
  return items.map((item) => ({ ...item, customFieldLabels: labels }))
}

export async function GET(req: Request) {
  const { denied } = await requireAdmin()
  if (denied) return denied
  const params = new URL(req.url).searchParams
  try {
    if (params.get('view') === 'notifications') {
      const inbox = await listApplicantNotifications()
      return NextResponse.json({ ...inbox, items: await withCustomFieldLabels(inbox.items) }, { headers: noStore })
    }
    if (params.get('view') === 'applications') {
      const items = await listApplications(Number(params.get('jobId')) || undefined, params.get('status') || undefined)
      return NextResponse.json({ items: await withCustomFieldLabels(items) }, { headers: noStore })
    }
    if (params.get('view') === 'interview') {
      const jobId = Number(params.get('jobId'))
      if (!Number.isSafeInteger(jobId) || jobId <= 0) return NextResponse.json({ error: 'A valid vacancy is required.' }, { status: 400, headers: noStore })
      return NextResponse.json(await listVacancyInterview(jobId), { headers: noStore })
    }
    return NextResponse.json({ items: await listJobSummaries() }, { headers: noStore })
  } catch (error) { return failure(error, 'Unable to load job recruitment data.') }
}

const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set-application-status'), id: z.number().int().positive(), status: z.enum(APPLICATION_STATUSES) }),
  z.object({ action: z.literal('update-deadline'), jobId: z.number().int().positive(), deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ action: z.literal('schedule-interview'), jobId: z.number().int().positive(), startsAt: z.string().datetime(), endsAt: z.string().datetime(), minutesPerApplicant: z.number().int().min(1).max(240) }),
  z.object({ action: z.literal('extend-interview'), jobId: z.number().int().positive(), endsAt: z.string().datetime() }),
  z.object({ action: z.literal('close-interview'), jobId: z.number().int().positive() }),
])

export async function PATCH(req: Request) {
  const guard = await requireAdmin('admin', 'editor')
  if (guard.denied) return guard.denied
  const parsed = mutationSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid job workflow action.' }, { status: 400, headers: noStore })

  try {
    const body = parsed.data
    if (body.action === 'set-application-status') {
      const application = await setApplicationStatus(body.id, body.status)
      let emailDelivery: string | undefined
      if (application.changed && ['reviewing', 'shortlisted', 'rejected', 'hired'].includes(body.status) && !application.email) {
        emailDelivery = 'missing-recipient'
      }
      if (application.changed && ['reviewing', 'shortlisted', 'rejected', 'hired'].includes(body.status) && application.email) {
        try {
          const message = applicationStatusEmail({
            applicationId: application.id,
            transitionKey: application.statusChangedAt,
            name: application.name,
            email: application.email,
            jobTitle: application.jobTitle,
            jobRole: application.jobRole,
            status: body.status as 'reviewing' | 'shortlisted' | 'rejected' | 'hired',
          })
          const result = await queueJobEmail(message)
          emailDelivery = result.delivery
        } catch (error) {
          emailDelivery = 'queue-error'
          console.error('Applicant status email could not be queued.', error)
        }
      }
      await auditAdminAction({ actorEmail: guard.admin!.email, action: 'jobs.application.status.update', entity: `job_application:${body.id}`, metadata: { previousStatus: application.previousStatus, status: body.status, emailDelivery }, request: req })
      return NextResponse.json({ ok: true, changed: application.changed, emailDelivery }, { headers: noStore })
    }

    if (body.action === 'update-deadline') {
      const result = await updateVacancyDeadline(body.jobId, body.deadline)
      await auditAdminAction({ actorEmail: guard.admin!.email, action: 'jobs.vacancy.deadline.update', entity: `job:${body.jobId}`, metadata: { deadline: body.deadline }, request: req })
      return NextResponse.json({ ok: true, ...result }, { headers: noStore })
    }

    if (body.action === 'schedule-interview') {
      const schedule = await scheduleVacancyInterview(body)
      const deliveries = new Array<string>(schedule.appointments.length)
      let cursor = 0
      // Limit concurrent Gmail SMTP sends and DB outbox writes for large shortlists.
      const workerCount = Math.min(4, schedule.appointments.length)
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (cursor < schedule.appointments.length) {
          const index = cursor++
          const appointment = schedule.appointments[index]
          if (!appointment.email) { deliveries[index] = 'missing-recipient'; continue }
          const message = interviewAppointmentEmail({
            applicationId: appointment.applicationId,
            interviewId: schedule.interviewId,
            revision: schedule.revision,
            name: appointment.name,
            email: appointment.email,
            jobTitle: schedule.jobTitle,
            jobRole: schedule.jobRole,
            startsAt: appointment.startsAt,
            endsAt: appointment.endsAt,
            rescheduled: schedule.rescheduled,
          })
          try { deliveries[index] = (await queueJobEmail(message)).delivery }
          catch (error) { deliveries[index] = 'queue-error'; console.error('Interview invitation could not be queued.', error) }
        }
      }))
      await auditAdminAction({ actorEmail: guard.admin!.email, action: schedule.rescheduled ? 'jobs.interview.reschedule' : 'jobs.interview.schedule', entity: `job:${body.jobId}`, metadata: { interviewId: schedule.interviewId, revision: schedule.revision, applicantCount: schedule.appointments.length }, request: req })
      return NextResponse.json({ ok: true, schedule, emailDeliveries: deliveries }, { headers: noStore })
    }

    if (body.action === 'extend-interview') {
      const result = await extendVacancyInterview(body.jobId, body.endsAt)
      await auditAdminAction({ actorEmail: guard.admin!.email, action: 'jobs.interview.extend', entity: `job:${body.jobId}`, metadata: result, request: req })
      return NextResponse.json({ ok: true, ...result }, { headers: noStore })
    }

    const result = await closeVacancyInterview(body.jobId)
    await auditAdminAction({ actorEmail: guard.admin!.email, action: 'jobs.interview.close', entity: `job:${body.jobId}`, metadata: result, request: req })
    return NextResponse.json({ ok: true, ...result }, { headers: noStore })
  } catch (error) { return failure(error, 'Unable to update the recruitment workflow.') }
}
