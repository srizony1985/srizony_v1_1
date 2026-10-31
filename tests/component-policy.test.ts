import test from 'node:test'
import assert from 'node:assert/strict'
import { isLandingComponentKey, validatePageComponentLayers } from '../lib/cms/component-policy'

const section = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra })

test('landing routes accept only registered landing compositions', () => {
  assert.equal(validatePageComponentLayers('/', [section('stats', { homeComponent: 'growth' })]), null)
  assert.match(String(validatePageComponentLayers('/', [section('richText')])), /registered landing component/)
  assert.match(String(validatePageComponentLayers('/', [section('cards', { homeComponent: 'growth' })])), /requires the “stats” section type/)
})

test('normal slug pages accept sectional components and reusable landing compositions', () => {
  assert.equal(validatePageComponentLayers('/about-us', [section('richText'), section('cards', { homeComponent: 'missionVisionValues' })]), null)
  assert.match(String(validatePageComponentLayers('/about-us', [section('cards', { homeComponent: 'not-real' })])), /unknown landing component/)
  assert.match(String(validatePageComponentLayers('/about-us', [section('unknown')])), /unsupported page component/)
})

test('landing component keys are explicit and finite', () => {
  assert.equal(isLandingComponentKey('hero'), true)
  assert.equal(isLandingComponentKey('news'), true)
  assert.equal(isLandingComponentKey('successStories'), true)
  assert.equal(isLandingComponentKey('stories'), true)
  assert.equal(isLandingComponentKey('richText'), false)
  assert.equal(isLandingComponentKey(null), false)
})
