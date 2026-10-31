import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('job editor exposes a bilingual category for applicant notification grouping', () => {
  const components = read('lib/cms/components.ts')
  assert.match(components, /key: 'category', label: 'Job category', type: 'text', bilingual: true/)
})

test('admin jobs API exposes a no-cache new applicant notification feed', () => {
  const route = read('app/api/admin/jobs/route.ts')
  const service = read('lib/cms/jobs.ts')
  assert.match(route, /view'\) === 'notifications'[\s\S]*listApplicantNotifications\(\)/)
  assert.match(service, /COUNT\(\*\)::int AS total FROM job_applications WHERE status = 'new'/)
  assert.match(service, /WHERE a\.status = 'new' ORDER BY a\.created_at DESC LIMIT 2000/)
  assert.match(service, /job_category_en/)
  assert.match(service, /job_category_bn/)
})

test('job management shows a total applicant notification count and category-grouped inbox', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  assert.match(page, /newApplicantCount/)
  assert.match(page, /New applicant notifications/)
  assert.match(page, /job-notification-category/)
  assert.match(page, /job-notification-job/)
  assert.match(page, /Review applicants/)
})

test('CMS filters vacancies by publishing state and applicants by recruitment state', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  for (const status of ['published', 'draft', 'hidden']) assert.ok(page.includes(status))
  for (const status of ['new', 'reviewing', 'shortlisted', 'rejected', 'hired']) assert.ok(page.includes(status))
  assert.match(page, /aria-label="Filter job posts by status"/)
  assert.match(page, /aria-label="Filter applicants by recruitment status"/)
})

test('applicant status updates update the displayed list and refresh job-level counts', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  assert.match(page, /setApplicationStatus\(id, status\)/)
  assert.match(page, /apps\.setData/)
  assert.match(page, /void jobs\.reload\(\)/)
})
