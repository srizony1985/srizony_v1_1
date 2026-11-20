import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('site typography is a single safely validated configuration, not a theme selector', () => {
  const utility = read('lib/themeTypography.ts')
  const route = read('app/api/admin/theme/typography/route.ts')
  const registry = read('lib/apiRegistry.ts')
  const site = read('lib/site.ts')
  assert.match(utility, /THEME_TYPOGRAPHY_SETTING_KEY = 'cms-theme-typography'/)
  assert.match(utility, /normalizeThemeTypographyPreferences/)
  assert.match(utility, /normalizeSiteThemeTypography/)
  assert.match(utility, /0\.85, 1\.25/)
  assert.match(utility, /bodyColor/)
  assert.match(route, /requireAdmin\('admin', 'editor'\)/)
  assert.match(route, /onConflictDoUpdate/)
  assert.match(route, /normalizeThemeTypographySettings/)
  assert.doesNotMatch(route, /themeName/)
  assert.match(registry, /\"path\": \"\/api\/admin\/theme\/typography\"/)
  assert.match(site, /applyThemeTypographySettings\(systemData\.themes, typography\)/)
})

test('theme typography is exposed in CMS and drives font, scale, colour and navigation tokens', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  const runtime = read('lib/themeRuntime.ts')
  const nav = read('app/globals.css')
  assert.match(settings, /ThemeTypographyView/)
  assert.match(settings, /Save typography/)
  assert.ok(settings.includes("const SCOPES: ThemeTypographyScope[] = ['global', 'header', 'content', 'footer', 'cms']"))
  assert.match(settings, /aria-label="Typography scope"/)
  assert.match(settings, /SCOPES\.map\(\(item\) =>/)
  for (const scope of ['global', 'header', 'content', 'footer', 'cms']) assert.ok(settings.includes(`'${scope}'`), `missing typography scope ${scope}`)
  assert.match(settings, /Body text colour/)
  assert.match(shell, /settings\?view=theme/)
  for (const token of ['--sf-font-body', '--sf-font-display', '--sf-fs-md', '--sf-fw-head', '--sf-typo-body-color', '--sf-typo-heading-color', '--sf-typo-nav-color', '--sf-nav-font-size']) {
    assert.ok(runtime.includes(token), `missing runtime typography token ${token}`)
  }
  assert.match(nav, /--sf-nav-font-size/)
})

test('Google Drive point-in-time restore selector lists archives and only enables verified full archives', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const drive = read('lib/google/drive.ts')
  const route = read('app/api/admin/database/drive-backups/route.ts')
  assert.match(settings, /id="settings-restore-point"/)
  assert.match(settings, /Restore selected point/)
  assert.match(settings, /!selectedRestorePoint\.restorable/)
  assert.match(drive, /includeItemsFromAllDrives: 'true'/)
  assert.match(drive, /file\.name\.endsWith\('\.tar\.gz'\) \|\| file\.name\.endsWith\('\.json'\)/)
  assert.ok(drive.includes("/^[a-f0-9]{64}$/i.test(file.appProperties?.sha256 ?? '')"))
  assert.match(route, /item\.id === payload\.backupId && item\.restorable/)
})

test('typography and alerts use shadcn components and scoped website theme tokens', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const select = read('components/ui/native-select.tsx')
  const badge = read('components/ui/badge.tsx')
  const publicCss = read('app/globals.css')
  assert.match(settings, /settings-theme-typography-grid/)
  assert.match(settings, /<NativeSelect/)
  assert.match(settings, /<Button/)
  assert.match(select, /data-slot="native-select"/)
  assert.match(badge, /data-slot="badge"/)
  assert.match(publicCss, /--sf-line-height-body/)
  assert.doesNotMatch(read('app/admin/layout.tsx'), /Admin\.css/)
})


test('typography supports optional inherited scopes and refreshes the cached public layout after save', () => {
  const utility = read('lib/themeTypography.ts')
  const runtime = read('lib/themeRuntime.ts')
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const route = read('app/api/admin/theme/typography/route.ts')
  for (const scope of ['global', 'header', 'content', 'footer', 'cms']) assert.match(utility, new RegExp(scope))
  assert.match(utility, /normalizeThemeTypographyOverrides/)
  assert.match(utility, /applyThemeTypographySettings/)
  for (const scope of ['header', 'content', 'footer', 'cms']) assert.match(runtime, new RegExp(`--sf-${scope}-font-body`))
  assert.match(settings, /settings-theme-scope-picker/)
  assert.match(settings, /router\.refresh\(\)/)
  assert.match(route, /revalidateTag\('site-content', \{ expire: 0 \}\)/)
  assert.match(route, /revalidatePath\('\/', 'layout'\)/)
})

test('mobile topbar is hidden and desktop submenu active paths have visible route cues', () => {
  const nav = read('components/ui/NavBar.tsx')
  const css = read('app/globals.css')
  const tree = read('components/ui/NavMenuTree.tsx')
  assert.match(nav, /canonicalPathname = pathname === '\/bn'/)
  assert.match(css, /\.sf-header \.sf-social-topbar \{ display: none !important; \}/)
  assert.match(tree, /is-active-path/)
  assert.match(css, /\.sf-menu li\.is-active-path > \.sf-menu-link::after/)
})

test('job overview has a top-right apply action, deadline emphasis and reusable visual steps', () => {
  const job = read('components/pages/JobPostingDetail.tsx')
  const steps = read('components/ui/ProcessSteps.tsx')
  const css = read('app/globals.css')
  assert.match(job, /sf-job-overview-apply/)
  assert.match(job, /sf-job-fact--deadline/)
  assert.match(job, /ProcessSteps/)
  assert.match(steps, /sf-process-step-marker/)
  assert.match(css, /sf-job-deadline-note/)
  assert.match(css, /sf-process-steps/)
})

test('map attribution remains compact and readable rather than removing required copyright credits', () => {
  const maps = read('components/home/LocationMaps.tsx')
  const css = read('app/globals.css')
  assert.match(maps, /MapTiler/)
  assert.match(maps, /OpenStreetMap contributors/)
  assert.match(css, /Keep map copyright credits compact without hiding/)
  assert.match(css, /\.sf-fp-leaflet \.leaflet-control-attribution/)
})
