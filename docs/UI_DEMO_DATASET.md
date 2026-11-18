# Srizony Foundation — UI demo content dataset

This is a fictional bilingual dataset for testing the CMS Site Content editor, public collection pages, detail pages, cards, grids, list layouts, search/filter controls, notices, reports, jobs, team profiles, success-story galleries and statistics.

> **Local/staging only — never import this published demo dataset into the live production site.** The existing CMS database-transfer screen is a general-purpose admin import and does not enforce the demo script's `NODE_ENV` safeguard. Use a local Neon branch/database or staging environment.

**All records are fictional.** They are visibly labeled `DEMO PREVIEW`; fictional vacancies, team profiles, composite stories and statistics must never be represented as official Srizony Foundation content. Records are `published` only so they appear in a local/staging preview. The seed and API scripts refuse to run when `NODE_ENV=production` and require an explicit `ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY` opt-in.

## Contents

- `data/ui-demo-content.v1.json` — canonical CMS content API dataset (38 items / 13 component types).
- `data/ui-demo-cms-transfer.v1.json` — compatible `srizony-cms-site-data` v1 file for **Admin Dashboard → Settings → CMS site-data transfer**. It imports only `cms_content_items`; it does not overwrite menus, website identity, homepage configuration or existing content.
- `scripts/seed-ui-demo.mjs` — direct Neon database seed with transaction, conflict preflight and collection-page section setup.
- `scripts/upload-ui-demo-api.mjs` — login + sequential upload through `POST /api/admin/site-content`; that API calls the CMS repository and automatically connects items to their collection pages.
- `scripts/remove-ui-demo.mjs` and `scripts/remove-ui-demo-api.mjs` — remove only the namespaced demo records.
- `tests/ui-demo-content.test.mjs` — data/transfer contract tests.

## Install the scripts into an existing project

Extract this patch ZIP into the project root and run:

```bash
node ui-demo-dataset-patch/apply.mjs
```

The patch adds these package scripts without changing dependencies:

```text
db:seed:ui-demo
db:remove:ui-demo
api:seed:ui-demo
api:remove:ui-demo
test:ui-demo
```

The dataset and scripts are installed in `data/` and `scripts/`.

## Before importing: initialize the content registry if it is still empty

Your database can have working tables and pages while the configurable content registry remains empty. Run this idempotent seed once if the CMS Site Configuration screen shows zero content types/fields:

```bash
CMS_SITE_KEY=default npm run db:seed:registry
```

## Option A — recommended: upload through the authenticated CMS API

1. Make sure the project has already been migrated and the CMS admin account can sign in.
2. Start the local site: `npm run dev`.
3. Make sure `.env.local` contains the admin login used by `/api/admin/login`:

```dotenv
CMS_ADMIN_EMAIL=your-cms-admin-email
CMS_ADMIN_PASSWORD=your-cms-admin-password
ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY
CMS_API_BASE_URL=http://localhost:3000
```

4. Run:

```bash
npm run api:seed:ui-demo
```

The script authenticates against the local CMS login route, keeps the signed session cookie in memory, checks for slug conflicts, then sends each record to `POST /api/admin/site-content`. It does not print the password or cookie. The API uses the regular CMS content service, so collection page sections are connected as items are created.

If you intentionally test a **staging** site instead of localhost, set `CMS_API_BASE_URL` to the staging URL and explicitly add `ALLOW_REMOTE_DEMO_API=YES_REMOTE_DEMO`. Do not use this on production.

## Option B — upload through the CMS database transfer screen

1. Open **Admin Dashboard → Settings → CMS site-data transfer**.
2. Select `data/ui-demo-cms-transfer.v1.json`.
3. Confirm the preview shows 38 rows in `cms_content_items`, then apply the import.
4. The database transfer endpoint writes directly to the migrated PostgreSQL table and generates record IDs. It does not run the single-item repository's collection-page attachment logic.
5. To connect the records to collection-page sections, run Option C's `db:seed:ui-demo` command. It detects the already-imported demo rows, skips them, and only repairs/creates the corresponding collection sections.

The transfer file targets the fresh default site (`site_id=1`). For a database where the selected `cms_sites` row has another ID, use Option A or Option C instead.

## Option C — direct database seed

Run from the project root, with the `.env.local` `DATABASE_URL` pointing to the intended **local or staging** database:

```bash
ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY CMS_SITE_KEY=default npm run db:seed:ui-demo
```

This command:

- opens a PostgreSQL transaction;
- verifies the requested `cms_sites.site_key` exists;
- refuses to overwrite non-demo content at any sample slug;
- inserts records into `cms_content_items` with generated IDs;
- creates or connects the matching `contentFeed` sections in `pages.render_cache`;
- marks records with `attributes.demoOnly=true` and `attributes.demoDataset`;
- rolls back all writes if the operation fails.

It does not change the homepage composition, navigation tree, Website Essentials, contact settings, admin users, job applications, donations or private operational data. It creates/updates only the relevant collection pages and demo content.

## Remove the demo data

Choose the cleanup path that matches how it was uploaded:

```bash
ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY CMS_SITE_KEY=default npm run db:remove:ui-demo
```

or, if uploaded through the CMS API:

```bash
ALLOW_UI_DEMO_SEED=YES_DEMO_ONLY npm run api:remove:ui-demo
```

Cleanup removes records with the reserved `demo-ui-` slug prefix and `DEMO PREVIEW —` title. It leaves collection sections in Page Builder so they can be reused; delete unused empty sections manually if desired.

## Images and links

Images are preview stock photos from `images.unsplash.com`, which is present in the project's `remotePatterns`. They are external URLs, not uploaded media binaries. This dataset intentionally does not create `media_items` rows or claim ownership of stock images. Report/notice links use `https://example.com/` placeholders; they are not real PDFs.

## Validation

Run:

```bash
npm run test:ui-demo
```

The tests validate the dataset envelope, all 13 component types, unique namespaced slugs, required form fields, select options, bilingual demo labels, future job deadlines, fictional success-story image requirements and CMS-transfer envelope shape.

**Use only one import route per database.** If records are already present, the scripts skip recognizable demo items; they refuse to overwrite records that reuse a demo slug but do not carry the demo title marker.
