import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('Homepage Page Builder exposes database-backed add/edit managers for News Rail and Success Stories cards', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const manager = read('app/admin/dashboard/_components/LandingCollectionCardsEditor.tsx')
  assert.match(builder, /<LandingCollectionCardsEditor component="news"\s*\/>/)
  assert.match(builder, /<LandingCollectionCardsEditor component="success-story"\s*\/>/)
  assert.match(builder, /Add and manage its cards below/)
  assert.match(manager, /Add news card/)
  assert.match(manager, /Add success story card/)
  assert.match(manager, /listContent\(component\)/)
  assert.match(manager, /<ContentEditor/)
  assert.match(manager, /onDeleted=\{remove\}/)
})

test('News and Success Story records support a CMS-managed landing-card display order', () => {
  const definitions = read('lib/cms/components.ts')
  const content = read('lib/cms/content.ts')
  const editor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  assert.match(definitions, /Landing card order \(optional\)/)
  assert.match(definitions, /Landing gallery order \(optional\)/)
  assert.equal((content.match(/attributes->>'displayOrder'/g) || []).length >= 4, true)
  assert.match(content, /Number\(value\) > 100000/)
  assert.match(editor, /field\.key === 'displayOrder'/)
})

test('Landing section card counts are configurable and public components respect the CMS limit', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const site = read('lib/site.ts')
  const news = read('components/home/NewsRail.tsx')
  const stories = read('components/home/SuccessStoriesGallery.tsx')
  const types = read('types/entityType.ts')
  assert.match(types, /maxItems\?: number/)
  assert.match(builder, /Maximum cards displayed/)
  assert.match(site, /newsSectionLimit/)
  assert.match(site, /successSectionLimit/)
  assert.match(news, /source\?\.maxItems/)
  assert.match(stories, /source\.maxItems/)
})

test('Landing Page Builder routes the legacy Success Story heading to the Success Stories gallery editor, not News', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(builder, /const isNewsRail =[^\n]*news from the field/)
  assert.match(builder, /const isSuccessGallery =[^\n]*success story of srizony/)
})


test('Legacy newsFeed homepage sections are recognized, normalized and editable through the News Rail manager', () => {
  const policy = read('lib/cms/component-policy.ts')
  const renderer = read('components/home/LandingSectionRenderer.tsx')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const site = read('lib/site.ts')
  assert.match(policy, /newsFeed: 'carousel'/)
  assert.match(renderer, /case 'newsFeed'/)
  assert.match(builder, /section\.homeComponent === 'newsFeed'/)
  assert.match(site, /section\.homeComponent === 'newsFeed'/)
  assert.match(site, /homeComponent: section\.homeComponent === 'stories' \|\| section\.homeComponent === 'newsFeed' \? 'news'/)
})

test('Success Story CMS records require an approved image before publishing a gallery card', () => {
  const definitions = read('lib/cms/components.ts')
  const editor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  const content = read('lib/cms/content.ts')
  const gallery = read('components/home/SuccessStoriesGallery.tsx')
  const statusApi = read('lib/cms/content.ts')
  assert.match(definitions, /core\(\)\.map\(\(field\) => field\.key === 'image' \? \{ \.\.\.field, required: true/)
  assert.match(editor, /field\.required \? ' \*'/)
  assert.match(content, /if \(field\.required && !value/)
  assert.match(statusApi, /Add an approved image before publishing this Success Story/)
  assert.match(gallery, /item\.image\?\.src/)
})
