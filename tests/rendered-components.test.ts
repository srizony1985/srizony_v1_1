import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRenderedComponents, RENDERED_COMPONENT_TYPES } from '../lib/cms/rendered-components'

test('normalizes supported component arrays and removes duplicates', () => {
  assert.deepEqual(parseRenderedComponents(['cards', 'gallery', 'cards']), ['cards', 'gallery'])
})

test('parses JSON-encoded arrays and comma-delimited legacy values', () => {
  assert.deepEqual(parseRenderedComponents('["cards","gallery"]'), ['cards', 'gallery'])
  assert.deepEqual(parseRenderedComponents('cards | gallery'), ['cards', 'gallery'])
})

test('supports legacy object wrappers and boolean component maps', () => {
  assert.deepEqual(parseRenderedComponents({ components: ['cards', 'gallery'] }), ['cards', 'gallery'])
  assert.deepEqual(parseRenderedComponents({ rendered_components: '["stats","reports"]' }), ['stats', 'reports'])
  assert.deepEqual(parseRenderedComponents({ cards: true, gallery: false, stats: true }), ['cards', 'stats'])
  assert.deepEqual(parseRenderedComponents([{ type: 'cards' }, { component: 'video' }]), ['cards', 'video'])
})

test('malformed, null, and legacy collection values safely default to all supported types', () => {
  assert.deepEqual(parseRenderedComponents({ legacyCollection: 'project' }), RENDERED_COMPONENT_TYPES)
  assert.deepEqual(parseRenderedComponents('project/product/team'), RENDERED_COMPONENT_TYPES)
  assert.deepEqual(parseRenderedComponents('{invalid-json'), RENDERED_COMPONENT_TYPES)
  assert.deepEqual(parseRenderedComponents(null), RENDERED_COMPONENT_TYPES)
  assert.deepEqual(parseRenderedComponents({ components: 42 }), RENDERED_COMPONENT_TYPES)
})
