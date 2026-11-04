# Google Drive JSON mirror (personal Gmail / My Drive)

SF_V1.2 keeps **Neon PostgreSQL as its production database**. The Google Drive integration creates an incremental, recoverable JSON mirror in a normal consumer Gmail account's **My Drive**. It does not require Google Workspace, a Shared Drive, or personal-drive storage ownership by the service account.

The service account is deliberately restricted to **updating pre-created files**. It never creates new Drive files. You create one `.json` file per PostgreSQL table and one `backup-manifest.json` file from your own Gmail account, then share the folder with the service-account email as Editor. This avoids the service-account ownership/quota restriction that affects new files in personal My Drive.

## What gets mirrored

- One JSON file per PostgreSQL public table, such as `pages.json`, `cms_content_items.json`, `nav_items.json`, and `media_items.json`.
- Each table file includes a format version, table name, exported timestamp, Neon change revision, row count and full row payload.
- Image objects referenced by `media_items` are downloaded from Neon S3-compatible object storage and embedded in the matching JSON row as `backupEncoding: "base64"`, `backupContentType`, `backupBase64`, and `backupSha256`.
- A `backup-manifest.json` file records the files, row counts, SHA-256 digests, revisions and image counts from the last successful run.

The first incremental workflow run requires that the expected JSON files already exist. Missing files, duplicate filenames, Google Docs/Sheets files, or files without service-account edit permission cause the run to fail safely instead of creating or overwriting an ambiguous item.

## 1. Create the personal Drive folder and JSON files

1. Sign in to the personal Gmail account that will own the backup folder.
2. Create a folder in **My Drive**, for example `SF_V1.2 Database Backups`.
3. Enable the Google Drive API in a Google Cloud project and create a service account with an RSA JSON key.
4. Copy the service account's `client_email` from its JSON credentials.
5. Share the folder with that email and grant **Editor** access. Do not use a Workspace Shared Drive; it is not required.
6. Run the following command locally after configuring a direct `DATABASE_URL` or `BACKUP_DATABASE_URL` and installing PostgreSQL client tools:

   ```bash
   npm run backup:google-drive:list
   ```

   The command prints every required filename, including `backup-manifest.json`. It reads the PostgreSQL catalog only; it does not contact Google Drive.
7. From your Gmail account, create a real uploaded `.json` file for every printed name inside the folder. Each can initially contain `{}`. Do not create Google Docs documents with a `.json` title; upload actual plain-text JSON files.
8. Share the folder with the service account as Editor. If permissions do not inherit to existing files, share the files themselves as Editor too.

When the CMS creates new database tables in a future migration, run the filename-list command again and create the new file from your Gmail account before the next backup run.

## 2. Configure GitHub Actions secrets

Add these GitHub repository **secrets**:

| Secret | Required | Purpose |
|---|---:|---|
| `BACKUP_DATABASE_URL` | Yes | Direct Neon/PostgreSQL URL; use the non-pooled endpoint where available. |
| `GOOGLE_DRIVE_FOLDER_ID` | Yes | ID of the personal My Drive backup folder. |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | Yes (preferred) | Base64 of the complete service-account JSON key. |
| `AWS_ENDPOINT_URL_S3` | When image rows exist | Neon-compatible S3 endpoint for downloading source images. |
| `AWS_ACCESS_KEY_ID` | When image rows exist | Storage read credential. |
| `AWS_SECRET_ACCESS_KEY` | When image rows exist | Storage read credential. |

Alternative Google credential inputs are supported: `GOOGLE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_SERVICE_ACCOUNT_EMAIL` together with `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (or `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_BASE64`). Keep all credentials in GitHub Secrets or a server-side secret manager. Never use `NEXT_PUBLIC_*` variables or commit key files.

Add these repository **variables**:

| Variable | Default | Purpose |
|---|---:|---|
| `AWS_REGION` | — | Region required by the S3-compatible endpoint. |
| `NEON_OBJECT_STORAGE_BUCKET` | `uploads` | Default private bucket for media rows with no explicit bucket. |
| `DRIVE_JSON_MAX_FILE_BYTES` | `209715200` (200 MiB) | Maximum uncompressed JSON size per table file. Increase only when the Drive workflow runner has sufficient memory. |

To encode the service account JSON locally:

```bash
# macOS
base64 -i service-account.json | tr -d '\n'

# Linux
base64 -w 0 service-account.json
```

## 3. Apply the migration and run a test

The project migration `drizzle/0019_google_drive_json_mirror.sql` adds a small transactional change journal to Neon. It marks modified tables dirty in the same Neon transaction as the write. High-churn analytics, security, and abuse-control tables (`visitor_events`, `site_visitors`, rate-limit tables, and login-attempt tables) are intentionally excluded from this per-write journal to avoid making every page-view or rate-limit write contend on one queue row. They are included in the daily full snapshot.

Deploy the application migration first:

```bash
npm run db:migrate
```

Then run **GitHub → Actions → Neon to personal Google Drive JSON mirror → Run workflow**. For the first population, enable `full_snapshot` so all public tables (including analytics/security tables) are written. Subsequent incremental runs only export tables whose Neon revision changed.

The workflow runs every hour and performs a full snapshot daily at 02:35 Bangladesh time. GitHub Actions schedules can be delayed or queued; hourly is a target cadence, not a real-time guarantee. You can also run a full snapshot locally:

```bash
npm run backup:google-drive:full
```

A normal local incremental run is:

```bash
npm run backup:google-drive
```

## 4. Database failover boundary — important

**Google Drive JSON is a backup/recovery mirror, not a live PostgreSQL replacement.** The application uses SQL, relational constraints, transactions, joins, row locks, and Neon-specific database calls throughout its API and CMS. Google Drive files do not provide those semantics. Automatically redirecting a failed Neon write to a JSON file would risk losing cross-table consistency, duplicate IDs, partial multi-file updates, and races across server instances.

The implemented behavior is deliberately safe:

- Writes continue to go to Neon only.
- The Neon transaction marks changed tables for replication.
- GitHub Actions copies those table snapshots to existing Drive JSON files.
- If Neon is unavailable, the application reports its normal database-unavailable state; it does **not** claim that a Drive JSON file has accepted a transactional write.
- The last successful Drive mirror remains available for recovery, with a lag determined by the last successful workflow run.

For true automatic write failover, use a second PostgreSQL-compatible service with replication/failover support (or a deliberately engineered multi-primary architecture). A personal Drive folder cannot safely provide that role. A PGlite/local JSON fallback on serverless instances is also not a reliable multi-instance production database because instances do not share a durable transaction coordinator or lock manager.

## 5. Restore approach

Treat the JSON mirror as a recovery export, not a one-click SQL restore. To restore safely:

1. Create an isolated staging Neon/PostgreSQL database and apply the SF migrations to recreate the schema.
2. Download `backup-manifest.json` and the required table JSON files from Drive.
3. Verify each table file against the SHA-256 recorded in the manifest.
4. Restore relational tables in dependency order using a reviewed import process with foreign-key checks enabled; then reset serial/identity sequences.
5. For each `media_items` row with `backupEncoding: "base64"`, decode `backupBase64`, use `backupContentType` as the restored MIME type when `content_type` is missing, verify `backupSha256`, upload the bytes to the intended staging S3 bucket under a safe media key, and update the corresponding `storage_key`, `storage_bucket`, and `src` references. Remove the `backup*` helper fields before importing the row into PostgreSQL.
6. Validate CMS login, pages, menus, content detail routes, donations, applications, private documents and public images before considering a recovery complete.

Do not import a Drive snapshot over a live production database. A successful upload and checksum verify the cloud copy, not the integrity of a full application restore. Perform restore drills in staging after schema changes and at least quarterly.

## 6. Files and commands

- `scripts/backup-google-drive-json.mjs` — incremental/full snapshot runner.
- `scripts/lib/google-drive-json.mjs` — service-account Drive API client with existing-file-only updates, duplicate checks, resumable uploads and checksum verification.
- `drizzle/0019_google_drive_json_mirror.sql` — Neon transactional change journal and low-overhead table triggers.
- `.github/workflows/production-google-drive-backup.yml` — hourly incremental and daily full backup schedules.

The legacy compressed archive script remains available as `npm run backup:google-drive:archive`; it creates new Drive files and is not the command used by the personal-My-Drive JSON workflow.
