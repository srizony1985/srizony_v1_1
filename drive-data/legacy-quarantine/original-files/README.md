# Google Drive JSON table mirror

This directory is the **private local staging area** for the Google Drive database mirror. Generated table snapshots are intentionally not committed because they can contain real people’s contact details, form submissions, account records, donation records, and other production data.

## Generate the complete JSON set

From the project root, configure `DATABASE_URL` or `BACKUP_DATABASE_URL` with a direct PostgreSQL connection URL and run:

```bash
npm install
npm run drive-data:export
```

This runs `scripts/backup-google-drive-json.mjs --full --local`. It discovers every current `public` base table in the connected database (excluding the internal `drive_sync_state` queue) and writes:

- `backup-manifest.json` — index of every exported table, export mode/time, row counts, byte sizes, table revisions, SHA-256 file digests and schema digests.
- `<table-name>.json` — one schema-and-data document for every discovered PostgreSQL table. The file contains the table identity, full catalog-derived schema, schema digest, export timestamp, revision, row count and row data.

`media_items.json` contains Base64-encoded payloads and SHA-256 checksums for every ready image row, including S3 objects, local project public assets, and approved external image sources. S3 credentials are required only when the database contains object-storage-backed images.

## Get the exact file names for the live database

The project cannot infer the production table list from source files alone; migrations and production schema can differ. Run:

```bash
npm run backup:google-drive:list
```

The output is the authoritative list for the currently connected database: `backup-manifest.json` plus one `<table-name>.json` file for every current public base table. Do not create guessed table files or use an incomplete list.

## Mirror the files to Google Drive

1. Create a private folder owned by the Google account that will retain the backups.
2. Create one real `.json` file in that folder for every name printed by `npm run backup:google-drive:list`, including `backup-manifest.json`. Empty JSON objects (`{}`) are valid initial file contents; the mirroring script replaces the contents after checking the file identity and edit permissions.
3. Share the folder with the configured service-account email as **Editor**.
4. Configure the server-side Google service-account credentials and `GOOGLE_DRIVE_FOLDER_ID`.
5. Run `npm run backup:google-drive:full` to write the complete snapshot set. Later, `npm run backup:google-drive` mirrors tables marked dirty by the database change journal.

The service account updates existing JSON files; the Gmail/Drive folder owner creates them. The folder and files must remain private. Never place production snapshot JSON in source control, a public website directory, or a public download.

## File format and safety

Every table document uses `format: "srizony-postgresql-table-v1"`. The manifest uses `format: "srizony-drive-database-manifest-v1"`. Schema metadata uses `format: "srizony-postgresql-table-schema-v1"`. The runtime validates file digests, schema digests, table identity, revisions and row counts before trusting a snapshot.

Google Drive JSON is a **read-only recovery mirror**, not a transactional database. The CMS must continue to reject writes while Neon is unavailable. For full point-in-time restoration, use the separate `.tar.gz` archive backup workflow described in `docs/GOOGLE_DRIVE_BACKUPS.md`.


Ready images are embedded in `media_items.json` as Base64 with SHA-256 checksums. The exporter supports S3-compatible media objects, local project public files under `/public/photos` and `/public/images`, and HTTPS URLs from a strict allowlist (`images.unsplash.com`, `api.dicebear.com`, `images.pexels.com` by default). To approve additional exact hostnames, set `DRIVE_JSON_IMAGE_FETCH_HOSTS` to a comma-separated list. `DRIVE_JSON_MAX_IMAGE_BYTES` defaults to 25 MiB. Unsupported/missing sources fail the export instead of silently leaving an incomplete backup.

## Clean up genuinely unrecoverable image records

If the exporter reports a ready image row with no valid object key or recoverable source (for example a stale `/api/media/{id}` URL with no backing storage object), the project includes a narrow Neon cleanup command:

```bash
# Preview only; this command never changes the database.
npm run db:media:cleanup-unrecoverable

# Explicitly apply only the previewed safe deletions.
npm run db:media:cleanup-unrecoverable:apply
```

The cleanup uses the same media-source classifier as the backup exporter. It retains valid S3 object keys, approved HTTPS images and local `/public/photos` or `/public/images` files even when `storage_key` is empty. Unapproved HTTPS hosts are reported for manual allow-list review and are not deleted. Missing local public files are included as cleanup candidates.

Before applying, the script checks every foreign key pointing at `media_items`. Rows referenced by `RESTRICT`, `NO ACTION` or `SET DEFAULT` constraints are skipped. `SET NULL` references are detached and `CASCADE` join rows are removed by PostgreSQL; those effects are shown in the preview. The apply step locks and rechecks candidate rows, writes a local metadata-only audit report under `drive-data/`, and then deletes only those rows in a database transaction. It does not delete unrelated pages, content entries or S3 objects.

After cleanup succeeds, rerun `npm run drive-data:export` and then `npm run backup:google-drive:full`.
