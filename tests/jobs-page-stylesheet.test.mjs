import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../app/admin/dashboard/jobs/page.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../app/admin/dashboard/jobs/jobs.css', import.meta.url), 'utf8')

test('Jobs page imports its route-specific stylesheet', () => {
  assert.match(page, /import\s+['"]\.\/jobs\.css['"]\s*;?/)
})

test('Jobs page styles cover the main management and applicant views', () => {
  for (const selector of [
    '.jobs-workspace',
    '.jobs-list-panel',
    '.job-filter-tabs',
    '.jobs-list-item',
    '.job-notification-trigger',
    '.jobs-notification-inbox',
    '.job-notification-groups',
    '.job-notification-applicant',
    '.application-status-tabs',
    '.jobs-applications-table',
    '.jobs-placeholder',
  ]) {
    assert.ok(css.includes(selector), `Missing Jobs CSS selector: ${selector}`)
  }
})

test('Jobs styles include compact mobile layouts and keyboard focus visibility', () => {
  assert.match(css, /@media\s*\(max-width:\s*600px\)/)
  assert.match(css, /@media\s*\(max-width:\s*820px\)/)
  assert.match(css, /:focus-visible/)
  assert.match(css, /prefers-reduced-motion/)
})
