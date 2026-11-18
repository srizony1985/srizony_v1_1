import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const route = readFileSync(path.join(projectRoot, 'app/api/map-boundaries/route.ts'), 'utf8')

test('large Bangladesh ADM2 GeoJSON bypasses Next Data Cache', () => {
  assert.match(route, /getGeoJson\(DISTRICT_URL, \{ cache: 'no-store' \}\)/)
  assert.doesNotMatch(route, /export const revalidate\s*=/)
})

test('map boundaries API retains shared-cache headers', () => {
  assert.match(route, /Cache-Control':?\s*'public, s-maxage=86400, stale-while-revalidate=604800'/)
})
