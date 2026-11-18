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

test('job management has no notification tab and exposes the four defined workflows', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  assert.match(page, /label: 'Vacancies'/)
  assert.match(page, /label: 'Applications'/)
  assert.match(page, /label: 'Application Process'/)
  assert.match(page, /label: 'Application Form'/)
  assert.doesNotMatch(page, /Applicant inbox|kind: 'notifications'|notificationCategoryFilter/)
})

test('Vacancies use lifecycle stages and Applications use all five recruitment statuses', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  const lifecycle = read('app/admin/dashboard/_components/LifecycleWorkspace.tsx')
  for (const stage of ['new', 'review', 'interview', 'processed']) assert.ok(lifecycle.includes(`value: '${stage}'`))
  for (const status of ['new', 'reviewing', 'shortlisted', 'rejected', 'hired']) assert.ok(page.includes(`value: '${status}'`))
  assert.match(lifecycle, /label="Vacancy workflow stage"/)
  assert.match(page, /aria-label="Filter applications by status"/)
})

test('applicant status updates update the displayed list and refresh job-level counts', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  assert.match(page, /setApplicationStatus\(id, status\)/)
  assert.match(page, /applications\.setData/)
  assert.match(page, /void jobs\.reload\(\)/)
})
