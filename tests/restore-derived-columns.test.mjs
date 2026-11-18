import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSnapshotRowRequiredColumns, validateSnapshotRelationshipTransforms } from '../scripts/lib/restore-validation.mjs'

const column = (nullable = 'NO') => ({ is_nullable: nullable, is_identity: 'NO', is_generated: 'NEVER', column_default: null })

test('accepts hero_slides.image_id when it is derived from a media URL', () => {
  const metadata = new Map([['id', column()], ['image_id', column()], ['title_en', column()]])
  assert.doesNotThrow(() => assertSnapshotRowRequiredColumns('hero_slides', { id: 'slide-1', title_en: 'Title', _restore_image_src: 'https://example.test/image.jpg' }, 0, metadata))
})

test('still rejects a missing required non-derived column', () => {
  const metadata = new Map([['id', column()], ['title_en', column()]])
  assert.throws(() => assertSnapshotRowRequiredColumns('hero_slides', { id: 'slide-1' }, 0, metadata), /missing required column "title_en"/)
})

test('still rejects supplied undefined values', () => {
  const metadata = new Map([['id', column()]])
  assert.throws(() => assertSnapshotRowRequiredColumns('hero_slides', { id: undefined }, 0, metadata), /undefined value for "id"/)
})

test('requires every hero media URL to exist in media_items snapshot', () => {
  const valid = new Map([['media_items', { doc: { rows: [{ src: 'https://example.test/a.jpg' }] } }], ['hero_slides', { doc: { rows: [{ _restore_image_src: 'https://example.test/a.jpg' }] } }]])
  assert.doesNotThrow(() => validateSnapshotRelationshipTransforms(valid))
  const invalid = new Map([['media_items', { doc: { rows: [{ src: 'https://example.test/a.jpg' }] } }], ['hero_slides', { doc: { rows: [{ _restore_image_src: 'https://example.test/missing.jpg' }] } }]])
  assert.throws(() => validateSnapshotRelationshipTransforms(invalid), /not present in media_items.json/)
})
