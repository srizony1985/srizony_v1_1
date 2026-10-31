import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentRoute, canonicalizeCmsRoute, getContentRouteParent, isNavigationPagePath } from '../lib/cms/routes'
import { CONTENT_COLLECTION_ROUTES } from '../lib/cms/components'

test('root-level News and Success Story detail routes remain canonical', () => {
  assert.equal(canonicalizeCmsRoute('/news/community-health-update'), '/news/community-health-update')
  assert.equal(canonicalizeCmsRoute('/success-stories/women-led-enterprise'), '/success-stories/women-led-enterprise')
  assert.equal(getContentRouteParent('/news/community-health-update'), '/news')
  assert.equal(getContentRouteParent('/success-stories/women-led-enterprise'), '/success-stories')
  assert.equal(buildContentRoute('/news', 'community-health-update'), '/news/community-health-update')
  assert.equal(buildContentRoute('/success-stories', 'women-led-enterprise'), '/success-stories/women-led-enterprise')
})

test('previous nested detail URLs canonicalize to the new root-level paths', () => {
  assert.equal(canonicalizeCmsRoute('/what-we-do/news/community-health-update'), '/news/community-health-update')
  assert.equal(canonicalizeCmsRoute('/what-we-do/success-stories/women-led-enterprise'), '/success-stories/women-led-enterprise')
  assert.equal(canonicalizeCmsRoute('/success-story/women-led-enterprise'), '/success-stories/women-led-enterprise')
})

test('News and Success Stories have only root-level collection pages', () => {
  assert.equal(canonicalizeCmsRoute('/news'), '/news')
  assert.equal(canonicalizeCmsRoute('/success-stories'), '/success-stories')
  assert.equal(canonicalizeCmsRoute('/what-we-do/news'), '/news')
  assert.equal(canonicalizeCmsRoute('/what-we-do/success-stories'), '/success-stories')
  assert.equal(canonicalizeCmsRoute('/category/news'), '/news')
  assert.equal(canonicalizeCmsRoute('/success-story'), '/success-stories')
})


test('root News and Success Stories are the only registered collection pages', () => {
  const routes = CONTENT_COLLECTION_ROUTES.filter((route) => ['news', 'success-story'].includes(route.component))
  assert.deepEqual(routes.map((route) => [route.component, route.slug]), [
    ['news', '/news'],
    ['success-story', '/success-stories'],
  ])
  assert.equal(isNavigationPagePath('/news', {}), true)
  assert.equal(isNavigationPagePath('/success-stories', {}), true)
  assert.equal(isNavigationPagePath('/what-we-do/news', {}), true) // redirect resolves to the canonical /news page
})
