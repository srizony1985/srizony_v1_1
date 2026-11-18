# Local drive-data recovery pack

This folder contains a curated restore set prepared from the uploaded legacy `drive-data.zip` for the current 29-migration CMS schema.

- `backup-manifest.json` lists ten verified table snapshots (740 rows).
- Root-level JSON documents are schema-adapted and checksummed for the current database layout.
- `RECOVERY_REPORT.md` explains transformations, exclusions and data-loss limitations.
- `legacy-quarantine/` preserves the original uploaded ZIP and all source JSON files. Those originals are not imported automatically.

Run `npm run db:restore:local` to read this folder and restore into `BACKUP_DATABASE_URL` or `DATABASE_URL`. Then run `npm run db:seed:registry` to populate only the CMS component/field registry. Read the project's `LOCAL_DATA_RESTORE.md` first.

These files contain private website content and operational/audit records. Do not commit them to source control or place them in a public directory.
