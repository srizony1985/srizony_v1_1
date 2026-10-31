import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = process.cwd()
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const listFiles = (dir) => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  if (entry.isDirectory()) return listFiles(path)
  return [path]
})

const cssFiles = [
  'app/globals.css',
  'app/site-components.css',
  'app/site-polish.css',
  'app/admin/Admin.css',
  ...listFiles('app/css_extra').filter((file) => file.endsWith('.css')),
  ...listFiles('app').filter((file) => file.endsWith('.module.css')),
]

const knownIntentionalRadii = new Set(['0', '0px', '2px', '3px', '50%', '99px', '999px', '9999px', '50% 50% 50% 0'])

test('all non-landing route templates share the global SF theme and admin theme bridge', () => {
  const publicLayout = read('app/layout.tsx')
  const adminLayout = read('app/admin/layout.tsx')
  const adminTheme = read('app/admin/AdminThemeShell.tsx')
  assert.match(publicLayout, /\.\/globals\.css/)
  assert.match(publicLayout, /\.\/site-components\.css/)
  assert.match(publicLayout, /\.\/site-polish\.css/)
  assert.match(publicLayout, /<AppShell/)
  assert.match(adminLayout, /import '\.\/Admin\.css'/)
  assert.match(adminLayout, /<AdminThemeShell/)
  assert.match(adminTheme, /themeVars\['--sf-primary'\]/)
  assert.match(adminTheme, /'--radius-control': radiusControl/)
  assert.match(adminTheme, /'--radius-card': radius/)
  assert.match(adminTheme, /'--radius-panel': radiusPanel/)

  const pageFiles = listFiles('app').filter((file) => file.endsWith('/page.tsx') || file === 'app/page.tsx')
  const scopedPageFiles = pageFiles.filter((file) => file !== 'app/page.tsx')
  assert.ok(scopedPageFiles.length >= 15, `Expected all static, CMS, and admin page templates to be audited; got ${scopedPageFiles.length}`)
  assert.ok(scopedPageFiles.includes('app/[...slug]/page.tsx'))
  assert.ok(scopedPageFiles.includes('app/bn/[[...slug]]/page.tsx'))
  for (const route of [
    'app/search/page.tsx',
    'app/admin/dashboard/site-content/page.tsx',
    'app/admin/dashboard/page-builder/page.tsx', 'app/admin/dashboard/jobs/page.tsx',
    'app/admin/dashboard/navigation/page.tsx', 'app/admin/dashboard/website-essentials/page.tsx',
  ]) assert.ok(scopedPageFiles.includes(route), `Missing page template: ${route}`)
  assert.ok(!scopedPageFiles.includes('app/unsubscribe/page.tsx'), 'Newsletter preference route is intentionally retired.')
  assert.equal(existsSync(resolve(root, 'app/resources/page.tsx')), false)
  assert.equal(existsSync(resolve(root, 'app/management-staff/page.tsx')), false)
})

test('SF semantic radius tokens are defined consistently in the shared theme layers', () => {
  const global = read('app/globals.css')
  const components = read('app/site-components.css')
  for (const token of ['--sf-radius-shape', '--sf-radius-card', '--sf-radius-panel', '--sf-radius-control', '--sf-radius-small', '--sf-radius-tight']) {
    assert.match(global, new RegExp(`${token}\\s*:`), `global token ${token} missing`)
    if (token === '--sf-radius-shape') assert.ok(components.includes('var(--sf-radius-shape'), 'component layer must derive shapes from the root SF shape token')
    else assert.match(components, new RegExp(`${token}\\s*:`), `component fallback token ${token} missing`)
  }
  const admin = read('app/admin/Admin.css')
  for (const token of ['--sf-radius-card', '--sf-radius-panel', '--sf-radius-control', '--sf-radius-small']) {
    assert.ok(admin.includes(`var(${token}`), `Admin compatibility alias is not tied to ${token}`)
  }
})

test('no UI stylesheet keeps arbitrary numeric border radii outside intentional geometric shapes', () => {
  const offenders = []
  for (const file of cssFiles) {
    const text = read(file)
    const matcher = /border-radius\s*:\s*([^;}\n]+)/g
    let match
    while ((match = matcher.exec(text))) {
      const value = match[1].trim()
      if (knownIntentionalRadii.has(value)) continue
      if (/^var\(/.test(value) || /^(?:calc|min|max)\(/.test(value)) continue
      if (/\d+(?:\.\d+)?px/.test(value)) offenders.push(`${file}: ${value}`)
    }
  }
  assert.deepEqual(offenders, [])
})

test('active and compatibility stylesheets stay synchronized', () => {
  assert.equal(read('site-components.css'), read('app/site-components.css'))
  assert.equal(read('site-polish.css'), read('app/site-polish.css'))
})
