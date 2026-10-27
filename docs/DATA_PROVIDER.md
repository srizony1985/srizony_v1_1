# CMS data-provider and Google Drive setup

## Current architecture boundary

- Google Drive is the preferred document store for new JSON-shaped CMS documents when `DATA_PROVIDER_DEFAULT=google-drive`; Neon can also store those documents through `site_settings`.
- Neon PostgreSQL remains the relational database for the existing Drizzle repositories, CMS tables, authentication-related records, submissions, visitors, donations, and newsletter records.
- `lib/google/drive.ts` provides server-only JSON document read/write operations against a configured Google Drive folder using the Drive REST API.
- The CMS header selector stores an administrator's signed, HttpOnly provider preference. It validates Google Drive folder access before selecting Drive. `lib/cms/document-store.ts` routes JSON-shaped documents through the selected provider. It does **not** silently migrate or reroute existing Drizzle SQL queries; the remaining relational repositories must be migrated to a shared repository interface before Google Drive can replace Neon for all records. Drive JSON files are not a relational SQL database.

## Google Cloud configuration

1. Create/select a Google Cloud project and enable **Google Drive API**.
2. Create a service account and generate a key only if the deployment environment cannot use workload identity. Store the private key in deployment secrets, never in source control.
3. Create a folder in Drive, or use a folder inside a Shared Drive.
4. For a My Drive folder, share that folder with the service-account email as **Editor**. Service accounts generally cannot be the owner of files in a user's My Drive. For centrally managed, organization-owned content, use a Shared Drive and grant the service account **Content manager** or **Manager**, according to the least-privilege policy. Shared Drive roles replace the concept of a service-account-owned My Drive folder.
5. Put the folder ID in `GOOGLE_DRIVE_FOLDER_ID`. The server checks access by reading the folder metadata before switching to Drive.
6. Populate `.env.local` from `.env.example`. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` must retain newlines; when stored as one environment line, represent them as `\n`.
7. Deploy only on a Node.js runtime with outbound HTTPS access to `oauth2.googleapis.com` and `www.googleapis.com`.

## JWT / no refresh-token flow

The backend signs a short-lived RS256 JWT assertion with the service-account private key and exchanges it at Google's OAuth token endpoint for an approximately one-hour access token. The access token is cached only until shortly before expiry. No OAuth refresh token is requested, stored, or used. Google Drive calls are server-side only; the browser never receives the private key or service-account access token.

The CMS provider choice is stored in a signed HttpOnly cookie using `CMS_PROVIDER_COOKIE_SECRET` (or the configured CMS session secret fallback). It is not a Google credential. Do not expose either secret to `NEXT_PUBLIC_*` variables.

## API and cost notes

The implementation uses Google's official OAuth token endpoint and Drive API v3 over HTTPS; no paid third-party SDK is required. Google Cloud may enforce quotas and account-specific terms, so check the project's current Drive API quotas. Drive API usage is not an unlimited storage/compute guarantee; Google Drive storage limits still apply.

## Switching and migration plan

1. Keep Neon as the source of truth for relational data while validating Drive folder permissions.
2. Define repository interfaces per domain (pages/navigation, themes/settings, media metadata, submissions, users, donations, analytics) rather than pretending a JSON file is interchangeable with SQL.
3. Implement and test a Drive document repository for suitable document-shaped CMS records, including optimistic concurrency/version checks and atomic-write strategy.
4. Build a one-way export, compare row/document counts and hashes, then run a controlled dual-write/read-compare period.
5. Only change the default provider after all required repositories, transaction semantics, uniqueness constraints, backups, and rollback paths are migrated. Donations, auth, and submissions should remain relational unless their consistency requirements are explicitly redesigned.

The existing `GET /api/admin/database` route continues to report relational Neon table counts. The header selector is an initial provider-preference control and not a live migration switch for every existing table.
