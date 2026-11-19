import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('homepage renders both specialised compositions and ordinary Page Builder sections', () => {
  const home = read('components/home/HomePage.tsx')
  const policy = read('lib/cms/component-policy.ts')
  assert.match(home, /import SectionRenderer from '@\/components\/pages\/SectionRenderer'/)
  assert.match(home, /<SectionRenderer sections=\{visibleSections\} page=\{page\} \/>/)
  assert.doesNotMatch(home, /!isLandingComponentKey\(section\.homeComponent\)/)
  assert.doesNotMatch(policy, /if \(slug === '\/'\)\s*\{\s*if \(!isLandingComponentKey/)
  assert.match(policy, /validTypes\.includes\(section\.type\)/)
})

test('ContentFeed collection manager loads the full selected-type catalogue and stores section-level inclusion', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const types = read('types/entityType.ts')
  assert.match(types, /selectedRecordIds\?: number\[\]/)
  assert.match(builder, /listContent\(config\.component\)\s*\.then\(\(all\) => setItems\(all\)\)/)
  assert.doesNotMatch(builder, /all\.filter\(\(item\) => String\(FIXED_CONTENT_PARENT/)
  assert.match(builder, /useEffect\(\(\) => \{ void refresh\(\) \}, \[refresh\]\)/)
  assert.match(builder, /<Checkbox checked=\{selectedIds\.has\(item\.id\)\}/)
  assert.match(builder, /setConfig\(\{ selectedRecordIds: \[\.\.\.next\] \}\)/)
  assert.match(builder, /type="search" value=\{collectionQuery\}/)
  assert.match(builder, /showSearch/)
  assert.match(builder, /showCategoryFilter/)
  assert.match(builder, /showYearFilter/)
  assert.match(builder, /components: \[nextConfig\.component\]/)
  assert.match(builder, /editing === 'new' && saved\.status === 'published'/)
})

test('public content feeds hydrate only selected published records when an explicit selection exists', () => {
  const site = read('lib/site.ts')
  const content = read('lib/cms/content.ts')
  assert.match(site, /Array\.isArray\(config\.selectedRecordIds\)/)
  assert.match(site, /selectedRecordIds !== undefined \? \{ selectedRecordIds \} : \{\}/)
  assert.match(site, /getPublishedFeed\(\[config\.component\], maxItems, undefined, selectedRecordIds\)/)
  assert.match(content, /recordIds\?: number\[\]/)
  assert.match(content, /selectedIds\.includes\(Number\(row\.id\)\)/)
  assert.match(content, /AND id IN/)
})


test('new ordinary Page Builder sections start manual while ContentFeed starts connected', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(builder, /enabled: type === 'contentFeed'/)
  assert.match(builder, /COLLECTION_SECTION_TYPES\.has\(section\.type\) \|\| section\.contentCollection\?\.enabled \|\| section\.type === 'contentFeed'/)
})

test('legacy landing markers with a mismatched discriminator do not hide their section', () => {
  const renderer = read('components/pages/SectionRenderer.tsx')
  assert.match(renderer, /LANDING_COMPONENT_TYPE\[homeComponent\] === section\.type/)
  assert.match(renderer, /A stale legacy homeComponent must not make an otherwise valid CMS section/)
  assert.match(renderer, /return <PageSection key=/)
})


test('homepage Page Builder exposes both generic sections and specialised landing compositions', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(builder, /aria-label="Page section type"/)
  assert.match(builder, /onClick=\{addPageSection\}/)
  assert.match(builder, /Add section/)
  assert.match(builder, /Add landing composition/)
  assert.match(builder, /grid-cols-2 gap-3 xl:grid-cols-4/)
})
