# Configurable CMS and database schema v2

## What changed

- Migration `0024_site_configurable_cms.sql` adds `cms_sites`, `cms_content_type_definitions`, `cms_content_field_definitions`, `cms_data_pipelines`, and `cms_site_config`.
- Site-owned tables are linked to `cms_sites` through `site_id`; new application writes default to the first configured site in this deployment.
- `cms_content_items.route_parent` is now relational and indexed. A compatibility trigger mirrors it to `attributes.routeParent` while older components are being retired.
- Content registry definitions and field metadata are bootstrapped from the built-in content catalogue once. Existing database-managed definitions are not overwritten by the seed script.
- `/admin/dashboard/site-configuration` manages the current site's identity, URL/domain, locales, identity JSON and settings JSON. `/api/admin/site-config` exposes the active site and registry to authorized CMS users.
- Public `contentFeed` sections now include client-side keyword search, category/status filtering and year filtering. It covers news, projects, jobs and notices where those content feeds are configured.
- Google Drive backup exports v2 manifest/table envelopes with a site key and version information. The read-only fallback reader accepts validated v1 and v2. New v2 snapshots must match `CMS_SITE_KEY`.

## Fresh database setup

Use a fresh Neon database and its **direct (non-pooled) connection string** for migration operations. Keep application traffic on the pooled connection if that is how the deployment is currently configured.

```bash
npm ci
# configure DATABASE_URL and site variables in .env.local first
npm run db:bootstrap
npm run build
```

`db:bootstrap` applies all migrations in order, then runs the structural seed and creates the first site registry. Do not run `db:seed:reset` unless you explicitly intend to reset seeded site/page/config data.

## Per-website configuration

The CMS is independently deployable for different websites. The supported installation model is **one deployment/database per website**; this avoids accidental cross-site access to legacy tables that have not yet been converted to shared multi-tenant queries. Set the following before the first bootstrap:

```dotenv
CMS_SITE_KEY=your-site-key
CMS_SITE_NAME=Your Website
CMS_SITE_URL=https://www.example.org
CMS_SITE_DOMAIN=www.example.org
CMS_DEFAULT_LOCALE=en
CMS_SUPPORTED_LOCALES=en,bn
# optional first-run object; never put credentials/secrets here
CMS_SITE_IDENTITY_JSON={}
```

Use a unique stable `CMS_SITE_KEY` for each site deployment. A newly migrated database starts with a neutral `default` site row. The seed process associates its existing records with this site and renames that row to your configured key. Do not change the site key after publishing a Drive backup unless you also intend to change the snapshot namespace.

## Drive backup format

Run a full export after bootstrap:

```bash
npm run backup:google-drive:full
```

The exporter writes `srizony-drive-database-manifest-v2` and `srizony-postgresql-table-v2`. Each table document contains the database schema fingerprint, `siteKey`, `siteSchemaVersion`, pipeline format, revision, row count and rows. Media payloads continue to be embedded as Base64 with digest metadata. See `drive-data/README.md`.

The checked-in `drive-data/*.json` examples are historical v1 snapshots and have deliberately been left untouched. Relabeling their envelopes would misrepresent their old table schemas. They remain readable by the compatibility reader; regenerate them from the newly bootstrapped database for current v2 snapshots.

## Important scope boundary

This change establishes the site identity, registry metadata, relational route key, seed/bootstrap path and backup versioning. Built-in content forms still use the project's compiled component catalogue as their initial renderer/validator; the registry is seeded from it and exposed to the admin, but arbitrary new field types and arbitrary SQL source-table remapping are not yet a safe no-code extension mechanism. The setup supports independent websites through separate deployments/databases; it is not a shared multi-tenant SaaS database. Keep secrets in environment variables or a secret manager, not in `identity` or `settings` JSON.

## Operational verification

After deployment:

1. Confirm migration `0024_site_configurable_cms` is present in `drizzle.__drizzle_migrations`.
2. Confirm `cms_sites`, `cms_content_type_definitions`, `cms_content_field_definitions`, `cms_data_pipelines`, and `cms_site_config` exist.
3. Confirm each site-owned row has `site_id=1` on the first site installation.
4. Open `/admin/dashboard/site-configuration` and confirm its registry counts are non-zero.
5. Publish a news item, project, job and notice; test search, category/status and year filters on their public collection pages.
6. Run a full Drive export and verify the manifest and table envelopes use v2 and the configured site key.
