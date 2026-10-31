import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = readFileSync(new URL('../app/admin/dashboard/settings/SettingsClient.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/admin/dashboard/settings/settings.css', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../app/admin/dashboard/_components/Shell.tsx', import.meta.url), 'utf8')

test('Settings imports route-specific styles and keeps its existing sidebar destinations discoverable', () => {
  assert.match(client, /import '\.\/settings\.css'/)
  assert.match(shell, /label: 'CMS Users', href: '\/admin\/dashboard\/settings\?view=users'/)
  assert.match(shell, /label: 'Database & APIs', href: '\/admin\/dashboard\/settings\?view=database'/)
  assert.match(shell, /label: 'Reporting', href: '\/admin\/dashboard\/settings\?view=reporting'/)
  assert.doesNotMatch(client, /className="settings-navigation"/)
})

test('CMS user creation validates email and the API password requirements before saving', () => {
  assert.match(client, /function isValidEmail/)
  assert.match(client, /value\.length >= 10 && \/\[A-Za-z\]\//)
  assert.match(client, /setFormError\('Enter a valid email address\.'/)
  assert.match(client, /setFormError\('Use at least 10 characters, including one letter and one number\.'/)
  assert.match(client, /onSubmit=\{\(event\) => void add\(event\)\}/)
})

test('CMS user list has search, role and status filters with labelled account actions', () => {
  assert.match(client, /Search email, role or source/)
  assert.match(client, /All statuses/)
  assert.match(client, /All roles/)
  assert.match(client, /Reset password for \$\{user\.email\}/)
  assert.match(client, /Disable account/)
  assert.match(client, /Delete \$\{user\.email\}/)
})

test('Password reset dialog manages focus, Escape, keyboard tab order and background scrolling', () => {
  assert.match(client, /aria-modal="true"/)
  assert.match(client, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(client, /event\.key === 'Escape'/)
  assert.match(client, /event\.key !== 'Tab'/)
  assert.match(client, /previousFocus\.focus\(\)/)
})

test('Reporting includes indeterminate select-all, row selection and selected/all CSV exports', () => {
  assert.match(client, /selectAllRef\.current\.indeterminate = someVisibleSelected && !allVisibleSelected/)
  assert.match(client, /aria-label="Select all matching rows"/)
  assert.match(client, /aria-label=\{`Select row \$\{index \+ 1\}`\}/)
  assert.match(client, /exportRows\(selectedRows, 'selected'\)/)
  assert.match(client, /exportRows\(data \?\? \[\], 'all'\)/)
})

test('Settings stylesheet has compact responsive layouts and visible keyboard focus', () => {
  assert.match(styles, /@media \(max-width: 760px\)/)
  assert.match(styles, /@media \(max-width: 520px\)/)
  assert.match(styles, /:focus-visible/)
  assert.match(styles, /prefers-reduced-motion/)
})
