import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('new navigation pages receive one default section with a content-feed or other-section choice', () => {
  const editor = read('app/admin/dashboard/navigation/page.tsx')
  const service = read('lib/cms/navigation.ts')
  const api = read('app/api/admin/navigation/route.ts')
  assert.match(editor, /No preference — use Rich text \(default\)/)
  assert.match(editor, /value="contentFeed"/)
  assert.match(editor, /value="other"/)
  assert.match(editor, /RENDERED_COMPONENTS\.filter\(\(type\) => type !== 'contentFeed'\)/)
  assert.match(editor, /initialSectionGroup === 'contentFeed'[\s\S]*?'contentFeed'[\s\S]*?'richText'/)
  assert.match(service, /cleanSectionCount\(input\.sectionCount \?\? 1\)/)
  assert.match(service, /const contentType = settings\?\.sectionContentType \?\? 'richText'/)
  assert.match(api, /sectionContentType: z\.enum\(/)
})

test('location maps are opt-in and restricted to the home and contact routes', () => {
  const routePolicy = read('lib/cms/locationMap.ts')
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  const template = read('components/pages/PageTemplate.tsx')
  const migration = read('drizzle/0029_location_map_opt_in.sql')
  assert.match(routePolicy, /path === '\/' \|\| path === '\/contact' \|\| path === '\/contact-us'/)
  assert.match(routePolicy, /page\.showContactMap === true/)
  assert.match(pageBuilder, /supportsLocationMap\(nextSlug\) && data\.showContactMap === true/)
  assert.match(pageBuilder, /Page elements/)
  assert.match(pageBuilder, /Delete \$\{label\} from this page/)
  assert.match(template, /showContactMap && <LocationMaps page=\{page\} variant="contact"/)
  assert.match(migration, /'{showContactMap}'[\s\S]*?'false'::jsonb/)
})

test('content-feed search, category and year filters are editable, persisted and conditionally rendered', () => {
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  const site = read('lib/site.ts')
  const renderer = read('components/pages/PublicContentFeed.tsx')
  const sectionContent = read('components/pages/SectionContent.tsx')
  for (const flag of ['showSearch', 'showCategoryFilter', 'showYearFilter']) {
    assert.ok(pageBuilder.includes(flag), `missing CMS control ${flag}`)
    assert.ok(site.includes(`${flag}: storedCollection?.${flag} !== false`), `missing persistence for ${flag}`)
    assert.ok(renderer.includes(flag), `missing public renderer behavior for ${flag}`)
    assert.ok(sectionContent.includes(`${flag}={collection?.${flag} !== false}`), `missing renderer binding for ${flag}`)
  }
})

test('footer link creation opens a bounded single-link editor instead of an overflowing field grid', () => {
  const footer = read('app/admin/dashboard/_components/FooterSettingsView.tsx')
  assert.match(footer, /setActiveFooterLinkIds/)
  assert.match(footer, /role="tablist"/)
  assert.match(footer, /role="tabpanel"/)
  assert.match(footer, /grid min-w-0 gap-3 rounded-lg border border-border bg-card/)
  assert.doesNotMatch(footer, /grid-template-columns:repeat\(5/)
})

test('public typography roles and Scarlet Labs CMS attribution are connected to the CMS', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  const typography = read('lib/themeTypography.ts')
  const runtime = read('lib/themeRuntime.ts')
  const css = read('app/globals.css')
  const login = read('app/admin/login/page.tsx')
  const footer = read('components/admin/cms/AdminAppShell.tsx')
  // These roles have visible controls in the current Typography workspace.
  for (const role of ['bodyScale', 'h1Scale', 'h2Scale', 'h3Scale', 'leadScale', 'eyebrowScale', 'cardTitleScale', 'cardBodyScale', 'buttonScale', 'breadcrumbScale', 'metaScale', 'labelScale', 'brandScale', 'footerHeadingScale']) {
    assert.ok(settings.includes(role), `missing CMS typography control ${role}`)
    assert.ok(runtime.includes(role), `missing runtime token mapping ${role}`)
  }
  // Footer-link scale remains a supported persisted/runtime role; it is not a
  // separately exposed control in the current settings UI.
  assert.match(typography, /footerLinkScale: number/)
  assert.match(typography, /footerLinkScale: boundedNumber/)
  assert.match(runtime, /footer-link-scale/)
  assert.match(css, /\.sf-main :is\(h1, h2, h3, h4, h5, h6\)/)
  assert.match(css, /\.sf-footer :is\(h1,h2,h3,h4,h5,h6/)
  assert.match(login, /Content Management System/)
  assert.match(login, /© 2026 Scarlet Labs/)
  assert.match(footer, /Developed by Scarlet Labs/)
  assert.match(footer, /Website CMS · Recruitment Application/)
})
