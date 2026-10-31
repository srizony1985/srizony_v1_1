#!/usr/bin/env bash
set -Eeuo pipefail

# Full, timestamped backup of PostgreSQL plus both object-storage buckets.
# Use a dedicated backup bucket; never back up a bucket into itself.
: "${BACKUP_DATABASE_URL:?Set BACKUP_DATABASE_URL to a direct, non-pooled PostgreSQL connection URL}"
: "${AWS_ENDPOINT_URL_S3:?Set AWS_ENDPOINT_URL_S3 to the S3-compatible storage endpoint}"
: "${AWS_REGION:?Set AWS_REGION}"
: "${AWS_ACCESS_KEY_ID:?Set AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set AWS_SECRET_ACCESS_KEY}"
: "${BACKUP_S3_BUCKET:?Set BACKUP_S3_BUCKET to a dedicated backup bucket}"

PRIVATE_BUCKET="${NEON_OBJECT_STORAGE_BUCKET:-uploads}"
PUBLIC_BUCKET="${NEON_PUBLIC_ASSETS_BUCKET:-public-assets}"
PREFIX="${BACKUP_S3_PREFIX:-srizony-production}"
PREFIX="${PREFIX#/}"
PREFIX="${PREFIX%/}"

if [[ "$BACKUP_S3_BUCKET" == "$PRIVATE_BUCKET" || "$BACKUP_S3_BUCKET" == "$PUBLIC_BUCKET" ]]; then
  echo "BACKUP_S3_BUCKET must be separate from the private/public source buckets." >&2
  exit 2
fi
if [[ "$PRIVATE_BUCKET" == "$PUBLIC_BUCKET" ]]; then
  echo "The private and public source bucket names must be different." >&2
  exit 2
fi
for command_name in pg_dump aws sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "Required command not found: $command_name" >&2; exit 127; }
done

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/srizony-backup.XXXXXXXX")"
DEST="s3://${BACKUP_S3_BUCKET}/${PREFIX}/${STAMP}"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

# The application's S3 client uses path-style addressing for Neon-compatible storage.
# Mirror that behavior in AWS CLI so both source and destination bucket URLs resolve.
cat > "$WORK_DIR/aws-config" <<CONFIG
[default]
region = ${AWS_REGION}
s3 =
    addressing_style = path
CONFIG
export AWS_CONFIG_FILE="$WORK_DIR/aws-config"

printf 'Creating PostgreSQL backup (%s)…\n' "$STAMP"
pg_dump --format=custom --no-owner --no-privileges --file "$WORK_DIR/database.dump" "$BACKUP_DATABASE_URL"
test -s "$WORK_DIR/database.dump"
(cd "$WORK_DIR" && sha256sum database.dump > database.dump.sha256)
cat > "$WORK_DIR/manifest.txt" <<MANIFEST
backup_utc=${STAMP}
database_file=database.dump
database_format=pg_dump-custom
private_storage_bucket=${PRIVATE_BUCKET}
public_storage_bucket=${PUBLIC_BUCKET}
MANIFEST

aws --endpoint-url "$AWS_ENDPOINT_URL_S3" s3 cp "$WORK_DIR/database.dump" "$DEST/database.dump" --only-show-errors
aws --endpoint-url "$AWS_ENDPOINT_URL_S3" s3 cp "$WORK_DIR/database.dump.sha256" "$DEST/database.dump.sha256" --only-show-errors
aws --endpoint-url "$AWS_ENDPOINT_URL_S3" s3 cp "$WORK_DIR/manifest.txt" "$DEST/manifest.txt" --only-show-errors

printf 'Backing up private media bucket: %s…\n' "$PRIVATE_BUCKET"
aws --endpoint-url "$AWS_ENDPOINT_URL_S3" s3 sync "s3://${PRIVATE_BUCKET}/" "$DEST/storage/${PRIVATE_BUCKET}/" --only-show-errors
printf 'Backing up public media bucket: %s…\n' "$PUBLIC_BUCKET"
aws --endpoint-url "$AWS_ENDPOINT_URL_S3" s3 sync "s3://${PUBLIC_BUCKET}/" "$DEST/storage/${PUBLIC_BUCKET}/" --only-show-errors

printf 'Backup completed: %s\n' "$DEST"
