# Google Drive runtime failover — Srizony v1.2

> **Scope:** This release supports validated Google Drive read failover and backup/recovery. It does not make CMS mutations writable to Drive. See [the full datastore migration plan](./GOOGLE_DRIVE_FULL_DATASTORE_MIGRATION_PLAN.md) before attempting a Drive-only writable deployment.

## Operational model

- Neon PostgreSQL is the transactional primary.
- Google Drive JSON table mirrors provide verified, read-only runtime failover for public site content and supported CMS reporting/inspection views.
- Google Drive full archives remain the point-in-time restore mechanism.
- Object storage remains the normal media-write store. Images embedded in `media_items.json` may be served from Drive when the primary metadata/object storage is unreachable.

## Runtime signals

`GET /api/admin/data-provider` reports one of:

- `neon-primary`: Neon accepted a health query; normal writes are enabled.
- `google-drive-read-only`: Neon is unavailable and the Drive manifest contains at least one recent snapshot. CMS reads are available; writes remain disabled.
- `unavailable`: no usable primary or Drive snapshot can be verified.

The CMS header polls this state every 60 seconds. The database-status route uses the manifest index, not a full download of all table files. API read responses sourced from Drive include `X-Srizony-Data-Source: google-drive-snapshot` and snapshot timestamps where relevant.

## Drive setup

1. Prefer a Google Shared Drive folder. Grant the service account Contributor/Content manager permissions and ensure it can read/update mirror files and create full archives.
2. Configure `GOOGLE_DRIVE_FOLDER_ID` and one service-account credential option: `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, `GOOGLE_SERVICE_ACCOUNT_JSON`, or the email/private-key pair.
3. Pre-create the JSON mirror files listed by `npm run backup:google-drive:list` in that folder. The mirror job updates these files; it does not create missing table files.
4. Configure `DRIVE_READ_FALLBACK_MAX_AGE_HOURS=168` and `DRIVE_READ_FALLBACK_CACHE_MS=180000` (or a stricter freshness/cache window based on your outage policy).
5. Configure a secure emergency admin with `CMS_ADMIN_USERS_JSON` and `CMS_SESSION_SECRET`. Keep the credential only in the hosting secret store.
6. Run `npm run backup:google-drive:full` from an environment with a direct PostgreSQL connection and confirm the manifest/table timestamps update.

## Supported degraded-mode reads

Public pages, navigation, published content, CMS navigation/content inspection, job and application listing, dashboard and report views, settings documents, footer/theme settings and verified public image payloads are backed by the Drive mirror. The admin interface marks this data as stale/read-only and shows the source.

## Operations that still require the primary database

CMS create/update/delete, menu edits, user provisioning and role changes, login/session revocation for database users, media uploads, public submissions, job applications, donation creation and payment callbacks require transactional storage. They fail closed during a Neon outage. A Drive snapshot is never mutated and the application never returns a false “saved” response for a mutation that could not be committed.

## Why the current system is not a writable Drive database

The CMS uses SQL joins, transactions, foreign keys, uniqueness, atomic counters, idempotency and row-level conflict handling. A Drive JSON file patch cannot provide those guarantees, particularly when multiple independent serverless function instances handle requests concurrently. To make Drive the writable authority, all reads and writes would have to move to a dedicated serialized coordinator plus append-only journal, replay, conflict detection and compaction. This is a separate application-wide storage migration and must be load-tested before production. For fully writable high-availability CMS operations, configure a second transactional database and keep Drive as a backup/failover read source.
