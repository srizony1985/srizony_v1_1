import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('structural seed imports the content-details dataset validator it calls', () => {
  const seed = read('seed-structural.ts')
  assert.match(seed, /import \{[^}]*validateContentDetailsDataset[^}]*\} from ['"]@\/lib\/cms\/fallback-gateway['"]`?;?/s)
  assert.match(seed, /const catalogue = validateContentDetailsDataset\(\)/)
})

test('homepage visual components safely handle optional CMS fields', () => {
  const locations = read('components/home/LocationMaps.tsx')
  const mission = read('components/home/MissionVisionValues.tsx')
  const newsRail = read('components/home/NewsRail.tsx')

  assert.match(locations, /footprintEyebrow\?\.\[lang\] \?\? ''/)
  assert.match(locations, /footprintTitle\?\.\[lang\] \?\? ''/)
  assert.doesNotMatch(mission, /<Illustration kind="area"[^>]*label=/)
  assert.match(newsRail, /image\?\.src && <SafeImage src=\{image\.src\}/)
  assert.match(newsRail, /showNewsSecondaryButton && newsSecondaryHref && newsSecondaryLabel\?\.\[lang\]/)
})

test('legacy newsFeed identity is part of the canonical landing-component type contract', () => {
  const entityTypes = read('types/entityType.ts')
  const componentPolicy = read('lib/cms/component-policy.ts')
  const renderer = read('components/home/LandingSectionRenderer.tsx')
  const pageBuilder = read('app/admin/dashboard/page-builder/page.tsx')
  const newsRail = read('components/home/NewsRail.tsx')
  assert.match(entityTypes, /'newsFeed'.*@deprecated/s)
  assert.match(componentPolicy, /LandingComponentKeyModel/)
  assert.match(componentPolicy, /newsFeed:\s*'carousel'/)
  assert.match(renderer, /case 'newsFeed'/)
  assert.match(pageBuilder, /section\.homeComponent === 'newsFeed'/)
  assert.match(newsRail, /s\.homeComponent === 'newsFeed'/)
})

test('database transfer routes narrow the nullable database before callbacks', () => {
  const exportRoute = read('app/api/admin/database/export/route.ts')
  const importRoute = read('app/api/admin/database/import/route.ts')
  assert.match(exportRoute, /const database = db[\s\S]*?if \(database === null\)[\s\S]*?database\.execute/)
  assert.match(importRoute, /const database = db[\s\S]*?if \(database === null\)[\s\S]*?database\.execute/)
  assert.doesNotMatch(exportRoute, /\bdb\.execute/)
  assert.doesNotMatch(importRoute, /\bdb\.execute/)
})

test('content collection JSON is narrowed before reading its config fields', () => {
  const content = read('lib/cms/content.ts')
  assert.match(content, /const rawCollection = section\?\.contentCollection/)
  assert.match(content, /!Array\.isArray\(rawCollection\)[\s\S]*?rawCollection as Record<string, unknown>/)
})

test('landing feed limits are read only after carousel narrowing', () => {
  const site = read('lib/site.ts')
  assert.match(site, /if \(section\.type !== 'carousel' \|\| !matches\(section\)\) return \[\][\s\S]*?section\.type === 'carousel' \? section\.maxItems/)
  assert.match(site, /\.includes\(sectionHeading \?\? ''\)/)
})
