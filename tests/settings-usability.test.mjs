import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const client = readFileSync(new URL('../app/admin/dashboard/settings/SettingsClient.tsx', import.meta.url), 'utf8')
const table = readFileSync(new URL('../components/admin/cms/AdminTable.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../app/admin/dashboard/_components/Shell.tsx', import.meta.url), 'utf8')

test('Settings uses the consolidated stylesheet and keeps its existing sidebar destinations discoverable', () => {
  assert.doesNotMatch(client, /settings\.css|Admin\.css|site-polish\.css/)
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
  assert.match(client, /id="cms-user-create-form"/)
  assert.match(client, /type="submit" form="cms-user-create-form"/)
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
  assert.match(client, /acquireModalScrollLock\(/)
  assert.match(client, /root\.style\.overflow = 'hidden'/)
  assert.match(client, /body\.style\.overflow = 'hidden'/)
  assert.match(client, /restoreDocumentScroll\?\.\(\)/)
  assert.match(client, /event\.key === 'Escape'/)
  assert.match(client, /event\.key !== 'Tab'/)
  assert.match(client, /previousFocus\.focus\(\)/)
})

test('Reporting uses the shared table selection model and preserves selected/all CSV exports', () => {
  assert.match(client, /<AdminTable[\s\S]*?selectable[\s\S]*?selectedIds=\{\[\.\.\.selected\]\.map\(String\)\}/)
  assert.match(table, /<Checkbox\s+checked=\{allSelected\}\s+indeterminate=\{someSelected\}/)
  assert.match(table, /aria-label="Select all visible rows"/)
  assert.match(table, /aria-label=\{`Select row \${id}`\}/)
  assert.match(client, /selectedExportable/)
  assert.match(client, /exportable/)
  assert.match(table, /exportCsv\('selected'\)/)
  assert.match(table, /exportCsv\('all'\)/)
  assert.match(table, /anchor\.download = scope === 'selected'/)
})

test('Settings screens are built from the shared shadcn primitives', () => {
  assert.match(client, /<Card/)
  assert.match(client, /<Button/)
  assert.match(client, /<Input/)
  assert.match(client, /<NativeSelect/)
  assert.match(client, /<label/)
  assert.doesNotMatch(client, /Admin\.css|settings\.css/)
})


test('Settings uses the shared toolbar tabs and exposes an associated accessible panel', () => {
  assert.match(client, /import \{[^}]*AdminTabs[^}]*\} from '@\/components\/admin\/cms'/)
  assert.match(client, /tabs=\{[\s\S]*?<AdminTabs/)
  assert.match(client, /id="database-view-tabs"/)
  assert.match(client, /panelId="database-view-panel"/)
  assert.match(client, /id="settings-view-panel"/)
  assert.match(client, /aria-label=\{`\$\{meta\.title\} settings`\}/)
  assert.match(client, /router\.replace\('\/admin\/dashboard\/footer'\)/)
})
