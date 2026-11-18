import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(path, 'utf8')
const components = [
  read('components/admin/cms/index.ts'),
  read('components/admin/cms/principles/usability.ts'),
  read('components/admin/cms/principles/execution.ts'),
  read('components/admin/cms/principles/tokens.ts'),
].join('\n')
const appShell = read('components/admin/cms/AdminAppShell.tsx')
const header = read('components/admin/cms/AdminWorkspaceHeader.tsx')
const navigation = read('components/admin/cms/AdminNavigation.tsx')
const toolbar = read('components/admin/cms/AdminToolbar.tsx')
const dataContainer = read('components/admin/cms/AdminDataContainer.tsx')
const table = read('components/admin/cms/AdminTable.tsx')

test('CMS workspace chrome is exported as reusable shell, header, navigation and viewport components', () => {
  for (const component of ['AdminAppShell', 'AdminWorkspaceHeader', 'AdminNavigationSidebar', 'AdminViewportGrid', 'AdminProviderFooter', 'AdminNavigationLink', 'AdminNavigationGroupToggle', 'AdminNavigationChildLink']) {
    assert.ok(components.includes(component), `Missing reusable component ${component}`)
  }
  assert.match(header, /providerHealth/)
  assert.match(header, /Save all/)
  assert.match(header, /userInitial/)
  assert.match(header, /@2xl\/header:max-w-56/)
  assert.match(appShell, /h-dvh min-h-dvh w-full min-w-0 overflow-hidden/)
  assert.match(appShell, /overflow-auto overscroll-contain/)
  assert.match(appShell, /Use Save all in the header/)
  assert.match(navigation, /aria-current=\{active \? 'page' : undefined\}/)
  assert.match(navigation, /aria-expanded=\{!compact && expanded\}/)
})

test('toolbar, dataset frame and data table separate sticky controls from the scrollable records viewport', () => {
  assert.match(toolbar, /sticky top-0 z-30/)
  assert.match(toolbar, /AdminToolbarSearch/)
  assert.match(toolbar, /AdminToolbarFilterGroup/)
  assert.match(toolbar, /role="group" aria-label=\{`\$\{title\} actions`\}/)
  assert.match(dataContainer, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(dataContainer, /cms-data-scroll/)
  assert.match(dataContainer, /overflow-auto/)
  assert.match(dataContainer, /footerActions\?: ReactNode/)
  assert.match(table, /sticky top-0 z-20/)
  assert.match(table, /admin-table-summary/)
  assert.match(table, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/)
  assert.match(table, /admin-table-scroll/)
})

test('common table exposes safe behavior defaults and opt-in import and selection', () => {
  assert.match(table, /sortable = true/)
  assert.match(table, /selectable = false/)
  assert.match(table, /exportable = false/)
  assert.match(table, /exportImportable = false/)
  assert.match(table, /onImportFile\?: \(file: File\)/)
  assert.match(table, /function exportCsv\(scope: 'all' \| 'selected' = 'all'\)/)
  assert.match(table, /selectedExportable = false/)
  assert.match(table, /Export selected/)
  assert.match(table, /function sortBy\(/)
  assert.match(table, /onSelectionChange\?\.\(\[\.\.\.next\]\)/)
  assert.match(table, /role="status"\s+aria-live="polite"/)
  assert.match(table, /originalIndex/)
  assert.match(table, /const sourceRows = useMemo/)
  assert.match(table, /scrollClassName\?: string/)
  assert.match(table, /tableClassName\?: string/)
  assert.match(table, /from ['"]@\/components\/ui\/table['"]/)
  assert.match(table, /from ['"]@\/components\/ui\/checkbox['"]/)
})

test('CMS component typography is loaded from the database scope and applied to the shared shell', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const theme = read('app/admin/AdminThemeShell.tsx')
  const controls = read('components/admin/cms/AdminTypographyControls.tsx')
  const css = read('app/globals.css')
  assert.match(settings, /AdminTypographyControls/)
  assert.match(settings, /Admin interface/)
  assert.match(settings, /sf-admin-typography-updated/)
  assert.match(theme, /getThemeTypography/)
  assert.match(theme, /normalizeThemeTypographySettings/)
  for (const token of ['--cms-sidebar-font-size', '--cms-toolbar-font-size', '--cms-table-font-size', '--cms-control-font-size', '--cms-header-font-size', '--cms-data-heading-font-size', '--cms-footer-font-size']) {
    assert.ok(theme.includes(token), `Missing CMS token ${token}`)
    assert.ok(controls.includes(token.replace('--cms-', 'admin')) || settings.includes('AdminTypographyControls'))
  }
  assert.match(css, /\.admin-theme-root\s*\{[^}]*--radius:/s)
  assert.match(css, /\.admin-theme-root[^\{]*\[data-slot="button"\]/)
})

test('all CMS data tables render through the shared shadcn table component', () => {
  const scan = (dir) => readdirSync(dir).flatMap((name) => {
    const file = join(dir, name)
    if (statSync(file).isDirectory()) return scan(file)
    if (!/\.(tsx|jsx)$/.test(name)) return []
    return [file]
  })
  const files = [...scan('app/admin'), ...scan('components/admin')]
  const nativeTables = files.filter((file) => /<table\b/.test(read(file)))
  assert.deepEqual(nativeTables.sort(), [])
  assert.match(table, /from ['"]@\/components\/ui\/table['"]/)
  assert.match(table, /<Table/)
})

test('shared data containers expose dedicated execution status, instructions and footer action slots', () => {
  assert.match(dataContainer, /status\?: \{ info\?: NavGroup; content: ReactNode; \}/)
  assert.match(dataContainer, /instructions\?: ReactNode/)
  assert.match(dataContainer, /footerActions\?: ReactNode/)
  assert.match(dataContainer, /role="status" aria-live="polite"/)
  assert.match(dataContainer, /aria-label=\{`\$\{label\} footer actions`\}/)
})

test('site configuration route uses shared toolbar, viewport data container, grid and dataset grouping', () => {
  const config = read('app/admin/dashboard/site-configuration/SiteConfigurationClient.tsx')
  assert.match(config, /<AdminToolbar/)
  assert.match(config, /<AdminDataContainer/)
  assert.match(config, /<AdminWorkspaceGrid/)
  assert.match(config, /<AdminDataGroup/)
  assert.match(config, /bodyScroll="auto"/)
})

test('CMS UI exports are separated by the three component principles', () => {
  const usability = read('components/admin/cms/principles/usability.ts')
  const execution = read('components/admin/cms/principles/execution.ts')
  const tokens = read('components/admin/cms/principles/tokens.ts')
  const architecture = read('components/admin/cms/ARCHITECTURE.md')
  assert.match(usability, /AdminToolbar[\s\S]*AdminTabs/)
  assert.match(execution, /AdminAppShell[\s\S]*AdminNavigationSidebar[\s\S]*AdminDataContainer[\s\S]*AdminTable/)
  assert.match(tokens, /AdminTypographyControls/)
  for (const principal of ['Usability', 'Execution and interaction', 'CSS tokens and scoped typography']) {
    assert.ok(architecture.includes(principal), `Missing architecture principle: ${principal}`)
  }
})


test('route workspaces use a one-column shell and only the four paired workflows opt into split layout', () => {
  const workspaceGrid = read('components/admin/cms/AdminWorkspaceGrid.tsx')
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  const siteContent = read('app/admin/dashboard/site-content/page.tsx')
  const jobs = read('app/admin/dashboard/jobs/page.tsx')
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')

  assert.match(workspaceGrid, /layout = 'single'/)
  assert.match(workspaceGrid, /min-\[1120px\]:grid-cols-\(--cms-workspace-columns\)/)
  assert.match(shell, /<AdminViewportGrid[\s\S]*?layout="single"/)
  assert.doesNotMatch(shell, /pathname\.includes\('site-content'\)|pathname\.includes\('\/jobs'\)|pathname\.includes\('page-builder'\)/)

  assert.match(siteContent, /<AdminWorkspaceGrid[\s\S]*?layout="split"/)
  assert.match(siteContent, /site-content-editor-panel\]:order-2/)
  assert.match(siteContent, /site-content-table-panel\]:order-1/)
  assert.match(jobs, /activeTab === 'applications' && \(\s*<AdminWorkspaceGrid[\s\S]*?layout="split"/)
  assert.match(jobs, /Selected applicant and application register/)
  assert.match(pageBuilder, /<AdminWorkspaceGrid[\s\S]*?layout="split"/)
  assert.match(pageBuilder, /Page selector and page editor/)
  assert.match(settings, /<AdminWorkspaceGrid[\s\S]*?layout="split"/)
  assert.match(settings, /CMS user creation and user directory/)
})


test('Site Content reconciles the selected editor record with the visible dataset after reloads and filters', () => {
  const siteContent = read('app/admin/dashboard/site-content/page.tsx')
  assert.match(siteContent, /const activeSelectedId = useMemo\(\(\) => \{[\s\S]*items\.some\(\(item\) => item\.id === selectedId\)/)
  assert.match(siteContent, /const selected = typeof activeSelectedId === 'number'/)
  assert.match(siteContent, /const selectedVisibleIds = useMemo/)
})
