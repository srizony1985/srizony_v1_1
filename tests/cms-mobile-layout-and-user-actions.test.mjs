import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('Page Builder exposes persisted mobile arrangements and mobile grid columns', () => {
  const types = read('types/entityType.ts')
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const site = read('lib/site.ts')
  const sectionRenderer = read('components/pages/SectionContent.tsx')
  const feedRenderer = read('components/pages/PublicContentFeed.tsx')
  const css = read('app/globals.css')

  assert.match(types, /mobileLayout\?: 'auto' \| 'grid' \| 'carousel' \| 'list'/)
  assert.match(types, /mobileColumns\?: 1 \| 2/)
  assert.match(builder, /<span>Mobile layout<\/span>/)
  assert.match(builder, /<span>Mobile columns<\/span>/)
  assert.match(builder, /mobileLayout: 'auto'/)
  assert.match(builder, /mobileColumns: 1/)
  assert.match(site, /mobileLayout: \['auto', 'grid', 'carousel', 'list'\]/)
  assert.match(site, /mobileColumns: Number\(storedCollection\?\.mobileColumns\) === 2 \? 2 : 1/)
  assert.match(sectionRenderer, /data-mobile-layout=\{collection\?\.mobileLayout !== 'auto'/)
  assert.match(sectionRenderer, /mobileColumns=\{collection\?\.mobileColumns \?\? 1\}/)
  assert.match(feedRenderer, /data-mobile-layout=\{mobileLayout !== 'auto'/)
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*data-mobile-layout="carousel"/)
  assert.match(css, /data-mobile-layout="grid"[\s\S]*grid-template-columns: repeat\(var\(--sf-grid-columns-mobile, 1\)/)
})

test('CMS header Create user button submits the user form directly', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  assert.match(settings, /type="submit" form="cms-user-create-form"/)
  assert.match(settings, /<form[\s\S]*?id="cms-user-create-form"[\s\S]*?onSubmit=\{\(event\) => void add\(event\)\}/)
})

test('Page Builder add-content and repeat-item controls use visible active-theme treatments', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  const css = read('app/globals.css')
  assert.match(builder, /cms-collection-add-button/)
  assert.match(builder, /cms-add-row inline-flex/)
  assert.match(css, /admin-theme-root \.cms-collection-add-button[\s\S]*background: var\(--primary\)[\s\S]*color: var\(--primary-foreground\)/)
  assert.match(css, /admin-theme-root \.cms-add-row[\s\S]*background: color-mix\(in srgb, var\(--primary\)/)
})
