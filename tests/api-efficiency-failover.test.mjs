import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('CMS public settings use Neon first and verified Google Drive snapshots only during an outage', async () => {
  const settings = await read('lib/cms/settings-store.ts')
  const drive = await read('lib/google/drive-snapshot.ts')
  const db = await read('lib/db/index.ts')
  assert.match(settings, /database\.select/)
  assert.match(settings, /readDriveTableSnapshotInfo\('site_settings'\)/)
  assert.match(settings, /successful Neon read with no row is authoritative/)
  assert.match(settings, /writes must commit to/)
  assert.match(drive, /rowCount/)
  assert.match(drive, /marker\.sha256 && document\?\.sha256/)
  assert.match(drive, /revision/)
  assert.match(drive, /DRIVE_READ_FALLBACK_MAX_AGE_HOURS/)
  assert.match(db, /quota.*exhausted/i)
})

test('legacy public JSON endpoints are retired and the current site API is documented as successor', async () => {
  const paths = ['home', 'footer', 'pages', 'news']
  for (const name of paths) {
    const route = await read(`app/api/${name}/route.ts`)
    assert.match(route, /status: 410/)
    assert.match(route, /ENDPOINT_RETIRED/)
    assert.match(route, /successor-version/)
  }
  const api = await read('lib/api/public.ts')
  assert.doesNotMatch(api, /\/api\/news/)
  assert.match(api, /\/api\/site\?slug=/)
})

test('public card CTAs are real outer links with a shared, defined, accessible button treatment', async () => {
  const card = await read('components/pages/ContentFeedCard.tsx')
  const css = await read('app/globals.css')
  assert.match(card, /import AppLink from '@\/components\/ui\/AppLink'/)
  assert.match(card, /<AppLink href=\{href\}/)
  assert.match(card, /sf-feed-card-cta sf-feed-card-cta--button sf-job-feed-action/)
  assert.match(css, /\.sf-feed-grid \.sf-feed-card-cta\s*\{/)
  assert.match(css, /\.sf-feed-grid \.sf-feed-card-cta:focus-visible/)
})

test('desktop submenu ancestors and exact active links receive visible and accessible active states', async () => {
  const tree = await read('components/ui/NavMenuTree.tsx')
  const css = await read('app/globals.css')
  assert.match(tree, /containsActiveRoute/)
  assert.match(tree, /is-active-path/)
  assert.match(tree, /aria-current=\{isExactActive \? 'page'/)
  assert.match(css, /\.sf-menu li\.is-active-path > \.sf-menu-link/)
  assert.match(css, /\.sf-menu-link\[aria-current='page'\]/)
})

test('mission vision values numbers use high-contrast light and dark theme tokens and stay visible on short screens', async () => {
  const css = await read('app/globals.css')
  assert.match(css, /--sf-story-number:#173d5b/)
  assert.match(css, /--sf-story-number:#ffd166/)
  assert.match(css, /color: var\(--sf-story-number\)/)
  assert.doesNotMatch(css, /max-height: 720px\) \{ \.sf-story-num \{ display: none;/)
})

test('API efficiency: navigation caches independently, essentials coalesce, and public form cache invalidates after edits', async () => {
  const site = await read('lib/site.ts')
  const nav = await read('lib/cms/navigation.ts')
  const essentials = await read('components/hooks/useWebsiteEssentials.ts')
  const publicApi = await read('lib/api/public.ts')
  const publicForm = await read('app/api/jobs/application-form/route.ts')
  const navRoute = await read('app/api/navigation/route.ts')
  const adminForm = await read('app/api/admin/job-application-form/route.ts')
  assert.match(site, /srizony-cms-navigation-v2/)
  assert.match(site, /srizony-public-global-document-v1/)
  assert.match(site, /getPublicNavigationSnapshot/)
  assert.match(navRoute, /getPublicNavigationSnapshot/)
  assert.doesNotMatch(navRoute, /getPublicSiteSnapshot/)
  assert.match(nav, /revalidateTag\('site-navigation', 'max'\)/)
  assert.match(essentials, /let cached:/)
  assert.match(essentials, /cached = \{ at: Date\.now\(\), request: Promise\.resolve\(essentials\) \}/)
  assert.match(publicApi, /getWebsiteEssentials/)
  assert.match(publicForm, /revalidate: 300/)
  assert.match(adminForm, /revalidateTag\('job-application-form', 'max'\)/)
})

test('standalone tools share Next.js environment initialization while the DB module only consumes process.env', async () => {
  const db = await read('lib/db/index.ts')
  const helper = await read('scripts/load-env.ts')
  const drizzle = await read('drizzle.config.ts')
  const driveBackup = await read('scripts/backup-google-drive-json.mjs')
  const mediaCleanup = await read('scripts/cleanup-unrecoverable-media.mjs')
  assert.doesNotMatch(db, /dotenv|loadEnvConfig|config\(/)
  for (const source of [helper, drizzle, driveBackup, mediaCleanup]) {
    assert.match(source, /createRequire\(/)
    assert.match(source, /require\(['"]@next\/env['"]\)/)
    assert.match(source, /loadEnvConfig\(process\.cwd\(\)\)/)
    assert.doesNotMatch(source, /import \{\s*loadEnvConfig\s*\} from ['"]@next\/env['"]?/)
  }
})


test('Drive mirror lookup supports Shared Drives and caches filename-to-ID discovery', async () => {
  const drive = await read('lib/google/drive.ts')
  const jsonBackup = await read('scripts/lib/google-drive-json.mjs')
  assert.match(drive, /supportsAllDrives: 'true'/)
  assert.match(drive, /includeItemsFromAllDrives: 'true'/)
  assert.match(drive, /readDriveJsonWithDigest/)
  assert.match(drive, /driveJsonFileCache/)
  assert.match(drive, /DRIVE_FILE_LOOKUP_TTL_MS/)
  assert.match(jsonBackup, /supportsAllDrives: 'true'/)
  assert.match(jsonBackup, /includeItemsFromAllDrives: 'true'/)
})

test('database status uses manifest metadata instead of downloading every table snapshot', async () => {
  const database = await read('app/api/admin/database/route.ts')
  const snapshots = await read('lib/google/drive-snapshot.ts')
  assert.match(database, /readDriveSnapshotManifestInfo/)
  assert.doesNotMatch(database, /Promise\.all\(tables\.map\(async.*readDriveTableSnapshotInfo/s)
  assert.match(snapshots, /export async function readDriveSnapshotManifestInfo/)
  assert.match(snapshots, /rowCount: Number\.isSafeInteger/)
})

test('CMS exposes live provider health and warns when Drive is serving read-only snapshots', async () => {
  const provider = await read('app/api/admin/data-provider/route.ts')
  const shell = await read('app/admin/dashboard/_components/Shell.tsx')
  const header = await read('components/admin/cms/AdminWorkspaceHeader.tsx')
  assert.match(provider, /google-drive-read-only/)
  assert.match(provider, /writesEnabled/)
  assert.match(provider, /readDriveSnapshotManifestInfo/)
  assert.match(shell, /showProviderBanner/)
  assert.match(header, /Google Drive · Read-only/)
  assert.match(header, /<Badge[\s\S]*?variant=\{provider\.variant\}/)
})
