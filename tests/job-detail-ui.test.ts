import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

test('project and job cards use only CMS-selected images and compact type-specific layouts', () => {
  const cards = read('components/pages/ContentFeedCard.tsx')
  const feed = read('lib/cms/content.ts')
  assert.match(cards, /item\.component === 'project'/)
  assert.match(cards, /item\.component === 'job'/)
  assert.match(cards, /item\.image && <figure className="media-image sf-feed-project-media"/)
  assert.match(cards, /item\.image \? <div className="sf-job-feed-media"/)
  assert.match(cards, /className="carousel-card sf-feed-card--project"/)
  assert.match(cards, /className="sf-feed-card--job"/)
  assert.match(cards, /className="sf-job-feed-card"/)
  assert.match(cards, /CardDescription className="sf-job-feed-summary"/)
  assert.match(cards, /Apply by/)
  assert.match(cards, /View position/)
  assert.doesNotMatch(cards, /fallbackCardImage|FolderKanban|curatedProjectArtwork/)
  assert.match(feed, /imageWasSelectedInCms/)
  assert.doesNotMatch(cards, /curatedProjectArtwork|fallbackCardImage/)
  assert.match(feed, /function isSeedCatalogueImage\(/)
  assert.match(feed, /contentDetails\.find/) // used only to recognize and suppress known seed artwork
  assert.match(feed, /contentDetails-v1/)
  assert.match(feed, /contentEntries\.find/)
  assert.match(feed, /const editableImage = row\.image_src && !knownSeedImage && \(imageManaged \|\| !seedSource\) \? String\(row\.image_src\) : ''/)
  assert.match(feed, /values\.image = editableImage/)
})

test('legacy or non-CMS detail imagery is stripped from routed detail pages', () => {
  const template = read('components/pages/PageTemplate.tsx')
  const content = read('lib/cms/content.ts')
  assert.match(template, /function withoutUnmanagedDetailImages/)
  assert.match(template, /isContentDetail && !canShowContentImage[\s\S]*visible\.map\(withoutUnmanagedDetailImages\)/)
  assert.match(template, /sf-banner--plain/)
  assert.match(content, /const cmsMediaManaged = Boolean\(imageSrc\) && !isSeedCatalogueImage\(row, attributes\) && \(imageManagedValue === 'true' \|\| !attributes\.seedSource\)/)
})

test('bundled seed artwork is not promoted into CMS cards unless an editor saves a CMS image', () => {
  const content = read('lib/cms/content.ts')
  const editor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  assert.match(content, /const imageManaged = String\(attrs\.imageManaged \|\| ''\)\.toLowerCase\(\) === 'true'/)
  assert.match(content, /const editableImage = row\.image_src && !knownSeedImage && \(imageManaged \|\| !seedSource\) \? String\(row\.image_src\) : ''/)
  assert.match(content, /const imageWasSelectedInCms = Boolean\(v\.image\) && \(String\(v\.imageManaged \|\| ''\)\.toLowerCase\(\) === 'true' \|\| !v\.seedSource\)/)
  assert.match(editor, /<MediaField label=\{`\$\{field\.label\}\$\{field\.required \? ' \*' : ''\}`\} value=\{values\[field\.key\] \?\? ''\} onChange=\{\(v\) => set\(field\.key, v\)\}/)
  assert.doesNotMatch(content, /curatedProjectArtwork/)
  assert.match(content, /contentDetails\.find/) // known seed URLs are explicitly excluded
})

test('job details use a themed posting first and reveal the application form only after Apply', () => {
  const template = read('components/pages/PageTemplate.tsx')
  const job = read('components/pages/JobPostingDetail.tsx')
  const css = read('app/site-polish.css')
  assert.match(template, /page\.contentComponent === 'job' && page\.contentSlug[\s\S]*JobPostingDetail/)
  assert.match(job, /useState\(false\)/)
  assert.match(job, /aria-expanded=\{applicationOpen\}/)
  assert.match(job, /applicationOpen && <div[\s\S]*JobApplicationForm/)
  assert.match(job, /Apply now/)
  assert.match(job, /scrollIntoView\(\{ behavior: 'smooth'/)
  assert.match(css, /\.sf-job-posting \{ display: grid;/)
  assert.match(css, /\.sf-job-overview \{[^}]*var\(--sf-card\)/)
  assert.match(css, /\.sf-job-fact \{[^}]*var\(--sf-soft\)/)
  assert.match(css, /\.sf-job-apply-callout \{[^}]*var\(--sf-border\)/)
})

test('card metadata is compact, horizontal and content-sized', () => {
  const css = read('app/site-polish.css')
  assert.match(css, /\.sf-feed-grid \.sf-feed-card-tags \{ display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start;/)
  assert.match(css, /\.sf-feed-grid \.notice-card \{ display: grid; grid-template-columns: max-content minmax\(0, 1fr\) auto;/)
  assert.match(css, /grid-auto-rows: auto; align-items: start;/)
})

test('CMS image fields upload and persist editor-selected media URLs', () => {
  const editor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  const media = read('app/admin/dashboard/_components/MediaField.tsx')
  const api = read('app/api/admin/media/upload/route.ts')
  assert.match(editor, /<MediaField label=\{`\$\{field\.label\}\$\{field\.required \? ' \*' : ''\}`\} value=\{values\[field\.key\] \?\? ''\} onChange=\{\(v\) => set\(field\.key, v\)\}/)
  assert.match(media, /form\.append\('kind', kind\)/)
  assert.match(media, /fetch\('\/api\/admin\/media\/upload'/)
  assert.match(media, /onChange\(String\(data\.src\)\)/)
  assert.match(api, /public-assets|isPublic/)
})


test('job and notice feed grids use two columns above medium and one column below', () => {
  const renderer = read('components/pages/SectionContent.tsx')
  const polish = read('app/site-polish.css')
  const editor = read('app/admin/dashboard/page-builder/page.tsx')
  assert.match(renderer, /fixedTwoColumnFeed = feedComponent === 'notice' \|\| feedComponent === 'job'/)
  assert.match(renderer, /desktopColumns = fixedTwoColumnFeed \? 2/)
  assert.match(renderer, /tabletColumns = fixedTwoColumnFeed \? 2/)
  assert.match(polish, /@media \(max-width: 767px\)[\s\S]*\.sf-content-feed--notice \.sf-feed-grid,[\s\S]*\.sf-content-feed--job \.sf-feed-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/)
  assert.match(editor, /Notice and job feeds use two columns on medium and larger screens, and one column on smaller screens/)
})
