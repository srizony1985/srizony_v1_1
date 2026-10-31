# Srizony Foundation — Functional Test Results

**Run date:** 2026-10-29
**Scope:** updated source package + dependency-light application validation tests
**Status:** 34 source-contract and validation tests passed using Node.js built-in TypeScript stripping with temporary explicit `.ts` import extensions. The normal npm script, lint, production build and database-backed flows remain unverified because dependency installation could not reach the npm registry (`EAI_AGAIN`).

## Test summary

- Functional and source-contract test cases: **34 passed / 0 failed** in the dependency-light runner.
- TypeScript/TSX syntax transpilation: **211 files checked / 0 syntax errors**.
- `package.json` and Drizzle migration journal JSON parsing: **passed**.
- CSS brace-balance check: **passed**.
- Backup shell script passes `bash -n`; backup GitHub Actions workflow parses as YAML.
- Demo PDF fixture signatures: **3/3 valid**.

## Covered source contracts

- Canonical route helpers return `/item` for landing content, `/menu/item` for a menu page, and `/menu/submenu/item` for a submenu page. Parent-route parsing supports the corresponding URL depths.
- Content destination routes are limited to `/`, `/menu`, and `/menu/submenu`; the CMS database/runtime schema uses a route-scoped `(routeParent, slug)` unique index rather than the old global `(component, slug)` index.
- The CMS migration creates collection pages even when navigation rows are missing, and ensures Career / Jobs is a published main-navigation item at `/carrer-job`.
- Internal navigation slug collisions with existing content are rejected, and internal menu creation saves an initial sectioned page.
1. Job detail pages render the bilingual application form.
2. Form requires applicant name/email/PDF, uploads the file before application submission, and sends the one-time upload token.
3. Resume upload code enforces PDF signature/type/size, private storage, rate limiting and an expiring token.
4. Application API checks same-origin browser requests, field rules, honeypot, rate limit, job availability/deadline and response reference.
5. Admin Job Management reads application rows and links to the authenticated media endpoint.
6. Demo seeding is opt-in and refuses `NODE_ENV=production`.
7. Website Essentials supports editable social links, staff, locations and blank-by-default document links.
8. Location map consumes CMS location records and styles selected/head-office markers responsively.
9. Career route aliases resolve to `/carrer-job`; published jobs feed the public listing and link to `/carrer-job/{job-slug}`.
10. Navigation endpoints provide admin-protected create/update/reorder/delete, internal menu creation saves a page document with sections, and menu routes cannot collide with existing content URLs.
11. Public PDF upload requires editor/admin access and validates PDF signature, size and visibility.
12. Maintenance endpoint checks `CRON_SECRET`, and database status access is admin-only.
13. Field-level validation rejects invalid names/emails, excessively long optional fields, filled honeypots, malformed/empty PDFs and expired deadlines.
14. Upload filename normalization preserves a valid `.pdf` extension and removes path traversal segments.

## Demo fixtures

- `tests/fixtures/demo-resume.pdf`
- `tests/fixtures/demo-staff-list.pdf`
- `tests/fixtures/demo-working-locations.pdf`

The documents are intentionally fictional preview fixtures. Do not use them as official staff/branch publications.

## Environment-dependent checks still required

- Restore npm registry/network access, install dependencies with `npm ci`, then run `npm run test:functional`, `npm run lint`, and `npm run build`.
- Apply migrations to local/staging using `npm run db:migrate`.
- Configure a non-production database and private/public object storage, seed only with `ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY`, and test upload/submission/admin access end-to-end.
- Confirm resumes return `401` while logged out and open for the authorized admin/editor.
- Configure repository secrets/variables and a private destination bucket for `.github/workflows/production-backup.yml`, then perform a database/object-storage restore test in the hosting environment. Source code cannot prove that scheduled backups are running or restorable.

The 34 passing tests are source-level checks, not a claim that the live website or external services have been exercised. The normal `npm ci`/`npm run` toolchain still needs to be run in an environment with registry access.
