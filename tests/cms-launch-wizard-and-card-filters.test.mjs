import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')

test('public card search and filters use theme-aware light and dark surface tokens', () => {
  const css = read('app/globals.css')
  assert.match(css, /\.sf-public-feed-toolbar[\s\S]*?background: color-mix\(in srgb, var\(--sf-card\)/)
  assert.match(css, /\.sf-public-feed-search, \.sf-public-feed-select[\s\S]*?background: var\(--sf-raised/)
  assert.match(css, /\.sf-public-feed-search input, \.sf-public-feed-select select[\s\S]*?color: var\(--sf-ink\)/)
  assert.match(css, /html\[data-mode='light'\] \.sf-public-feed-toolbar \{ color-scheme: light; \}/)
  assert.match(css, /html\[data-mode='dark'\] \.sf-public-feed-toolbar \{ color-scheme: dark; \}/)
})

test('legacy getting-started overlay is removed from the shadcn dashboard shell', () => {
  const header = read('components/admin/cms/AdminWorkspaceHeader.tsx')
  const shell = read('app/admin/dashboard/_components/Shell.tsx')
  assert.doesNotMatch(header, /sf:open-cms-welcome|cms-welcome-launch/)
  assert.doesNotMatch(shell, /CmsWelcomeWizard|sf:open-cms-welcome/)
})
