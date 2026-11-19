import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('shared CMS section tabs support selected state and keyboard navigation', () => {
  const tabs = read('components/admin/cms/AdminTabs.tsx')
  const compatibility = read('app/admin/dashboard/_components/AdminCommon.tsx')
  assert.match(tabs, /role="tablist"/)
  assert.match(tabs, /aria-selected=\{selected\}/)
  assert.match(tabs, /event\.key === 'ArrowRight'/)
  assert.match(tabs, /event\.key === 'ArrowLeft'/)
  assert.match(tabs, /event\.key === 'Home'/)
  assert.match(tabs, /event\.key === 'End'/)
  assert.match(tabs, /event\.target\.closest<HTMLButtonElement>\('\[role=\"tab\"\]'\)/)
  assert.match(tabs, /aria-controls=\{panelId\}/)
  assert.match(compatibility, /return <AdminTabs \{\.\.\.props\} \/>/)
})

test('toolbar renders the tabs on the left before refresh and page actions', () => {
  const toolbar = read('components/admin/cms/AdminToolbar.tsx')
  const tabsIndex = toolbar.indexOf('{tabs ?')
  const actionIndex = toolbar.indexOf('onRefresh &&')
  assert.ok(tabsIndex >= 0 && actionIndex > tabsIndex)
  assert.match(toolbar, /sticky top-0 z-30/)
  assert.match(toolbar, /border-border/)
})

test('multi-section editors and Settings reuse shared tabs while sidebar destinations remain available', () => {
  for (const file of [
    'app/admin/dashboard/portfolio/page.tsx',
    'app/admin/dashboard/website-essentials/page.tsx',
    'app/admin/dashboard/jobs/page.tsx',
    'app/admin/dashboard/cms-pipeline/page.tsx',
  ]) {
    const source = read(file)
    assert.match(source, /<AdminSectionTabs/, `${file} should use shared tabs`)
    assert.match(source, /<(?:SectionToolbar|AdminToolbar)/, `${file} should place tabs in the shared toolbar`)
  }
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  assert.match(settings, /<section[\s\S]*?id="settings-view-panel"[\s\S]*?aria-label=\{`\$\{meta\.title\} settings`\}/)
  assert.match(settings, /<AdminTabs/)
  assert.match(settings, /id="database-view-tabs"/)
  assert.match(settings, /panelId="database-view-panel"/)
  assert.doesNotMatch(settings, /<AdminSectionTabs/)
  for (const view of ['users', 'database', 'reporting', 'theme']) {
    assert.ok(shell.includes(`/admin/dashboard/settings?view=${view}`), `Settings ${view} view must be reachable from sidebar`)
  }
})

test('Page Builder section editors show one selected section panel and preserve inactive drafts', () => {
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(pageBuilder, /<AdminSectionTabs/)
  assert.match(pageBuilder, /hidden=\{index !== Math\.min\(activeSectionIndex, sections\.length - 1\)\}/)
  assert.match(pageBuilder, /role=\{index === Math\.min\(activeSectionIndex, sections\.length - 1\) \? 'tabpanel' : undefined\}/)
})

test('inactive editor panels use the native hidden attribute without global admin CSS', () => {
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(pageBuilder, /hidden=\{index !== Math\.min\(activeSectionIndex, sections\.length - 1\)\}/)
  assert.doesNotMatch(read('app/admin/layout.tsx'), /Admin\.css/)
})
