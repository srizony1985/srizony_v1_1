import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Footer navigation is placed under Content management, not Settings', () => {
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  assert.match(shell, /key: 'footer', section: 'Content management', label: 'Footer Navigation'/)
  const settingsGroup = shell.slice(shell.indexOf("key: 'settings'"), shell.indexOf('\n  },', shell.indexOf("key: 'settings'")))
  assert.doesNotMatch(settingsGroup, /Footer/)
})

test('Footer custom links provide searchable site destinations from the protected navigation API', () => {
  const editor = read('app/admin/dashboard/_components/FooterSettingsView.tsx')
  assert.match(editor, /getAdminNavigationTree\(\)/)
  const api = read('lib/api/adminFooter.ts')
  assert.match(api, /adminRequest<\{ groups\?: NavGroupTree\[\] \}>\('\/api\/admin\/navigation'/)
  assert.match(editor, /flattenSiteLinks/)
  assert.match(editor, /<datalist id=/)
  assert.match(editor, /list=\{`footer-site-links-/)
})

test('Footer typography is saved as part of the single footer configuration and applied at render time', () => {
  const config = read('lib/footerConfig.ts')
  const editor = read('app/admin/dashboard/_components/FooterSettingsView.tsx')
  const footer = read('components/ui/Footer.tsx')
  const css = read('app/globals.css')
  for (const field of ['titleFontFamily', 'titleSize', 'titleWeight', 'titleColor', 'linkSize', 'linkWeight', 'linkColor', 'bodyFontFamily', 'bodySize', 'bodyColor']) {
    assert.match(config, new RegExp(field))
    assert.match(editor, new RegExp(field))
  }
  assert.match(footer, /--sf-footer-heading-color/)
  assert.match(css, /--sf-footer-heading-weight/)
  assert.match(css, /--sf-footer-link-color/)
})

test('the old CMS welcome wizard has been removed from the admin application', () => {
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  assert.equal(existsSync('app/admin/dashboard/_components/CmsWelcomeWizard.tsx'), false)
  assert.doesNotMatch(shell, /CmsWelcomeWizard|srizony-cms-welcome-dismissed/)
})

test('API security audit document identifies dormant endpoints and distinguishes source audit from live penetration testing', () => {
  const report = read('docs/PERFORMANCE_API_SECURITY_AUDIT.md')
  assert.match(report, /50 Next\.js API route handlers/)
  assert.match(report, /\/api\/admin\/entities/)
  assert.match(report, /\/api\/admin\/form-users/)
  assert.match(report, /not a penetration test/)
})
