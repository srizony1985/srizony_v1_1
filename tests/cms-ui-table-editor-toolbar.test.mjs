import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const globalCss = read('app/globals.css')
const pipeline = read('app/admin/dashboard/cms-pipeline/page.tsx')
const report = read('app/admin/dashboard/reports/[report]/page.tsx')
const applicationBuilder = read('components/admin/JobApplicationFormBuilder.tsx')
const navigation = read('app/admin/dashboard/navigation/page.tsx')
const commonTable = read('components/admin/cms/AdminTable.tsx')

test('CMS pipeline domains use an accessible, horizontally and vertically scrollable shadcn data table', () => {
  assert.match(pipeline, /<AdminDataContainer[\s\S]*bodyScroll="auto"/)
  assert.match(pipeline, /caption="Database content domains"/)
  assert.match(pipeline, /<AdminTable<DomainStatus>/)
  assert.match(commonTable, /overflow-auto overscroll-contain/)
  assert.match(commonTable, /sticky top-0 z-20/)
  assert.match(commonTable, /admin-table-summary/)
  for (const column of ['Content domain', 'Database table', 'Records', 'Data status', 'Action']) assert.ok(pipeline.includes(column))
})

test('visitor reports have their own content region and independent bounded table scrolling', () => {
  assert.match(report, /<AdminDataContainer[\s\S]*label=\{`\$\{config\.title\} records`\}/)
  assert.doesNotMatch(report, /<section className="admin-main">/)
  assert.match(report, /bodyScroll="hidden"/)
  assert.match(commonTable, /overflow-auto overscroll-contain/)
  assert.match(report, /admin-report-cell-value/)
})

test('job application form editor keeps header, scrolling fields and save actions in a bounded component layout', () => {
  assert.match(applicationBuilder, /<AdminDataContainer[\s\S]*label="Job application form builder"/)
  assert.match(applicationBuilder, /title="Job application form builder"/)
  assert.match(applicationBuilder, /bodyScroll="auto"/)
  assert.match(applicationBuilder, /<Button/)
  assert.match(applicationBuilder, /<Textarea/)
})

test('admin toolbars, tables and navigation use shadcn semantic tokens and responsive utilities', () => {
  assert.match(read('components/admin/cms/AdminTabs.tsx'), /overflow-x-auto/)
  assert.match(read('components/admin/cms/AdminToolbar.tsx'), /flex min-w-0 flex-wrap/)
  assert.match(commonTable, /admin-table-scroll min-h-0 h-full w-full overflow-auto overscroll-contain/)
  assert.match(read('app/admin/dashboard/jobs/page.tsx'), /tableClassName="min-w-\[720px\]"/)
  assert.match(navigation, /role="tree" aria-label="Site navigation"/)
  assert.match(navigation, /cms-navigation-tree/)
  assert.doesNotMatch(navigation, /className="nav-actions"/)
  assert.match(read('components/admin/cms/AdminToolbar.tsx'), /bg-background\/80/)
})

test('public page typography stays in globals while admin styling is entirely component-owned', () => {
  assert.match(globalCss, /\.cms-typography-scope/)
  assert.match(globalCss, /\.cms-card-illustration/)
  assert.doesNotMatch(read('app/admin/layout.tsx'), /Admin\.css/)
  assert.match(read('app/admin/AdminThemeShell.tsx'), /admin-theme-root/)
})
