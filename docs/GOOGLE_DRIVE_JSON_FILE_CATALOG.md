# Google Drive JSON mirror — file catalog and generation

## Files stored in the Drive folder

The JSON mirror is generated from the live PostgreSQL catalog, rather than a hand-maintained static list:

| File pattern | Purpose |
|---|---|
| `backup-manifest.json` | Lists all table snapshots and records export time/mode, row counts, sizes, revisions, table SHA-256 digests and schema SHA-256 digests. |
| `<public-table-name>.json` | One file per public PostgreSQL base table (except the internal `drive_sync_state` queue). Contains that table’s schema metadata and its rows. |

`media_items.json` embeds SHA-256-verified Base64 bytes for every ready image row. It supports S3-compatible object-storage keys, project-owned `/public/photos` and `/public/images` assets, and HTTPS image URLs from approved hosts (by default `images.unsplash.com`, `api.dicebear.com`, and `images.pexels.com`). Other remote hosts must be explicitly added to `DRIVE_JSON_IMAGE_FETCH_HOSTS`; unresolved images still stop the backup. High-churn analytics and security tables are included in a full export; they are excluded from ordinary incremental runs to avoid mirroring on every visitor event or login attempt.

## Generate actual files

The source archive does not include a production Neon credential or generated snapshot data. To generate the complete and schema-correct JSON set, configure `DATABASE_URL` or `BACKUP_DATABASE_URL` and run:

```bash
npm install
npm run drive-data:export
```

The output is written to `drive-data/`. The database connection uses the Node-native `@neondatabase/serverless` Pool driver and a PostgreSQL `REPEATABLE READ READ ONLY` transaction, so table rows and schema metadata are captured from one consistent point in time. No `psql` executable or separately installed PostgreSQL client is required. Use Node.js 24.21.0 (the project `.nvmrc` version), which supplies the WebSocket runtime required by Neon's Pool/Client API.

To print the exact Drive filenames required by the currently connected database:

```bash
npm run backup:google-drive:list
```

This is the authoritative source of filenames. Do not rely on a table list inferred from this repository because deployed schemas may include later migrations or drift-repair tables.

## Upload / refresh

The Google Drive workflow expects the folder owner to pre-create one real `.json` file per required name and share the private folder with the service account as Editor. The service account updates the existing files; it does not create the initial file set. Once prepared, run:

```bash
npm run backup:google-drive:full
```

Subsequent incremental updates use:

```bash
npm run backup:google-drive
```

Generated exports are intentionally git-ignored because they may contain production personal data and operational records. Google Drive JSON snapshots are read-only fallbacks; only Neon remains the transactional write authority.


For project-bundled and approved-remote images, the JSON snapshot includes a snapshot-only `backupStorageKey` plus `backupSourceType`. Those fields are not written to Neon. They let the verified Drive media fallback serve the embedded image bytes when the primary database is unavailable. `DRIVE_JSON_MAX_IMAGE_BYTES` controls the per-image limit (default 25 MiB).
