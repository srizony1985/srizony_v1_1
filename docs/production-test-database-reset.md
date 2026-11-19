# Reset and seed a disposable production-test database

> **Destructive operation.** These commands delete all application objects and rows in the PostgreSQL `public` schema and the Drizzle `drizzle` migration schema. Run them only against a dedicated disposable Neon branch/database, never the live primary database.

## 1. Install dependencies and select the test branch

Use the direct (non-pooled) connection URL for the dedicated test branch. Keep it out of Git and chat history. This project pins Node.js **24.21.0** in `.nvmrc`; select that version before installing packages.

```bash
nvm install
nvm use
node --version   # expected: v24.21.0
npm ci
export NODE_ENV=production
export DATABASE_URL='postgresql://USER:PASSWORD@DIRECT-TEST-BRANCH-HOST/DBNAME?sslmode=require'
export BACKUP_DATABASE_URL="$DATABASE_URL"
```

For `.env.production.local`, set `DATABASE_URL` there and let the Node scripts load it through `@next/env`. `pg_dump` does not load Next.js environment files itself, so export `BACKUP_DATABASE_URL` in the shell before running a database backup.

## 2. Back up before reset

Database-only backup:

```bash
mkdir -p backups
BACKUP_FILE="backups/srizony-before-reset-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-privileges \
  --file "$BACKUP_FILE" \
  "$BACKUP_DATABASE_URL"
pg_restore --list "$BACKUP_FILE" | head -30
```

For the project's full PostgreSQL + private/public object-storage backup, configure `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BACKUP_S3_BUCKET`, and the source bucket names, then run:

```bash
npm run backup:production
```

The backup bucket must be different from both source media buckets.

## 3. Inspect the exact target (read-only)

```bash
npm run db:reset-and-seed -- --print-target
```

The command prints the database name, host, current schema, and an exact confirmation token in the form `DATABASE@HOST`. This step performs no reset.

Check that the host/database are the disposable test branch. If the script reports relations outside `public`/`drizzle`, stop and review them; the reset deliberately refuses to wipe unexpected schemas.

## 4. Drop the application database schema, migrate, and seed

Replace the placeholder below with the exact `Confirm` token printed in step 3:

```bash
ALLOW_PRODUCTION_DB_RESET=true \
DISPOSABLE_TEST_DATABASE=true \
npm run db:reset-and-seed -- \
  --confirm-reset \
  --confirm-target 'DATABASE@HOST'
```

The script then:

1. Re-checks the target and destructive confirmation.
2. Drops and recreates the PostgreSQL `public` schema.
3. Drops the Drizzle migration-ledger schema.
4. Runs `npm run db:init` to replay every committed Drizzle migration.
5. Runs `npm run db:seed` to load the committed Srizony dataset (pages, menus, global settings, CMS catalogue content and seed media metadata).

The reset command removes all application objects and rows inside `public`, plus the Drizzle migration ledger in `drizzle`. It is intentionally not a whole-cluster wipe: it does **not** drop PostgreSQL roles, Neon/provider-managed schemas, other user-created schemas, or object-storage buckets/files. If it detects application-like relations in another schema, it refuses to run. Uploaded object-storage files are left untouched; their database metadata in `public` is reset.

## Optional: restore the supplied curated CMS recovery pack

The project also contains a curated local recovery pack in `drive-data/`. Its manifest is dated **2026-11-09** and contains 10 validated table snapshots (740 rows). It is not a complete database backup: it does not restore page/menu snapshots, admin credentials, job applications or resume uploads, and it reconstructs media metadata without the original image binaries. It does contain historical CMS content and audit data, so keep it private and use it only on a protected test branch.

To rebuild the schema, seed the committed structural data, then replace the overlapping content/media/contact tables with that curated snapshot and seed the CMS registry, run this instead of step 4:

```bash
ALLOW_PRODUCTION_DB_RESET=true \
DISPOSABLE_TEST_DATABASE=true \
ALLOW_PRODUCTION_JSON_RESTORE=true \
npm run db:reset-and-restore-local -- \
  --confirm-reset \
  --confirm-target 'DATABASE@HOST'
```

The restore script validates the complete manifest, file checksums, schema compatibility and relationships before it starts its transaction. The historical admin credentials are intentionally not restored; provision a new verified administrator separately.

Choose **one** reset mode: `db:reset-and-seed` for only the canonical source-controlled dataset, or `db:reset-and-restore-local` to additionally import the supplied 2026-11-09 recovery pack.

## 5. Validate the test deployment

```bash
npm run test:functional
npx tsc --noEmit
npm run build
```

Run these against the project checkout containing the patched code. Connect only the test deployment/preview environment to the disposable test database; do not point the live production site at it.

## Non-destructive alternatives

- `npm run db:init` — apply migrations only; it does not seed content.
- `npm run db:seed` — non-destructive seed/normalization; it preserves existing page section arrays, including explicit deletions and empty lists.
- `npm run db:reset-and-seed -- --print-target` — inspect the target only; it does not delete data.
