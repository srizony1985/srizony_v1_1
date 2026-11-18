import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the application modal removes the nested form card frame', async () => {
  const css = await read('app/globals.css')
  assert.match(css, /\.sf-job-modal-body \.sf-job-application\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s)
})

test('public submission checks the deadline server-side and queues a receipt', async () => {
  const jobs = await read('lib/cms/jobs.ts')
  const route = await read('app/api/jobs/apply/route.ts')
  assert.match(jobs, /if \(!isApplicationDeadlineOpen\(deadline\)\) throw new JobError\('The application deadline has passed/)
  assert.match(route, /!mapped\.name\.trim\(\)[\s\S]*!mapped\.email\.trim\(\)/)
  assert.match(route, /applicationReceivedEmail\(/)
  assert.match(route, /queueJobEmail\(message\)/)
})

test('legacy application-form documents are normalized with required name and email fields', async () => {
  const form = await read('lib/jobApplicationForm.ts')
  const builder = await read('components/admin/JobApplicationFormBuilder.tsx')
  assert.match(form, /requiredContactFields/)
  assert.match(form, /systemField: starter\.systemField, required: true/)
  assert.match(builder, /Applicant name is a required system field/)
  assert.match(builder, /Applicant email is a required system field/)
  assert.match(builder, /const isLockedField = \(field: JobApplicationCustomField\)/)
  assert.match(builder, /const locked = isLockedField\(field\)/)
  assert.match(builder, /disabled=\{locked\}/)
})

test('status updates create the requested reviewing, short-listed and rejected notifications', async () => {
  const templates = await read('lib/mail/job-templates.ts')
  const route = await read('app/api/admin/jobs/route.ts')
  assert.match(templates, /Your application is being reviewed for the/)
  assert.match(templates, /Congratulations! Your application has been short-listed for the/)
  assert.match(templates, /The interview schedule for this role will be published soon/)
  assert.match(templates, /Sorry! Your application has been rejected for the/)
  assert.match(route, /applicationStatusEmail\(/)
  assert.match(route, /queueJobEmail\(message\)/)
})

test('Nodemailer uses the actual Gmail mailbox and App Password over TLS SMTP', async () => {
  const mailer = await read('lib/mail/job-mailer.ts')
  assert.match(mailer, /host:\s*['"]smtp\.gmail\.com['"]/)
  assert.match(mailer, /port:\s*465/)
  assert.match(mailer, /secure:\s*true/)
  assert.match(mailer, /user:\s*config\.user/)
  assert.match(mailer, /pass:\s*config\.appPassword/)
  assert.match(mailer, /GMAIL_APP_PASSWORD/)
  assert.match(mailer, /replace\(\/\\s\+\/g, ['"]['"]\)/)
  assert.doesNotMatch(mailer, /GMAIL_REFRESH_TOKEN|GMAIL_CLIENT_ID|GMAIL_CLIENT_SECRET|oauth2\.googleapis\.com|gmail\.googleapis\.com/)
  assert.match(mailer, /JOB_MAIL_FROM[\s\S]*verified Gmail\/Workspace Send-As alias/)
})

test('the mail outbox is persistent, idempotent and retryable', async () => {
  const migration = await read('drizzle/0023_job_recruitment_workflow_and_email_outbox.sql')
  const outbox = await read('lib/cms/job-mail-outbox.ts')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS job_email_outbox/)
  assert.match(migration, /event_key VARCHAR\(240\) NOT NULL UNIQUE/)
  assert.match(outbox, /ON CONFLICT \(event_key\) DO NOTHING/)
  assert.match(outbox, /row\.status === 'pending'\) return attemptOutboxMessage\(Number\(row\.id\)\)/)
  assert.match(outbox, /next_attempt_at = now\(\) \+ \(\$\{delayMinutes\} \* interval '1 minute'\)/)
  assert.match(outbox, /attempts >= 12/)
})

test('vacancy stage is deadline-driven and the review count is visible', async () => {
  const service = await read('lib/cms/jobs.ts')
  const lifecycle = await read('app/admin/dashboard/_components/LifecycleWorkspace.tsx')
  assert.match(service, /isApplicationDeadlineOpen\(deadline\) \? 'new' : 'review'/)
  assert.match(lifecycle, /label: 'Review'/)
  assert.match(lifecycle, /count: counts\[item\.value\]/)
  assert.match(lifecycle, /count: counts\[item\.value\]/)
})

test('interview slots are sequential, sized by shortlisted applicants, and emailed individually', async () => {
  const jobs = await read('lib/cms/jobs.ts')
  const route = await read('app/api/admin/jobs/route.ts')
  const form = await read('components/admin/JobInterviewScheduleForm.tsx')
  assert.match(jobs, /ROW_NUMBER\(\) OVER \(ORDER BY a\.created_at ASC, a\.id ASC\)/)
  assert.match(jobs, /slot_number - 1/)
  assert.match(jobs, /slot_number \* \$\{minutes\}/)
  assert.match(form, /shortlistedCount \* minutes/)
  assert.match(route, /while \(cursor < schedule\.appointments\.length\)/)
  assert.match(route, /const index = cursor\+\+/)
  assert.match(route, /const appointment = schedule\.appointments\[index\]/)
  assert.match(route, /interviewAppointmentEmail\(/)
})

test('interview reschedules have a new revision and close only after shortlist resolution', async () => {
  const jobs = await read('lib/cms/jobs.ts')
  const route = await read('app/api/admin/jobs/route.ts')
  const lifecycle = await read('app/admin/dashboard/_components/LifecycleWorkspace.tsx')
  assert.match(jobs, /revision = job_vacancy_interviews\.revision \+ 1/)
  assert.match(jobs, /Existing appointment history is preserved/)
  assert.match(jobs, /active_interview AS MATERIALIZED[\s\S]*locked_applications AS MATERIALIZED[\s\S]*FOR UPDATE OF a/)
  assert.match(jobs, /This recruitment process is already closed/)
  assert.match(jobs, /Resolve all \$\{remaining\} short-listed applicants/)
  assert.match(route, /action: z\.literal\('extend-interview'\)/)
  assert.match(route, /action: z\.literal\('close-interview'\)/)
  assert.match(lifecycle, /Reschedule & notify/)
  assert.match(lifecycle, /Complete hiring & close interview/)
})

test('the vacancy interview schedule uses one Neon HTTP-compatible PostgreSQL statement', async () => {
  const jobs = await read('lib/cms/jobs.ts')
  const schedule = jobs.slice(jobs.indexOf('export async function scheduleVacancyInterview'), jobs.indexOf('export async function extendVacancyInterview'))
  assert.match(schedule, /WITH job AS MATERIALIZED/)
  assert.match(schedule, /upsert_interview AS \(/)
  assert.match(schedule, /upsert_appointments AS \(/)
  assert.doesNotMatch(schedule, /\.transaction\(/)
})

test('deadline extension reopens vacancies and application submission stays closed after expiry', async () => {
  const jobs = await read('lib/cms/jobs.ts')
  const detail = await read('components/pages/JobPostingDetail.tsx')
  assert.match(jobs, /workflowStage: 'new' as const/)
  assert.match(detail, /disabled=\{!applicationDeadlineOpen\}/)
  assert.match(detail, /Applications closed/)
})
