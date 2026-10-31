import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('Projects page is treated as a database catalogue in the Page Builder', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(builder, /isProjectsCollectionMarker/)
  assert.match(builder, /isProjectsCollectionPresentation/)
  assert.match(builder, /isProjectsDatabaseSection = pageSlug === '\/projects'/)
  assert.match(builder, /collectionManaged = Boolean\(section\.contentCollection\?\.enabled \|\| isProjectsDatabaseSection/)
  assert.match(builder, /setItems\(isCanonicalProjectsCollection\s*\? all/)
  assert.match(builder, /Project cards and uploaded images are loaded from published Project records/)
  assert.match(builder, /cms-collection-thumb/)
})

test('Saving the canonical Projects page always persists its live Project collection binding', () => {
  const site = read('lib/site.ts')
  assert.match(site, /const markedProjectsSectionIndex = slug === '\/projects'/)
  assert.match(site, /const projectsSectionIndex = slug === '\/projects'/)
  assert.match(site, /index === projectsSectionIndex/)
  assert.match(site, /enabled: isCanonicalProjectsCollection \? true/)
  assert.match(site, /component: isCanonicalProjectsCollection \? 'project' : component/)
})

test('Public Projects page hydrates items for every supported card presentation', () => {
  const site = read('lib/site.ts')
  assert.match(site, /function isProjectsCollectionSection\(/)
  assert.match(site, /function isProjectCollectionPresentation\(/)
  assert.match(site, /function projectsCollectionSectionIndex\(/)
  assert.match(site, /const projectSectionIndex = canonicalSlug === '\/projects'/)
  assert.match(site, /sectionIndex === projectSectionIndex/)
  assert.match(site, /if \(section\.type === 'contentFeed'\) return \{ \.\.\.section, components: \['project'\], items: collection \}/)
  assert.match(site, /if \(section\.type === 'cards'\) return \{ \.\.\.section, items: cards \}/)
  assert.match(site, /if \(section\.type === 'gallery'\) return \{ \.\.\.section, items: collection\.filter/)
  assert.match(site, /if \(section\.type === 'carousel'\) return \{ \.\.\.section, items: collection\.map/)
  assert.match(site, /canonicalSlug === '\/projects' \? undefined : canonicalSlug/)
  assert.match(site, /if \(canonicalSlug === '\/projects' && collection\.length && !projectSectionMatched\)/)
})

test('Published Project images are exposed as the card image field consumed by the renderer', () => {
  const content = read('lib/cms/content.ts')
  const site = read('lib/site.ts')
  const card = read('components/pages/ContentFeedCard.tsx')
  const sections = read('components/pages/SectionContent.tsx')
  assert.match(content, /function storedImageSource\(/)
  assert.match(content, /const attributeCandidates = \[attrs\.image, attrs\.imageSrc, attrs\.image_url\]/)
  assert.match(content, /const candidates = imageManaged\s*\? \[\.\.\.attributeCandidates, row\.image_src\]/)
  assert.match(content, /normalizeMediaSrc\(/)
  assert.match(content, /api\/media\/by-key/)
  assert.match(content, /const savedImage = storedImageSource\(row, attrs\)/)
  assert.match(content, /const imageWasSelectedInCms = Boolean\(v\.image\)/)
  assert.match(site, /entry\.image \? \{ src: entry\.image, alt: entry\.title \}/)
  assert.match(card, /item\.image \? <SafeImage src=\{item\.image\}/)
  assert.match(sections, /item\.image\?\.src \? <div className="sf-card-media">/)
})

test('Legacy and CMS-managed media references do not discard an explicit uploaded image', () => {
  const content = read('lib/cms/content.ts')
  assert.match(content, /const knownSeedImage = !imageManaged && isSeedCatalogueImage\(row, attrs\)/)
  assert.match(content, /return `\/api\/media\/by-key\//)
  assert.match(content, /uploads\\\/media/)
  assert.match(content, /value\.startsWith\('\/'\) \|\| \/\^https\?:/)
})

test('Projects Page Builder receives live CMS records in its editor items array', () => {
  const site = read('lib/site.ts')
  assert.match(site, /function hydrateProjectsEditorPage\(/)
  assert.match(site, /const projects = await getPublishedFeed\(\['project'\], 100\)/)
  assert.match(site, /fallback = hydrateProjectsEditorPage\(fallback, projects\)/)
  assert.match(site, /override = hydrateProjectsEditorPage\(override as PageData \| null, projects\)/)
  assert.match(site, /if \(section\.type === 'carousel'\) return \{ \.\.\.section, items: entries\.map/)
})

test('Live Projects items are not duplicated into the saved page snapshot', () => {
  const site = read('lib/site.ts')
  assert.match(site, /slug === '\/projects' && isCanonicalProjectsCollection \? \{ items: \[\] \} : \{\}/)
})
