import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getMappedJobApplicationValues,
  normalizeJobApplicationFormConfig,
  DEFAULT_JOB_APPLICATION_FORM,
  validateCustomJobFields,
} from '../lib/jobApplicationForm'
import {
  hasPdfSignature,
  isApplicationDeadlineOpen,
  MAX_RESUME_BYTES,
  safeResumeFileName,
} from '../lib/jobApplicationValidation'

const exampleConfig = {
  version: 2 as const,
  headingEn: 'Apply', headingBn: '', descriptionEn: '', descriptionBn: '', submitLabelEn: 'Send', submitLabelBn: '',
  fields: [
    { id: 'custom_person_name', systemField: 'name' as const, labelEn: 'Candidate name', labelBn: '', type: 'text' as const, required: true, minLength: 2, maxLength: 160 },
    { id: 'custom_person_email', systemField: 'email' as const, labelEn: 'Contact email', labelBn: '', type: 'email' as const, required: false, maxLength: 254 },
    { id: 'custom_portfolio', labelEn: 'Portfolio URL', labelBn: '', type: 'url' as const, required: false },
    { id: 'custom_resume_file', systemField: 'resume' as const, labelEn: 'CV file', labelBn: '', type: 'resume' as const, required: false },
  ],
}

test('accepts a PDF file signature and rejects invalid or empty files', () => {
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true)
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46])), false)
  assert.equal(hasPdfSignature(new Uint8Array()), false)
})

test('enforces the resume size cap used by the upload API and form', () => {
  assert.equal(MAX_RESUME_BYTES, 4 * 1024 * 1024)
  assert.equal(MAX_RESUME_BYTES < 5 * 1024 * 1024, true)
})

test('migrates legacy additional-only configuration into editable CMS-managed starter fields', () => {
  const migrated = normalizeJobApplicationFormConfig({ fields: [{ id: 'custom_test_question', labelEn: 'Question', labelBn: '', type: 'text', required: false }] })
  assert.equal(migrated.version, 2)
  assert.ok(migrated.fields.some((field) => field.systemField === 'name'))
  assert.ok(migrated.fields.some((field) => field.systemField === 'email'))
  assert.ok(migrated.fields.some((field) => field.systemField === 'resume'))
  assert.ok(migrated.fields.some((field) => field.id === 'custom_test_question'))
})

test('moves legacy select empty-option labels into editable CMS field settings', () => {
  const normalized = normalizeJobApplicationFormConfig({ fields: [{ id: 'custom_legacy_select', labelEn: 'Department', labelBn: '', type: 'select', required: true, options: ['Finance'] }] })
  const select = normalized.fields.find((field) => field.id === 'custom_legacy_select')
  assert.equal(select?.selectPlaceholderEn, 'Select an option')
  assert.equal(select?.selectPlaceholderBn, 'একটি বিকল্প নির্বাচন করুন')
})

test('validates configured required fields, email and URL values without fixed field requirements', () => {
  assert.deepEqual(validateCustomJobFields(exampleConfig, { custom_person_name: 'Demo Applicant' }), {})
  const errors = validateCustomJobFields(exampleConfig, { custom_person_name: 'X', custom_person_email: 'invalid', custom_portfolio: 'javascript:alert(1)' })
  assert.ok(errors.custom_person_name)
  assert.ok(errors.custom_person_email)
  assert.ok(errors.custom_portfolio)
})

test('maps only the CMS-selected system fields into legacy applicant columns', () => {
  assert.deepEqual(getMappedJobApplicationValues(exampleConfig, {
    custom_person_name: ' Demo Applicant ',
    custom_person_email: 'DEMO@example.com',
    custom_portfolio: 'https://example.com',
  }), { name: 'Demo Applicant', email: 'DEMO@example.com', phone: '', coverLetter: '' })
})

test('rejects unknown values and requires a resume only when CMS marks it required', () => {
  const requiredResume = { ...exampleConfig, fields: exampleConfig.fields.map((field) => field.type === 'resume' ? { ...field, required: true } : field) }
  assert.ok(validateCustomJobFields(requiredResume, { custom_person_name: 'Demo Applicant' }).custom_resume_file)
  assert.deepEqual(validateCustomJobFields(requiredResume, { custom_person_name: 'Demo Applicant' }, 'one-time-resume-token-123456789012345678901234567890'), {})
  assert.ok(validateCustomJobFields(exampleConfig, { custom_person_name: 'Demo Applicant', custom_unknown: 'invalid' }).custom_unknown)
})

test('allows jobs through their closing date and rejects expired deadlines', () => {
  const now = new Date('2026-10-28T12:00:00+06:00')
  assert.equal(isApplicationDeadlineOpen('2026-10-28', now), true)
  assert.equal(isApplicationDeadlineOpen('2026-10-27', now), false)
  assert.equal(isApplicationDeadlineOpen('2099-12-31', now), true)
  assert.equal(isApplicationDeadlineOpen('not-a-date', now), false)
  assert.equal(isApplicationDeadlineOpen('2026-02-31', now), false)
  assert.equal(isApplicationDeadlineOpen('2026-13-01', now), false)
  assert.equal(isApplicationDeadlineOpen('', now), true)
})

test('starter form is itself editable configuration rather than separate public markup', () => {
  assert.equal(DEFAULT_JOB_APPLICATION_FORM.version, 2)
  assert.ok(DEFAULT_JOB_APPLICATION_FORM.fields.every((field) => field.id.startsWith('custom_')))
  assert.ok(DEFAULT_JOB_APPLICATION_FORM.fields.some((field) => field.systemField === 'resume' && field.type === 'resume'))
})

test('normalizes a potentially hostile upload name to a PDF basename', () => {
  assert.equal(safeResumeFileName('../../My CV final.pdf'), 'My-CV-final.pdf')
  assert.equal(safeResumeFileName('malicious.exe'), 'malicious.pdf')
  assert.equal(safeResumeFileName(''), 'resume.pdf')
})
