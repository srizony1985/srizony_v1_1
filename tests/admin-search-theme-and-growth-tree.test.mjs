import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('CMS search fields explicitly use semantic surfaces in light and dark modes', () => {
  const css = read('app/globals.css')
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  const toolbar = read('components/admin/cms/AdminToolbar.tsx')

  assert.match(shell, /id="cms-navigation-search"[\s\S]*?className="admin-theme-search-input[^\"]*bg-card[^\"]*text-foreground/)
  assert.match(toolbar, /className="admin-theme-search-input[^\"]*bg-card[^\"]*text-foreground/)
  assert.match(css, /\.admin-theme-root input\.admin-theme-search-input[\s\S]*?background:\s*var\(--background\)\s*!important/)
  assert.match(css, /-webkit-text-fill-color:\s*var\(--foreground\)\s*!important/)
  assert.match(css, /input\.admin-theme-search-input:-webkit-autofill/)
})

test('growth-tree branch records are served publicly and persisted through an admin-only API', () => {
  const settings = read('lib/GrowthMilestones.ts')
  const publicRoute = read('app/api/growth-tree/route.ts')
  const adminRoute = read('app/api/admin/growth-tree/route.ts')
  const apiClient = read('lib/api/growthTree.ts')
  const registry = read('lib/apiRegistry.ts')
  const editor = read('app/admin/dashboard/settings/GrowthTreeView.tsx')
  const tree = read('components/home/GrowthTree.tsx')

  assert.match(settings, /GROWTH_TREE_SETTING_KEY\s*=\s*'homepage\.growth-tree'/)
  assert.match(settings, /START_YEAR\s*=\s*1985/)
  assert.match(settings, /END_YEAR\s*=\s*2026/)
  assert.match(publicRoute, /readCmsSettingValueInfo/)
  assert.match(publicRoute, /normalizeGrowthMilestones/)
  assert.match(adminRoute, /requireAdmin\('admin', 'editor', 'analyst'\)/)
  assert.match(adminRoute, /requireAdmin\('admin', 'editor'\)/)
  assert.match(adminRoute, /\.insert\(siteSettings\)/)
  assert.match(adminRoute, /\.onConflictDoUpdate/)
  assert.match(adminRoute, /revalidatePath\('\/', 'layout'\)/)
  assert.match(adminRoute, /auditAdminAction/)
  assert.match(apiClient, /\/api\/admin\/growth-tree/)
  assert.match(apiClient, /method:\s*'PUT'/)
  assert.match(registry, /\"path\": \"\/api\/growth-tree\"/)
  assert.match(registry, /\"path\": \"\/api\/admin\/growth-tree\"/)
  assert.match(editor, /saveGrowthTreeAdmin/)
  assert.match(editor, /English title/)
  assert.match(editor, /বাংলা শিরোনাম/)
  assert.match(tree, /fetch\('\/api\/growth-tree'/)
  assert.match(tree, /setMilestones\(normalizeGrowthMilestones/)
})

test('growth-tree CMS editor is discoverable from Settings and uses shared workspace components', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  const editor = read('app/admin/dashboard/settings/GrowthTreeView.tsx')
  const footer = read('app/admin/dashboard/_components/FooterSettingsView.tsx')
  const siteConfig = read('app/admin/dashboard/site-configuration/SiteConfigurationClient.tsx')

  assert.match(settings, /view === 'growth' && <GrowthTreeView role=\{role\}/)
  assert.match(shell, /Homepage Growth Tree[\s\S]*?settings\?view=growth/)
  assert.match(editor, /<AdminWorkspaceGrid layout="split" columns="minmax\(0, 1\.2fr\) minmax\(0, 0\.9fr\)"/)
  assert.match(editor, /<AdminDataContainer/)
  assert.match(editor, /<AdminTable/)
  assert.match(footer, /<AdminWorkspaceGrid layout="single"/)
  assert.match(footer, /<AdminDataContainer/)
  assert.match(siteConfig, /<AdminWorkspaceGrid layout="single"/)
  assert.match(siteConfig, /<AdminDataContainer/)
  assert.match(settings, /<AdminWorkspaceGrid layout="single" ariaLabel="CMS reporting and data exports"/)
  assert.match(settings, /<AdminDataContainer\s+label="CMS reporting workspace"/)
})
