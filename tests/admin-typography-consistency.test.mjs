import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('admin typography uses scoped CSS tokens inherited from the database-backed CMS typography setting', () => {
  const css = read('app/globals.css')
  const shell = read('app/admin/AdminThemeShell.tsx')
  const button = read('components/ui/button.tsx')
  assert.match(css, /--font-sans:/)
  assert.match(css, /--color-foreground:/)
  assert.match(shell, /createCmsTypographyStyle/)
  assert.match(shell, /getThemeTypography/)
  assert.match(shell, /--cms-sidebar-font-size/)
  assert.match(shell, /--cms-table-font-size/)
  assert.match(button, /text-sm font-medium/)
  assert.doesNotMatch(css, /--admin-type-(?:body|sidebar|toolbar|table|control|header)/)
})

test('the typography editor exposes CMS component sizing only in the admin interface scope', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const controls = read('components/admin/cms/AdminTypographyControls.tsx')
  assert.match(settings, /Theme typography/)
  assert.match(settings, /Admin interface/)
  assert.match(settings, /scope === 'cms' && <AdminTypographyControls/)
  for (const key of ['adminSidebarSize', 'adminToolbarSize', 'adminTableSize', 'adminControlSize', 'adminHeaderSize', 'adminDataHeadingSize', 'adminFooterSize']) {
    assert.ok(controls.includes(key), `missing CMS component typography key: ${key}`)
  }
})
