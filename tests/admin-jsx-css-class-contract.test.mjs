import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(path, 'utf8')
const collect = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? collect(path) : /\.(tsx|jsx)$/.test(path) ? [path] : []
})

test('shadcn configuration targets the existing Next.js Tailwind v4 application', () => {
  const config = JSON.parse(read('components.json'))
  assert.equal(config.style, 'new-york')
  assert.equal(config.base, 'radix')
  assert.equal(config.tailwind.css, 'app/globals.css')
  assert.equal(config.tailwind.cssVariables, true)
  assert.equal(config.aliases.ui, '@/components/ui')
  assert.equal(config.aliases.utils, '@/lib/utils')
  assert.match(read('app/globals.css'), /@import\s+"tailwindcss"/)
  assert.match(read('app/globals.css'), /@theme inline/)
})

test('the admin no longer imports or contains a separate CSS stylesheet', () => {
  assert.equal(existsSync('app/admin/Admin.css'), false)
  assert.doesNotMatch(read('app/admin/layout.tsx'), /Admin\.css|admin\.css/)
  assert.deepEqual(collect('app/admin').filter((file) => /\.css$/.test(file)), [])
  assert.deepEqual(collect('components/admin').filter((file) => /\.css$/.test(file)), [])
})

test('shared UI primitives follow shadcn source-component conventions', () => {
  const button = read('components/ui/button.tsx')
  const card = read('components/ui/card.tsx')
  const input = read('components/ui/input.tsx')
  const select = read('components/ui/native-select.tsx')
  const table = read('components/ui/table.tsx')
  assert.match(button, /class-variance-authority/)
  assert.match(button, /export const buttonVariants = cva/)
  assert.match(button, /data-slot="button"/)
  assert.match(card, /data-slot="card"/)
  assert.match(input, /data-slot="input"/)
  assert.match(select, /data-slot="native-select"/)
  assert.match(table, /data-slot="table"/)
  assert.match(button, /bg-primary text-primary-foreground/)
  assert.match(button, /focus-visible:ring-ring/)
})

test('admin routes use shared shadcn buttons and avoid legacy custom UI class contracts', () => {
  const files = [...collect('app/admin'), ...collect('components/admin')]
  const missingButtonImport = []
  const rawButton = []
  for (const file of files) {
    const source = read(file)
    if (/<Button\b/.test(source) && !/import\s*\{[^}]*\bButton\b[^}]*\}\s*from\s*['"]@\/components\/ui\/button['"]/.test(source)) missingButtonImport.push(file)
    if (/<button\b|<\/button>/.test(source)) rawButton.push(file)
    assert.doesNotMatch(source, /ui-button-(?:default|primary|ghost)|bg-cms-|text-cms-|border-cms-/)
  }
  assert.deepEqual(missingButtonImport, [])
  assert.deepEqual(rawButton, [])
})

test('admin theme tokens are scoped so the public site remains independent', () => {
  const shell = read('app/admin/AdminThemeShell.tsx')
  const css = read('app/globals.css')
  assert.match(shell, /admin-theme-root min-h-dvh bg-background text-foreground/)
  assert.match(css, /\.admin-theme-root\s*\{/)
  assert.match(css, /\.admin-theme-root\.dark\s*\{/)
  assert.match(css, /--sf-font-body/)
  assert.doesNotMatch(css, /html:has\(\.admin-theme-root\)|body:has\(\.admin-theme-root\)/)
})
