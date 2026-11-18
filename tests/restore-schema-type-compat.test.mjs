import test from 'node:test'
import assert from 'node:assert/strict'
import { compareSnapshotColumnType } from '../scripts/lib/schema-type-compat.mjs'

test('accepts exact varchar type and length', () => {
  assert.deepEqual(
    compareSnapshotColumnType('character varying(120)', 'character varying', 120),
    { compatible: true, kind: 'exact', declaredBaseType: 'character varying', declaredLength: 120 },
  )
})

test('accepts safe varchar(n) snapshot to text database widening', () => {
  assert.deepEqual(
    compareSnapshotColumnType('character varying(120)', 'text', null),
    { compatible: true, kind: 'safe-widening', declaredBaseType: 'character varying', declaredLength: 120 },
  )
})

test('rejects text snapshot to varchar database narrowing', () => {
  assert.equal(compareSnapshotColumnType('text', 'character varying', 120).compatible, false)
})

test('rejects varchar length mismatch', () => {
  assert.equal(compareSnapshotColumnType('character varying(120)', 'character varying', 100).compatible, false)
})

test('rejects unrelated type mismatch', () => {
  assert.equal(compareSnapshotColumnType('jsonb', 'text', null).compatible, false)
})
