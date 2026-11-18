import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('admin select uses the shadcn native-select component contract', () => {
  const select = read('components/ui/native-select.tsx')
  assert.match(select, /data-slot="native-select"/)
  assert.match(select, /focus-visible:ring-ring/)
  assert.match(select, /border-input/)
  assert.match(select, /ChevronDown/)
  assert.match(select, /<select/)
})

test('admin inputs and checkboxes use shared shadcn primitives', () => {
  const input = read('components/ui/input.tsx')
  const checkbox = read('components/ui/checkbox.tsx')
  const table = read('components/admin/cms/AdminTable.tsx')
  assert.match(input, /data-slot="input"/)
  assert.match(input, /focus-visible:ring-ring/)
  assert.match(checkbox, /data-slot="checkbox"/)
  assert.match(checkbox, /focus-visible:ring-ring/)
  assert.match(table, /from ['"]@\/components\/ui\/checkbox['"]/)
})

test('admin light and dark modes are driven by scoped semantic tokens', () => {
  const shell = read('app/admin/AdminThemeShell.tsx')
  const css = read('app/globals.css')
  assert.match(shell, /data-admin-mode=\{mode\}/)
  assert.match(shell, /mode === 'dark' \? 'dark' : ''/)
  assert.match(css, /\.admin-theme-root\s*\{[^}]*--background:[^}]*--foreground:[^}]*--primary:/s)
  assert.match(css, /\.admin-theme-root\.dark\s*\{[^}]*--background:[^}]*--foreground:/s)
})


test('admin theme normalization explicitly covers header text, inputs, borders and hover surfaces', () => {
  const css = read('app/globals.css')
  assert.match(css, /admin-workspace-header h1/)
  assert.match(css, /--hover-surface:/)
  assert.match(css, /--border:/)
  assert.match(css, /--input:/)
  assert.match(css, /settings-search/)
  assert.match(css, /admin-common-table tbody tr:hover/)
  assert.match(css, /-webkit-autofill/)
})
