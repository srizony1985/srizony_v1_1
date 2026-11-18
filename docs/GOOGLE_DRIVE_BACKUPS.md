# Google Drive backup, point-in-time restore, and degraded reads

Neon PostgreSQL remains the transactional production source of truth. Google Drive is the active read-failover provider and point-in-time recovery target. It stores two layers:

1. **Full point-in-time archives** (`.tar.gz`) for destructive restoration of PostgreSQL and both configured object-storage buckets.
2. **Incremental JSON table mirrors** (`.json`) for public-site and supported CMS read fallback when Neon has a transient network, quota, or connection outage.

The Drive mirror is intentionally a validated **read-only runtime fallback**, not a writable SQL database. Google Drive file updates do not provide PostgreSQL transactions, foreign-key enforcement, unique constraints, row locks, or atomic commits across several table files. CMS edits, role changes, uploads, applications, donations, payment callbacks and other transactional writes therefore remain disabled while Neon is unavailable. The site and CMS read screens use manifest-listed snapshots no older than `DRIVE_READ_FALLBACK_MAX_AGE_HOURS` (default 168 hours / 7 days). The admin header indicates when Google Drive is the active read provider and disables the global Save action.

## Full point-in-time backup scope

A full archive contains:

- `database.dump`: PostgreSQL custom-format dump of the complete configured database (schema, tables, rows, indexes, constraints, functions and database-resident CMS configuration).
- `storage/<private-bucket>/` and `storage/<public-bucket>/`: copies of both configured S3-compatible object-storage buckets.
- `runtime-config.json`: non-secret runtime settings such as timezone, public site URL and bucket names.
- `manifest.json`: backup-start timestamp, `Asia/Dhaka` timezone, PostgreSQL snapshot start/end, object-storage copy start/end, git commit, backup format, storage bucket names and the PostgreSQL dump SHA-256.

Deployment secrets, service-account credentials, database URLs, SMTP/API tokens, and private keys are intentionally excluded. Keep those in the hosting/GitHub secret manager. The recorded git commit identifies the application-code revision that was deployed at backup time; it is not a source-code archive.

The archive represents a database dump and object-store synchronization performed by one backup job. PostgreSQL dump generation uses a consistent database snapshot. The separate object buckets are copied sequentially, so the process is not an atomic transaction spanning Neon and object storage. The manifest records each phase's timestamps so operators can see the consistency window. For applications that mutate media references concurrently during a backup, pause high-volume media mutations or use immutable/versioned object keys for the strongest cross-store consistency. PostgreSQL global roles, passwords, provider infrastructure, and deployment secrets are not included; database roles/permissions must be provisioned by the environment, and the restore intentionally uses `--no-owner --no-privileges`.

## Schedule and manual backup

- Full archive: daily at **02:00 Bangladesh time (`Asia/Dhaka`)**, implemented as `0 20 * * *` UTC (Bangladesh is UTC+6).
- JSON mirror: hourly, with a full table mirror refresh during the daily 02:00 job.
- CMS manual backup: Settings → Database & APIs → Point-in-time backups & recovery → **Create backup now**.
- GitHub Actions manual backup: run workflow `Srizony production backup and recovery` with operation `backup`.
- Retention: all full archives are retained by default so the CMS can show every available restore point. Set `BACKUP_DRIVE_RETENTION_DAYS` to a positive number of days to enable automated pruning; at least the two newest full archives are retained.

GitHub Actions scheduled workflows can be delayed by GitHub queueing. The displayed 02:00 time is the configured target, not a hard real-time guarantee. Check the workflow run history for actual start and completion timestamps.

## Google Drive permissions

The full archive writer must create new `.tar.gz` files. The service account therefore needs permission to add children to the backup folder (`capabilities.canAddChildren`). A **Shared Drive folder** with the service account granted Contributor/Content manager access is the preferred destination. A service account may be unable to create new files in a normal personal Gmail My Drive because service accounts do not own personal-drive storage quota. Use delegated user OAuth or another supported Drive destination if a Shared Drive is unavailable.

The JSON mirror is separate: it updates existing, pre-created `.json` files and may work in a personal My Drive folder even when the service account cannot create new files. The CMS status panel disables full backup creation when Drive reports that the connected folder cannot accept new files.

## Required GitHub Actions secrets and variables

Secrets:

| Secret | Purpose |
|---|---|
| `BACKUP_DATABASE_URL` | Direct PostgreSQL/Neon connection URL; use the non-pooled endpoint for `pg_dump` and `pg_restore`. |
| `GOOGLE_DRIVE_FOLDER_ID` | Destination folder ID for archive files and JSON mirrors. |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | Base64-encoded complete service-account JSON (preferred). |
| `AWS_ENDPOINT_URL_S3` | S3-compatible object-storage endpoint. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Object-storage credentials. |
| `GITHUB_BACKUP_TOKEN` | Fine-grained token used by the CMS to inspect and dispatch this repository's workflow; grant Actions: read and write, plus Metadata: read. |

Alternative Google credential inputs supported by the scripts are `GOOGLE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_SERVICE_ACCOUNT_EMAIL` plus `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (or `_BASE64`).

Variables:

| Variable | Default | Purpose |
|---|---|---|
| `GITHUB_BACKUP_REPOSITORY` | `GITHUB_REPOSITORY` | `owner/repository` dispatched by the CMS. |
| `GITHUB_BACKUP_REF` | `main` | Branch/ref containing the workflow. |
| `AWS_REGION` | provider-specific | S3-compatible region. |
| `NEON_OBJECT_STORAGE_BUCKET` | `uploads` | Private media bucket. |
| `NEON_PUBLIC_ASSETS_BUCKET` | `public-assets` | Public media bucket. |
| `DRIVE_JSON_IMAGE_FETCH_HOSTS` | `images.unsplash.com,api.dicebear.com,images.pexels.com` | Additional exact HTTPS hostnames permitted when embedding seeded/remote images in the JSON mirror. |
| `DRIVE_JSON_MAX_IMAGE_BYTES` | `26214400` | Maximum size of a single embedded image (25 MiB). |
| `BACKUP_DRIVE_RETENTION_DAYS` | `0` | Full archive retention in days; `0` disables automatic pruning. |
| `DRIVE_READ_FALLBACK_MAX_AGE_HOURS` | `168` | Maximum age for public-site and supported CMS Drive fallback snapshots. |
| `DRIVE_READ_FALLBACK_CACHE_MS` | `180000` | Per-process snapshot cache lifetime (5,000–300,000 ms); reduces repeated Drive reads while keeping mirror refresh latency bounded. |
| `CMS_ADMIN_USERS_JSON` | — | Optional emergency/break-glass CMS administrator list. Use an environment-configured admin to access the CMS during a Neon outage; database-backed sessions are deliberately not authenticated against stale user snapshots. |

The hosting environment also needs the Drive credentials and `GOOGLE_DRIVE_FOLDER_ID` for CMS provider health, snapshot reads, media fallback and backup history. Configure at least one strong `CMS_ADMIN_USERS_JSON` environment administrator for controlled CMS read access during a Neon outage; do not enable stale-snapshot session validation because it could preserve a revoked user's access. Set `GITHUB_BACKUP_TOKEN`, `GITHUB_BACKUP_REPOSITORY`, and optional `GITHUB_BACKUP_REF` in the server-side production environment. Never put these values in `NEXT_PUBLIC_*` variables.

## Deploy and verify

1. Configure Neon, Drive, S3, and GitHub secrets/variables.
2. Confirm the service account can add files to the selected folder.
3. Apply migrations: `npm run db:migrate`.
4. In GitHub Actions, run the workflow manually with operation `backup`.
5. Verify the run ends successfully and the `.tar.gz` appears in the configured Drive folder with a SHA-256 `appProperty`.
6. Verify CMS Settings → Database & APIs lists the archive as a restorable point.
7. For disaster-recovery readiness, periodically test restore into a separate staging database and isolated object-storage buckets before considering a production restore procedure validated.

Local scripts require PostgreSQL client tools (`pg_dump`, `pg_restore`), AWS CLI and Node dependencies:

```bash
npm run backup:google-drive:archive
npm run restore:google-drive -- --file-id '<DRIVE_FILE_ID>' --confirm 'RESTORE PRODUCTION'
```

Never run the restore command against production casually. The CMS restore button requires a typed confirmation, accepts only a verified full archive in the configured Drive folder, and dispatches a GitHub workflow. That workflow creates a fresh pre-restore archive before downloading and verifying the selected backup. It then replaces the configured media buckets and restores PostgreSQL. The restore is destructive and should be used only after confirming the target database, bucket names and selected timestamp.

## Recovery limitations

- The current restore script restores archived PostgreSQL objects into the configured database using `pg_restore --clean --if-exists`, and synchronizes the two configured object buckets. PostgreSQL objects represented in the archive are replaced, but `pg_restore --clean` does not remove unrelated tables or other objects created after the backup that are absent from the archive. For a mathematically exact database rewind, restore to a fresh Neon branch/database or perform a separately approved schema reset; test the target-specific process in staging before production. This is not a zero-downtime database failover.
- The Drive JSON fallback is read-only and intentionally limited to the public page documents, global-site settings and navigation snapshots. Other application queries and every write require Neon.
- Secrets and deployment-only configuration must be restored from the secret manager. Keep the deployment's app-code git commit available for the matching application version.
- Google Drive revision history is not a substitute for these full archives; files may be revised/merged by Drive and its history is not guaranteed to provide a complete restore point.


## Runtime Drive failover coverage

The server checks Neon first. Only transient failures such as connection loss, quota exhaustion, rate limits and temporary 5xx responses trigger Drive reads. A successful Neon response (including an empty result) remains authoritative and never gets replaced with older Drive data.

Supported Drive-backed reads include:

- Public page documents, global site state, published content feeds and the public navigation tree.
- CMS content/navigation inspection, job and application lists, visitor/submission/donation/form-user reports, dashboard aggregates, pipeline status, table/entity browsing, and CMS user listings.
- Website essentials, footer configuration, theme typography and other settings stored in `site_settings`.
- Public image responses when the media item and SHA-256-verified image bytes are present in the `media_items.json` snapshot. Media payloads are limited to supported image MIME types and are integrity checked before serving.

Snapshot-backed admin responses identify `google-drive-snapshot` as their data source and are read-only. The database status screen reads counts and sizes from the manifest rather than downloading every table document. Runtime file discovery includes the Shared Drive flags and briefly caches file IDs to lower API usage. Each table file's exact downloaded bytes are checked against the manifest SHA-256 where present, in addition to row-count and revision checks.

### Authentication and write boundary

A `cms_users.json` snapshot is used only for the CMS user listing. Password hashes and old roles/status values in a backup are not a safe authentication authority: an account might have been disabled or demoted after the last mirror. When Neon is down, use an environment-configured break-glass administrator from `CMS_ADMIN_USERS_JSON`. Database-backed login, role/session revocation, CMS writes, uploads, public form submissions, job applications, donations and payment callbacks remain unavailable until the transactional primary is healthy. The UI shows a read-only recovery banner and disables the global Save action; individual write endpoints must continue returning an explicit 503 rather than claiming that a snapshot was changed.

### What is required for fully writable Drive-only CMS operation

That is a separate storage migration, not a toggle. Every SQL-backed CMS service and public write route would need to be rewritten around a single serialized write coordinator, append-only operation journal, idempotency keys, conflict detection, recovery/replay, and compaction. A process-local lock is not sufficient on a horizontally scaled/serverless host. Apps Script `LockService` can serialize code sections, but the application would need to route *all* mutations through that coordinator, and Shared Drive ownership/permissions and Drive API quota limits still apply. Until that migration is designed and load-tested, the current read-only failover is the safe mode; use a second transactional PostgreSQL provider for uninterrupted editing and transactional submissions.

Ready images from project `/public/photos` and `/public/images` paths, plus allow-listed HTTPS hosts, are included in the JSON snapshot with a snapshot-only `backupStorageKey` so the existing by-ID Drive media fallback can serve them. The default external image host allowlist is `images.unsplash.com`, `api.dicebear.com`, and `images.pexels.com`; add exact hosts with `DRIVE_JSON_IMAGE_FETCH_HOSTS`.


### CMS integration preflight

The Database & APIs → Database Info & Transfer panel checks Google service-account authentication, folder readability/listing, Shared Drive file-creation capability, editable pre-created JSON mirror files, downloadable verified restore archives, and whether the configured GitHub Actions workflow is active. Full archive creation stays disabled until the folder is in a Shared Drive with `capabilities.canAddChildren=true` and the workflow is available. Restore is enabled only when a verified full archive is downloadable and the pre-restore backup can also be created.

The GitHub token's API permissions can be checked, but GitHub does not reveal the values of repository Actions secrets to the CMS. The workflow validates `BACKUP_DATABASE_URL`, Google service-account credentials, the Drive folder, and object-storage credentials at run time. A successful CMS preflight therefore confirms the API access and Drive permissions; it does not replace a successful end-to-end workflow run.
