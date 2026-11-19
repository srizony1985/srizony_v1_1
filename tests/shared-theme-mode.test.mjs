import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('public site and CMS admin use one shared sf-mode cookie and storage key', () => {
  const shared = read('lib/sharedThemeMode.ts')
  const hook = read('lib/useSharedThemeMode.ts')
  const site = read('components/containers/SiteProvider.tsx')
  const admin = read('app/admin/AdminThemeShell.tsx')
  const layout = read('app/admin/layout.tsx')
  const rootLayout = read('app/layout.tsx')

  assert.match(shared, /SHARED_THEME_MODE_COOKIE = 'sf-mode'/)
  assert.match(shared, /SHARED_THEME_MODE_STORAGE_KEY = 'sf-mode'/)
  assert.match(shared, /SHARED_THEME_MODE_EVENT = 'sf:theme-mode-change'/)
  assert.match(hook, /useSyncExternalStore\(subscribe, getSnapshot, getServerSnapshot\)/)
  assert.match(hook, /persistSharedThemeMode\(nextMode\)/)
  assert.match(site, /useSharedThemeMode\(initialPreferences\?\.mode \|\| 'dark'\)/)
  assert.match(admin, /useSharedThemeMode\(initialMode\)/)
  assert.match(hook, /addEventListener\('storage', handleStorage\)/)
  assert.match(layout, /cookieStore\.get\(SHARED_THEME_MODE_COOKIE\)/)
  assert.match(rootLayout, /SHARED_THEME_MODE_COOKIE/)
  assert.match(rootLayout, /normalizeSharedThemeMode\(/)
  assert.doesNotMatch(admin, /sf-admin-mode/)
  assert.doesNotMatch(layout, /sf-admin-mode/)
})

test('admin mode follows the public dark default when no shared preference exists', () => {
  const shared = read('lib/sharedThemeMode.ts')
  const admin = read('app/admin/AdminThemeShell.tsx')
  assert.match(shared, /fallback: SharedThemeMode = 'dark'/)
  assert.match(admin, /initialMode = 'dark'/)
})
