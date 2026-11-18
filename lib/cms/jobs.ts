import type { ExternalValue, JsonObject } from '@/types/json'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { ensureCmsSchema } from './ensureSchema'
import { isApplicationDeadlineOpen } from '@/lib/jobApplicationValidation'

type Row = JsonObject
export class JobError extends Error { constructor(message: string, public status = 400) { super(message) } }
const database = () => { if (!db) throw new JobError('DATABASE_URL is not configured', 503); return db }
const run = (q: ReturnType<typeof sql>) => withDbRetry(() => database().execute(q))
const iso = (v: ExternalValue) => (v instanceof Date ? v.toISOString() : String(v || ''))

export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'] as const

async function ensureJobsSchema() {
  if (!db) return false
  try {
    await ensureCmsSchema()
    return true
  } catch (error) {
    if (isTransientDatabaseError(error as ExternalValue)) return false
    throw error
  }
}

function asObject(value: ExternalValue): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
}

function categoryValue(attributes: ExternalValue, language: 'en' | 'bn') {
  const value = asObject(attributes)
  const candidate = language === 'en'
    ? value.category_en || value.category || value.employmentType
    : value.category_bn || value.category_en || value.category || value.employmentType
  return String(candidate || (language === 'en' ? 'Uncategorized' : 'অনির্ধারিত'))
}

export type VacancyWorkflowStage = 'new' | 'review' | 'interview' | 'processed'

function mapJobRow(r: Row) {
  const attributes = asObject(r.attributes)
  const deadline = String(attributes.deadline || '')
  const interviewStatus = String(r.interview_status || '')
  const workflowStage: VacancyWorkflowStage = interviewStatus === 'closed'
    ? 'processed'
    : interviewStatus === 'scheduled'
      ? 'interview'
      : isApplicationDeadlineOpen(deadline) ? 'new' : 'review'
  return {
    id: Number(r.id), slug: String(r.slug || ''), title: { en: String(r.title_en || ''), bn: String(r.title_bn || r.title_en || '') },
    category: { en: categoryValue(attributes, 'en'), bn: categoryValue(attributes, 'bn') },
    status: String(r.status || ''), postedAt: String(r.published_at || '').slice(0, 10), deadline,
    applications: Number(r.applications || 0), newApplications: Number(r.new_applications || 0),
    workflowStage,
    shortlistedCount: Number(r.shortlisted_count || 0),
    interview: r.interview_id ? {
      id: Number(r.interview_id), startsAt: iso(r.interview_starts_at as ExternalValue),
      endsAt: iso(r.interview_ends_at as ExternalValue), minutesPerApplicant: Number(r.minutes_per_applicant || 10),
      status: interviewStatus, shortlistedCount: Number(r.shortlisted_count || 0),
    } : null,
  }
}

function mapApplicationRow(r: Row) {
  return {
    id: Number(r.id), jobId: Number(r.job_id), jobTitle: String(r.job_title || ''), jobSlug: String(r.job_slug || ''),
    jobCategory: { en: String(r.job_category_en || 'Uncategorized'), bn: String(r.job_category_bn || 'অনির্ধারিত') },
    name: String(r.name || ''), email: String(r.email || ''), phone: String(r.phone || ''), coverLetter: String(r.cover_letter || ''),
    resumeUrl: String(r.resume_url || ''), customFields: asObject(r.custom_fields), status: String(r.status || 'new'), createdAt: iso(r.created_at),
  }
}

async function readJobRowsFromDrive(): Promise<Row[]> {
  const [jobSnapshot, applicationSnapshot] = await Promise.all([
    readDriveTableSnapshotInfo('cms_content_items'),
    readDriveTableSnapshotInfo('job_applications'),
  ])
  if (!jobSnapshot || !applicationSnapshot) throw new JobError('Google Drive does not contain complete, recent job snapshots. Job data is temporarily unavailable.', 503)
  const applications = applicationSnapshot.rows
  return jobSnapshot.rows.filter((row) => row.component === 'job').map((row) => {
    const matching = applications.filter((application) => Number(application.job_id) === Number(row.id))
    return {
      ...row,
      applications: matching.length,
      new_applications: matching.filter((application) => application.status === 'new').length,
    }
  })
}

async function readApplicationsFromDrive(jobId?: number, status?: string): Promise<Row[]> {
  const [applicationSnapshot, jobSnapshot] = await Promise.all([
    readDriveTableSnapshotInfo('job_applications'),
    readDriveTableSnapshotInfo('cms_content_items'),
  ])
  if (!applicationSnapshot || !jobSnapshot) throw new JobError('Google Drive does not contain complete, recent job-application snapshots. Applicant data is temporarily unavailable.', 503)
  const jobs = new Map(jobSnapshot.rows.filter((row) => row.component === 'job').map((row) => [Number(row.id), row]))
  return applicationSnapshot.rows
    .filter((row) => (!jobId || Number(row.job_id) === jobId) && (!status || row.status === status))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 2000)
    .flatMap((row) => {
      const job = jobs.get(Number(row.job_id))
      if (!job) return []
      return [{
        ...row,
        job_title: job.title_en,
        job_slug: job.slug,
        job_category_en: categoryValue(job.attributes, 'en'),
        job_category_bn: categoryValue(job.attributes, 'bn'),
      }]
    })
}


/** Rate-limit public job uploads/submissions by a hash of the request IP, never raw IP. */
export async function enforcePublicJobRateLimit(action: 'resume-upload' | 'apply', subject: string, limit: number) {
  await ensureCmsSchema()
  const subjectHash = createHash('sha256').update(subject || 'unknown').digest('hex')
  const rateKey = `${action}:${subjectHash}`
  const result = await run(sql`
    INSERT INTO job_public_rate_limits (rate_key, window_started_at, attempts)
    VALUES (${rateKey}, now(), 1)
    ON CONFLICT (rate_key) DO UPDATE SET
      attempts = CASE WHEN job_public_rate_limits.window_started_at < now() - interval '1 hour' THEN 1 ELSE job_public_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN job_public_rate_limits.window_started_at < now() - interval '1 hour' THEN now() ELSE job_public_rate_limits.window_started_at END
    RETURNING attempts
  `)
  return Number((result.rows[0] as Row | undefined)?.attempts ?? limit + 1) <= limit
}

export async function listJobSummaries() {
  const databaseAvailable = await ensureJobsSchema()
  let rows: Row[]
  if (databaseAvailable) {
    try {
      rows = (await run(sql`
    SELECT i.id, i.slug, i.title_en, i.title_bn, i.status, i.published_at, i.attributes,
      (SELECT COUNT(*)::int FROM job_applications a WHERE a.job_id = i.id) AS applications,
      (SELECT COUNT(*)::int FROM job_applications a WHERE a.job_id = i.id AND a.status = 'new') AS new_applications,
      (SELECT vi.id FROM job_vacancy_interviews vi WHERE vi.job_id = i.id LIMIT 1) AS interview_id,
      (SELECT vi.status FROM job_vacancy_interviews vi WHERE vi.job_id = i.id LIMIT 1) AS interview_status,
      (SELECT vi.starts_at FROM job_vacancy_interviews vi WHERE vi.job_id = i.id LIMIT 1) AS interview_starts_at,
      (SELECT vi.ends_at FROM job_vacancy_interviews vi WHERE vi.job_id = i.id LIMIT 1) AS interview_ends_at,
      (SELECT vi.minutes_per_applicant FROM job_vacancy_interviews vi WHERE vi.job_id = i.id LIMIT 1) AS minutes_per_applicant,
      (SELECT COUNT(*)::int FROM job_applications a WHERE a.job_id = i.id AND a.status = 'shortlisted') AS shortlisted_count
    FROM cms_content_items i WHERE i.component = 'job' ORDER BY i.published_at DESC, i.id DESC`)).rows as Row[]
    } catch (error) {
      if (!isTransientDatabaseError(error as ExternalValue)) throw error
      rows = await readJobRowsFromDrive()
    }
  } else {
    rows = await readJobRowsFromDrive()
  }
  return rows.map(mapJobRow)
}

export async function listApplications(jobId?: number, status?: string) {
  const databaseAvailable = await ensureJobsSchema()
  if (status && !(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new JobError('Unsupported application status.')
  const where = jobId && status
    ? sql`WHERE a.job_id = ${jobId} AND a.status = ${status}`
    : jobId
      ? sql`WHERE a.job_id = ${jobId}`
      : status
        ? sql`WHERE a.status = ${status}`
        : sql``
  let rows: Row[]
  if (databaseAvailable) {
    try {
      rows = (await run(sql`
    SELECT a.*, i.title_en AS job_title, i.slug AS job_slug,
      COALESCE(NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), NULLIF(i.attributes->>'employmentType', ''), 'Uncategorized') AS job_category_en,
      COALESCE(NULLIF(i.attributes->>'category_bn', ''), NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), NULLIF(i.attributes->>'employmentType', ''), 'অনির্ধারিত') AS job_category_bn
    FROM job_applications a JOIN cms_content_items i ON i.id = a.job_id
    ${where} ORDER BY a.created_at DESC LIMIT 2000`)).rows as Row[]
    } catch (error) {
      if (!isTransientDatabaseError(error as ExternalValue)) throw error
      rows = await readApplicationsFromDrive(jobId, status)
    }
  } else {
    rows = await readApplicationsFromDrive(jobId, status)
  }
  return rows.map(mapApplicationRow)
}

/** New application notifications, with an exact total and the latest 2,000 applicant records. */
export async function listApplicantNotifications() {
  const databaseAvailable = await ensureJobsSchema()
  if (databaseAvailable) {
    try {
      const [countResult, rowsResult] = await Promise.all([
        run(sql`SELECT COUNT(*)::int AS total FROM job_applications WHERE status = 'new'`),
        run(sql`
          SELECT a.*, i.title_en AS job_title, i.slug AS job_slug,
            COALESCE(NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), NULLIF(i.attributes->>'employmentType', ''), 'Uncategorized') AS job_category_en,
            COALESCE(NULLIF(i.attributes->>'category_bn', ''), NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), NULLIF(i.attributes->>'employmentType', ''), 'অনির্ধারিত') AS job_category_bn
          FROM job_applications a JOIN cms_content_items i ON i.id = a.job_id
          WHERE a.status = 'new' ORDER BY a.created_at DESC LIMIT 2000
        `),
      ])
      const items = (rowsResult.rows as Row[]).map(mapApplicationRow)
      return { total: Number((countResult.rows[0] as Row | undefined)?.total ?? 0), items }
    } catch (error) {
      if (!isTransientDatabaseError(error as ExternalValue)) throw error
    }
  }

  const [applications, cmsItems] = await Promise.all([
    readDriveTableSnapshotInfo('job_applications'),
    readDriveTableSnapshotInfo('cms_content_items'),
  ])
  if (!applications || !cmsItems) throw new JobError('Google Drive does not contain a complete, recent job-application snapshot. Notifications are temporarily unavailable.', 503)
  const jobs = new Map(cmsItems.rows.filter((row) => row.component === 'job').map((row) => [Number(row.id), row]))
  const items = applications.rows
    .filter((row) => row.status === 'new')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 2000)
    .flatMap((row) => {
      const job = jobs.get(Number(row.job_id))
      return job ? [mapApplicationRow({ ...row, job_title: job.title_en, job_slug: job.slug, job_category_en: categoryValue(job.attributes, 'en'), job_category_bn: categoryValue(job.attributes, 'bn') })] : []
    })
  return { total: applications.rows.filter((row) => row.status === 'new').length, items }
}

export async function setApplicationStatus(id: number, status: typeof APPLICATION_STATUSES[number]) {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new JobError('Unsupported status.')
  await ensureCmsSchema()
  const result = await run(sql`
    WITH locked_interview AS MATERIALIZED (
      SELECT vi.status
      FROM job_vacancy_interviews vi
      WHERE vi.job_id = (SELECT a.job_id FROM job_applications a WHERE a.id = ${id})
      FOR UPDATE
    ), current_application AS MATERIALIZED (
      SELECT a.id, a.status AS previous_status, a.status_changed_at AS previous_status_changed_at,
        a.name, a.email, a.job_id, i.title_en AS job_title, i.attributes,
        locked_interview.status AS interview_status
      FROM job_applications a
      JOIN cms_content_items i ON i.id = a.job_id
      LEFT JOIN locked_interview ON TRUE
      WHERE a.id = ${id} AND i.component = 'job'
      FOR UPDATE OF a
    ), changed AS (
      UPDATE job_applications a
      SET status = ${status}, status_changed_at = now()
      FROM current_application c
      WHERE a.id = c.id AND a.status = c.previous_status AND a.status <> ${status}
        AND NOT (${status} = 'shortlisted' AND c.interview_status = 'closed')
      RETURNING a.id, a.status, a.status_changed_at
    )
    SELECT c.id, c.name, c.email, c.previous_status, c.interview_status,
      COALESCE(changed.status, c.previous_status) AS status,
      COALESCE(changed.status_changed_at, c.previous_status_changed_at) AS status_changed_at,
      (changed.id IS NOT NULL) AS changed,
      c.job_title,
      COALESCE(NULLIF(c.attributes->>'employmentType', ''), NULLIF(c.attributes->>'category_en', ''), NULLIF(c.attributes->>'category', ''), 'Position') AS job_role
    FROM current_application c LEFT JOIN changed ON changed.id = c.id
  `)
  const row = result.rows[0] as Row | undefined
  if (!row) throw new JobError('Application not found.', 404)
  if (status === 'shortlisted' && row.interview_status === 'closed') throw new JobError('This recruitment process is already closed. The applicant cannot be short-listed again.', 409)
  return {
    id: Number(row.id), name: String(row.name || ''), email: String(row.email || ''),
    previousStatus: String(row.previous_status || 'new'), status: String(row.status || status),
    statusChangedAt: iso(row.status_changed_at as ExternalValue), changed: row.changed === true,
    jobTitle: String(row.job_title || ''), jobRole: String(row.job_role || ''),
  }
}

export async function submitApplication(input: { jobSlug: string; jobRouteParent: string; name?: string; email?: string; phone?: string; coverLetter?: string; resumeToken?: string; customFields?: Record<string, string | number | boolean> }): Promise<{ id: number; jobTitle: string; jobRole: string }> {
  await ensureCmsSchema()
  const job = (await run(sql`
    SELECT id, title_en, attributes FROM cms_content_items
    WHERE component = 'job' AND slug = ${input.jobSlug} AND status = 'published'
      AND COALESCE(NULLIF(attributes->>'routeParent', ''), '/carrer-job') = ${input.jobRouteParent}
    LIMIT 1
  `)).rows[0] as Row | undefined
  if (!job) throw new JobError('This job is no longer available.', 404)
  const attributes = asObject(job.attributes)
  const deadline = typeof attributes.deadline === 'string' ? attributes.deadline : ''
  if (!isApplicationDeadlineOpen(deadline)) throw new JobError('The application deadline has passed. Applications are closed for this vacancy.', 410)

  const name = (input.name || '').trim()
  const email = (input.email || '').trim().toLowerCase()
  const phone = (input.phone || '').trim()
  const coverLetter = (input.coverLetter || '').trim()
  if (email) {
    const dup = await run(sql`SELECT id FROM job_applications WHERE job_id = ${Number(job.id)} AND lower(email) = ${email} LIMIT 1`)
    if (dup.rows.length) throw new JobError('You have already applied for this job.', 409)
  }

  const customFields = JSON.stringify(input.customFields || {})
  if (input.resumeToken) {
    const tokenHash = createHash('sha256').update(input.resumeToken).digest('hex')
    // Claim the one-time, short-lived upload token and insert the application in a single SQL statement.
    // The resume remains private; admins can open it through the authenticated /api/media/:id route.
    const inserted = await run(sql`
      WITH job_still_open AS MATERIALIZED (
        SELECT i.id
        FROM cms_content_items i
        WHERE i.id = ${Number(job.id)} AND i.component = 'job' AND i.slug = ${input.jobSlug}
          AND i.status = 'published'
          AND COALESCE(NULLIF(i.attributes->>'routeParent', ''), '/carrer-job') = ${input.jobRouteParent}
          AND (NULLIF(i.attributes->>'deadline', '') IS NULL OR (i.attributes->>'deadline')::date >= (now() AT TIME ZONE 'Asia/Dhaka')::date)
      ), claimed_resume AS (
        UPDATE job_resume_uploads
        SET consumed_at = now()
        WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > now()
          AND EXISTS (SELECT 1 FROM job_still_open)
        RETURNING media_id
      )
      INSERT INTO job_applications (job_id, name, email, phone, cover_letter, resume_url, custom_fields)
      SELECT job_still_open.id, ${name}, ${email}, ${phone || null}, ${coverLetter || null}, '/api/media/' || claimed_resume.media_id::text, ${customFields}::jsonb
      FROM job_still_open CROSS JOIN claimed_resume
      RETURNING id
    `)
    const row = inserted.rows[0] as Row | undefined
    if (!row) throw new JobError('Your resume upload has expired or was already used. Please upload it again.', 410)
    return { id: Number(row.id), jobTitle: String(job.title_en || ''), jobRole: categoryValue(attributes, 'en') }
  }

  const inserted = await run(sql`
    INSERT INTO job_applications (job_id, name, email, phone, cover_letter, resume_url, custom_fields)
    SELECT i.id, ${name}, ${email}, ${phone || null}, ${coverLetter || null}, NULL, ${customFields}::jsonb
    FROM cms_content_items i
    WHERE i.id = ${Number(job.id)} AND i.component = 'job' AND i.slug = ${input.jobSlug}
      AND i.status = 'published'
      AND COALESCE(NULLIF(i.attributes->>'routeParent', ''), '/carrer-job') = ${input.jobRouteParent}
      AND (NULLIF(i.attributes->>'deadline', '') IS NULL OR (i.attributes->>'deadline')::date >= (now() AT TIME ZONE 'Asia/Dhaka')::date)
    RETURNING id
  `)
  const row = inserted.rows[0] as Row | undefined
  if (!row) throw new JobError('The deadline may have passed or this vacancy is no longer accepting applications. Please refresh the vacancy page.', 410)
  return { id: Number(row.id), jobTitle: String(job.title_en || ''), jobRole: categoryValue(attributes, 'en') }
}

export async function updateVacancyDeadline(jobId: number, deadline: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || !isApplicationDeadlineOpen(deadline)) {
    throw new JobError('Choose a valid application deadline that is today or later.')
  }
  await ensureCmsSchema()
  const activeInterview = await run(sql`SELECT id FROM job_vacancy_interviews WHERE job_id = ${jobId} AND status = 'scheduled' LIMIT 1`)
  if (activeInterview.rows.length) throw new JobError('The interview is already scheduled. Close or reschedule the interview before changing the application deadline.', 409)
  const updated = await run(sql`
    UPDATE cms_content_items
    SET attributes = jsonb_set(COALESCE(attributes, '{}'::jsonb), '{deadline}', to_jsonb(${deadline}::text), true),
        updated_at = now()
    WHERE id = ${jobId} AND component = 'job'
    RETURNING id
  `)
  if (!updated.rows.length) throw new JobError('Vacancy not found.', 404)
  return { jobId, deadline, workflowStage: 'new' as const }
}

export type VacancyInterviewAppointment = {
  applicationId: number
  name: string
  email: string
  status: string
  startsAt: string
  endsAt: string
}

export async function listVacancyInterview(jobId: number) {
  await ensureCmsSchema()
  const scheduleResult = await run(sql`
    SELECT vi.id, vi.job_id, vi.starts_at, vi.ends_at, vi.minutes_per_applicant,
      vi.status, vi.revision, vi.closed_at, i.title_en,
      COALESCE(NULLIF(i.attributes->>'employmentType', ''), NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), 'Position') AS job_role
    FROM job_vacancy_interviews vi
    JOIN cms_content_items i ON i.id = vi.job_id
    WHERE vi.job_id = ${jobId} AND i.component = 'job'
    LIMIT 1
  `)
  const schedule = scheduleResult.rows[0] as Row | undefined
  if (!schedule) throw new JobError('No interview schedule exists for this vacancy.', 404)
  const appointmentResult = await run(sql`
    SELECT ai.application_id, ai.starts_at, ai.ends_at, a.name, a.email, a.status
    FROM job_application_interviews ai
    JOIN job_applications a ON a.id = ai.application_id
    WHERE ai.interview_id = ${Number(schedule.id)}
    ORDER BY ai.starts_at ASC, ai.application_id ASC
  `)
  return {
    id: Number(schedule.id), jobId: Number(schedule.job_id), jobTitle: String(schedule.title_en || ''),
    jobRole: String(schedule.job_role || ''), startsAt: iso(schedule.starts_at as ExternalValue),
    endsAt: iso(schedule.ends_at as ExternalValue), minutesPerApplicant: Number(schedule.minutes_per_applicant || 10),
    status: String(schedule.status || 'scheduled'), revision: Number(schedule.revision || 1),
    closedAt: schedule.closed_at ? iso(schedule.closed_at as ExternalValue) : null,
    appointments: (appointmentResult.rows as Row[]).map((row) => ({
      applicationId: Number(row.application_id), name: String(row.name || ''), email: String(row.email || ''),
      status: String(row.status || 'shortlisted'), startsAt: iso(row.starts_at as ExternalValue), endsAt: iso(row.ends_at as ExternalValue),
    } satisfies VacancyInterviewAppointment)),
  }
}

export async function scheduleVacancyInterview(input: {
  jobId: number; startsAt: string; endsAt: string; minutesPerApplicant: number
}) {
  await ensureCmsSchema()
  const start = new Date(input.startsAt)
  const end = new Date(input.endsAt)
  const minutes = Math.floor(input.minutesPerApplicant)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new JobError('Choose a valid interview start and end time.')
  }
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new JobError('Interview duration per applicant must be between 1 and 240 minutes.')
  }

  const jobResult = await run(sql`
    SELECT i.id, i.title_en,
      COALESCE(NULLIF(i.attributes->>'employmentType', ''), NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), 'Position') AS job_role,
      COUNT(a.id)::int AS shortlisted_count
    FROM cms_content_items i
    LEFT JOIN job_applications a ON a.job_id = i.id AND a.status = 'shortlisted'
    WHERE i.id = ${input.jobId} AND i.component = 'job'
    GROUP BY i.id
  `)
  const job = jobResult.rows[0] as Row | undefined
  if (!job) throw new JobError('Vacancy not found.', 404)
  const applicantCount = Number(job.shortlisted_count || 0)
  if (!applicantCount) throw new JobError('At least one short-listed applicant is required before scheduling an interview.', 409)
  const minimumEnd = start.getTime() + applicantCount * minutes * 60_000
  if (minimumEnd > end.getTime()) {
    throw new JobError(`The selected window is too short. ${applicantCount} short-listed applicants need ${applicantCount * minutes} minutes. Extend the interview end time.`)
  }

  /*
   * This project uses Drizzle's Neon HTTP driver. It intentionally has no
   * interactive transaction() support. Keep the entire schedule mutation in
   * one PostgreSQL statement so a partial interview/appointment set cannot be
   * committed. Existing appointment history is preserved for applicants whose
   * status has already been resolved; current shortlisted slots are upserted.
   */
  const result = await run(sql`
    WITH job AS MATERIALIZED (
      SELECT i.id, i.title_en,
        COALESCE(NULLIF(i.attributes->>'employmentType', ''), NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), 'Position') AS job_role
      FROM cms_content_items i
      WHERE i.id = ${input.jobId} AND i.component = 'job'
    ),
    shortlisted AS MATERIALIZED (
      SELECT a.id, a.name, a.email,
        ROW_NUMBER() OVER (ORDER BY a.created_at ASC, a.id ASC)::int AS slot_number
      FROM job_applications a
      JOIN job ON job.id = a.job_id
      WHERE a.status = 'shortlisted'
    ),
    shortlist_count AS (
      SELECT COUNT(*)::int AS total FROM shortlisted
    ),
    upsert_interview AS (
      INSERT INTO job_vacancy_interviews (job_id, starts_at, ends_at, minutes_per_applicant)
      SELECT job.id, ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, ${minutes}
      FROM job CROSS JOIN shortlist_count
      WHERE shortlist_count.total > 0
        AND ${start.toISOString()}::timestamptz + (shortlist_count.total * ${minutes}) * interval '1 minute' <= ${end.toISOString()}::timestamptz
      ON CONFLICT (job_id) DO UPDATE SET
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        minutes_per_applicant = EXCLUDED.minutes_per_applicant,
        status = 'scheduled',
        revision = job_vacancy_interviews.revision + 1,
        closed_at = NULL,
        updated_at = now()
      WHERE job_vacancy_interviews.status <> 'closed'
      RETURNING id, revision
    ),
    upsert_appointments AS (
      INSERT INTO job_application_interviews (interview_id, application_id, starts_at, ends_at)
      SELECT vi.id, s.id,
        ${start.toISOString()}::timestamptz + ((s.slot_number - 1) * ${minutes}) * interval '1 minute',
        ${start.toISOString()}::timestamptz + (s.slot_number * ${minutes}) * interval '1 minute'
      FROM upsert_interview vi
      CROSS JOIN shortlisted s
      ON CONFLICT (application_id) DO UPDATE SET
        interview_id = EXCLUDED.interview_id,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at
      RETURNING application_id, starts_at, ends_at
    )
    SELECT vi.id AS interview_id, vi.revision,
      job.title_en, job.job_role,
      s.id AS application_id, s.name, s.email,
      appointments.starts_at, appointments.ends_at
    FROM upsert_interview vi
    CROSS JOIN job
    JOIN upsert_appointments appointments ON TRUE
    JOIN shortlisted s ON s.id = appointments.application_id
    ORDER BY appointments.starts_at ASC, s.id ASC
  `)

  const rows = result.rows as Row[]
  if (!rows.length) {
    throw new JobError('The schedule could not be saved. The vacancy may have been closed or the short-listed applicant list changed. Refresh and try again.', 409)
  }
  const first = rows[0]
  const revision = Number(first.revision || 1)
  const appointments: VacancyInterviewAppointment[] = rows.map((row) => ({
    applicationId: Number(row.application_id),
    name: String(row.name || ''),
    email: String(row.email || ''),
    status: 'shortlisted',
    startsAt: iso(row.starts_at as ExternalValue),
    endsAt: iso(row.ends_at as ExternalValue),
  }))

  return {
    interviewId: Number(first.interview_id),
    revision,
    appointments,
    jobId: input.jobId,
    jobTitle: String(first.title_en || ''),
    jobRole: String(first.job_role || ''),
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    minutesPerApplicant: minutes,
    rescheduled: revision > 1,
  }
}

export async function extendVacancyInterview(jobId: number, newEndsAt: string) {
  const end = new Date(newEndsAt)
  if (!Number.isFinite(end.getTime())) throw new JobError('Choose a valid extended end time.')
  await ensureCmsSchema()
  const result = await run(sql`
    UPDATE job_vacancy_interviews vi
    SET ends_at = ${end.toISOString()}, updated_at = now()
    WHERE vi.job_id = ${jobId} AND vi.status = 'scheduled' AND vi.ends_at < ${end.toISOString()}
      AND vi.ends_at >= COALESCE((SELECT MAX(ai.ends_at) FROM job_application_interviews ai WHERE ai.interview_id = vi.id), vi.starts_at)
    RETURNING vi.id, vi.ends_at
  `)
  if (!result.rows.length) throw new JobError('The interview is not active, or the new end time must be later than the current end time.', 409)
  return { jobId, endsAt: iso((result.rows[0] as Row).ends_at as ExternalValue) }
}

export async function closeVacancyInterview(jobId: number) {
  await ensureCmsSchema()
  // Lock order is interview row first, then application rows. setApplicationStatus
  // uses the same order, so closing cannot race a concurrent short-list action.
  const result = await run(sql`
    WITH active_interview AS MATERIALIZED (
      SELECT id FROM job_vacancy_interviews
      WHERE job_id = ${jobId} AND status = 'scheduled'
      FOR UPDATE
    ), locked_applications AS MATERIALIZED (
      SELECT a.id, a.status
      FROM job_applications a
      CROSS JOIN active_interview
      WHERE a.job_id = ${jobId}
      FOR UPDATE OF a
    ), remaining AS (
      SELECT COUNT(*) FILTER (WHERE status = 'shortlisted')::int AS total
      FROM locked_applications
    ), closed AS (
      UPDATE job_vacancy_interviews vi
      SET status = 'closed', closed_at = now(), updated_at = now()
      FROM active_interview active, remaining
      WHERE vi.id = active.id AND remaining.total = 0
      RETURNING vi.id
    )
    SELECT remaining.total, closed.id
    FROM remaining LEFT JOIN closed ON TRUE
  `)
  const row = result.rows[0] as Row | undefined
  if (!row || !Number(row.id || 0)) {
    const remaining = Number(row?.total || 0)
    if (remaining > 0) throw new JobError(`Resolve all ${remaining} short-listed applicants by marking them hired or rejected before closing the interview.`, 409)
    throw new JobError('No active interview schedule was found for this vacancy.', 404)
  }
  return { jobId, status: 'processed' as const }
}
