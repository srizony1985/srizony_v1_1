import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(file, 'utf8')

test('a saved CMS homepage respects section deletions while restoring its required newsroom rail', () => {
  const site = read('lib/site.ts')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.doesNotMatch(site, /REQUIRED_LANDING_COMPONENTS/)
  assert.match(site, /Only a page without a persisted CMS override receives bundled defaults/)
  assert.match(site, /if \(fallback && addMissingManaged\)/)
  assert.match(site, /else if \(fallback && component === 'news' && shouldInsertDefault\)/)
  assert.match(site, /Array\.isArray\(override\?\.sections\) \? override!\.sections as PageData\['sections'\] : \(fallback\?\.sections \|\| \[\]\)/)
  assert.match(builder, /sections: cur\.sections\.filter\(\(_, i\) => i !== index\)/)
  assert.match(site, /revalidateTag\('site-content', \{ expire: 0 \}\)/)
  assert.match(site, /if \(!current\.items\?\.length\) current\.items = fallback\.items/)
  assert.match(site, /if \(!hasLandingBody\(current\.body\)\) current\.body = fallback\.body/)
  assert.match(site, /current\.visible === false \? \{ visible: false \}/)
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
  assert.match(site, /if \(mvvItems\.length > 0\)\s*\{/)
  assert.match(site, /visible: section\.visible !== false/)
  assert.match(site, /items: mergeMvvArtwork\(mergedItems, section\)/)
  assert.doesNotMatch(site, /visible: mvvItems\.length > 0/)
})

test('an empty saved website-essentials locations list falls back to the configured branch directory', () => {
  const api = read('app/api/website-essentials/route.ts')
  assert.match(api, /locations: normalizedEssentials\.locations\.length \? normalizedEssentials\.locations : BRANCHES/)
})


test('saved homepages restore the managed news rail and render its canonical identity', () => {
  const site = read('lib/site.ts')
  const renderer = read('components/home/LandingSectionRenderer.tsx')
  assert.match(site, /fallback && \(addMissingManaged \|\| component === 'news'\)/)
  assert.match(renderer, /case 'news':[\s\S]*case 'newsFeed':[\s\S]*NewsRail/)
})
