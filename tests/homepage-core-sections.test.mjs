import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(file, 'utf8')

test('a saved CMS homepage is authoritative: deleted sections and empty content stay deleted', () => {
  const site = read('lib/site.ts')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const seed = read('seed-structural.ts')
  const api = read('app/api/site/route.ts')
  assert.match(site, /A saved\s+\*? `sections` array is authoritative/)
  assert.match(site, /if \(addMissingManaged && fallback\)/)
  assert.doesNotMatch(site, /component === 'news' && shouldInsertDefault/)
  assert.doesNotMatch(site, /if \(!current\.items\?\.length\) current\.items = fallback\.items/)
  assert.doesNotMatch(site, /if \(!hasLandingBody\(current\.body\)\) current\.body = fallback\.body/)
  assert.match(builder, /sections: cur\.sections\.filter\(\(_, i\) => i !== index\)/)
  assert.match(builder, /function commitItems\(next: JsonObject\[\]\)/)
  assert.match(builder, /dataSource: 'manual' as const/)
  assert.match(site, /revalidateTag\('site-content', \{ expire: 0 \}\)/)
  assert.doesNotMatch(seed, /requiredKeys = new Set/)
  assert.doesNotMatch(seed, /mergeUniqueItems/)
  assert.match(seed, /sections: current\.sections/)
  assert.match(api, /'Cache-Control': 'no-store, max-age=0'/)
  assert.doesNotMatch(site, /else if \(entries\.length\) sections\.push\(/)
})

test('impact cards have a registered landing identity and use the shared page-section renderer', () => {
  const types = read('types/entityType.ts')
  const policy = read('lib/cms/component-policy.ts')
  const renderer = read('components/home/LandingSectionRenderer.tsx')
  const data = read('data/data.ts')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(types, /'impactCards'/)
  assert.match(policy, /impactCards: 'cards'/)
  assert.match(policy, /key: 'impactCards'/)
  assert.match(renderer, /case 'impactCards': return section\.type === 'cards' \? <PageSectionRenderer/)
  assert.match(data, /homeComponent:'impactCards',[\s\S]{0,100}variant:'impact'/)
  assert.match(builder, /if \(key === 'impactCards' && next\.type === 'cards'\)/)
})

test('blank portfolio MVV fields cannot hide or erase the homepage MVV cards', () => {
  const site = read('lib/site.ts')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(site, /if \(mvvItems\.length > 0\)\s*\{/)
  assert.match(site, /section\.dataSource === 'published-feed'/)
  assert.match(site, /section\.dataSource === 'portfolio-about'/)
  assert.match(builder, /portfolio-about/)
  assert.match(builder, /Synchronize published Job records/)
  assert.match(site, /visible: section\.visible !== false/)
  assert.match(site, /items: mergeMvvArtwork\(mergedItems, section\)/)
  assert.doesNotMatch(site, /visible: mvvItems\.length > 0/)
})

test('an empty saved website-essentials locations list falls back to the configured branch directory', () => {
  const api = read('app/api/website-essentials/route.ts')
  assert.match(api, /locations: normalizedEssentials\.locations\.length \? normalizedEssentials\.locations : BRANCHES/)
})


test('a deleted newsroom rail is not restored, while an existing rail keeps its canonical renderer identity', () => {
  const site = read('lib/site.ts')
  const renderer = read('components/home/LandingSectionRenderer.tsx')
  assert.match(site, /Older documents used `stories`\/`newsFeed` for the newsroom/)
  assert.doesNotMatch(site, /if \(fallback && component === 'news'/)
  assert.match(renderer, /case 'news':[\s\S]*case 'newsFeed':[\s\S]*NewsRail/)
})

test('deleted project and career sections are not synthesized from their content collections', () => {
  const site = read('lib/site.ts')
  assert.doesNotMatch(site, /!projectSectionMatched/)
  assert.match(site, /Hydrate only a collection section the editor has explicitly configured/)
  assert.match(site, /section\.dataSource !== 'manual'/)
  assert.match(site, /section\.dataSource === 'published-feed'/)
  assert.doesNotMatch(site, /sections: \[\.\.\.page\.sections, \{ type: 'contentFeed', heading: \{ en: 'Current Vacancies'/)
})
