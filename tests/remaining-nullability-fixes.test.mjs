import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('database import totals reduce into a definite number', () => {
  const settings = read('app/admin/dashboard/settings/SettingsClient.tsx')
  assert.match(settings, /Object\.values\(result\.imported \?\? \{\}\)\.reduce<number>\(\(sum, count\) => sum \+ Number\(count \?\? 0\), 0\)/)
  assert.match(settings, /toast\.success\(`Imported \$\{importedTotal\.toLocaleString\(\)\} records\.`\)/)
})

test('homepage feed callbacks use the page captured after the null guard', () => {
  const site = read('lib/site.ts')
  assert.match(site, /if \(!useStaticFallback && page && \(needsFieldNews \|\| pageUsesSuccessStoriesGallery\)\)\s*\{\s*\/\/ Capture the narrowed page[\s\S]*?const currentPage = page/)
  assert.match(site, /const sectionItemLimits =[\s\S]*?currentPage\.sections\.flatMap/)
  assert.match(site, /\.\.\.currentPage,[\s\S]*?sections: currentPage\.sections\.map/)
  assert.doesNotMatch(site, /const sectionItemLimits =[\s\S]*?=> page\.sections\.flatMap/)
})
