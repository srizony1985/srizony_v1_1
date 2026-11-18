import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public application inputs and field labels are rendered from the CMS field array', () => {
  const form = read('components/pages/JobApplicationForm.tsx')
  assert.match(form, /formConfig\.fields\.map\(/)
  assert.match(form, /const label = bn && field\.labelBn \? field\.labelBn : field\.labelEn/)
  assert.match(form, /required=\{field\.required\}/)
  assert.doesNotMatch(form, /Full name|Email address|Phone number|Cover letter/)
  assert.doesNotMatch(form, /name=\"name\"|name=\"email\"|name=\"phone\"|name=\"coverLetter\"/)
})

test('CMS builder manages all form content, mappings, field types, and ordering', () => {
  const builder = read('components/admin/JobApplicationFormBuilder.tsx')
  assert.match(builder, /Heading \(English\)/)
  assert.match(builder, /Label \(English\)/)
  assert.match(builder, /Applicant data mapping/)
  assert.match(builder, /PDF resume upload/)
  assert.match(builder, /New field/)
  assert.match(builder, /Remove field/)
  assert.match(builder, /onMove\(field\.id, -1\)/)
  assert.match(builder, /onMove\(field\.id, 1\)/)
})

test('server validates CMS-defined field values and derives legacy inbox columns from configured mappings', () => {
  const route = read('app/api/jobs/apply/route.ts')
  const validation = read('lib/jobApplicationForm.ts')
  const service = read('lib/cms/jobs.ts')
  assert.match(route, /validateCustomJobFields/)
  assert.match(route, /getMappedJobApplicationValues/)
  assert.match(validation, /field\.systemField === 'name'/)
  assert.match(validation, /field\.systemField === 'email'/)
  assert.match(service, /if \(input\.resumeToken\)/)
  assert.match(service, /INSERT INTO job_applications \(job_id, name, email, phone, cover_letter, resume_url, custom_fields\)/)
  assert.match(service, /SELECT i\.id, \$\{name\}, \$\{email\}/)
})

test('resume upload endpoint is available only when the CMS form defines a resume field', () => {
  const route = read('app/api/jobs/resume/route.ts')
  assert.match(route, /formConfig\.fields\.some\(\(field\) => field\.type === 'resume'\)/)
  assert.match(route, /Resume uploads are not enabled on the current application form/)
})
