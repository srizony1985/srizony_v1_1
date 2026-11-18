# Media rows without recoverable storage keys — cleanup fix

## Root cause

The image backup correctly refuses to create an incomplete snapshot when a `ready` image in `public.media_items` has no recoverable source. A missing `storage_key` by itself is not enough to delete a row: the image may still be recoverable from a legacy `src` object key, a project `/public/photos` or `/public/images` asset, or an allow-listed HTTPS source.

## New cleanup commands

```bash
# Read-only preview; no data changes.
npm run db:media:cleanup-unrecoverable

# Explicit deletion of the safe candidates printed by the preview.
npm run db:media:cleanup-unrecoverable:apply
```

The apply command re-reads and locks rows in Neon, reclassifies them, checks all foreign keys referencing `media_items`, and deletes only rows which remain unrecoverable. It skips rows which have populated `RESTRICT`, `NO ACTION`, or `SET DEFAULT` references. `SET NULL` and `CASCADE` are reported with the affected table and count. No parent content records are deleted to force cleanup.

An unapproved HTTPS hostname is never deleted automatically; add the exact host to `DRIVE_JSON_IMAGE_FETCH_HOSTS` or repair the source. Valid S3 keys and existing local project images are retained even when `storage_key` is NULL.

For each apply run, a metadata-only audit report is written under `drive-data/media-cleanup-report-<timestamp>.json` with restrictive local file permissions. The database operation uses one transaction and rolls back on failure.

## After cleanup

```bash
npm run drive-data:export
npm run backup:google-drive:full
```

The backup exporter's unresolved-media error also prints the cleanup preview/apply commands.

## Scope and limitation

This code package does not have credentials or network access to the user's live Neon database, so it has not deleted a production row itself. Run the explicit `:apply` command in the deployed project environment to perform the requested deletion.
