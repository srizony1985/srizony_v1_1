# Google Drive JSON backup — remove the local `psql` requirement

## Error fixed

The previous exporter called `spawnSync("psql", ...)`. On macOS without the PostgreSQL command-line tools installed, Node returned `spawnSync psql ENOENT` before any query reached Neon.

## Implementation

`scripts/backup-google-drive-json.mjs` now imports `Pool` from the project's existing `@neondatabase/serverless` dependency. It connects using `BACKUP_DATABASE_URL` (preferred) or `DATABASE_URL`, keeps one client checked out, and performs the schema/data read inside a `REPEATABLE READ READ ONLY` transaction. Query results return JSON as text so the existing lossless PostgreSQL numeric serialization remains intact. The client and pool are always released in `finally`.

No `psql`, `pg_dump`, Homebrew `libpq`, or global PostgreSQL CLI installation is required for these JSON mirror commands.

## Prerequisites

- Use Node.js `24.21.0` from `.nvmrc`. The Neon Pool transport relies on the built-in WebSocket implementation.
- Run `npm ci` so the existing `@neondatabase/serverless` dependency is installed.
- Set `BACKUP_DATABASE_URL` or `DATABASE_URL` to a valid Neon PostgreSQL connection string.
- For `backup:google-drive` commands, also configure the existing Google Drive service-account credentials and folder ID.
- For `drive-data:export`, configure object-storage credentials only when ready `media_items` rows point to S3-compatible objects. Seeded remote image URLs and project `/photos` or `/images` assets are embedded without S3 credentials.

## Commands

```bash
nvm use
npm ci
npm run backup:google-drive:list
npm run drive-data:export
npm run backup:google-drive:full
```

`backup:google-drive:list` lists the exact currently deployed table-file names. `drive-data:export` writes a local complete snapshot to `drive-data/`. `backup:google-drive:full` updates the pre-created JSON files in the configured Drive folder.

## Why not install `psql` instead?

Installing `libpq` would restore the old script's external dependency, but it would make a JavaScript backup task dependent on a machine-specific executable and PATH configuration. Using the already-installed Neon driver removes that dependency and keeps the database snapshot/transaction logic in Node.


## Image source coverage

The JSON exporter now backs up ready images from three supported source types: configured S3-compatible object storage, local project public assets (`/photos/...` and `/images/...`), and HTTPS URLs from a strict host allowlist. By default the allowlist includes `images.unsplash.com`, `api.dicebear.com`, and `images.pexels.com`. Add additional exact hostnames through `DRIVE_JSON_IMAGE_FETCH_HOSTS` (comma-separated). Every copied payload receives a SHA-256 checksum and is embedded as Base64. A snapshot-only `backupStorageKey` enables verified Drive fallback for project/remote sources; it does not modify live Neon rows. Missing local files, unapproved hosts, inaccessible objects, or invalid image data still stop the backup.
