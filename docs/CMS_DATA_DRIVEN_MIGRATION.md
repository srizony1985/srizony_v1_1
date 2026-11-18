# Srizony CMS-driven content, UI and database mirror

## What this patch changes

1. **One public global stylesheet.** `app/globals.css` now contains the final token-conflict and layout normalization layer. `app/layout.tsx` imports only this stylesheet. The separate `app/site-fixes.css` has been merged into the end of `globals.css`; the original stylesheet body was retained rather than rewritten.
2. **CMS typography contract.** Page and section typography values are written as `--sf-cms-*` custom properties by `lib/cms/typography.ts`. The global typography scope applies the configured family, weight, size, color, line height and tracking to headings, body copy, lists, labels, links, form controls and buttons while retaining semantic contrast on brand surfaces.
3. **Page composition is stored with the page.** `pages.render_cache` carries `pageView`, `cardStyle` and `showContactMap`. The shared page template chooses reusable views from these fields instead of checking `/resources`, `/management-staff` or `/contact` in the JSX.
4. **Bilingual UI copy is stored in `ui_content`.** The public site reads those rows from Neon, overlays them on seeded defaults, and can read them from the validated Drive snapshot during a transient Neon outage. The admin dashboard now exposes **Content management → UI Text & Labels** for English and Bangla text. Changes are written to Neon only.
5. **Collection fallback no longer invents a public page.** In normal runtime, a missing route must have a published CMS page or published content-detail record. The bundled page/collection registry remains available for seeding, build-time rendering and explicitly enabled static fallback only.
6. **Header geometry.** The navigation ResizeObserver writes the measured header height to the document root as `--sf-header-height` for sticky offsets and anchor positions.

## Apply the database merge

The migration is idempotent and preserves any existing `pages.render_cache` values and any existing `ui_content` text. It seeds missing page behaviours for the current Resources, Management Staff, Contact, Social Development and Enterprise Development pages, then inserts the default English/Bangla labels required by the new UI editor.

Recommended command (from the project root, after configuring `DATABASE_URL` and installing dependencies):

```bash
npm run db:migrate
```

The migration file is:

```text
drizzle/0022_cms_page_behaviour_and_ui_content.sql
```

Equivalent direct SQL command for a controlled one-off operation:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0022_cms_page_behaviour_and_ui_content.sql
```

The Drizzle journal already includes migration `0022_cms_page_behaviour_and_ui_content`. Prefer the normal migration command so the migration tracking table and DDL stay aligned. If the direct `psql` command is used instead, the SQL is safe to encounter again because it uses JSONB merge semantics and `ON CONFLICT DO NOTHING`.

## Generate schema-matched Neon table JSON

The source archive does not contain a live Neon credential. For that reason this package deliberately contains no fake or guessed operational rows/schema. Generate the exact current table documents from the actual Neon database:

```bash
# Configure DATABASE_URL in .env.local or export it in the shell.
npm run drive-data:export
```

The command is equivalent to:

```bash
node scripts/backup-google-drive-json.mjs --full --local
```

Requirements:

- A direct PostgreSQL URL in `DATABASE_URL` or `BACKUP_DATABASE_URL`.
- `psql` available on `PATH`.
- For image rows in `media_items`, the same S3-compatible object-storage variables already used by the production media store: `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and the correct bucket configuration.

The command writes `/drive-data/<table-name>.json` and `/drive-data/backup-manifest.json`. It reads schema and rows in one PostgreSQL `REPEATABLE READ READ ONLY` transaction. Each table file includes a `schema` object, `schemaSha256`, row count, export time, revision and rows. `schema` captures table-specific catalog definitions (column order/types/defaults/identity/generated fields, type metadata, comments, constraints, indexes, triggers, grants, RLS policies and partition/relation settings). The manifest includes both the file digest and schema digest.

These JSON exports are ignored by Git because they can hold production data. Keep them private and upload them only to the configured private Google Drive folder. To refresh the Drive mirror using the configured service account and pre-created JSON files, run:

```bash
npm run backup:google-drive:full
```

Incremental mirroring remains available through `npm run backup:google-drive` after the journal triggers and pre-created Drive table files are configured.

## Database authority and fallback boundaries

Neon remains the only transactional write database and the source of truth. The Google Drive files are immutable-per-snapshot, digest-verified copies for degraded-mode reads and recovery. A Drive folder does not provide PostgreSQL transactions, uniqueness enforcement, row-level locking, foreign-key enforcement, serializable isolation, or safe concurrent writes. The CMS API therefore rejects edits when Neon is unavailable rather than pretending to write to Drive. Do not enable dual-write from the browser or application server.

## Remaining work before claiming a 100% CMS-owned application

This patch removes the hard-coded page-view choices described above and routes the staff/resource interface labels through `ui_content`, but it does **not** yet make every value in the repository editable from CMS. A source audit still finds code-owned bootstrap/compatibility rules and data defaults that need separate migrations and editor screens, notably:

- `lib/cms/components.ts` and `CONTENT_COLLECTION_ROUTES`: the component/route registry is still code-owned metadata used by seed scripts, CMS validation and content-detail route construction. It is not public page copy, but adding/removing a collection type still requires code changes.
- `lib/site.ts`: legacy page-specific portfolio hydration and some catalogue compatibility branches still reference known paths (`/about-us`, `/mission-vision`, `/governing-body`, `/executive-committee`, `/projects`, `/news`, `/enterprise-development`, `/notice`, `/carrer-job`, and programme pages). These should be converted to section-level `contentCollection`/binding metadata and generic renderer adapters, with a migration that annotates existing sections before removing the compatibility branches.
- `data/data.ts`, `lib/cms/fallback-gateway.ts` and `seed-structural.ts`: bundled data remains a bootstrap/build/static-fallback source. It must not be deleted until the production Neon dataset is verified complete and the build-time content strategy is changed.
- Some component-level empty-state fallbacks remain as resilience defaults. The new `ui_content` keys override them, but missing database keys still use sensible fallback text to avoid blank UI.
- Full CMS control of forms, route aliases, redirects, error pages, email templates, permissions, feature flags and system settings requires dedicated data models and role-protected editors. CSS tokens alone cannot make application logic editable.

Therefore this patch is a substantial step toward CMS ownership, not an honest claim that 100% of all application data and behaviour has been migrated. Do not delete the remaining compatibility registries or seed data until the corresponding live database records, routes and rollback path have been verified.

## Operational verification checklist

- Run `npm run db:migrate` against a staging Neon database first.
- Confirm the five page behaviours in the Page Builder after migration.
- Edit a staff/resource label in the UI Text & Labels screen in both languages and confirm the public page updates.
- Run `npm run drive-data:export`; inspect the manifest and confirm every exported table has a matching schema/table name and `schemaSha256`.
- Upload or mirror the generated files to a private test Drive folder; simulate a transient Neon read failure and verify only public read paths use Drive.
- Confirm all admin write endpoints fail closed when Neon is unavailable.
- Run the project functional tests, lint and production build, then do responsive visual checks at 480, 640, 720, 900, 1024 and 1280px and in both appearance modes.
