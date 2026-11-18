import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('admin shell bounds the workspace to the viewport and keeps scrolling inside the content area', () => {
  const shell = read('components/admin/cms/AdminAppShell.tsx')
  assert.match(shell, /h-dvh min-h-dvh w-full min-w-0 overflow-hidden/)
  assert.match(shell, /group-data-\[mobile-open=true\]\/admin-shell:translate-x-0/)
  assert.match(shell, /group-data-\[collapsed=true\]\/admin-shell:md:w-18/)
  assert.match(shell, /flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden/)
  assert.match(shell, /overflow-auto overscroll-contain/)
  assert.match(shell, /min-w-0/)
})

test('workspace header uses the shared component system and keeps actions responsive', () => {
  const header = read('components/admin/cms/AdminWorkspaceHeader.tsx')
  assert.match(header, /import \{ Button \} from ['"]@\/components\/ui\/button['"]/)
  assert.match(header, /PanelLeftClose|PanelLeftOpen/)
  assert.match(header, /Save all/)
  assert.match(header, /flex min-h-14 min-w-0 flex-wrap/)
  assert.match(header, /<Button/)
})

test('dashboard cards use intrinsic grid sizing and wide tables own their scroll area', () => {
  const overview = read('app/admin/dashboard/overview/page.tsx')
  const table = read('components/admin/cms/AdminTable.tsx')
  assert.match(overview, /columns="repeat\(auto-fit, minmax\(min\(100%, 190px\), 1fr\)\)"/)
  assert.match(table, /overflow-auto overscroll-contain/)
  assert.match(table, /sticky top-0 z-20/)
  assert.match(table, /admin-table-summary/)
})


test('CMS global styles keep search, forms, data panels and responsive headers theme-aware', () => {
  const css = read('app/globals.css')
  assert.match(css, /\.admin-theme-root\s*\{[^}]*color-scheme:\s*light/s)
  assert.match(css, /\.admin-theme-root\.dark\s*\{[^}]*color-scheme:\s*dark/s)
  assert.match(css, /settings-search[^}]*min-width:\s*0/s)
  assert.match(css, /input:not\(\[type="checkbox"\]\)[^}]*background-color:\s*var\(--card\)/s)
  assert.match(css, /admin-workspace-header[^}]*height:\s*auto/s)
  assert.match(css, /@media \(max-width:\s*640px\)/)
  assert.match(css, /settings-drive-readiness-grid[^}]*repeat\(auto-fit/s)
})
