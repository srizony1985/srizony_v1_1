# API, fallback, navigation and usability improvements

## 1. Environment configuration

- Removed manual `dotenv` loading from the shared database module. Runtime database access now consumes the environment prepared by Next.js.
- Added a single `scripts/load-env.ts` helper based on `@next/env` for standalone maintenance commands; Drizzle and the Google Drive JSON backup command use the Next-compatible loader.
- Removed the direct `dotenv` dependency and synchronized the package lock.

**Benefit:** avoids repeated environment-file parsing/injection during normal server module evaluation, keeps `.env.local`/`.env` precedence consistent with Next.js, and retains environment support for standalone scripts.

## 2. Legacy API consolidation

The old public JSON endpoints are retired with HTTP `410 Gone`, a `Deprecation` header, and a `Link` successor header:

| Retired route | Current route |
| --- | --- |
| `/api/home` | `/api/site?slug=%2F` |
| `/api/footer` | `/api/site?slug=%2F` (`global.footer`) |
| `/api/pages?slug=...` | `/api/site?slug=...` |
| `/api/news` | `/api/site?slug=%2Fnews` |

Current internal clients use the consolidated site API and the dedicated navigation API. A source scan found no internal client references to the retired routes. External integrations must migrate before relying on a future removal of the compatibility responses.

**Benefit:** one canonical public data contract, fewer independent response shapes and less duplicate client-side fetching/normalization.

## 3. Neon primary with Google Drive JSON read failover

- Neon PostgreSQL remains the source of truth and the only write/transaction provider.
- Verified Google Drive table snapshots remain an active **read-only failover** for supported public CMS reads when Neon is unavailable, including quota exhaustion, rate limits, network faults and connection limits.
- Failover checks the manifest and matching table file, table identity, row count, revision and maximum snapshot age (`DRIVE_READ_FALLBACK_MAX_AGE_HOURS`, default 168 hours).
- Snapshot downloads are coalesced and briefly cached. A process retains its last verified snapshot during a transient Drive refresh failure while that snapshot remains inside the allowed age.
- A successful Neon lookup that returns no row is authoritative; it does not fall through to stale Drive content.
- CMS writes, form submissions, donations and other transactional actions remain Neon-only. When Neon is unavailable, mutations fail clearly rather than pretending a Drive JSON write succeeded.
- Settings reads now share one Neon-first/Drive-second path for theme typography, footer, website essentials and CMS JSON documents such as the job application form.

**Benefit:** public content can remain available during Neon quota/network incidents without creating split-brain writes or silently replacing current database state with stale backup data.

## 4. API request and data-consumption efficiency

- Added an independently cached public navigation snapshot. `/api/navigation` now returns only the navigation tree and the global UI-label document; it no longer builds the full homepage/site snapshot just to paint the header.
- Navigation cache is revalidated after CMS navigation changes and naturally expires after 60 seconds.
- Website Essentials requests share one browser-side in-flight promise across consumers and cache the resolved result for 60 seconds. The cache lifetime starts after the response completes.
- Public job-application form schema is cached for five minutes and its cache tag is invalidated after an admin update.
- Drive manifest/table fetches are cached and concurrent requests for the same table are coalesced.
- Public page/site snapshots retain server-side caching and tag-based invalidation after CMS changes.

**Benefit:** fewer repeated database/Drive reads, smaller navigation responses, less duplicate traffic from shared components, and fewer requests during transient outages while preserving prompt cache invalidation after writes.

## 5. Navigation and card actions

- Desktop navigation marks an exact active page using `aria-current="page"` and marks ancestor submenu paths with a separate active-path style.
- Card CTA affordances use a shared defined themed class and stay inside one semantic `AppLink` per card. They are not implemented as nested links/buttons, which would create invalid interactive nesting.
- CTA focus states are visible and keyboard accessible.

**Benefit:** visitors can identify their current section and understand which card action will navigate them; keyboard users receive an explicit focus indicator.

## 6. Mission, Vision and Values contrast

- Replaced low-contrast/transparency-only number styling with explicit high-contrast theme tokens.
- Light mode uses dark ink/outline shades; dark mode uses bright warm foreground/outline shades.
- Responsive sizing now keeps the numbers visible on short viewports rather than hiding them.

**Benefit:** stronger hierarchy and legibility across appearance modes and smaller screens.

## 7. Quality attributes and operational notes

- Preserved existing semantic page/card structure, focus-visible indicators, responsive styles and cache tags while adding the above changes.
- Added source-contract regression tests for failover safety, endpoint migration, card links, active navigation, theme contrast and API caching.
- Added/retained CI, CodeQL and Dependabot workflow configuration for automated quality/security checks and dependency updates.

**Benefit:** changes are guarded against regressions and have a clearer security and maintenance path.

## 8. Database migration

No new SQL migration is required for these changes. They reuse the existing `site_settings`, `site_global_state`, `pages`, `nav_items`, `nav_groups`, `cms_content_items` and Drive mirror schema. Apply any existing unapplied migrations before deployment:

```bash
npm ci
npm run db:migrate
npm run test:functional
npx tsc --noEmit
npm run build
```

Refresh the Drive mirror after deployment or a substantial content update:

```bash
npm run backup:google-drive
```

The `backup:google-drive`, `backup:google-drive:full`, `backup:google-drive:list`, and `drive-data:export` commands use the Node-native Neon serverless Pool driver. They do not require the PostgreSQL CLI (`psql`) or `postgresql-client`. Set `BACKUP_DATABASE_URL` (preferred for backup jobs) or `DATABASE_URL`, and configure the Google Drive service account/folder for remote mirroring. The backup exporter uses a pinned WebSocket client and a repeatable-read transaction for consistent snapshots; use the project's Node.js 24.21.0 runtime.
