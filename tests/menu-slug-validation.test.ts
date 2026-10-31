import test from 'node:test'
import assert from 'node:assert/strict'
import { inspectTopLevelMenuSlug } from '../lib/cms/routes'

test('a valid single-segment top-level menu slug is accepted', () => {
  assert.deepEqual(inspectTopLevelMenuSlug('/about-us'), { valid: true, path: '/about-us' })
  assert.deepEqual(inspectTopLevelMenuSlug('community-program'), { valid: true, path: '/community-program' })
})

test('a genuinely nested path is rejected as a submenu path', () => {
  assert.deepEqual(inspectTopLevelMenuSlug('/about-us/our-team'), { valid: false, reason: 'nested', input: '/about-us/our-team' })
})

test('News and Success Stories are valid root pages while unrelated legacy aliases stay reserved', () => {
  assert.deepEqual(inspectTopLevelMenuSlug('/news'), { valid: true, path: '/news' })
  assert.deepEqual(inspectTopLevelMenuSlug('/success-stories'), { valid: true, path: '/success-stories' })
  assert.deepEqual(inspectTopLevelMenuSlug('/partners'), { valid: false, reason: 'reserved-alias', input: '/partners', canonical: '/about-us/partners-networks' })
  assert.deepEqual(inspectTopLevelMenuSlug('/home'), { valid: false, reason: 'reserved-alias', input: '/home', canonical: '/' })
})
