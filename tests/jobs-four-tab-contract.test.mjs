import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

test('Job & Applications exposes exactly four primary tabs and no inbox tab', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  const tabs = page.match(/\{ value: '(?:vacancies|applications|process|form)', label:/g) || []
  assert.equal(tabs.length, 4)
  assert.match(page, /label: 'Vacancies'/)
  assert.match(page, /label: 'Applications'/)
  assert.match(page, /label: 'Application Process'/)
  assert.match(page, /label: 'Application Form'/)
  assert.doesNotMatch(page, /Applicant inbox|value: 'inbox'|kind: 'notifications'|notificationCategoryFilter/)
})

test('only Vacancies mounts the two-column vacancy lifecycle workspace', () => {
  const page = read('app/admin/dashboard/jobs/page.tsx')
  const lifecycle = read('app/admin/dashboard/_components/LifecycleWorkspace.tsx')
  const applicationStart = page.indexOf("{activeTab === 'applications' &&")
  const processStart = page.indexOf("{activeTab === 'process' &&", applicationStart)
  const applicationsBranch = page.slice(applicationStart, processStart)
  assert.match(page, /activeTab === 'vacancies' && \(\s*<LifecycleWorkspace/)
  assert.match(lifecycle, /className="jobs-lifecycle-workspace-grid min-w-0"/)
  assert.doesNotMatch(applicationsBranch, /jobs-workspace|jobs-list-panel/)
  assert.match(page, /activeTab === 'applications' \? getJobApplications\(\)/)
})

test('application process visibility is validated and consumed by public job pages', () => {
  const route = read('app/api/admin/job-application-process/route.ts')
  const site = read('lib/site.ts')
  const template = read('components/pages/PageTemplate.tsx')
  const detail = read('components/pages/JobPostingDetail.tsx')
  assert.match(route, /requireAdmin\('admin', 'editor'\)/)
  assert.match(route, /writeCmsDocument\('job-application-process\.json'/)
  assert.match(site, /job-application-process\.json/)
  assert.match(template, /processConfig=\{site\.jobApplicationProcess\}/)
  assert.match(detail, /processConfig\.visible && processConfig\.steps\.some/)
})
