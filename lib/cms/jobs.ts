import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, withDbRetry } from '@/lib/db'
import { ensureCmsSchema } from './ensureSchema'
import { isApplicationDeadlineOpen } from '@/lib/jobApplicationValidation'

type Row = Record<string, any>
export class JobError extends Error { constructor(message: string, public status = 400) { super(message) } }
const database = () => { if (!db) throw new JobError('DATABASE_URL is not configured', 503); return db }
const run = (q: ReturnType<typeof sql>) => withDbRetry(() => database().execute(q))
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v || ''))

export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'] as const

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
  await ensureCmsSchema()
  const rows = (await run(sql`
    SELECT i.id, i.slug, i.title_en, i.title_bn, i.status, i.published_at, i.attributes,
      (SELECT COUNT(*)::int FROM job_applications a WHERE a.job_id = i.id) AS applications,
      (SELECT COUNT(*)::int FROM job_applications a WHERE a.job_id = i.id AND a.status = 'new') AS new_applications
    FROM cms_content_items i WHERE i.component = 'job' ORDER BY i.published_at DESC, i.id DESC`)).rows as Row[]
  return rows.map((r) => ({
    id: Number(r.id), slug: r.slug, title: { en: r.title_en, bn: r.title_bn || r.title_en },
    category: {
      en: String(r.attributes?.category_en || r.attributes?.category || r.attributes?.employmentType || 'Uncategorized'),
      bn: String(r.attributes?.category_bn || r.attributes?.category_en || r.attributes?.category || r.attributes?.employmentType || 'অনির্ধারিত'),
    },
    status: r.status, postedAt: String(r.published_at).slice(0, 10), deadline: r.attributes?.deadline || '',
    applications: Number(r.applications), newApplications: Number(r.new_applications),
  }))
}

export async function listApplications(jobId?: number, status?: string) {
  await ensureCmsSchema()
  if (status && !(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new JobError('Unsupported application status.')
  const where = jobId && status
    ? sql`WHERE a.job_id = ${jobId} AND a.status = ${status}`
    : jobId
      ? sql`WHERE a.job_id = ${jobId}`
      : status
        ? sql`WHERE a.status = ${status}`
        : sql``
  const rows = (await run(sql`
    SELECT a.*, i.title_en AS job_title, i.slug AS job_slug,
      COALESCE(NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), NULLIF(i.attributes->>'employmentType', ''), 'Uncategorized') AS job_category_en,
      COALESCE(NULLIF(i.attributes->>'category_bn', ''), NULLIF(i.attributes->>'category_en', ''), NULLIF(i.attributes->>'category', ''), NULLIF(i.attributes->>'employmentType', ''), 'অনির্ধারিত') AS job_category_bn
    FROM job_applications a JOIN cms_content_items i ON i.id = a.job_id
    ${where} ORDER BY a.created_at DESC LIMIT 2000`)).rows as Row[]
  return rows.map((r) => ({
    id: Number(r.id), jobId: Number(r.job_id), jobTitle: r.job_title, jobSlug: r.job_slug,
    jobCategory: { en: r.job_category_en, bn: r.job_category_bn },
    name: r.name, email: r.email, phone: r.phone || '', coverLetter: r.cover_letter || '',
    resumeUrl: r.resume_url || '', status: r.status, createdAt: iso(r.created_at),
  }))
}

/** New application notifications, with an exact total and the latest 2,000 applicant records. */
export async function listApplicantNotifications() {
  await ensureCmsSchema()
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
  const items = (rowsResult.rows as Row[]).map((r) => ({
    id: Number(r.id), jobId: Number(r.job_id), jobTitle: r.job_title, jobSlug: r.job_slug,
    jobCategory: { en: r.job_category_en, bn: r.job_category_bn },
    name: r.name, email: r.email, phone: r.phone || '', coverLetter: r.cover_letter || '',
    resumeUrl: r.resume_url || '', status: r.status, createdAt: iso(r.created_at),
  }))
  return { total: Number((countResult.rows[0] as Row | undefined)?.total ?? 0), items }
}

export async function setApplicationStatus(id: number, status: string) {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) throw new JobError('Unsupported status.')
  await ensureCmsSchema()
  if (!(await run(sql`UPDATE job_applications SET status = ${status} WHERE id = ${id} RETURNING id`)).rows.length) throw new JobError('Application not found.', 404)
}

export async function submitApplication(input: { jobSlug: string; jobRouteParent: string; name: string; email: string; phone?: string; coverLetter?: string; resumeToken: string }) {
  await ensureCmsSchema()
  const job = (await run(sql`
    SELECT id, attributes FROM cms_content_items
    WHERE component = 'job' AND slug = ${input.jobSlug} AND status = 'published'
      AND COALESCE(NULLIF(attributes->>'routeParent', ''), '/carrer-job') = ${input.jobRouteParent}
    LIMIT 1
  `)).rows[0] as Row | undefined
  if (!job) throw new JobError('This job is no longer available.', 404)
  const deadline = typeof job.attributes?.deadline === 'string' ? job.attributes.deadline : ''
  if (!isApplicationDeadlineOpen(deadline)) throw new JobError('The application deadline has passed.', 410)

  const email = input.email.trim().toLowerCase()
  const dup = await run(sql`SELECT id FROM job_applications WHERE job_id = ${Number(job.id)} AND lower(email) = ${email} LIMIT 1`)
  if (dup.rows.length) throw new JobError('You have already applied for this job.', 409)

  const tokenHash = createHash('sha256').update(input.resumeToken).digest('hex')
  // Claim the one-time, short-lived upload token and insert the application in a single SQL statement.
  // The resume remains private; admins can open it through the authenticated /api/media/:id route.
  const inserted = await run(sql`
    WITH claimed_resume AS (
      UPDATE job_resume_uploads
      SET consumed_at = now()
      WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > now()
      RETURNING media_id
    )
    INSERT INTO job_applications (job_id, name, email, phone, cover_letter, resume_url)
    SELECT ${Number(job.id)}, ${input.name.trim()}, ${email}, ${input.phone?.trim() || null}, ${input.coverLetter?.trim() || null}, '/api/media/' || claimed_resume.media_id::text
    FROM claimed_resume
    RETURNING id
  `)
  const row = inserted.rows[0] as Row | undefined
  if (!row) throw new JobError('Your resume upload has expired or was already used. Please upload it again.', 410)
  return Number(row.id)
}
