# Production backups and restore drill

The repository includes a scheduled GitHub Actions workflow (`.github/workflows/production-backup.yml`) and the executable backup task (`scripts/backup-production.sh`). The workflow is **not active until repository secrets/variables and a destination bucket are configured**. Do not treat the existing maintenance cron as a backup; it only prunes operational data.

## One-time setup

1. Create a dedicated, private S3-compatible backup bucket. Prefer a separate account/provider with access controls independent from the application media buckets. Enable encryption and a lifecycle rule (for example, retain daily backups for 35 days and monthly copies for 12 months) on that backup bucket.
2. Add these repository **secrets**:
   - `BACKUP_DATABASE_URL`: a direct, non-pooled PostgreSQL connection URL with permission to read all application schemas. Use a URL-encoded password and never commit it.
   - `AWS_ENDPOINT_URL_S3`: the S3-compatible endpoint URL.
   - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: scoped credentials that can read the two source media buckets and write to the backup bucket.
3. Add these repository **variables**:
   - `AWS_REGION` (the storage region)
   - `BACKUP_S3_BUCKET` (the dedicated backup bucket name)
   - `BACKUP_S3_PREFIX` (optional; defaults to `srizony-production`)
   - `NEON_OBJECT_STORAGE_BUCKET` (optional; defaults to `uploads`)
   - `NEON_PUBLIC_ASSETS_BUCKET` (optional; defaults to `public-assets`)
   - `PG_DUMP_MAJOR` (optional; defaults to `17`; use a PostgreSQL client major version compatible with the server)
4. Run **Actions → Scheduled production backup → Run workflow** once. Verify a timestamped backup contains `database.dump`, its SHA-256 file, a manifest, and copies of both storage buckets. The workflow runs daily at 20:35 UTC (02:35 Bangladesh time the following day).
5. Configure alerts for failed workflow runs and apply a retention lifecycle policy to the backup bucket. A successful upload is not a restore test.

The script rejects a destination bucket equal to either source bucket to avoid recursively backing a bucket into itself. It creates a custom-format `pg_dump` archive and copies both private `uploads` and public `public-assets` objects. It never makes the backup bucket public.

## Restore drill

At least quarterly, restore into an isolated staging project, never over production:

1. Download the chosen `database.dump` and `database.dump.sha256`; verify with `sha256sum -c database.dump.sha256` (run this in the directory containing the downloaded archive).
2. Restore the database into an empty staging database using the matching PostgreSQL tools, for example `pg_restore --no-owner --no-privileges --dbname="$STAGING_DATABASE_URL" database.dump`. Review extension/role requirements before restoring into an existing database; this example is for a fresh staging database.
3. Copy the saved `storage/uploads/` and `storage/public-assets/` contents into staging media buckets, then configure staging environment variables to use those buckets.
4. Run migrations only if needed for the selected restore point, then test login, public assets, PDFs, content rendering, job application/resume privacy and menu/content routing.
5. Record the restore date, backup timestamp, duration and any issues. Keep this procedure and credentials in the organization's approved secret manager.

The project archive cannot configure GitHub repository secrets, provision the backup bucket, or prove that a backup/restore completed in the user's hosting account. Those are deployment operations and must be verified after upload.
