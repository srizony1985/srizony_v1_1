import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const css = read('app/globals.css')

test('public document scrolling is not globally locked', () => {
  assert.match(css, /html\s*\{\s*min-height:\s*100%/)
  assert.match(css, /body\s*\{\s*margin:\s*0;\s*min-height:\s*100%/)
  assert.match(read('components/admin/cms/AdminAppShell.tsx'), /h-dvh min-h-dvh w-full min-w-0 overflow-hidden/)
  assert.doesNotMatch(css, /html\s*\{[^}]*overflow:\s*hidden/s)
  assert.doesNotMatch(css, /body\s*\{[^}]*overflow:\s*hidden/s)
})

test('Leaflet district colors are available from the root theme tokens', () => {
  for (let i = 1; i <= 8; i += 1) assert.match(css, new RegExp(`--sf-fp-district-${i}:`))
  assert.match(css, /html\[data-mode="dark"\]\s*\{[^}]*--sf-fp-district-1:/s)
  assert.match(read('components/home/LocationMaps.tsx'), /getComputedStyle\(document\.documentElement\)/)
})

test('logo loader JSX class and global stylesheet selectors match', () => {
  assert.match(read('components/ui/LogoLoader.tsx'), /"sf-loader"/)
  assert.match(css, /\.sf-loader\s*\{[^}]*place-items:\s*center/s)
  assert.match(css, /\.sf-loader-fullscreen\s*\{[^}]*inset:\s*0[^}]*min-height:\s*100dvh/s)
  assert.doesNotMatch(css, /\.sf-loader-loader/)
})

test('nested navigation focus only expands the directly focused item', () => {
  const tree = read('components/ui/NavMenuTree.tsx')
  const navbar = read('components/ui/NavBar.tsx')
  assert.match(tree, /target\.parentElement === event\.currentTarget/)
  assert.match(navbar, /classList\.contains\('sf-nav-group-trigger'\)/)
  assert.doesNotMatch(css, /\.sf-dd--group:focus-within\s*>\s*\.sf-dd-panel/)
  assert.doesNotMatch(css, /\.sf-menu li:focus-within\s*>\s*\.sf-menu--sub/)
})

test('career actions use public theme button tokens', () => {
  assert.match(read('components/pages/ContentFeedCard.tsx'), /sf-feed-card-cta sf-feed-card-cta--button sf-job-feed-action/)
  assert.match(css, /\.sf-feed-grid \.sf-feed-card-cta\s*\{[^}]*background:\s*var\(--sf-primary\)[^}]*color:\s*var\(--sf-on-primary\)/s)
  assert.match(read('components/pages/JobPostingDetail.tsx'), /sf-btn sf-btn--primary sf-job-overview-apply/)
})

test('donation controls retain explicit light-mode contrast', () => {
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-donation-step-num/)
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-donation-chip-on/)
  assert.match(css, /html\[data-mode="light"\] \.sf-main \.sf-donation-submit/)
})

test('CMS section headings pass through the emoji-stripping display helper', () => {
  assert.match(read('lib/sectionTitle.ts'), /Extended_Pictographic/)
  assert.match(read('components/ui/SectionHeading.tsx'), /plainSectionTitle/)
  assert.match(read('components/pages/DiagramHeading.tsx'), /plainSectionTitle/)
  assert.match(read('components/pages/PageTemplate.tsx'), /plainSectionTitle\(page\.title\[lang\]\)/)
})
