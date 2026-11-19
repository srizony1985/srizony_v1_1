import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('adding landing sections creates starter content and bilingual section headings', () => {
  const builder = read('app/admin/dashboard/page-builder/page.tsx')
  for (const token of [
    'GROWTH_INTRO.eyebrow', 'COUNTERS.map',
    'STORY_INTRO.eyebrow', 'STORY.map',
    'FOOTPRINT_INTRO.eyebrow',
    'AREAS_INTRO.eyebrow', 'AREAS.map',
  ]) assert.ok(builder.includes(token), `Missing starter content binding: ${token}`)
})

test('empty non-manual starter sections use canonical homepage copy; manual empty arrays remain empty', () => {
  const growth = read('components/home/GrowthSection.tsx')
  const mvv = read('components/home/MissionVisionValues.tsx')
  const areas = read('components/home/DevelopmentAreas.tsx')
  const locations = read('components/home/LocationMaps.tsx')
  for (const source of [growth, mvv, areas]) {
    assert.match(source, /\.length \|\| .*dataSource === 'manual'/)
  }
  assert.match(growth, /GROWTH_INTRO\.title/)
  assert.match(mvv, /STORY_INTRO\.title/)
  assert.match(areas, /AREAS_INTRO\.title/)
  assert.match(locations, /FOOTPRINT_INTRO\.title/)
  assert.match(locations, /footprintCopy\?\.visible === false/)
})


test('development fallback mode warns when it would bypass saved CMS sections', () => {
  const site = read('lib/site.ts')
  assert.match(site, /NODE_ENV === 'development' && process\.env\.CMS_STATIC_FALLBACK === 'true'/)
  assert.match(site, /Public pages will use bundled content instead of saved database page sections/)
})
