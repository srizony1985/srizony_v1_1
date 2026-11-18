# Google Drive JSON image-backup source fix

## Why the image export stopped

The previous exporter assumed every ready `media_items` image had a recoverable S3 key in `storage_key` or an S3 bucket URL in `src`. The current CMS seed catalogue also uses external Unsplash/Dicebear URLs and project-owned `/photos/...` or `/images/...` files. Those records legitimately have no S3 `storage_key`, so the old check incorrectly rejected them.

## Supported image sources

The exporter now embeds every ready image payload in `media_items.json` from one of three source types:

1. **S3-compatible object storage** — existing `media/...` keys and `/uploads/media/...` or `/public-assets/media/...` bucket URLs. Requires the configured S3-compatible endpoint and credentials.
2. **Project-owned public files** — `/photos/...` and `/images/...`, resolved only below the repository's `/public` directory. Resolved file paths are checked again after realpath resolution so symlinks cannot escape `/public`.
3. **Approved external HTTPS images** — exact hosts `images.unsplash.com`, `api.dicebear.com`, and `images.pexels.com` are approved by default. Additional exact hostnames may be added through `DRIVE_JSON_IMAGE_FETCH_HOSTS` (comma-separated; no wildcards). Every redirect is revalidated against the same allowlist.

Remote and local files have a 25 MiB default per-image cap (`DRIVE_JSON_MAX_IMAGE_BYTES`). The response MIME type must be a supported image type. Each payload is embedded as Base64 with SHA-256 and byte-size metadata. A snapshot-only `backupStorageKey` enables the existing Drive media fallback to address these images if Neon is unavailable. The synthetic key is written only into the JSON snapshot; live Neon rows are never modified.

Deleted and quarantined media rows remain in the table snapshot as metadata, but their old image bytes are not fetched because they are not active media.

## Environment

No new configuration is needed for the project's existing Unsplash/Dicebear seed images or local `/photos` and `/images` assets. Optional settings:

```dotenv
# Additional trusted exact hostnames; defaults are always retained.
DRIVE_JSON_IMAGE_FETCH_HOSTS=

# Per-image byte limit; default 25 MiB.
DRIVE_JSON_MAX_IMAGE_BYTES=26214400

# Table JSON size limit; default 200 MiB.
DRIVE_JSON_MAX_FILE_BYTES=209715200
```

S3 variables are required only when at least one ready image row resolves to an S3 object key:

```dotenv
AWS_ENDPOINT_URL_S3=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
NEON_OBJECT_STORAGE_BUCKET=uploads
NEON_PUBLIC_ASSETS_BUCKET=public-assets
```

## Run the export

From the project root, using Node.js 24.21.0:

```bash
nvm use
npm ci
npm run drive-data:export
```

The exporter reports the number of images copied from object storage, project assets, and approved remote hosts. Unsupported hosts, missing local assets, missing S3 objects, invalid MIME types, checksum/size inconsistencies, and empty payloads still stop the backup. This prevents an incomplete JSON snapshot from being marked successful.

Then sync the resulting files to the pre-created Google Drive JSON files:

```bash
npm run backup:google-drive:full
```

## Validation performed

- Backup script and helper Node syntax checks passed.
- Media helper unit tests cover object-key parsing, local public paths, exact HTTPS host allowlisting, remote redirect rejection, remote byte limits, and deterministic snapshot keys.
- Project public image file reads were verified against the bundled `/public/photos/school-children.jpg` asset.
- The media Drive fallback now recognizes snapshot-only `backupStorageKey` values.
- Current full `.mjs` test suite: 221 passed, 15 failed, 2 skipped. The untouched input archive reports the same 15 failing test names and 2 skipped tests (211 passed), so this change added 10 passing tests and introduced no new existing-suite failures.
- Live Neon export and external image downloads were not run here because production credentials/network access are not available. A full Next.js production build was not run.
