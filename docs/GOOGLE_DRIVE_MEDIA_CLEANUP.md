# Cleanup of media rows with no recoverable source

The backup exporter must not create an apparently complete image backup when a ready `media_items` image has no recoverable bytes. For a row such as `src = /api/media/16` with an empty `storage_key`, the CMS media API route cannot reconstruct the original object unless the row also resolves to an actual storage object key or valid project/external source.

## Commands

```bash
npm run db:media:cleanup-unrecoverable
npm run db:media:cleanup-unrecoverable:apply
```

The first command is read-only. The second requires the explicit `--apply` flag and deletes only candidates after re-reading and locking their rows in Neon.

## What qualifies for cleanup

- Ready image rows (`kind = image` or `content_type LIKE 'image/%'`).
- No valid `media/...` storage key in `storage_key` or `src`.
- No valid local `/photos/...` or `/images/...` asset.
- No approved HTTPS image source.
- A local public path that no longer exists is also considered unrecoverable.

A valid HTTPS source on a host not in `DRIVE_JSON_IMAGE_FETCH_HOSTS` is not deleted. Add the exact hostname to the allow-list or repair the source first.

## Referential integrity

Before deletion, the tool introspects all foreign keys referencing `public.media_items`.

- `ON DELETE SET NULL`: allowed; the referencing image field becomes NULL.
- `ON DELETE CASCADE`: allowed for dependent media join/upload rows; the exact affected row counts are listed.
- `ON DELETE RESTRICT`, `NO ACTION`, or `SET DEFAULT`: blocks deletion when references exist.

Rows with restrictive references are left untouched and printed with the blocking table and constraint name. The command never disables constraints or deletes parent content records to force the cleanup.

## Audit and consistency

Before mutating the database, the apply command writes a restricted-permission report under `drive-data/media-cleanup-report-<timestamp>.json`. The transaction locks each media row, reclassifies the current values, checks foreign-key impacts, and deletes only rows that still qualify. If the transaction fails, all database deletes roll back. The report contains media metadata only; there is no image payload to archive for these missing-source records.

After the cleanup finishes, run:

```bash
npm run drive-data:export
npm run backup:google-drive:full
```

The exporter also now includes these cleanup commands in its unresolved-source error message.
