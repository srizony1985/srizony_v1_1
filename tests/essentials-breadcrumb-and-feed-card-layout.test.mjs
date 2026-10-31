import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('Documents & Resources resolves as an ordinary CMS slug rendered by the shared page template', () => {
  const content = read('components/pages/ResourcesContent.tsx')
  const contentPage = read('components/pages/ContentPage.tsx')
  const template = read('components/pages/PageTemplate.tsx')
  const dynamicRoute = read('app/[...slug]/page.tsx')
  assert.match(dynamicRoute, /return <ContentPage slug=\{canonical\} \/>/)
  assert.match(content, /sf-block sf-resource-directory/)
  assert.match(content, /essentials\.documents/)
  assert.doesNotMatch(content, /sf-essentials-hero|PublicBreadcrumb|<main/)
  assert.match(contentPage, /PageTemplate/)
  assert.match(template, /<Container variant="page" className=\{wrapperClass\}>/)
  assert.match(template, /<h1 className="sf-h1 sf-h1--page">\{page\.title\[lang\]\}<\/h1>/)
  assert.match(template, /page\.slug === '\/resources' && <ResourcesContent \/>/)
  assert.equal(existsSync(new URL('../app/resources/page.tsx', import.meta.url)), false)
})

test('Management Staff resolves as an ordinary CMS slug and keeps the staff directory content', () => {
  const content = read('components/pages/ManagementStaffContent.tsx')
  const template = read('components/pages/PageTemplate.tsx')
  const dynamicRoute = read('app/[...slug]/page.tsx')
  assert.match(dynamicRoute, /return <ContentPage slug=\{canonical\} \/>/)
  assert.match(content, /sf-block sf-staff-directory/)
  assert.match(content, /essentials\.staff/)
  assert.doesNotMatch(content, /sf-essentials-hero|PublicBreadcrumb|<main/)
  assert.match(template, /page\.slug === '\/management-staff' && <ManagementStaffContent \/>/)
  assert.equal(existsSync(new URL('../app/management-staff/page.tsx', import.meta.url)), false)
  assert.equal(existsSync(new URL('../app/bn/management-staff/page.tsx', import.meta.url)), false)
  assert.equal(existsSync(new URL('../app/bn/resources/page.tsx', import.meta.url)), false)
})

test('resource and staff cards use semantic surfaces and stretch consistently', () => {
  const css = read('app/site-polish.css')
  assert.match(css, /\.sf-staff-card,\.sf-resource-card[\s\S]*background: var\(--sf-essentials-surface\)/)
  assert.match(css, /\.sf-staff-grid[\s\S]*grid-auto-rows: 1fr[\s\S]*align-items: stretch/)
  assert.match(css, /\.sf-resource-grid[\s\S]*grid-auto-rows: 1fr[\s\S]*align-items: stretch/)
  assert.match(css, /\.sf-resource-content[\s\S]*margin-top: auto/)
})

test('notice and job circular cards share fixed columns, equal grid tracks and equal card dimensions', () => {
  const renderer = read('components/pages/SectionContent.tsx')
  const css = read('app/site-polish.css')
  assert.match(renderer, /feedColumns = fixedTwoColumnFeed \? 2/)
  assert.match(renderer, /feedTabletColumns = fixedTwoColumnFeed \? 2/)
  assert.match(renderer, /feedGap = fixedTwoColumnFeed \? '18px'/)
  assert.match(renderer, /feedLayoutClass = fixedTwoColumnFeed \? ''/)
  assert.match(css, /\.sf-content-feed--notice \.sf-feed-grid,[\s\S]*\.sf-content-feed--job \.sf-feed-grid \{[\s\S]*grid-auto-rows: minmax\(224px, 1fr\)/)
  assert.match(css, /\.sf-content-feed--notice \.sf-feed-grid-item,[\s\S]*\.sf-content-feed--job \.sf-feed-grid-item \{[\s\S]*height: 100%/)
  assert.match(css, /\.sf-content-feed--notice \.sf-feed-grid \.sf-feed-card--notice,[\s\S]*\.sf-content-feed--job \.sf-feed-grid \.sf-feed-card--job \{[\s\S]*min-height: 224px/)
  assert.match(css, /\.sf-content-feed--job \.sf-feed-grid \.sf-job-feed-card \{[\s\S]*height: 100%[\s\S]*min-height: 224px/)
})

test('active and root compatibility polish styles stay synchronized', () => {
  assert.equal(read('app/site-polish.css'), read('site-polish.css'))
})
