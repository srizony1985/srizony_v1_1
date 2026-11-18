import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const page = read('app/admin/dashboard/jobs/page.tsx')

test('Jobs management uses the shared shadcn controls rather than a separate admin stylesheet', () => {
  assert.doesNotMatch(page, /jobs\.css|Admin\.css|site-polish\.css/)
  assert.match(read('app/admin/layout.tsx'), /AdminThemeShell/)
  assert.match(page, /<Button/)
  assert.match(page, /search=\{applicationSearch\}/)
  assert.match(page, /<AdminTable/)
  assert.match(page, /<Badge/)
  assert.match(read('components/ui/button.tsx'), /data-slot="button"/)
})

test('Jobs dashboard keeps its responsive layout and keyboard-visible actions in JSX utilities', () => {
  assert.match(page, /min-w-0/)
  assert.match(read('components/ui/button.tsx'), /focus-visible:ring/)
  assert.match(page, /grid-cols-|flex-wrap|flex min-w-0/)
  assert.match(read('components/admin/cms/AdminTable.tsx'), /overflow-auto overscroll-contain/)
})
