import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('sidebar search icon and input share a single aligned flex row', () => {
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  assert.match(shell, /<Search className="pointer-events-none absolute left-3/)
  assert.match(shell, /<Input[\s\S]*?type="search"[\s\S]*?aria-label="Search CMS navigation"/)
  assert.match(shell, /relative/)
})

test('Footer Navigation is a dedicated protected screen with its own three section tabs', () => {
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  const footerPage = read('app/admin/dashboard/footer/page.tsx')
  const footerEditor = read('app/admin/dashboard/_components/FooterSettingsView.tsx')
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  assert.match(shell, /label: 'Footer Navigation',[^\n]*href: '\/admin\/dashboard\/footer'/)
  assert.match(footerPage, /getAdminSession\(\)/)
  assert.match(footerPage, /<FooterSettingsView role=\{session\.role\} \/>/)
  assert.match(footerEditor, /label: 'Layout & Content'/)
  assert.match(footerEditor, /label: 'Typography'/)
  assert.match(footerEditor, /label: 'Sections'/)
  assert.match(footerEditor, /onRefresh=\{refresh\}/)
  assert.doesNotMatch(settings, /footer: \{ title: 'Footer'/)
  assert.match(settings, /requested === 'footer'\) router\.replace\('\/admin\/dashboard\/footer'/)
})
