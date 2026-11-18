import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = process.cwd()
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const listFiles = (dir) => readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name)
  if (entry.isDirectory()) return listFiles(path)
  return [path]
})
const appStylesheets = listFiles('app').filter((file) => file.endsWith('.css'))
const knownIntentionalRadii = new Set(['12px', '8px', '0', '0px', '2px', '3px', '50%', '99px', '999px', '9999px', '50% 50% 50% 0'])

test('the public and CMS layouts import their separate stylesheets', () => {
  assert.deepEqual(appStylesheets.sort(), ['app/globals.css'])
  const publicLayout = read('app/layout.tsx')
  const adminLayout = read('app/admin/layout.tsx')
  assert.ok(publicLayout.indexOf("import './globals.css'") >= 0, 'Root layout must import globals.css')
  assert.doesNotMatch(publicLayout, /site-fixes\.css|site-components\.css|site-polish\.css|Admin\.css|module\.css/)
  assert.doesNotMatch(adminLayout, /Admin\.css/)
  assert.doesNotMatch(adminLayout, /globals\.css/)
  const css = read('app/globals.css')
  assert.ok(css.lastIndexOf('FINAL GLOBAL NORMALIZATION LAYER') > css.indexOf('@import \"tailwindcss\"'))
  assert.equal((css.match(/@import\s+['\"]tailwindcss['\"]/g) || []).length, 1)
  assert.doesNotMatch(css, /--sf-sf-[a-z0-9_-]+|var\(--sf-sf-[a-z0-9_-]+\)/i)
})

test('the measured navigation header height is shared from the document root', () => {
  const navBar = read('components/ui/NavBar.tsx')
  assert.match(navBar, /new ResizeObserver\(updateHeight\)/)
  assert.match(navBar, /root\.style\.setProperty\('--sf-header-height', height\)/)
  assert.match(navBar, /root\.style\.removeProperty\('--sf-header-height'\)/)
})

test('theme radius, spacing, typography and feedback tokens are available in the global theme', () => {
  const css = read('app/globals.css')
  for (const token of [
    '--sf-radius-shape', '--sf-radius-card', '--sf-radius-panel', '--sf-radius-control', '--sf-radius-small', '--sf-radius-tight',
    '--sf-space-1', '--sf-space-2', '--sf-space-3', '--sf-space-4', '--sf-space-6',
    '--sf-font-body', '--sf-font-display', '--sf-danger-soft', '--sf-warning-soft', '--sf-success-soft', '--sf-info-soft',
  ]) assert.match(css, new RegExp(`${token}\\s*:`), `Missing theme token ${token}`)
  for (const selector of ['.sf-theme-feedback--error', '.sf-theme-feedback--warning', '.sf-theme-feedback--success', '.sf-theme-feedback--info', '[data-sonner-toast]']) assert.ok(css.includes(selector), `Missing themed feedback selector ${selector}`)
  for (const token of ['--warning-bg', '--warning-text', '--warning-border', '--info-bg', '--info-text', '--info-border']) assert.match(css, new RegExp(`${token}\\s*:`), `Missing toast state token ${token}`)
})

test('CMS typography tokens cascade through semantic page, section, form and control elements', () => {
  const css = read('app/globals.css')
  const helper = read('lib/cms/typography.ts')
  assert.match(css, /\.sf-main \.cms-typography-scope[\s\S]*--sf-cms-font-family/)
  for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'dd', 'dt', 'figcaption', 'blockquote', 'a', 'button', 'input', 'select', 'textarea', 'label']) {
    assert.ok(css.includes(tag), `Expected CMS typography coverage for ${tag}`)
  }
  for (const variable of ['--sf-cms-font-family', '--sf-cms-heading-font-family', '--sf-cms-font-size', '--sf-cms-text-color', '--sf-cms-heading-color', '--sf-cms-line-height', '--sf-cms-letter-spacing']) {
    assert.ok(helper.includes(variable), `CMS editor must write ${variable}`)
  }
})

test('admin route utilities use shared shadcn controls and preserve public CSS isolation', () => {
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  const table = read('components/admin/cms/AdminTable.tsx')
  const button = read('components/ui/button.tsx')
  assert.match(shell, /<Input/)
  assert.match(shell, /<Button/)
  assert.match(table, /from ['"]@\/components\/ui\/table['"]/)
  assert.match(button, /buttonVariants = cva/)
  assert.match(read('app/admin/layout.tsx'), /AdminThemeShell/)
  assert.doesNotMatch(read('app/globals.css'), /\.admin-shell|\.ui-button/)
})

test('JSX inline style objects pass dynamic values only through CSS custom properties', () => {
  const sourceFiles = listFiles('app').concat(listFiles('components')).filter((file) => /\.tsx?$/.test(file))
  const offenders = []
  for (const file of sourceFiles) {
    const source = read(file)
    for (const match of source.matchAll(/style\s*=\s*\{\{([\s\S]*?)\}\s*(?:as\s+CSSProperties)?\}/g)) {
      const body = match[1]
      for (const property of body.matchAll(/(?:^|,)\s*['"]?([A-Za-z_$][\w$-]*)['"]?\s*:/g)) {
        if (!property[1].startsWith('--sf-') && !property[1].startsWith('--admin-') && !['width', 'textAlign'].includes(property[1])) offenders.push(`${file}: ${property[1]}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

test('shared Button follows shadcn variant and focus conventions', () => {
  const button = read('components/ui/button.tsx')
  assert.match(button, /export const buttonVariants = cva/)
  assert.match(button, /default: 'bg-primary text-primary-foreground/)
  assert.match(button, /secondary: 'bg-secondary text-secondary-foreground/)
  assert.match(button, /destructive: 'bg-destructive/)
  assert.match(button, /focus-visible:ring-ring/)
  assert.match(button, /data-slot="button"/)
})

test('no UI stylesheet keeps arbitrary numeric border radii outside intentional geometric shapes', () => {
  const css = read('app/globals.css')
  const offenders = []
  const matcher = /border-radius\s*:\s*([^;}\n]+)/g
  let match
  while ((match = matcher.exec(css))) {
    const value = match[1].trim()
    if (knownIntentionalRadii.has(value) || /^var\(/.test(value) || /^(?:calc|min|max|clamp)\(/.test(value)) continue
    if (/\d+(?:\.\d+)?px/.test(value)) offenders.push(value)
  }
  assert.deepEqual(offenders, [])
})
