import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/admin/dashboard/jobs/page.tsx', import.meta.url), 'utf8')
const tabs = readFileSync(new URL('../components/admin/cms/AdminTabs.tsx', import.meta.url), 'utf8')

test('Applications primary tab shows a corner badge containing the new applicant count', () => {
  assert.match(page, /newApplicantCount[\s\S]*count: newApplicantCount, countPosition: 'corner'/)
  assert.match(tabs, /countPosition\?: 'inline' \| 'corner'/)
  assert.match(tabs, /item.countPosition === 'corner' && 'relative pr-4'/)
})

test('Applications defaults to New and uses the shared sortable table with newest-first data ordering', () => {
  assert.match(page, /useState<ApplicantStatusFilter>\('new'\)/)
  assert.match(page, /applicationSort, setApplicationSort.*'newest'/)
  assert.match(page, /return applicationSort === 'oldest' \? aTime - bTime : bTime - aTime/)
  assert.match(page, /<AdminTable[\s\S]*?rows=\{visibleApplications\}/)
  assert.match(page, /footer=\{[\s\S]*?Showing \{visibleApplications\.length/)
  assert.doesNotMatch(page, /className="admin-table-scroll"><table className="admin-table jobs-applications-table"/)
})

test('Applications expose exactly the five recruitment status tabs', () => {
  const block = page.slice(page.indexOf('const APPLICATION_FILTERS'), page.indexOf('const dateLabel'))
  for (const status of ["value: 'new'", "value: 'reviewing'", "value: 'shortlisted'", "value: 'rejected'", "value: 'hired'"]) assert.ok(block.includes(status))
  assert.doesNotMatch(block, /value: 'all'/)
  assert.match(block, /Short-listed/)
})

test('Applicant detail pane exposes explicit status action buttons', () => {
  assert.match(page, /jobs-applicant-status-actions/)
  assert.match(page, /aria-label="Set applicant recruitment status"/)
  assert.match(page, /onClick=\{\(\) => selectedApplicant && void changeStatus\(selectedApplicant\.id, status\.value\)\}/)
  assert.match(page, /Applied for/)
  assert.match(page, /selectedApplicant\.jobTitle/)
})

test('The shared applications table opens the persistent applicant detail pane from a selected row action', () => {
  assert.match(page, /key: 'candidate'[\s\S]*?onClick=\{\(\) => setSelectedApplicantId\(applicant\.id\)\}/)
  assert.match(page, /<AdminTable/)
  assert.match(page, /jobs-applicant-detail-panel/)
  assert.match(page, /const selectedApplicant = visibleApplications\.find\(\(applicant\) => applicant\.id === selectedApplicantId\)/)
  assert.doesNotMatch(page, /jobs-applicant-modal|aria-modal=\"true\"/)
  assert.match(readFileSync(new URL('../components/ui/button.tsx', import.meta.url), 'utf8'), /focus-visible:ring/)
  assert.match(page, /<Button/)
})
