import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canonicalizeCmsRoute, buildContentRoute, getContentRouteParent } from '../lib/cms/routes'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

test('legacy flat URLs resolve to the canonical menu/submenu hierarchy', () => {
  const cases: Array<[string, string]> = [
    ['/project', '/projects'],
    ['/enterprise/srizony-hospital', '/enterprise-development/srizony-hospital'],
    ['/partners-networks', '/about-us/partners-networks'],
    ['/health-program', '/social-development/health-program'],
    ['/education-program', '/social-development/education-program'],
    ['/human-rights', '/social-development/human-rights'],
    ['/agriculture-livelihood', '/social-development/agriculture-livelihood'],
    ['/women-business-loan', '/organizational-development/women-business-loan'],
    ['/loans', '/organizational-development'],
    ['/reports', '/resources'],
    ['/founders-footprint', '/about-us/founders-footprint'],
  ]
  for (const [legacy, canonical] of cases) assert.equal(canonicalizeCmsRoute(legacy), canonical, legacy)
})

test('content detail paths remain scoped beneath their selected menu or submenu', () => {
  assert.equal(buildContentRoute('/projects', 'safe-water'), '/projects/safe-water')
  assert.equal(buildContentRoute('/social-development/health-program', 'community-clinic'), '/social-development/health-program/community-clinic')
  assert.equal(getContentRouteParent('/social-development/health-program/community-clinic'), '/social-development/health-program')
})

test('the bundled page catalogue only exports navigation pages and content details', () => {
  const data = read('data/data.ts')
  assert.match(data, /navigationPaths\.has\(slug\)/)
  assert.match(data, /navigationPaths\.has\(getContentRouteParent\(slug\)\)/)
  assert.doesNotMatch(data, /^\s*'\/privacy':\s*\{/m)
  assert.doesNotMatch(data, /^\s*'\/reports':\s*\{/m)
  assert.match(data, /excludedNavigationLabels/)
  assert.match(data, /excludedPaths|excludedNavigationPaths/)
})

test('the seed removes page rows that are not in the visible navigation tree', () => {
  const seed = read('seed-structural.ts')
  assert.match(seed, /async function ensureAndPruneMenuPages\(\)/)
  assert.match(seed, /if \(!paths\.has\(slug\)\)/)
  assert.match(seed, /DELETE FROM pages WHERE slug = \$\{String\(row\.slug\)\}/)
  assert.match(seed, /await ensureAndPruneMenuPages\(\)/)
})

test('public catch-all routes reject unlinked pages but allow CMS detail pages', () => {
  const english = read('app/[...slug]/page.tsx')
  const bangla = read('app/bn/[[...slug]]/page.tsx')
  for (const route of [english, bangla]) {
    assert.match(route, /if \(!isNavigationPagePath\(canonical, snapshot\.global\) && !snapshot\.page\.contentComponent\) notFound\(\)/)
    assert.match(route, /if \(canonical !== .*\) redirect\(/)
  }
})

test('menu definitions use canonical hierarchical hrefs instead of legacy flat paths', () => {
  const data = read('data/data.ts')
  const navChunk = data.slice(data.indexOf('const primaryNav: NavItem[] = ['), data.indexOf('\nconst pages:')) + data.slice(data.indexOf('const navGroups: NavGroup[] = ['), data.indexOf('\nconst imageMedia'))
  assert.match(navChunk, /href: '\/about-us\/partners-networks'/)
  assert.match(navChunk, /href: '\/social-development\/health-program'/)
  assert.match(navChunk, /href: '\/organizational-development\/women-business-loan'/)
  assert.match(navChunk, /href: '\/enterprise-development\/srizony-hospital'/)
  assert.doesNotMatch(navChunk, /href: '\/partners-networks'/)
  assert.doesNotMatch(navChunk, /href: '\/health-program'/)
  assert.doesNotMatch(navChunk, /href: '\/enterprise\/srizony-hospital'/)
})
