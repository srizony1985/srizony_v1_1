# Srizony Foundation CMS — Performance, Unused Code & API Security Audit

**Audit basis:** static source inspection of the supplied Srizony v1.2 project archive. This is not a penetration test and does not include production logs, live Neon query plans, Vercel telemetry, browser profiles, DNS/TLS scans, or gateway credentials. Findings below distinguish confirmed source behavior from items that require deployment verification.

## Executive summary

- The source contains **50 Next.js API route handlers** under `app/api`.
- Most CMS mutation routes use the shared admin session guard, role checks, input validation and audit logging.
- Public routes without an admin guard are not automatically vulnerabilities: public website reads, job applications, visitor tracking, OAuth callbacks and payment callbacks must be callable by the public or a third-party provider. They need endpoint-specific abuse and data-exposure controls instead.
- Four routes need explicit disposition because no in-repository feature caller was found: `/api/admin/data-provider`, `/api/admin/entities`, `/api/admin/form-users`, and the retired `/api/admin/theme` route. `/api/security/csp-report` has a configuration-level caller in `next.config.ts` (`report-uri`) and is not dead.
- Highest-priority risks: broad raw-table read access at `/api/admin/entities`; personal-data exposure at `/api/admin/form-users`; visitor-event write amplification at `/api/visitors`; reliance on proxy IP configuration for rate limits; and a report-only (not enforcing) CSP.
- No TSX component file was found with zero import/render references in the static component-reference scan. A small set of exported helper functions has only a declaration-level text reference and is listed for manual review—not automatic deletion.

## 1. Method and limitations

The audit inspected route handlers, imports, API client wrappers, the API registry, CMS guards, session signing, request-size controls, public rate limiting, storage access, and Next.js security headers. Static reference searches can miss framework conventions (`generateViewport`), dynamic imports, route callbacks, indirect invocation, package consumers and external provider callbacks. Therefore, a route with no direct UI fetch is classified as **no in-repo feature caller found**, not proven unreachable.

A production security conclusion also depends on environment variables, hosting proxy behavior, database grants, object-storage bucket policy, gateway configuration and deployed migrations. Those settings cannot be verified from source alone.

## 2. API inventory and reachability

### CMS/admin APIs

| Route | Methods | In-repo integration / purpose | Access assessment |
|---|---|---|---|
| `/api/admin/cms-pipeline` | GET, PUT | CMS pipeline screen | Admin guard; validated writes; audit log |
| `/api/admin/content` | GET, PUT | Legacy content API used by page-builder/portfolio clients | CMS session guard; review legacy data model before removal |
| `/api/admin/content/index` | GET | Page/menu index | Session guarded |
| `/api/admin/dashboard` | GET | Dashboard metrics | Session guarded |
| `/api/admin/data-provider` | GET, POST | No feature caller found; reports fixed Neon provider and rejects switching | Admin guarded; low direct exposure; likely obsolete UI/API surface |
| `/api/admin/database` | GET | Database/table inventory | Session guarded |
| `/api/admin/database/drive-backups` | GET, POST | Backup history, manual backup and restore | Admin guarded; destructive restore requires extra verification |
| `/api/admin/database/export` | GET | CMS data export | Admin guarded; exported data is sensitive |
| `/api/admin/database/import` | POST | CMS data import | Admin-only; bounded 20 MB body, table/column/PK preflight, transactional import |
| `/api/admin/donations` | GET | Donation reports | Session guarded; financial/PII data |
| `/api/admin/entities` | GET, POST, PATCH, DELETE | No in-repo UI caller found; GET exposes raw rows from an allowlist of tables; writes return disabled | **High risk / remove or restrict**; see findings below |
| `/api/admin/footer` | GET, PUT | Footer settings editor | Admin/editor guard; normalized JSON; audit log |
| `/api/admin/form-users` | GET | No in-repo UI caller found; returns up to 500 form-user records | **High privacy risk / remove or admin-only** |
| `/api/admin/job-application-form` | GET, PUT | Job application form builder | Admin/editor guard; validated configuration; audit log |
| `/api/admin/jobs` | GET, PATCH | Jobs and applications management | Role guarded; validate every action and preserve audit trail |
| `/api/admin/login` | POST | CMS sign-in | Public by design; bounded body, schema validation, login rate limit, hashed keys, signed cookie |
| `/api/admin/media/upload` | POST | CMS media upload | Session guarded; audit log; verify bucket policy and file limits in deployed configuration |
| `/api/admin/navigation` | GET, POST, PUT, PATCH, DELETE | Navigation editor and footer link picker | GET session guarded; mutations admin/editor guarded, Zod validation and audit log |
| `/api/admin/session` | GET, DELETE | Session status/logout | Session-aware |
| `/api/admin/site-content` | GET, POST, PUT, PATCH, DELETE | CMS content CRUD | Admin/editor guard; validation and audit logging |
| `/api/admin/submissions` | GET, PATCH | Enquiry/submission management and reports | Session/role guarded; contains personal data |
| `/api/admin/theme` | GET, PUT | Retired endpoint; returns HTTP 410 | No active feature should call it; safe retirement response |
| `/api/admin/theme/typography` | GET, PUT | Single site-theme typography editor | Admin/editor guard; audit log |
| `/api/admin/users` | GET, POST, PATCH, DELETE | CMS user administration | Admin guard; audit log |
| `/api/admin/visitors` | GET | Visitor analytics report | Session guarded |

### Public, callback and integration APIs

| Route | Methods | Purpose / trigger | Access assessment |
|---|---|---|---|
| `/api/auth/callback/google` | GET | Google OAuth redirect callback | Public callback by design; validate state/PKCE and cookie integrity |
| `/api/auth/email` | POST | Email verification/enquiry flow | Public flow with verification challenge and bounded/schema-validated input; confirm delivery-provider throttling in production |
| `/api/auth/me` | GET, DELETE | Current form-user session | Signed session cookie |
| `/api/auth/start` | POST | Start Google OAuth flow | Bounded body, schema, safe return path and public rate limits |
| `/api/cron/maintenance` | GET | Vercel cron from `vercel.json` | Bearer `CRON_SECRET`; configure secret and ensure platform cron auth is active |
| `/api/donations/callback` | GET, POST | SSLCommerz return/IPN callback | Public provider callback; financial state changes require server-side gateway validation, transaction ID, amount and currency match |
| `/api/donations/initiate` | POST | Public donation checkout | Strict schema, bounded body, idempotency key, rate limits, HTTPS production URL and gateway host allowlist |
| `/api/footer` | GET | Public footer snapshot | Public read; cache headers appropriate for non-personal data |
| `/api/home` | GET | Public home snapshot | Public read |
| `/api/jobs/application-form` | GET | Published job form schema | Public read; only published configuration should be exposed |
| `/api/jobs/apply` | POST | Public job application form | Same-origin check, schema/custom-field validation, honeypot and rate limit; verify trusted proxy IP configuration |
| `/api/jobs/resume` | POST | Public PDF resume upload | Same-origin check, 4 MB cap, MIME/extension/PDF-signature checks, private storage and one-time 30-minute token; verify trusted proxy IP configuration |
| `/api/map-boundaries` | GET | Location map boundary data | Public read; cache static boundary data where possible |
| `/api/media/[id]` | GET | Protected applicant resume/media retrieval | Requires authenticated CMS session; private media must remain private in object storage |
| `/api/media/by-key/[...key]` | GET | Legacy public-image URL compatibility | DB row must be ready, public and image-kind; key traversal checks; no private media by key alone |
| `/api/media` | GET | Public media catalogue | Public read; ensure only public media metadata is returned |
| `/api/navigation` | GET | Public navigation snapshot | Public read |
| `/api/news` | GET | Public news feed | Public read |
| `/api/pages` | GET | Public page feed | Public read |
| `/api/queries` | POST | Enquiry submission | Requires verified form-user session, email match, schema validation and daily limit |
| `/api/security/csp-report` | POST | Browser CSP reports via `next.config.ts` report-uri | Public by design; bounded body and global/IP rate limits; logs only selected fields |
| `/api/site` | GET | Public site snapshot and CMS content data | Public read; verify response contains no unpublished/private data |
| `/api/theme` | GET | Public theme configuration | Public read |
| `/api/visitors` | POST | Browser visitor/page-view tracking | **Abuse/performance risk**; public write endpoint currently has schema checks but no visible rate limit in route |
| `/api/website-essentials` | GET, PUT | Public essentials and CMS editor | GET returns published staff publicly and drafts to authorized editors; PUT admin/editor guarded and validated |

## 3. Unused or potentially unreachable code

### API routes with no feature caller found

1. **`GET/POST /api/admin/data-provider`** — no UI/API client call was found. The endpoint only reports Neon as fixed and rejects provider switching. It is authenticated but adds an unused API surface. Remove it if the database settings page no longer displays provider status; otherwise add an explicit read-only UI use.
2. **`GET /api/admin/entities`** — no in-repo UI caller was found. The route exposes raw table rows and schema metadata. It should not remain as a dormant, broadly readable data-browser API. Remove it or implement a purpose-built admin-only UI with sensitive-table exclusions and column-level redaction.
3. **`GET /api/admin/form-users`** — no in-repo UI caller was found. It returns form-user records and personal information. Remove it if no longer required; otherwise restrict to admin, paginate, minimize fields and add audit logging.
4. **`GET/PUT /api/admin/theme`** — retired endpoint returning 410. It is safe as a compatibility tombstone but should be removed from the API registry and clients if no legacy integrations depend on it.

`/api/security/csp-report` has no in-app fetch call, but `next.config.ts` configures it as the CSP report URI. It is an externally triggered endpoint, not dead code.

### Exported helper candidates for manual review

A repository-wide text-reference scan found these exported declarations with no other textual reference. This does **not** prove they are dead: framework conventions, re-exports, dynamic access, scripts and indirect references can be missed. Do not delete without checking the call graph and tests.

- `lib/footerDisplay.ts`: `getFooterDisplay`
- `lib/themeTypography.ts`: `normalizeThemeTypographyCollection`
- `lib/themeDisplay.ts`: `getThemeDisplay`
- `lib/navigationDisplay.ts`: `getNavigationDisplay`
- `lib/mediaDisplay.ts`: `getMediaDisplay`
- `lib/contentPageDisplay.ts`: `getPage`, `getPageDisplay`, `getAllPagePaths`
- `lib/utils.ts`: `localizeText`
- `lib/site.ts`: `syncCmsMenuContent`, `deleteDocument`
- `lib/data-provider.ts`: `getSelectedDataProvider`, `setSelectedDataProvider`
- `lib/homeDisplay.ts`: `getHomeDisplay`
- `lib/google/drive.ts`: `writeDriveJson`
- `lib/cms/components.ts`: `getContentCollectionRoute`
- `lib/cms/routes.ts`: `inspectTopLevelMenuSlug`, `normalizeCmsRoutePath`
- `lib/db/submit.ts`: `saveSubmission`
- `app/layout.tsx`: `generateViewport` is a Next.js framework convention and must not be removed because a plain text search finds only its declaration.

The static component import/render scan found no component file with zero in-repository import/render references. A full semantic dead-code pass (TypeScript program/checker plus framework-aware entry-point rules) is still recommended before deleting helpers.

## 4. Security findings and priority

### High priority

**H1 — Raw entity API exposes sensitive tables to all CMS roles.** `app/api/admin/entities/route.ts` allows `admin`, `editor` and `analyst` sessions to request rows from an allowlist that includes `form_users`, `submissions`, `donations`, `cookie_consents`, visitor records and other operational tables. It uses `SELECT *`. The route has no in-repo feature caller. Recommendation: disable/remove this endpoint or restrict it to admin with a strict table/column allowlist, PII redaction, pagination, audit logging and access justification.

**H2 — Form-user endpoint exposes PII without role separation and has no caller.** `app/api/admin/form-users/route.ts` checks for a session but does not restrict role, and returns up to 500 full records. Recommendation: remove if unused; otherwise require admin, return only required fields, paginate, audit access and apply retention controls.

**H3 — Visitor tracking write endpoint can be abused for database amplification.** `/api/visitors` accepts public POSTs and writes both `site_visitors` and `visitor_events`; route-level rate limiting is not visible. Recommendation: apply global, trusted-IP and visitor/session-subject limits; validate referrer as a bounded URL; cap path/referrer lengths; sample or aggregate high-volume events; monitor write volume and retention.

### Medium priority

**M1 — Trusted client IP header must be configured correctly.** `requestIp()` only trusts one explicitly configured header from an allowlist (`x-vercel-forwarded-for`, `cf-connecting-ip`, `x-real-ip`). If `TRUSTED_CLIENT_IP_HEADER` is absent/incorrect, it returns `unknown`. Some job upload/application rate limits then share one `unknown` bucket, which can throttle legitimate users together. Recommendation: configure the exact header that the hosting proxy strips and overwrites; test from production; never trust arbitrary client-supplied `X-Forwarded-For`.

**M2 — CSP is report-only, not enforcing.** `next.config.ts` sends `Content-Security-Policy-Report-Only` and allows broad `https:` script/connect/frame sources plus `unsafe-inline`. This is useful for observation but does not block violations. Recommendation: review CSP reports, replace broad sources with explicit provider domains/nonces or hashes, then enforce `Content-Security-Policy` after compatibility testing.

**M3 — Explicit CSRF/Origin policy is not uniform across every admin mutation.** The admin cookie is HttpOnly, SameSite=Lax and Secure in production, and session validation is robust; however, not every unsafe admin route visibly validates `Origin` or a CSRF token. Recommendation: add a shared same-origin/CSRF guard for POST/PUT/PATCH/DELETE admin requests, accounting for legitimate same-site deployments.

**M4 — Maintenance cron depends entirely on `CRON_SECRET`.** The endpoint fails closed if the secret is absent and compares the Bearer value, which is good. Confirm the Vercel cron is configured to send the expected authorization header and rotate the secret if exposed.

### Lower priority / operational hardening

- HSTS currently uses `max-age=31536000`; consider `includeSubDomains` only after confirming every subdomain is HTTPS-capable. Preload requires separate operational commitment.
- CSP report endpoint logs a small selected subset and is bounded/rate-limited; continue monitoring for log-volume abuse.
- Ensure private resume bucket policy blocks public reads, even if application routes enforce authentication.
- Ensure backups, exported database JSON, and restore archives are stored in private Drive folders with least-privilege service-account access and retention controls.
- Keep `CMS_SESSION_SECRET`/`AUTH_SECRET`, OAuth client secrets, SSLCOMMERZ credentials, `CRON_SECRET`, storage credentials and database URLs in deployment secrets only. Do not put them in the client bundle, CMS content, exported site settings or backup manifests.

## 5. Security controls that are implemented well in source

- CMS session token uses HMAC-SHA256 and timing-safe signature comparison, 12-hour expiry, HttpOnly cookie, SameSite=Lax and Secure in production.
- `getAdminSession()` rechecks current database role, status and `session_version`, allowing revocation after account changes; database-backed authorization fails closed when current state cannot be checked.
- Shared `requireAdmin()` centralizes session and role enforcement.
- Many mutation routes use Zod schemas, bounded field lengths and `safeParse` before writes.
- Admin mutation paths commonly write audit records.
- Database import is admin-only, body-bounded, table/column constrained, primary-key preflighted and applied through a transaction.
- Job resume upload validates same-origin browser requests, size, extension, MIME type and PDF signature; the object is private and the upload token is hashed, short-lived and one-time.
- Legacy media-by-key route checks the matching database record is ready, public and image-kind before serving; it rejects traversal segments.
- Donation initiation uses bounded JSON, strict schema, amount bounds, idempotency keys, public rate limits and a gateway-host allowlist. Callback processing validates the transaction server-to-server and compares transaction ID, amount and currency before marking success.
- OAuth start uses state, PKCE and safe same-origin return paths; it is rate-limited.
- CSP reporting is body-bounded and rate-limited; reports are treated as untrusted input.

## 6. Performance/API recommendations

1. Add rate limiting and sampling/aggregation to `/api/visitors`; this is likely the most important public write-volume optimization.
2. Add Vercel route-level invocation/duration monitoring for `/api/site`, `/api/navigation`, `/api/visitors`, `/api/jobs/apply`, `/api/jobs/resume`, donation endpoints and admin dashboard APIs.
3. Use Neon Query Insights to identify repeated query patterns, slow scans, connection saturation and index gaps; source inspection alone cannot measure query latency.
4. Preserve short shared caching for public, non-personal snapshots; keep admin and user-specific responses `no-store`.
5. Keep large media bytes out of JSON snapshots and database records; serve public media from the public asset bucket/CDN and private resumes through authenticated routes.
6. Paginate admin tables and avoid `SELECT *` for PII-heavy datasets.
7. Remove or document no-caller endpoints after confirming there are no external consumers.
8. Add an automated API contract test that compares route handlers with `lib/apiRegistry.ts` and flags missing/retired/stale entries.
9. Run browser performance recordings and compare CPU, layout, paint, image decode, long tasks and hydration before/after deployment.

## 7. Suggested remediation order

| Priority | Action | Reason |
|---|---|---|
| P0 | Restrict/remove `/api/admin/entities` and `/api/admin/form-users` | Minimize dormant PII/raw-table exposure |
| P0 | Configure and verify `TRUSTED_CLIENT_IP_HEADER` | Public rate limits need real client identity |
| P1 | Add rate limits to `/api/visitors` | Reduce database write amplification and abuse |
| P1 | Add shared CSRF/Origin validation for admin mutations | Uniform browser mutation protection |
| P1 | Move CSP from report-only to enforcement after allowlist tuning | Turn observation into an actual browser control |
| P2 | Remove/mark stale API routes in `lib/apiRegistry.ts` | Keep CMS API inventory accurate |
| P2 | Verify private object storage and Drive permissions | Protect resumes and backup data |
| P2 | Run semantic dead-code analysis and remove confirmed unused exports | Reduce maintenance surface safely |
| P3 | Profile Vercel and Neon in production | Establish measured performance baselines |

## 8. Verification still required in production

- Confirm the production deployment has `CMS_SESSION_SECRET` or `AUTH_SECRET`, `DATABASE_URL`, `TRUSTED_CLIENT_IP_HEADER`, `CRON_SECRET`, OAuth secrets, payment credentials and storage credentials configured correctly.
- Confirm the trusted proxy overwrites the configured IP header.
- Confirm private media bucket ACL/policy and signed/private object behavior.
- Test unauthorized and wrong-role access to every `/api/admin/*` route.
- Test CSRF attempts from a different origin against admin mutations.
- Test donation callback replay, mismatched amount/currency, invalid `val_id` and duplicate callback delivery.
- Test resume token reuse, expiry, oversized files, MIME spoofing and unauthenticated resume retrieval.
- Review CSP reports and enforce a strict policy only after external payment/OAuth/media providers are allowlisted.
- Capture Vercel and Neon metrics for at least one representative traffic window.

**Conclusion:** The codebase has a solid baseline for session signing, role checks, request validation, private resume handling and payment validation. The most actionable risks are the dormant raw-table and form-user read APIs, visitor write amplification, trusted proxy IP configuration and non-enforcing CSP. The remaining dead-code list is a manual-review queue, not a deletion instruction.
