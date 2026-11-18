# API, data-source and failover migration

## Runtime data contract

- Neon PostgreSQL is the primary source of truth for CMS reads and all writes.
- Google Drive JSON table snapshots remain an active, read-only failover source when Neon is unavailable, rate-limited, quota-exhausted or connection-limited.
- A successful Neon query that returns no row is authoritative; it must not be replaced with an older Drive row.
- Drive snapshots are accepted only when the manifest and table payload agree on table, row count and revision, and the snapshot is inside `DRIVE_READ_FALLBACK_MAX_AGE_HOURS` (default 168 hours).
- If both providers are unavailable, read endpoints use only their documented safe defaults or return a retryable error. Never invent a successful write.
- Mutations continue to require Neon. Drive JSON snapshots are not writable databases because they cannot provide PostgreSQL transactions, constraints, locking or conflict detection.

## Public API migration

| Retired endpoint | Replacement |
| --- | --- |
| `GET /api/home` | `GET /api/site?slug=%2F` |
| `GET /api/footer` | `GET /api/site?slug=%2F` (read `global.footer`) |
| `GET /api/pages?slug=...` | `GET /api/site?slug=...` |
| `GET /api/news` | `GET /api/site?slug=%2Fnews` (read the page feed) |

The retired routes return HTTP 410 with a `Link` successor header. Current clients use the consolidated site snapshot and the dedicated navigation endpoint. Remove any external integrations still calling a retired endpoint before the next major release.

## API/data efficiency improvements

- Cache the recursive navigation tree independently for 60 seconds and invalidate it on navigation mutations.
- Coalesce concurrent Google Drive manifest/table reads and cache verified snapshots briefly; retain the last validated snapshot during transient Drive failures.
- Use a single database-first/Drive-second settings reader for theme, footer, website essentials and CMS JSON documents.
- Coalesce public website-essentials requests in the browser and start the TTL after the response resolves.
- Cache the public job application form schema for five minutes; admin writes invalidate the cache immediately.
- Avoid the redundant immediate navigation refresh when an SSR site snapshot already contains current navigation; refresh remains available after focus/visibility changes.

## Migration commands

No SQL schema migration is required for this API and failover change: it reuses the existing `site_settings`, `nav_items`, `nav_groups` and `pages` tables and existing Drive snapshot format.

After deploying the code:

```bash
npm ci
npm run test:functional
npx tsc --noEmit
npm run build
```

Run a new snapshot after deployment or after a large CMS content update:

```bash
npm run backup:google-drive
```

Check the manifest and each exported table JSON before relying on a snapshot for recovery. Do not point application writes at Drive snapshots.
