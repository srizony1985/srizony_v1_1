import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('language switching updates the preference without navigating to another route', () => {
  const provider = read('components/containers/SiteProvider.tsx')
  const languageSetter = provider.slice(provider.indexOf('const setLanguage ='), provider.indexOf('/**\n   * Theme setters.'))

  assert.match(languageSetter, /setLang\(value\)/)
  assert.match(languageSetter, /localStorage\.setItem\('sf-lang', value\)/)
  assert.match(languageSetter, /sf-lang=\$\{value\}/)
  assert.doesNotMatch(languageSetter, /router\.push|router\.replace|window\.location/)
})

test('a saved language preference takes precedence over the optional Bangla route alias', () => {
  const layout = read('app/layout.tsx')
  assert.match(layout, /const isBanglaRoute = pathname === '\/bn' \|\| pathname\.startsWith\('\/bn\/'\)/)
  assert.match(layout, /const savedLang = cookieStore\.get\('sf-lang'\)\?\.value/)
  assert.match(layout, /savedLang === 'bn' \|\| savedLang === 'en'/)
  assert.match(layout, /: isBanglaRoute \? 'bn' : 'en'/)
})
