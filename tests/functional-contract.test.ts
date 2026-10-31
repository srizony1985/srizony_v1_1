import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildContentRoute, getContentRouteParent, normalizeCmsRoutePath } from '../lib/cms/routes'

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8')

test('public job detail page includes an application form for CMS job items', () => {
  assert.ok(existsSync(resolve(process.cwd(), 'components/pages/JobApplicationForm.tsx')))
  assert.match(read('components/pages/PageTemplate.tsx'), /page\.contentComponent === 'job'[\s\S]*JobPostingDetail/)
  assert.match(read('components/pages/JobPostingDetail.tsx'), /applicationOpen &&[\s\S]*JobApplicationForm/)
  assert.match(read('lib/cms/content.ts'), /contentComponent: row\.component/)
})

test('job applications are scoped to the canonical parent route as well as the slug', () => {
  const template = read('components/pages/PageTemplate.tsx')
  const form = read('components/pages/JobApplicationForm.tsx')
  const api = read('app/api/jobs/apply/route.ts')
  const service = read('lib/cms/jobs.ts')
  assert.match(read('components/pages/JobPostingDetail.tsx'), /getContentRouteParent\(canonicalPath\)/)
  assert.match(form, /applyForJob\(\{ jobSlug, jobRouteParent,/)
  assert.match(api, /jobRouteParent: z\.string\(\)/)
  assert.match(service, /COALESCE\(NULLIF\(attributes->>'routeParent', ''\), '\/carrer-job'\) = \$\{input\.jobRouteParent\}/)
})

test('application UI uploads a resume and submits the returned one-time token', () => {
  const form = read('components/pages/JobApplicationForm.tsx')
  assert.match(form, /type="file" accept="application\/pdf,\.pdf" required/)
  assert.match(form, /uploadJobResume\(file, honeypot\)/)
  assert.match(form, /token = upload\.data\.resumeToken/)
  assert.match(form, /Submit application/)
})

test('resume upload stays private and has rate limiting, validation and expiry-token support', () => {
  const route = read('app/api/jobs/resume/route.ts')
  assert.match(route, /isPublic: false/)
  assert.match(route, /kind: 'document'/)
  assert.match(route, /hasPdfSignature/)
  assert.match(route, /enforcePublicJobRateLimit\('resume-upload'/)
  assert.match(route, /job_resume_uploads/)
  assert.match(read('lib/cms/jobs.ts'), /consumed_at IS NULL AND expires_at > now\(\)/)
})

test('application API enforces origin, required resume token, anti-spam and rate limits', () => {
  const route = read('app/api/jobs/apply/route.ts')
  assert.match(route, /sameOrigin\(req\)/)
  assert.match(route, /resumeToken: z\.string\(\)\.min\(40\)/)
  assert.match(route, /enforcePublicJobRateLimit\('apply'/)
  assert.match(route, /validateJobApplicationFields/)
  assert.match(route, /SF-JOB-/)
})

test('admin applications can see and open the authenticated resume endpoint', () => {
  const admin = read('app/admin/dashboard/jobs/page.tsx')
  assert.match(admin, /a\.resumeUrl \? <a href=\{a\.resumeUrl\}/)
  assert.match(read('app/api/media/[id]/route.ts'), /Authentication required to access this media/)
})

test('new migration defines private one-time resume tokens and public-form rate limits', () => {
  const migration = read('drizzle/0011_job_application_resume_uploads.sql')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS job_resume_uploads/)
  assert.match(migration, /expires_at TIMESTAMPTZ NOT NULL/)
  assert.match(migration, /consumed_at TIMESTAMPTZ/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS job_public_rate_limits/)
})

test('preview seed is opt-in, explicitly non-production, and contains demo-only content', () => {
  const seed = read('scripts/seed-demo-preview.ts')
  assert.match(seed, /process\.env\.NODE_ENV === 'production'/)
  assert.match(seed, /ALLOW_DEMO_PREVIEW_SEED !== 'YES_DEMO_ONLY'/)
  assert.match(seed, /NOT A REAL VACANCY/)
  assert.match(seed, /Demo Applicant \(Preview Only\)/)
  assert.match(seed, /url: ''/)
})

test('website essentials has blank PDF states and editable staff and location records', () => {
  const admin = read('app/admin/dashboard/website-essentials/page.tsx')
  const api = read('app/api/website-essentials/route.ts')
  assert.match(admin, /Upload public PDF/)
  assert.match(admin, /Add staff/)
  assert.match(admin, /Add location/)
  assert.match(admin, /Preview PDF/)
  assert.match(api, /requireAdmin\('admin', 'editor'\)/)
})

test('functional test commands and migrations are registered', () => {
  const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
  assert.equal(packageJson.scripts['test:functional'], 'tsx --test tests/*.test.ts && node --test tests/*.test.mjs')
  assert.equal(packageJson.scripts['db:seed:demo'], 'tsx scripts/seed-demo-preview.ts')
  const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ tag: string }> }
  assert.ok(journal.entries.some((entry) => entry.tag === '0011_job_application_resume_uploads'))
})

test('location map loads CMS locations and retains responsive, colorful markers', () => {
  const map = read('components/home/LocationMaps.tsx')
  const css = read('app/site-components.css')
  assert.match(map, /fetch\('\/api\/website-essentials'/)
  assert.match(map, /configuredLocations/)
  assert.match(map, /setConfiguredLocations/)
  assert.match(css, /\.sf-fp-pin\.is-head \.sf-fp-dot-core[^}]*background:\s*var\(--sf-accent\)/)
  assert.match(css, /@media \(max-width: 700px\)/)
})

test('main navigation canonicalizes Career / Jobs and binds live published jobs to its page', () => {
  const site = read('lib/site.ts')
  const routes = read('lib/cms/routes.ts')
  const migration = read('drizzle/0010_carrer_job_canonical_route.sql')
  assert.match(routes, /'\/job-circular': '\/carrer-job'/)
  assert.match(site, /canonicalSlug === '\/carrer-job'/)
  assert.match(site, /getPublishedFeed\(\['job'\], 100, '\/carrer-job'\)/)
  assert.match(site, /href: `\/carrer-job\/\$\{entry\.slug\}`/)
  assert.match(migration, /'Career \/ Jobs'/)
  assert.match(migration, /'\/carrer-job'/)
})

test('CMS content routes are scoped to a selected parent and the landing page can receive content', () => {
  const service = read('lib/cms/content.ts')
  const editor = read('app/admin/dashboard/_components/ContentEditor.tsx')
  const routeApi = read('app/api/admin/site-content/route.ts')
  assert.match(service, /routeParent === '\/'[\s\S]*contentData\.allPages\['\/'\]/)
  assert.match(service, /function assertPublicRouteAvailable/)
  assert.match(service, /cms_content_items_route_slug_uq|routeParent/)
  assert.match(editor, /Publish under page/)
  assert.match(editor, /Public route preview/)
  assert.match(routeApi, /p\.get\('routeParent'\)/)
})

test('detail resolver supports the required single, menu, and submenu content depths', () => {
  const service = read('lib/cms/content.ts')
  const site = read('lib/site.ts')
  assert.match(service, /segments\.length >= 1 && segments\.length <= 3/)
  assert.match(service, /getContentRouteParent\(normalized\)/)
  assert.match(service, /COALESCE\(NULLIF\(attributes->>'routeParent'/)
  const routes = read('lib/cms/routes.ts')
  assert.match(routes, /export function getContentRouteParent\(path: string\)/)
  assert.match(routes, /segments\.length <= 1 \? LANDING_ROUTE/)
  assert.match(service, /const parentPath = getContentRouteParent\(normalized\)/)
  assert.match(site, /getPublishedContentDetailPage\(canonicalSlug\)/)
})

test('new migration creates collection pages independent of navigation and makes Career / Jobs a primary item', () => {
  const migration = read('drizzle/0012_cms_content_routing_and_collections.sql')
  const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ tag: string }> }
  assert.match(migration, /INSERT INTO pages/)
  assert.match(migration, /WHERE slug = '\/carrer-job'/)
  assert.match(migration, /cms_content_items_route_slug_uq/)
  assert.match(migration, /collision_count > 1/)
  assert.match(migration, /INSERT INTO nav_items/)
  assert.ok(journal.entries.some((entry) => entry.tag === '0012_cms_content_routing_and_collections'))
})

test("the CMS content list displays each item's concrete route and the seed sets route parents", () => {
  const list = read('app/admin/dashboard/site-content/page.tsx')
  const seed = read('seed-structural.ts')
  const demo = read('scripts/seed-demo-preview.ts')
  assert.match(list, /cms-list-route/)
  assert.match(list, /DEFAULT_CONTENT_PARENT\[r\.component\]/)
  assert.match(seed, /DEFAULT_CONTENT_PARENT\[component as keyof typeof DEFAULT_CONTENT_PARENT\]/)
  assert.match(demo, /routeParent: '\/carrer-job'/)
})

test('navigation endpoints and service support authenticated CRUD and reorder; creating a page saves a sectioned page', () => {
  const route = read('app/api/admin/navigation/route.ts')
  const service = read('lib/cms/navigation.ts')
  assert.match(route, /export async function POST/)
  assert.match(route, /export async function PUT/)
  assert.match(route, /export async function PATCH/)
  assert.match(route, /export async function DELETE/)
  assert.match(route, /requireAdmin\('admin', 'editor'\)/)
  assert.match(service, /export async function createMenu/)
  assert.match(service, /saveDocument\(`page:\$\{slug\}`/)
  assert.match(service, /defaultSection\(/)
  assert.match(service, /export async function saveNavigationOrder/)
  assert.match(service, /MAX_DEPTH = 2/)
})

test('public PDF uploads require an authorized editor and verify the PDF signature', () => {
  const route = read('app/api/admin/media/upload/route.ts')
  assert.match(route, /if \(!admin\)/)
  assert.match(route, /hasAdminRole\(admin, 'admin', 'editor'\)/)
  assert.match(route, /visibility === 'public'/)
  assert.match(route, /ascii\(0, 5\) === '%PDF-'/)
  assert.match(route, /MAX_DOCUMENT_BYTES = 4 \* 1024 \* 1024/)
})

test('social links are displayed in the top navigation and editable in Website Essentials', () => {
  const nav = read('components/ui/NavBar.tsx')
  const admin = read('app/admin/dashboard/website-essentials/page.tsx')
  assert.match(nav, /sf-social-topbar/)
  assert.match(nav, /fetch\('\/api\/website-essentials'/)
  assert.match(admin, /facebook/)
  assert.match(admin, /instagram/)
  assert.match(admin, /youtube/)
  assert.match(admin, /linkedin/)
})

test('management staff is a normal slug rendered by the shared template with safe empty states', () => {
  const page = read('components/pages/ManagementStaffContent.tsx')
  const template = read('components/pages/PageTemplate.tsx')
  const route = read('app/[...slug]/page.tsx')
  const admin = read('app/admin/dashboard/website-essentials/page.tsx')
  assert.match(route, /ContentPage slug=\{canonical\}/)
  assert.match(template, /page\.slug === '\/management-staff' && <ManagementStaffContent \/>/)
  assert.match(page, /Management staff information will be published soon/)
  assert.match(page, /person\.published/)
  assert.match(admin, /Add staff/)
  assert.match(admin, /Unpublish/)
  assert.match(admin, /Remove/)
  assert.equal(existsSync(resolve(process.cwd(), 'app/management-staff/page.tsx')), false)
})

test('maintenance endpoint checks its secret and database status requires an administrator', () => {
  const cron = read('app/api/cron/maintenance/route.ts')
  const database = read('app/api/admin/database/route.ts')
  assert.match(cron, /CRON_SECRET/)
  assert.match(cron, /status: 401/)
  assert.match(database, /getAdminSession\(\)/)
  assert.match(database, /hasAdminRole\(admin, 'admin'\)/)
  assert.match(database, /job_resume_uploads/)
  assert.match(database, /job_public_rate_limits/)
})

test('canonical route helper builds landing, menu and submenu detail URLs', () => {
  const helper = read('lib/cms/routes.ts')
  assert.match(helper, /export function buildContentRoute/)
  assert.match(helper, /export function getContentRouteParent/)
  assert.match(helper, /segments\.slice\(0, -1\)/)
  assert.equal(buildContentRoute('/', 'our-projects'), '/our-projects')
  assert.equal(buildContentRoute('/about-us', 'our-team'), '/about-us/our-team')
  assert.equal(buildContentRoute('/about-us/our-team', 'field-staff'), '/about-us/our-team/field-staff')
  assert.equal(getContentRouteParent('/about-us/our-team/field-staff'), '/about-us/our-team')
  assert.equal(getContentRouteParent('/our-projects'), '/')
  assert.equal(normalizeCmsRoutePath('/about-us/our-team/'), '/about-us/our-team')
  assert.throws(() => normalizeCmsRoutePath('/About Us'))
  assert.match(read('lib/cms/ddl.ts'), /cms_content_items_route_slug_uq/)
  assert.doesNotMatch(read('lib/cms/ddl.ts'), /CREATE UNIQUE INDEX IF NOT EXISTS cms_content_items_component_slug_uq/)
  assert.match(read('lib/cms/ddl.ts'), /DROP INDEX IF EXISTS cms_content_items_component_slug_uq/)
})

test('content destination page depth is capped at landing, main-menu, and submenu routes', () => {
  const service = read('lib/cms/content.ts')
  const navigation = read('lib/cms/navigation.ts')
  assert.match(service, /routeParent\.split\('\/'\)\.filter\(Boolean\)\.length > 2/)
  assert.match(navigation, /A published or draft content item already owns/)
  assert.match(navigation, /allowedExistingPageSlug/)
})


test('updated pages have safe shared CSS-token aliases and theme preview defaults', () => {
  const globals = read('app/globals.css')
  const adminCss = read('app/admin/Admin.css')
  const adminTheme = read('app/admin/AdminThemeShell.tsx')
  assert.match(globals, /--sf-display:\s*var\(--sf-font-display/)
  assert.match(globals, /--sf-body:\s*var\(--sf-font-body/)
  assert.match(globals, /--sf-radius:\s*var\(--sf-radius-shape/)
  assert.match(globals, /--sf-container:\s*var\(--sf-container-wide/)
  assert.match(globals, /--preview-primary:\s*var\(--sf-primary/)
  assert.match(adminCss, /--preview-primary:var\(--primary,var\(--admin-primary\)\)/)
  assert.match(adminCss, /var\(--preview-primary,var\(--primary,var\(--admin-primary\)\)\)/)
  assert.match(adminTheme, /'--primary': `rgb\(\$\{primary\}\)`/)
})

test('new public staff/resources and social/map labels use contrast-aware semantic link tokens', () => {
  const polish = read('app/site-polish.css')
  const components = read('app/site-components.css')
  assert.match(polish, /\.sf-essentials-back[^}]*color:var\(--sf-link,var\(--sf-primary\)\)/)
  assert.match(polish, /\.sf-staff-designation[^}]*color:var\(--sf-link,var\(--sf-primary\)\)/)
  assert.match(polish, /\.sf-resource-download[^}]*color:var\(--sf-link,var\(--sf-primary\)\)/)
  assert.match(polish, /\.sf-social-topbar-links a[^}]*color:var\(--sf-link,var\(--sf-primary\)\)/)
  assert.match(components, /\.sf-fp-maplink[^}]*color:var\(--sf-link,var\(--sf-primary\)\)/)
  assert.match(components, /\.sf-fp-card-icon[^}]*color:var\(--sf-link,var\(--sf-primary\)\)/)
})

test('district map uses a distinct theme-aware palette for colorful working locations', () => {
  const map = read('components/home/LocationMaps.tsx')
  const css = read('app/site-components.css')
  assert.match(map, /function districtPaletteFill\(name: string\)/)
  assert.match(map, /fill: selected \? 'var\(--sf-accent\)' : districtPaletteFill\(featureDistrictName\(feature\)\)/)
  assert.match(css, /--sf-fp-district-1: #72c7c4/)
  assert.match(css, /html\[data-mode='dark'\] \.sf-fp-svg[\s\S]*--sf-fp-district-8: #9b5821/)
})

test('global response security headers are configured without disabling external map tiles', () => {
  const config = read('next.config.ts')
  assert.match(config, /poweredByHeader: false/)
  assert.match(config, /X-Content-Type-Options[\s\S]*nosniff/)
  assert.match(config, /X-Frame-Options[\s\S]*SAMEORIGIN/)
  assert.match(config, /Referrer-Policy[\s\S]*strict-origin-when-cross-origin/)
  assert.match(config, /Strict-Transport-Security[\s\S]*max-age=31536000/)
})

test('scheduled backups include PostgreSQL and both private/public media buckets safely', () => {
  const script = read('scripts/backup-production.sh')
  const workflow = read('.github/workflows/production-backup.yml')
  const runbook = read('docs/OPERATIONS_BACKUPS.md')
  assert.match(script, /pg_dump --format=custom/)
  assert.match(script, /s3:\/\/\$\{PRIVATE_BUCKET\}/)
  assert.match(script, /s3:\/\/\$\{PUBLIC_BUCKET\}/)
  assert.match(script, /BACKUP_S3_BUCKET.*must be separate/)
  assert.match(workflow, /schedule:[\s\S]*cron: '35 20 \* \* \*'/)
  assert.match(workflow, /BACKUP_DATABASE_URL/)
  assert.match(runbook, /Restore drill/)
  assert.match(runbook, /not active until repository secrets\/variables and a destination bucket are configured/)
})

