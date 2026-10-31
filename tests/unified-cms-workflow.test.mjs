import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('Landing is the only fixed root; menu creation stores an explicit public route', () => {
  const navigation = read('lib/cms/navigation.ts')
  const ui = read('app/admin/dashboard/navigation/page.tsx')
  assert.match(navigation, /async function ensureLandingRootHierarchy\(\)/)
  assert.match(navigation, /function normalizeStoredMenuHref\(input: string, menuType: MenuType\)/)
  assert.match(navigation, /const slug = normalizeStoredMenuHref\(requestedSlug, menuType\)/)
  assert.match(navigation, /if \(input\.parentId == null\) throw new NavError\('Home is the only root/)
  assert.match(navigation, /saveDocument\(`page:\$\{slug\}`, menuPage\(slug, labelEn, labelBn/)
  assert.match(ui, /Add navigation item/)
  assert.match(ui, /Enter the complete public route/i)
  assert.match(ui, /Public page slugs never change when you reorder a menu/i)
  assert.doesNotMatch(navigation, /composeMenuPath|canonicalCollectionPath|synchronizeGroupPaths/)
})

test('all routes use one Home-rooted navigation tree with folder nodes and editable page slugs', () => {
  const data = read('data/data.ts')
  const seed = read('seed-structural.ts')
  const migration = read('drizzle/0016_single_navigation_tree_and_slug_pages.sql')
  const navbar = read('components/ui/NavBar.tsx')
  assert.match(data, /const navGroups: NavGroup\[\] = \[\]/)
  assert.match(data, /primaryNav\[0\]\.children = \[\s*\{ label: \{ en: 'Who We Are'/)
  assert.match(data, /label: \{ en: 'What We Do'/)
  assert.match(data, /href: '\/management-staff'/)
  assert.match(data, /href: '\/resources'/)
  assert.match(seed, /menuType === 'folder'/)
  assert.match(migration, /'\/management-staff'/)
  assert.match(migration, /'\/resources'/)
  assert.match(navbar, /mainNavigationLinks\.map/)
  assert.doesNotMatch(navbar, /navGroups\.map|groupCols/)
})

test('page sections define a reusable site-content collection and its presentation contract', () => {
  const types = read('types/entityType.ts')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const site = read('lib/site.ts')
  assert.match(types, /ContentCollectionConfig/)
  for (const property of ['enabled', 'component', 'maxItems', 'layout', 'columns', 'gap', 'viewportItems']) assert.match(types, new RegExp(`${property}\\??:`))
  assert.match(builder, /<SectionCollectionEditor section=\{section\}/)
  assert.match(builder, /Add content/)
  assert.match(builder, /Maximum records/)
  assert.match(builder, /Cards visible in viewport/)
  assert.match(builder, /Gap \(px\)/)
  assert.match(site, /maxItems: section\.type === 'cta' \|\| section\.type === 'donation' \? 1 : Math\.max\(1, Math\.min\(100/)
  assert.match(site, /viewportItems: Math\.max\(1, Math\.min\(12/)
  assert.match(site, /section\.type === 'cta' \|\| section\.type === 'donation' \? 1/)
})

test('content created from Site Content can create or join the collection on its destination page', () => {
  const content = read('lib/cms/content.ts')
  const editor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  const siteContent = read('app/admin/dashboard/site-content/page.tsx')
  assert.match(content, /async function ensureCollectionSection/)
  assert.match(content, /const destinationPage = FIXED_CONTENT_PARENT\[component\] \|\| routeParent/)
  assert.match(content, /contentCollection: \{ enabled: true, component, maxItems: 12/)
  assert.match(content, /await ensureCollectionSection\(routeParent, component\)/)
  assert.match(editor, /Publish under page/)
  assert.match(editor, /availablePages\.map\(\(page\)/)
  assert.match(siteContent, /requestedPage/)
  assert.match(siteContent, /FIXED_CONTENT_PARENT\[r\.component\] \|\| r\.values\.routeParent/)
})

test('page, section, navigation and content visibility are managed independently', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const navigation = read('lib/cms/navigation.ts')
  const site = read('lib/site.ts')
  const contentEditor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  assert.match(builder, /Publication status/)
  assert.match(builder, /Section visibility/)
  assert.match(navigation, /export async function setMenuVisibility/)
  assert.match(site, /i\.is_visible/)
  assert.match(site, /p\.status AS page_status/)
  assert.match(contentEditor, /setContentVisibility/)
  assert.match(contentEditor, /Now visible on the site/)
})

test('theme and colour administration is removed and legacy stored overrides are ignored', () => {
  const themeApi = read('app/api/admin/theme/route.ts')
  const site = read('lib/site.ts')
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  assert.match(themeApi, /status: 410/)
  assert.match(site, /themes: systemData\.themes/)
  assert.match(site, /public appearance is locked to the Scarlet\/Srizony design system/)
  assert.doesNotMatch(settings, /Theme and colour selection|Choose site colour|Theme palette editor/i)
})

test('JSON export includes CMS-managed page, navigation, content, identity and public payment display data', () => {
  const tables = read('lib/cms/dataTransfer.ts')
  const route = read('app/api/admin/database/export/route.ts')
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  for (const name of ['site_global_state', 'site_settings', 'payment_info', 'nav_groups', 'nav_items', 'pages', 'page_revisions', 'cms_content_items', 'media_items']) {
    assert.match(tables, new RegExp(`'${name}'`))
  }
  assert.match(route, /CMS_TRANSFER_TABLES/)
  assert.match(route, /key LIKE 'cms-document:%'/)
  assert.match(settings, /Export CMS data \(\.json\)/)
  assert.match(settings, /Website Essentials/)
})

test('JSON import validates the whole document before upserting and never deletes omitted rows', () => {
  const route = read('app/api/admin/database/import/route.ts')
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  assert.match(route, /Unsupported file/)
  assert.match(route, /Preflight every table, column and primary key before making the first write/)
  assert.match(route, /ON CONFLICT/)
  assert.match(route, /OVERRIDING SYSTEM VALUE/)
  assert.match(route, /Records absent from this file were not deleted/)
  assert.doesNotMatch(route, /DELETE FROM/)
  assert.match(settings, /Apply JSON changes/)
  assert.match(settings, /will not delete records/)
})

test('sensitive operational data is not part of the CMS mass-edit export', () => {
  const tables = read('lib/cms/dataTransfer.ts')
  for (const excluded of ['admin_login_attempts', 'admin_audit_log', 'donations', 'submissions', 'site_visitors', 'visitor_events', 'job_applications', 'form_users']) {
    assert.doesNotMatch(tables, new RegExp(`'${excluded}'`))
  }
  assert.match(read('app/admin/dashboard/settings/SettingsClient.tsx'), /user passwords, visitor logs, job applications, transaction records/)
})


test('statistics sections use real CMS metric records rather than generated index values', () => {
  const registry = read('lib/cms/components.ts')
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  const site = read('lib/site.ts')
  const content = read('lib/cms/content.ts')
  const library = read('app/admin/dashboard/site-content/page.tsx')
  assert.match(registry, /stat: \{[\s\S]*?key: 'stat'[\s\S]*?key: 'value'/)
  assert.match(registry, /slug: '\/impact\/statistics', component: 'stat'/)
  assert.match(pageBuilder, /if \(type === 'stats'\) return 'stat'/)
  assert.match(site, /value: entry\.metricValue \|\| '0'/)
  assert.match(content, /metricValue: v\.value \|\| undefined/)
  assert.match(library, /'success-story', 'stat'/)
  assert.doesNotMatch(site, /value: String\(index \+ 1\)/)
})
