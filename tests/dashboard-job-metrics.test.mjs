import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('../app/admin/dashboard/overview/page.tsx')
const route = read('../app/api/admin/dashboard/route.ts')
const ddl = read('../lib/cms/ddl.ts')

test('dashboard removes enquiry, form-user and completed-donation metrics', () => {
  assert.doesNotMatch(page, /label: ['\"]Enquiries['\"]/i)
  assert.doesNotMatch(page, /label: ['\"]Form users['\"]/i)
  assert.doesNotMatch(page, /label: ['\"]Completed donations['\"]/i)
  assert.doesNotMatch(page, /Enquiry frequency|Enquiry conversion/i)
  assert.doesNotMatch(route, /FROM form_users|FROM submissions/)
})

test('dashboard adds total posted jobs, open jobs and total applicants', () => {
  assert.match(page, /label: 'Total posted jobs'.*stats\.postedJobs/)
  assert.match(page, /label: 'Total open jobs'.*stats\.openJobs/)
  assert.match(page, /label: 'Total applicants'.*stats\.applicants/)
  assert.match(route, /AS posted_jobs/)
  assert.match(route, /AS open_jobs/)
  assert.match(route, /AS applicants/)
})

test('job application frequency is grouped by Dhaka calendar date', () => {
  assert.match(page, /Job application frequency/)
  assert.match(page, /valueKey="applications"/)
  assert.match(route, /application_daily AS/)
  assert.match(route, /AT TIME ZONE 'Asia\/Dhaka'/)
  assert.match(route, /COALESCE\(application_daily\.applications, 0\)/)
})

test('application trend query has a created-at index for range scans', () => {
  assert.match(ddl, /job_applications_created_idx ON job_applications\(created_at DESC\)/)
  assert.match(route, /WITH date_bounds AS \(/)
  assert.match(route, /AS start_day/)
  assert.match(route, /date_bounds\.start_day::timestamp AT TIME ZONE 'Asia\/Dhaka'/)
  assert.match(route, /date_bounds\.today \+ 1/)
  assert.match(route, /\$\{days - 1\}::int/)
  assert.doesNotMatch(route, /- \?\)::timestamp/)
})
