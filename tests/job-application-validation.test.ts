import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasPdfSignature,
  isApplicationDeadlineOpen,
  MAX_RESUME_BYTES,
  safeResumeFileName,
  validateJobApplicationFields,
} from '../lib/jobApplicationValidation'

const validFields = { name: 'Demo Applicant', email: 'demo.applicant@example.com', phone: '+880 1000-000000', coverLetter: 'This is a functional test.' }

test('accepts a PDF file signature and rejects invalid or empty files', () => {
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), true)
  assert.equal(hasPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46])), false)
  assert.equal(hasPdfSignature(new Uint8Array()), false)
})

test('enforces the resume size cap used by the upload API and form', () => {
  assert.equal(MAX_RESUME_BYTES, 4 * 1024 * 1024)
  assert.equal(MAX_RESUME_BYTES < 5 * 1024 * 1024, true)
})

test('accepts realistic dummy application fields', () => {
  assert.deepEqual(validateJobApplicationFields(validFields), {})
})

test('rejects short names, invalid email, oversize fields, and a filled spam honeypot', () => {
  const errors = validateJobApplicationFields({ name: 'X', email: 'not-an-email', phone: '1'.repeat(41), coverLetter: 'x'.repeat(5001), website: 'https://spam.invalid' })
  assert.ok(errors.name)
  assert.ok(errors.email)
  assert.ok(errors.phone)
  assert.ok(errors.coverLetter)
  assert.ok(errors.website)
})

test('allows jobs through their closing date and rejects expired deadlines', () => {
  const now = new Date('2026-10-28T12:00:00+06:00')
  assert.equal(isApplicationDeadlineOpen('2026-10-28', now), true)
  assert.equal(isApplicationDeadlineOpen('2026-10-27', now), false)
  assert.equal(isApplicationDeadlineOpen('2099-12-31', now), true)
  assert.equal(isApplicationDeadlineOpen('not-a-date', now), false)
  assert.equal(isApplicationDeadlineOpen('', now), true)
})

test('normalizes a potentially hostile upload name to a PDF basename', () => {
  assert.equal(safeResumeFileName('../../My CV final.pdf'), 'My-CV-final.pdf')
  assert.equal(safeResumeFileName('malicious.exe'), 'malicious.pdf')
  assert.equal(safeResumeFileName(''), 'resume.pdf')
})
