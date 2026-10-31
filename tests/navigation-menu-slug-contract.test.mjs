import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const requestedRoutes = [
  '/projects', '/carrer-job', '/notice', '/contact',
  '/about-us', '/about-us/founders-footprint', '/about-us/awards-recognition',
  '/about-us/executive-committee', '/about-us/operational-structure',
  '/about-us/partners-networks', '/about-us/governing-body', '/at-a-glance',
  '/impact-on-sdg', '/good-governance', '/management-staff', '/resources',
  '/social-development', '/social-development/health-program',
  '/social-development/education-program', '/social-development/human-rights',
  '/social-development/human-resource', '/social-development/climate-change',
  '/social-development/agriculture-livelihood', '/organizational-development',
  '/organizational-development/women-business-loan',
  '/organizational-development/small-enterprise-loan',
  '/organizational-development/agri-development-loan',
  '/organizational-development/household-migrant-loan',
  '/organizational-development/rural-development-loan',
  '/organizational-development/job-holders-loan',
  '/organizational-development/student-loan', '/enterprise-development',
  '/enterprise-development/srizony-hospital', '/enterprise-development/srizony-university',
  '/enterprise-development/srizony-polytechnic', '/enterprise-development/srizony-printing-press',
  '/enterprise-development/srizony-filling-station', '/enterprise-development/srizony-internet',
  '/enterprise-development/srizony-computer-garden', '/enterprise-development/srizony-motors',
  '/microfinance-program', '/success-stories', '/news',
]

test('the bundled navigation is one Home-rooted tree with two ordinary folder nodes', () => {
  const data = read('data/data.ts')
  for (const route of requestedRoutes) assert.ok(data.includes(`href: '${route}'`), `missing navigation route ${route}`)
  assert.match(data, /label: \{ en: 'Home', bn: 'হোম' \}[\s\S]*?href: '\/'/)
  assert.match(data, /label: \{ en: 'Who We Are'/)
  assert.match(data, /label: \{ en: 'What We Do'/)
  assert.match(data, /menuType: 'folder'/)
  assert.match(data, /const navGroups: NavGroup\[\] = \[\]/)
  assert.doesNotMatch(data, /href: '\/donate'/)
})

test('Home is the only fixed root; every other node remains an editable menu record', () => {
  const navigation = read('lib/cms/navigation.ts')
  const editor = read('app/admin/dashboard/navigation/page.tsx')
  assert.match(navigation, /async function ensureLandingRootHierarchy\(\)/)
  assert.match(navigation, /SET parent_id = \$\{landingId\} WHERE parent_id IS NULL AND id <> \$\{landingId\}/)
  assert.match(navigation, /Home is the only root\. Add every other menu under Home/)
  assert.match(editor, /Home is fixed and cannot be edited or reordered/)
  assert.match(editor, /draggable=\{!node\.isLandingPage && !busy\}/)
  assert.match(editor, /Navigation folder/)
  assert.doesNotMatch(editor, /REQUIRED_LANDING_MENU|group tabs|Rename navigation group/i)
  assert.doesNotMatch(navigation, /Partners & Networks is a required|Partners & Networks must remain/i)
})

test('menu editing and reorder operations preserve explicit page routes', () => {
  const navigation = read('lib/cms/navigation.ts')
  assert.match(navigation, /function normalizeStoredMenuHref/)
  assert.match(navigation, /const slug = normalizeStoredMenuHref\(requestedSlug, menuType\)/)
  assert.match(navigation, /const slug = normalizeStoredMenuHref\(input\.slug \|\| \(menuType === 'page' \? oldSlug : ''\), menuType\)/)
  assert.match(navigation, /Reordering changes only parent\/order metadata/)
  assert.doesNotMatch(navigation, /composeMenuPath|canonicalCollectionPath|synchronizeGroupPaths/)
  assert.doesNotMatch(navigation, /Partners & Networks must remain|Partners & Networks.*cannot contain nested/)
})

test('desktop and mobile headers render the single tree without separate navigation groups', () => {
  const navbar = read('components/ui/NavBar.tsx')
  const menuTree = read('components/ui/NavMenuTree.tsx')
  assert.match(navbar, /<Link href="\/" className=\{`sf-nav-link/)
  assert.match(navbar, /mainNavigationLinks\.map/)
  assert.match(navbar, /item\.menuType === 'folder'/)
  assert.match(navbar, /sf-drawer-main-links/)
  assert.doesNotMatch(navbar, /navGroups\.map|groupCols/)
  assert.match(menuTree, /aria-expanded/)
  assert.match(menuTree, /setExpanded/)
})

test('the admin editor offers edit, visibility, delete and reorder controls for every non-Home node', () => {
  const editor = read('app/admin/dashboard/navigation/page.tsx')
  assert.match(editor, /onClick=\{\(\) => void toggleVisibility\(node\)\}/)
  assert.match(editor, /onClick=\{\(\) => void reorderMenu\(node\.id, -1\)\}/)
  assert.match(editor, /onClick=\{\(\) => void reorderMenu\(node\.id, 1\)\}/)
  assert.match(editor, /onClick=\{\(\) => openEdit\(node\)\}/)
  assert.match(editor, /onClick=\{\(\) => setConfirm\(node\)\}/)
  assert.match(editor, /Enter the complete public route/)
  assert.match(editor, /const MAX_TREE_DEPTH = 4/)
})

test('the allowed hierarchy has three editable levels beneath fixed Home', () => {
  const navigation = read('lib/cms/navigation.ts')
  const editor = read('app/admin/dashboard/navigation/page.tsx')
  assert.match(navigation, /const MENU_LEVELS_BELOW_LANDING = 3/)
  assert.match(navigation, /const MAX_DEPTH = MENU_LEVELS_BELOW_LANDING \+ 1/)
  assert.match(navigation, /UPDATE nav_items n SET parent_id = v\.parent_id, sort_order = v\.sort_order/)
  assert.match(editor, /await saveMenuOrder\('primary', toMove\(next\)\)/)
})

test('the latest migration installs one tree with Who We Are and What We Do as folder nodes', () => {
  const migration = read('drizzle/0016_single_navigation_tree_and_slug_pages.sql')
  const slugRepair = read('drizzle/0017_management_resources_slug_pages.sql')
  assert.match(migration, /VALUES \('primary', 'Site Navigation'/)
  assert.match(migration, /'Who We Are'.*'folder'/s)
  assert.match(migration, /'What We Do'.*'folder'/s)
  for (const route of requestedRoutes) assert.ok(migration.includes(`'${route}'`), `migration missing route ${route}`)
  assert.match(migration, /DELETE FROM nav_groups WHERE id <> primary_group_id/)
  assert.match(migration, /INSERT INTO pages \(slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at\)/)
  assert.match(migration, /NOT EXISTS \(SELECT 1 FROM pages p WHERE p.slug = n.href\)/)
  assert.match(migration, /DELETE FROM nav_items WHERE NOT \(id = ANY\(keep_ids\)\)/)
  assert.match(migration, /CHECK \(parent_id IS NOT NULL OR href = '\/'\)/)
  assert.match(slugRepair, /href = item\.href,\s*menu_type = 'page'/)
  assert.match(slugRepair, /'\/management-staff'/)
  assert.match(slugRepair, /'\/resources'/)
})

test('desktop navigation dropdowns are mounted for CSS hover, keyboard focus and pointer interaction', () => {
  const navbar = read('components/ui/NavBar.tsx')
  const tree = read('components/ui/NavMenuTree.tsx')
  const styles = read('app/site-polish.css')
  assert.match(navbar, /onPointerEnter=\{\(event\) =>/)
  assert.match(navbar, /onPointerLeave=\{\(event\) =>/)
  assert.match(navbar, /onFocusCapture=\{\(\) => setOpenGroup\(key\)\}/)
  assert.match(navbar, /onBlurCapture=\{\(event\) =>/)
  assert.match(navbar, /onClick=\{\(\) => setOpenGroup\(\(current\) => current === key \? null : key\)\}/)
  assert.match(navbar, /<div className="sf-dd-panel sf-group-panel" aria-label=/)
  assert.doesNotMatch(navbar, /expanded && <div className="sf-dd-panel/)
  assert.match(navbar, /aria-expanded=\{expanded\}/)
  assert.match(tree, /onPointerEnter=\{\(event\) =>/)
  assert.match(tree, /onPointerLeave=\{\(event\) =>/)
  assert.match(styles, /\.sf-dd--group:hover > \.sf-dd-panel\.sf-group-panel/)
  assert.match(styles, /\.sf-dd--group:focus-within > \.sf-dd-panel\.sf-group-panel/)
  assert.match(styles, /pointer-events: none;/)
  assert.match(styles, /pointer-events: auto;/)
  assert.match(styles, /left: calc\(100% - 1px\);/)
  assert.match(navbar, /mobileExpandedItems/)
})
