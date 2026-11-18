# CMS data storage and provider boundary

## Runtime behavior

Neon PostgreSQL is the primary source of truth for relational CMS content, navigation, settings, form submissions, CMS users, donations and analytics. Google Drive JSON table snapshots are an active **read-only failover source for supported public CMS reads** when Neon is unavailable because of network errors, quota exhaustion, rate limiting or connection limits.

The Drive fallback is not a write database. It cannot provide PostgreSQL transactions, uniqueness constraints, row locks or conflict detection. All CMS mutations, form submissions, donations and other transactional operations must commit to Neon. If Neon is unavailable, write endpoints return a retryable service error; the application must never report a Drive snapshot write as saved.

## Failover safety rules

- A successful Neon read is authoritative, including a successful lookup that returns no row. Do not replace a missing Neon record with an older Drive value.
- Use Drive only after Neon is unavailable or not configured for supported read paths.
- Validate `backup-manifest.json` and the corresponding table JSON before use. Table identity, row count and revision must agree.
- Respect `DRIVE_READ_FALLBACK_MAX_AGE_HOURS` (default 168 hours). A snapshot that is too old or fails validation is not served.
- Cache validated snapshots briefly and coalesce concurrent Drive fetches. If Drive temporarily fails, retain the last still-valid snapshot already held in process memory.
- When Neon recovers, new reads return to Neon automatically. A Drive fallback is never copied into Neon automatically; restoring a snapshot must remain an explicit, reviewed recovery action.
- Public pages may use documented safe defaults if neither source is available. Admin edits and transactional actions must fail clearly rather than silently degrade to read-only mode.

## Supported fallback scope

The public page/global document repository, CMS navigation, published content catalogues, and named `site_settings` documents (theme typography, footer, website essentials, and job-application-form schema) can read from verified Drive table snapshots. Sensitive transactions and private records remain Neon-only.

## Production configuration

- Configure `DATABASE_URL` as a secret and use a Neon connection string appropriate to the deployed runtime.
- Configure Google service-account credentials and `GOOGLE_DRIVE_FOLDER_ID` (or `SCARLETLABS_DRIVE_FOLDER_ID`) for the dedicated backup folder.
- Keep `DRIVE_READ_FALLBACK_MAX_AGE_HOURS` conservative for content freshness; the default is seven days.
- Apply committed Drizzle migrations before deploying code that depends on new columns or tables.
- Generate and verify Drive JSON mirrors after substantial content updates, and retain full point-in-time backups separately.

The authenticated `GET /api/admin/data-provider` endpoint continues to report Neon as the primary write provider. It does not imply that Drive fallback is disabled: Drive remains configured and available to the explicit read-failover layer.
