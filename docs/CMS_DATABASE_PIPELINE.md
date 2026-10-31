# Srizony Foundation — Database-first CMS pipeline

## Governing principle

Neon PostgreSQL is the only authoritative runtime source for editable site data. The bundled `data/` catalogue is retained for bootstrap/seed migration, deterministic build preview and explicit recovery only. Application and component code must never import from `data/` directly; all such dependencies are isolated in `lib/cms/fallback-gateway.ts`.

The fallback gateway is not a parallel content provider. The normal runtime is DB-first. `CMS_STATIC_FALLBACK=true` is an explicit emergency/preview switch and should remain disabled in production. A missing or unavailable database must be visible as a service/configuration error instead of silently masking edits with stale bundled data.

## Data flow

```text
CMS forms / admin actions
        ↓
Admin API (session + role check + Zod validation)
        ↓
Domain service / repository
        ↓
Neon PostgreSQL transaction or upsert
        ↓
Audit event + cache/path invalidation
        ↓
Unified public snapshot / domain read API
        ↓
Landing renderer OR slug-page renderer
```

All display helpers (`homeDisplay`, `contentPageDisplay`, `navigationDisplay`, `footerDisplay`, `themeDisplay`, `mediaDisplay`) consume the unified DB-backed site snapshot. Components do not fetch raw data or import the fallback catalogue.

## Data domains and CMS editors

| Domain | PostgreSQL storage | CMS entry point |
|---|---|---|
| Landing and slug pages | `pages.render_cache`, `page_revisions` | Page Builder |
| Homepage global hero/copy | `site_global_state` | Page Builder → Homepage settings |
| Site identity and default SEO | `site_global_state.siteIdentity` | CMS Data Pipeline |
| Brand lockup and shared logo | `site_global_state.images`, `site_global_state.portfolio.brandIdentity` | Portfolio / CMS Data Pipeline logo |
| Navigation and submenus | `nav_groups`, `nav_items` | Navigation |
| Global theme/design tokens | `site_global_state.themes` | Settings → Theme |
| Staff, locations, social links, public PDFs | `site_settings['cms-document:website-essentials.json']` | Website Essentials / Page Builder → Office locations |
| Media metadata and uploaded files | `media_items` + configured object storage | Media Library / Media Field |
| Projects, news, notices, reports, enterprises and other collections | `cms_content_items` plus detail records | Site Content |
| Job postings and applications | CMS content records, `job_applications` | Jobs / Submissions |
| Forms and workflows | Page section configuration plus operational tables (`submissions`, donations, enquiry/auth tables) | Page Builder / form-specific editors |
| Operational site settings | `site_settings` and dedicated operational tables | Settings and corresponding modules |

Locations have one canonical editor and storage record: Website Essentials. The Page Builder office-location panel calls the same API and updates only the `locations` property while preserving socials, staff and PDF settings. Portfolio no longer saves a second branch directory.

## Component architecture

- **Landing/Home layer:** `components/home/*` and `LandingSectionRenderer`. The home page renders only sections with a known `homeComponent` key. Current keys are `hero`, `growth`, `missionVisionValues`, `locations`, `developmentAreas`, `news`, `successStories`, and `donate`. The deprecated `stories` key is accepted only to normalize old saved homepages into the News Rail.
- **Normal page layer:** `components/pages/*` and `SectionRenderer`. It handles content-type sections such as rich text, statistics, cards, gallery, timeline, diagram, table, video, CTA, contact, donation, notices, reports and content feeds.
- **Shared primitives:** neutral UI, typography, media and form primitives may be used by either layer.
- **Reuse direction:** landing compositions may be explicitly selected on normal slug pages; normal page compositions may not be registered on the landing route.

`lib/cms/component-policy.ts` validates this rule on the server before any page write. `HomePage` also filters unknown/non-landing sections as a rendering safeguard. Keep the registry, renderer switch and editor options in sync.

## Updating website data

1. An administrator signs into `/admin/dashboard`.
2. Select the domain editor from **CMS Data Pipeline**.
3. The editor loads the saved database record (bootstrap values may be shown only when the database record has not yet been seeded).
4. The editor validates the submitted structure and role permissions.
5. The API writes to Neon, records the administrator action, and invalidates the relevant route/cache tags.
6. The public site reads the updated record on its next request/revalidation.

No source-code edit, direct JSON file edit, or manual data-folder change is required for ongoing content updates.

## Bootstrap / migration

Before first production deployment:

```bash
npm ci
npm run db:bootstrap
npm run cms:audit:static
npm run db:audit:dataset
npm run test:functional
npx tsc --noEmit
npm run build
```

`db:bootstrap` runs migrations and the idempotent structural seed. The seed copies the bundled canonical content into the database only where required and does not replace already edited global values. It also seeds Website Essentials with the legacy branch directory only if that database document does not yet exist. Subsequent location changes are DB-only.

To run the full local pipeline in sequence after configuring `DATABASE_URL` and the required application secrets:

```bash
npm run cms:pipeline
```

Do **not** use `db:seed:reset`, `db:rebuild-cms`, or any reset script against production unless a separately verified database backup and approved migration plan exist. These are destructive maintenance operations.

## Fallback policy

- Bootstrap source: `data/` through `lib/cms/fallback-gateway.ts` only.
- No runtime component can import `data/` directly.
- A missing optional bootstrap record may use the documented safe fallback during first-time setup/build preview.
- Once an editor saves an explicit empty list or hidden section state, that intentional value must remain empty/hidden; it must not be repopulated from fallback data.
- Never write fallback data back over an existing DB record automatically.
- Production `CMS_STATIC_FALLBACK` should be unset or `false`.

## Verification / acceptance criteria

- `npm run cms:audit:static` reports no direct `data/` imports outside the fallback gateway.
- `tests/component-policy.test.ts` verifies landing/page compatibility and is included in `test:functional`.
- `npm run db:audit:dataset` verifies seed-source bilingual catalogue integrity.
- TypeScript, production build and functional tests pass.
- Root route sections all have valid landing component keys; ordinary page sections remain content-type based.
- Landing compositions can be reused on slug pages; normal page-only sections cannot be saved to the landing route.
- Editing site identity, navigation, landing/page content, theme, media, staff, locations, documents, collections or workflows persists to the DB and updates the appropriate public output.
- An explicit empty DB value is never replaced by a bundled fallback after configuration.

## Operational note

A successful archive/static verification does not prove a production database migration has been run. Run `npm run db:bootstrap` with the target environment's `DATABASE_URL`, then inspect `/admin/dashboard/cms-pipeline` to verify record counts and identity source. Keep a database backup before applying migrations to an existing production database.
