# CMS data storage and provider boundary

## Actual runtime behavior

Neon PostgreSQL is the only supported CMS source of truth in the current application. Both relational CMS entities and JSON-shaped CMS documents are stored in PostgreSQL (`site_settings` for named `cms-document:*.json` records). The authenticated `GET /api/admin/data-provider` endpoint reports Neon as the selected and only provider; its `POST` endpoint rejects attempts to switch providers.

The repository contains an experimental Google Drive REST client under `lib/google/drive.ts`, but the CMS document repository does not call it and the provider endpoint does not expose it. The Google Drive client is therefore dormant code, not an available production data provider. Do not set Google Drive credentials expecting the CMS to read or write Drive documents.

## Production configuration

- Configure `DATABASE_URL` as a secret; use a Neon connection string appropriate to the deployed runtime.
- Apply committed Drizzle migrations before deploying code that depends on new columns or tables.
- Keep Neon as the authoritative store for content, navigation, site settings, form submissions, CMS users, donations and analytics.
- Back up PostgreSQL and both media buckets using the workflow documented in `OPERATIONS_BACKUPS.md`.

## Future Google Drive work

Before enabling Google Drive, implement and test a repository interface for each supported document domain, including concurrency/version checks, schema validation, consistency semantics, migration verification and rollback. Keep authentication, donations, submissions and other transactional data relational unless their consistency model is explicitly redesigned. A JSON file store is not a drop-in replacement for PostgreSQL.
