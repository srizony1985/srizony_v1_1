import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8')

test('shared illustration registry covers mission, vision, values and reusable card artwork', () => {
  const illustration = read('components/home/Illustration.tsx')
  const wrapper = read('components/home/CmsCardIllustration.tsx')
  assert.match(illustration, /name: IllustrationName/)
  for (const name of ['mission', 'vision', 'values', 'heart', 'book', 'users', 'coins', 'sprout', 'store', 'women-business', 'small-enterprise', 'agriculture', 'migrant-household', 'rural-development', 'career', 'education']) {
    assert.ok(illustration.includes(`'${name}'`), `missing illustration: ${name}`)
  }
  assert.match(wrapper, /imageSrc/)
  assert.match(wrapper, /<Illustration name={name}/)
})

test('Mission Vision Values always has distinct semantic art and supports CMS image overrides', () => {
  const mvv = read('components/home/MissionVisionValues.tsx')
  const site = read('lib/site.ts')
  assert.match(mvv, /i === 0 \? 'mission' : i === 1 \? 'vision' : 'values'/)
  assert.match(mvv, /image: item\.image\?\.src/)
  assert.match(mvv, /<CmsCardIllustration name=/)
  assert.match(site, /illustration: 'mission'/)
  assert.match(site, /illustration: 'vision'/)
  assert.match(site, /mergeMvvArtwork/)
  assert.match(site, /illustration: saved\?\.illustration \|\| item\.illustration/)
  assert.match(site, /image: saved\?\.image\?\.src \? saved\.image : item\.image/)
})

test('Page Builder exposes reusable illustrations and custom artwork for each card/stat item', () => {
  const editor = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(editor, /Reusable illustration/)
  assert.match(editor, /Custom illustration image/)
  assert.match(editor, /Optional reusable illustration/)
  assert.match(editor, /cms-illustration-editor-preview/)
  assert.match(editor, /fields\.filter\(\(field\) => !\['href', 'icon'\]\.includes\(field\.key\)\)/)
  assert.doesNotMatch(editor, /fields\.filter\(\(field\) => field\.key !== 'illustration'\)/)
})

test('the shared illustration renderer is reused by landing cards, ordinary cards and statistics', () => {
  const projectCard = read('components/home/ProjectCard.tsx')
  const pageCards = read('components/pages/SectionContent.tsx')
  const stats = read('components/ui/Stats.tsx')
  const growth = read('components/home/GrowthSection.tsx')
  assert.match(projectCard, /<CmsCardIllustration/)
  assert.match(pageCards, /<CmsCardIllustration/)
  assert.match(stats, /<CmsCardIllustration/)
  assert.match(growth, /illustration: item\.illustration, image: item\.image/)
})

test('fallback homepage seeds unique Mission, Vision and Values illustration identities', () => {
  const fallback = read('data/data.ts')
  assert.match(fallback, /icon:'heart',illustration:'mission'/)
  assert.match(fallback, /icon:'users',illustration:'vision'/)
  assert.match(fallback, /icon:'shield',illustration:'values'/)
})
