# Production backups and restore drills

SF_V1.2 supports two independent backup destinations:

- **Google Drive personal My Drive JSON mirror:** incremental Neon table snapshots, Base64 image payloads, an upload manifest, and a daily full snapshot. It uses a service account only to update `.json` files created by the Gmail folder owner. See [`GOOGLE_DRIVE_BACKUPS.md`](./GOOGLE_DRIVE_BACKUPS.md) and `.github/workflows/production-google-drive-backup.yml`.
- **S3-compatible backup bucket:** the existing `scripts/backup-production.sh` workflow, using `BACKUP_DATABASE_URL`, S3 credentials and a dedicated destination bucket.

Keep backup destinations private, alert on failed scheduled runs, and perform a restore drill to an isolated staging environment at least quarterly. A successful upload alone is not a restore test.

The `backup:google-drive` command mirrors changed Neon tables to pre-created JSON files. The `backup:google-drive:full` command includes all public tables, including high-churn analytics/security tables. The `backup:google-drive:archive` command is the older timestamped archive uploader and requires a Drive destination that can create new files; it is not used by the personal Gmail JSON workflow.

The `backup:production` command continues to back up PostgreSQL and the two media buckets to S3. Neither backup workflow changes the live database provider. Google Drive is a recovery mirror, not an automatic live SQL failover database.

For S3 backup setup, provide:

- `BACKUP_DATABASE_URL`: direct, non-pooled PostgreSQL URL.
- `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- `BACKUP_S3_BUCKET`: a dedicated bucket different from both source media buckets.
- Optional `BACKUP_S3_PREFIX`, `NEON_OBJECT_STORAGE_BUCKET`, and `NEON_PUBLIC_ASSETS_BUCKET`.

The S3 script rejects a destination bucket equal to either source bucket to prevent recursive backup. It creates a custom-format `pg_dump` archive, checksum and manifest, then syncs private `uploads` and public `public-assets` objects. It never makes the backup bucket public.

The repository cannot configure production secrets, provision cloud destinations, or prove that an external restore completed. Verify these deployment tasks after configuration.
