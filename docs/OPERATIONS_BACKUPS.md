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

## GitHub Actions configuration

The repository includes three operational workflows:

- `Production Google Drive backups`: hourly incremental JSON mirror and daily full JSON snapshot, plus manual full-archive backup and restore operations.
- `Production S3-compatible backup`: scheduled PostgreSQL and media-bucket archive to a separate S3-compatible destination.
- `CI`, `CodeQL`, and Dependabot workflows for build validation and dependency/security maintenance.

Before enabling the production backup schedules, configure the following in **GitHub → Settings → Secrets and variables → Actions**.

### Repository or production-environment secrets

| Secret | Used by | Purpose |
| --- | --- | --- |
| `BACKUP_DATABASE_URL` | Google Drive and S3 workflows | Direct, non-pooled Neon/PostgreSQL connection URL with backup/restore privileges. |
| `GOOGLE_DRIVE_FOLDER_ID` | Google Drive workflow | Destination folder ID. |
| `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` | Google Drive workflow | Base64-encoded service-account JSON. The service account must have access to the destination folder and must be able to update the owner-created mirror files. |
| `AWS_ENDPOINT_URL_S3` | Archive and S3 workflows | S3-compatible object-storage endpoint. |
| `AWS_ACCESS_KEY_ID` | Archive and S3 workflows | Object-storage access key. |
| `AWS_SECRET_ACCESS_KEY` | Archive and S3 workflows | Object-storage secret key. |

Prefer configuring production credentials as **environment secrets** on the `production` environment where appropriate. The scheduled Google Drive JSON mirror and S3 job use repository-level secrets unless their workflow `env` mappings are changed to reference an environment.

### Repository or production-environment variables

| Variable | Default / required | Purpose |
| --- | --- | --- |
| `AWS_REGION` | Required for archive and S3 jobs | Region expected by the S3-compatible endpoint. |
| `BACKUP_S3_BUCKET` | Required for S3 workflow | Dedicated destination bucket; it must not be either source media bucket. |
| `BACKUP_S3_PREFIX` | `srizony-production` | Prefix within the destination bucket. |
| `NEON_OBJECT_STORAGE_BUCKET` | `uploads` | Private source media bucket. |
| `NEON_PUBLIC_ASSETS_BUCKET` | `public-assets` | Public source media bucket. |
| `BACKUP_DRIVE_RETENTION_DAYS` | `0` | Google Drive full-archive retention; `0` disables automated pruning. |

`AWS_REGION` is a GitHub Actions variable, not a secret, in these workflow definitions. Set `BACKUP_S3_BUCKET` as a repository variable before the S3 workflow is enabled.

### Schedules and manual operations

The Google Drive JSON mirror runs hourly. The `0 20 * * *` UTC run creates the daily full JSON snapshot at 02:00 the following day in `Asia/Dhaka`; other scheduled runs are incremental. The S3 PostgreSQL/media backup runs daily at 20:35 UTC (02:35 the following day in `Asia/Dhaka`). GitHub Actions schedules can be delayed during periods of high platform load, so monitor workflow outcomes rather than treating the cron minute as a hard guarantee.

To create a full Google Drive PostgreSQL/media archive, open **Actions → Production Google Drive backups → Run workflow**, select `backup`, and run it against the intended branch. This archive path requires the Drive, PostgreSQL, and S3-compatible storage settings above.

To restore an archive, first practice the process against an isolated staging database and isolated media buckets. For production, configure the GitHub `production` environment with required reviewers and prevent self-review where supported. The restore job uses that environment, validates the Drive file ID, requires the exact text `RESTORE PRODUCTION`, and creates a new archive before restoring. The environment name alone does not create an approval gate: configure its protection rules in GitHub settings.

**Restore is destructive.** It replaces database objects from the selected archive and synchronizes media using deletion semantics so the destination reflects the archived state. Do not run it as a routine backup check. Confirm the target database, media buckets, archive manifest, and recovery plan before approving the production environment job.

### First-run checklist

1. Configure all required secrets and variables without committing credential files or values.
2. Create the GitHub `production` environment and enable required reviewers for restores.
3. Trigger each backup workflow manually and inspect the complete logs.
4. Confirm that the expected Drive JSON files, full archive, S3 database dump, manifest, checksum, and media objects exist.
5. Restore to isolated staging and verify the website, CMS login, media, navigation, and content before relying on the backup as a recovery point.
6. Configure alerting/ownership for failed workflows and repeat restore drills quarterly.
