import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const shell = read('app/admin/dashboard/_components/Shell.tsx')
const navComponents = read('components/admin/cms/AdminNavigation.tsx')
const headerComponent = read('components/admin/cms/AdminWorkspaceHeader.tsx')

test('CMS sidebar uses the foundation identity and not the software vendor brand', () => {
  assert.match(shell, /src="\/images\/Logo-SF\.png" alt="Srizony Foundation"/)
  assert.match(shell, /Srizony Foundation/)
  assert.doesNotMatch(shell, /Scarlet Labs|scarletlabs\.tech|CMS powered by/)
})

test('CMS sidebar exposes labelled sections and accessible current navigation states', () => {
  assert.match(shell, /section: 'Overview'/)
  assert.match(shell, /section: 'Content management'/)
  assert.match(shell, /section: 'Insights'/)
  assert.match(shell, /section: 'System'/)
  assert.match(navComponents, /text-sidebar-foreground/)
  assert.match(navComponents, /aria-current=\{active \? 'page' : undefined\}/)
  assert.match(navComponents, /aria-expanded=\{!compact && expanded\}/)
  assert.match(navComponents, /aria-controls=\{!compact \? controls : undefined\}/)
  assert.match(shell, /const compactSidebar = collapsed && !mobileOpen/)
  assert.match(shell, /compactSidebar/)
})

test('collapse controls communicate state and expand/collapse icons transform', () => {
  assert.match(headerComponent, /PanelLeftClose/)
  assert.match(headerComponent, /PanelLeftOpen/)
  assert.match(headerComponent, /aria-expanded=\{!collapsed\}/)
  assert.match(navComponents, /expanded && 'rotate-180'/)
  assert.match(navComponents, /transition-transform/)
})

test('workspace header shows the active CMS location with shadcn buttons and badges', () => {
  assert.match(headerComponent, /CMS workspace/)
  assert.match(headerComponent, /<h1 className="[^"]*">\s*\{current\}\s*<\/h1>/)
  assert.match(headerComponent, /from ['"]@\/components\/ui\/button['"]/)
  assert.match(headerComponent, /from ['"]@\/components\/ui\/badge['"]/)
  assert.match(headerComponent, /<Button/)
  assert.doesNotMatch(headerComponent, /CMS powered by/)
})

test('sidebar and header styles use shadcn semantic tokens and responsive utility classes', () => {
  assert.match(navComponents, /hover:bg-sidebar-accent/)
  assert.match(navComponents, /focus-visible:ring-ring/)
  assert.match(read('components/admin/cms/AdminAppShell.tsx'), /group-data-\[collapsed=true\]\/admin-shell/)
  assert.match(navComponents, /!compact && <span className="min-w-0 flex-1 truncate">\{label\}<\/span>/)
  assert.doesNotMatch(read('app/admin/layout.tsx'), /Admin\.css/)
})

test('CMS page titles are singular and route toolbars do not introduce competing headings', () => {
  const common = read('app/admin/dashboard/_components/AdminCommon.tsx')
  const toolbar = read('components/admin/cms/AdminToolbar.tsx')
  assert.match(headerComponent, /<h1 className="[^"]*">\s*\{current\}\s*<\/h1>/)
  assert.doesNotMatch(common, /<h1|<h2/)
  assert.match(toolbar, /aria-label=\{`\$\{title\} tools`\}/)
})

test('compact navigation rail exposes accessible labels and native hover tooltips', () => {
  assert.match(navComponents, /data-nav-label=\{label\}/)
  assert.match(navComponents, /title=\{compact \? label : undefined\}/)
  assert.match(navComponents, /aria-label=\{compact \? label : undefined\}/)
})

test('CMS uses reusable accessible form controls without adding utility routes to the sidebar', () => {
  const select = read('components/ui/native-select.tsx')
  const textarea = read('components/ui/textarea.tsx')
  const checkbox = read('components/ui/checkbox.tsx')
  const siteConfiguration = read('app/admin/dashboard/site-configuration/SiteConfigurationClient.tsx')
  assert.doesNotMatch(shell, /key:\s*['"]ui-content['"]|href:\s*['"]\/admin\/dashboard\/ui-content['"] /)
  assert.match(select, /data-slot="native-select"/)
  assert.match(textarea, /data-slot="textarea"/)
  assert.match(checkbox, /data-slot="checkbox"/)
  assert.match(siteConfiguration, /<Textarea/)
  assert.match(siteConfiguration, /aria-label="Website identity JSON"/)
  assert.match(siteConfiguration, /aria-label="Website settings JSON"/)
})

test('Page Builder and database-backed editors use the single workspace Save all action', () => {
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  const appShell = read('components/admin/cms/AdminAppShell.tsx')
  const portfolio = read('app/admin/dashboard/portfolio/page.tsx')
  const essentials = read('app/admin/dashboard/website-essentials/page.tsx')
  const pipeline = read('app/admin/dashboard/cms-pipeline/page.tsx')
  assert.match(pageBuilder, /useRegisterAdminActions\('page-builder-current-page'/)
  assert.match(pageBuilder, /useRegisterAdminActions\('page-builder-landing-locations'/)
  assert.match(appShell, /Use Save all in the header/)
  assert.match(headerComponent, /\{saving \? 'Saving…' : 'Save all'\}/)
  assert.doesNotMatch(pageBuilder, /Save page|pb-bottom-save|Save the page to publish/)
  assert.match(portfolio, /useRegisterAdminActions\('portfolio-editor'/)
  assert.match(essentials, /useRegisterAdminActions\('website-essentials-editor'/)
  assert.match(pipeline, /useRegisterAdminActions\('cms-pipeline-identity'/)
  assert.doesNotMatch(pipeline, /Save identity/)
})

test('CMS forms use shared shadcn Select, Textarea and Checkbox primitives', () => {
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    return entry.isDirectory() ? walk(path) : path.endsWith('.tsx') ? [path] : []
  })
  const rawControl = /<(?:select|textarea)\b|<input\b(?=[^>]*\btype\s*=\s*["']checkbox["'])/s
  const offenders = walk('app/admin/dashboard').filter((file) => rawControl.test(readFileSync(file, 'utf8')))
  assert.deepEqual(offenders, [])
  for (const component of ['native-select.tsx', 'textarea.tsx', 'checkbox.tsx']) {
    assert.match(read(`components/ui/${component}`), /data-slot=/)
  }
  assert.match(read('components/ui/select.tsx'), /NativeSelect/)
})

test('CMS sidebar provides searchable navigation and a separate public-site shortcut', () => {
  assert.match(shell, /const \[navigationQuery, setNavigationQuery\] = useState\(''\)/)
  assert.match(shell, /const visibleGroups = useMemo<AdminNavGroup\[\]>/)
  assert.match(shell, /aria-label="Search CMS navigation"/)
  assert.match(shell, /No matching sections found\./)
  assert.match(shell, /buttonVariants\(\{ variant: 'outline' \}\)/)
  assert.match(shell, /href="\/" target="_blank" rel="noreferrer"/)
})

test('desktop sidebar collapse control is aligned with shadcn workspace chrome', () => {
  assert.match(headerComponent, /aria-controls="cms-primary-navigation"/)
  assert.match(headerComponent, /<Button/)
  assert.match(read('components/ui/button.tsx'), /focus-visible:ring/)
})
