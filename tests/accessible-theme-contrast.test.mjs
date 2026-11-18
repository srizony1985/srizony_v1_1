import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('public theme runtime derives contrast-safe semantic ink, links, status and focus colours', async () => {
  const source = await read('lib/themeRuntime.ts')
  for (const token of [
    "'--sf-ink': ink",
    "'--sf-muted': muted",
    "'--sf-link': link",
    "'--sf-secondary-ink': secondaryInk",
    "'--sf-accent-ink': accentInk",
    "'--sf-focus': focus",
  ]) assert.ok(source.includes(token), `Missing semantic contrast token: ${token}`)
  assert.match(source, /ensureThemeContrast\(.*\[surface, surfaceAlt\], 7\)/s)
  assert.match(source, /ensureThemeContrast\(.*\[surface, surfaceAlt\], 4\.5\)/s)
  assert.match(source, /ensureThemeContrast\(rawBorder, \[surface, surfaceAlt\], 3\)/)
})

test('slug and essentials breadcrumbs use opaque surfaces and visible current-page, link and separator colours', async () => {
  const css = await read('app/globals.css')
  assert.match(css, /\.sf-main \.sf-banner:not\(\.sf-banner--plain\) \.sf-crumbs ol\s*\{[^}]*background: color-mix\(in srgb, var\(--sf-footer-bg\) 94%, transparent\)/s)
  assert.match(css, /\.sf-main \.sf-banner--plain \.sf-crumbs li\s*,[\s\S]*?color: var\(--sf-ink\); opacity: 1/)
  assert.match(css, /\.sf-essentials-breadcrumb a,[\s\S]*?color: var\(--sf-link\); opacity: 1/)
  assert.match(css, /\.sf-main \.sf-banner:not\(\.sf-banner--plain\) \.sf-eyebrow,[\s\S]*?color: var\(--sf-footer-ink\)/)
})

test('CMS maps icons and active navigation to the contrast-safe link token in both modes', async () => {
  const shell = await read('app/admin/AdminThemeShell.tsx')
  const navigation = await read('components/admin/cms/AdminNavigation.tsx')
  assert.match(shell, /admin-theme-root min-h-dvh bg-background text-foreground/)
  assert.match(navigation, /text-sidebar-foreground/)
  assert.match(navigation, /bg-sidebar-accent text-sidebar-accent-foreground/)
  assert.match(navigation, /focus-visible:ring-ring/)
})

test('CMS-managed page colours and footer overrides are corrected for active light/dark surfaces', async () => {
  const typography = await read('lib/cms/typography.ts')
  const css = await read('app/globals.css')
  const footer = await read('components/ui/Footer.tsx')
  assert.match(typography, /--sf-cms-text-color-light/)
  assert.match(typography, /--sf-cms-text-color-dark/)
  assert.match(typography, /ensureThemeContrast\(value\.color, \['#ffffff', '#edf3f7'\], 4\.5\)/)
  assert.match(css, /html\[data-mode='light'\] \.sf-main \.cms-typography-scope/)
  assert.match(css, /html\[data-mode='dark'\] \.sf-main \.cms-typography-scope/)
  assert.match(footer, /ensureThemeContrast\(footer\.typography\.linkColor, \[footerBackground\], 4\.5\)/)
})
