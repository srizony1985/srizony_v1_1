# Functional Verification and Demo Preview Data

This patch adds the missing job application form and resume upload path, plus an explicitly opt-in demo dataset for local or staging UI walkthroughs. Demo data is fictional. It must never be seeded in production.

## What is implemented

- A bilingual application form is rendered on CMS job detail pages. It requires applicant name, email, and a PDF resume; phone and cover letter are optional.
- Resume uploads accept PDF only, verify the `%PDF-` file signature, enforce a 4 MB limit, use same-origin checks for browser requests, and apply a per-IP hashed rate limit.
- Applicant resumes are stored in the private media bucket with `is_public=false`. The upload API returns a 30-minute token; the application API hashes and claims the token once in the same SQL statement that inserts the application.
- Job applications are checked against the current published job and application deadline. Duplicate application email addresses for the same job are rejected. Successful submissions receive an `SF-JOB-000001` style reference.
- The admin Job Management screen can display applicants and open the protected `/api/media/:id` resume URL when signed in with the required role.
- Staff/locations PDF fields and staff/location/social controls remain editable in Website Essentials. Empty PDF URL values are intentional UI placeholders; no empty or invented official PDF is published.
- Demo seed inserts one clearly labeled published demo vacancy, one clearly fake sample application for the admin table, a fictional staff record, example social URLs and one demo map location. PDF document URLs remain blank until a tester uploads the included PDF fixtures.
- The demo seed has both a production guard and an explicit opt-in check. A backup of the pre-existing Website Essentials settings is stored before demo settings are applied; the cleanup command restores those settings.

## Files for manual UI checks

All are under `tests/fixtures/` and contain fictional/preview-only values:

- `demo-resume.pdf` — choose this file in the public job application form.
- `demo-staff-list.pdf` — upload to the Staff List PDF field in Website Essentials.
- `demo-working-locations.pdf` — upload to the Working Locations PDF field.

These files are test fixtures, not official organization documents. Do not publish them on the live website.

## Local or staging setup

1. Configure `.env.local` with a non-production `DATABASE_URL` and the existing Neon Object Storage variables required by `lib/storage.ts`:
   `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, plus `NEON_OBJECT_STORAGE_BUCKET` if a non-default private bucket is used.
2. Install dependencies and apply migrations:

   ```bash
   npm ci
   npm run db:migrate
   ```

3. Seed preview-only records explicitly. Run this only against a disposable local database or isolated staging database:

   ```bash
   NODE_ENV=development ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY npm run db:seed:demo
   ```

4. Run automated tests and start the app:

   ```bash
   npm run test:functional
   npm run dev
   ```

## Manual end-to-end proof

### Job posting and application submission

1. Open `/carrer-job`. The demo vacancy is titled `[DEMO PREVIEW] ... NOT A REAL VACANCY` so it is unmistakably fictional.
2. Open the vacancy. Confirm the form appears beneath the job details.
3. Try submitting without a name, valid email, or resume; native/browser and server-side validation should stop submission.
4. Upload `tests/fixtures/demo-resume.pdf`, enter `Demo Applicant 02` and a unique test email such as `demo.applicant.02@example.com`, and submit. Expect a success panel with a reference number.
5. Sign in to Admin → Job Management → Applications for the demo job. Confirm the new row appears and the resume link opens for an authenticated editor/admin.
6. Open that resume URL in a logged-out/private browser window. The private media endpoint should return 401 rather than expose the resume.
7. Attempt to apply twice to the same job with the same email. The second submission should be rejected as a duplicate.
8. Edit the deadline to yesterday in the job editor. The public feed/detail/application endpoint should refuse the expired job; restore the future deadline after the test.

### Website Essentials

1. Open Admin → Website Essentials. Confirm empty/default fields and the empty staff/document states render without errors.
2. Upload `demo-staff-list.pdf` and `demo-working-locations.pdf`; preview each PDF and save the settings. Use the Preview links to confirm they open.
3. Add or review the demo staff record and demo location. The record contains explicit preview-only wording. Confirm the staff page/map renders in both English and Bangla.
4. Remove the demo URLs/content before launch, then upload only the approved official documents and replace demo social URLs with verified official accounts.

### Other checklist functions

- Site Navigation: create, edit, reorder, nest and remove a menu; refresh and check the public navigation. Creating internal navigation should also create its page/section.
- Page Builder: save a page with two contentFeed sections of different types; verify each section has only one selected type and each item URL inherits the page's nested route.
- Working location map: verify marker, popup, zoom/touch and responsive behavior; confirm coordinates with the actual branch list.
- Job admin: verify create/edit, publish/hide, deadline behavior, application counts and review-status updates.
- Upload security: unauthenticated requests to `/api/admin/media/upload` should be denied; applicant resumes must never be public assets.
- Performance and backups: run production build and Lighthouse/PageSpeed on staging, check links at desktop/mobile widths, configure provider-side database/object-storage backups, and perform a restore test. These cloud tasks cannot be verified from source files alone.

## Cleanup

After testing, run:

```bash
NODE_ENV=development ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY npm run db:seed:demo:remove
```

The cleanup removes the seeded demo job and fake application, and restores the Website Essentials settings captured before seeding. It intentionally does not delete unrelated content or uploaded media. Inspect the database and object-storage bucket before using any further cleanup procedure.

## Verification status for this packaged source

- Source-contract tests are included in `tests/functional-contract.test.ts`.
- Pure validation tests are included in `tests/job-application-validation.test.ts`.
- The three included PDF fixtures were rendered for visual inspection and are one page each.
- Full Next.js build, lint, real object-storage upload, database insert, and browser E2E require a complete dependency install plus the user's database/storage configuration. They are not claimed as passed merely because the source files are present.

## Latest source verification run (2026-10-28)

The latest route/CMS revision was checked with the following tests in the packaging environment:

| Check | Result | What this establishes |
|---|---|---|
| Functional/source-contract and pure validation tests | **28 passed, 0 failed** | Covers application validation, private resume handling, canonical route helpers, CMS route depth/collisions, Career / Jobs listing, menu/page creation, map, PDF workflows, social links, staff directory and admin maintenance checks. |
| TypeScript/TSX syntax transpilation | **211 files, 0 syntax errors** | Files parse and transpile; this is not a full semantic type check. |
| Package JSON + Drizzle migration journal | **Passed** | Both files parse as valid JSON and migration 0012 is registered. |
| Demo PDF signature check | **3 of 3 passed** | Each fixture has the `%PDF-` signature and is suitable for UI upload tests. |

The dependency installation did not complete in this environment, so the project's `tsx` runner was unavailable. The test suite was therefore executed with the available global TypeScript/ts-node runner. After installing dependencies normally, run `npm run test:functional` in the project directory.

### Not claimed as passed

The Next.js production build, ESLint, real Neon database migration/insert, private object-storage upload/read, browser-based application submission, and production restore test were not executed here. They require a complete dependency install and non-production database/storage credentials. Do not seed production with preview data.


## CMS routing model (updated 2026-10-28)

- The landing page is the single `/` route and is not an ordinary navigation slug.
- Main internal navigation items use `/{menu-slug}`. Submenus use `/{menu-slug}/{submenu-slug}`. Internal navigation create/update writes the matching page document with section containers.
- Each `contentFeed` section is normalized to exactly one content type. Add another section to show another content type.
- The CMS content editor includes a **Publish under page** selector, publication visibility and a public URL preview. The component type's default destination is used unless an editor selects a different existing page.
- Content placed on Home uses `/{content-slug}`; on a menu page it uses `/{menu-slug}/{content-slug}`; on a submenu page it uses `/{menu-slug}/{submenu-slug}/{content-slug}`.
- Slugs are unique within a destination page, allowing the same short slug under different pages while preventing two items from claiming the same public route. Page/menu routes take precedence; the CMS rejects content routes that conflict with an existing page or navigation item.
- Canonical collection destinations include `/projects`, `/news`, `/enterprise-development`, `/about-us/partners-networks`, `/social-development/health-program`, `/organizational-development`, `/management-staff`, `/notice`, `/resources`, `/carrer-job`, and `/success-stories`. News details use `/news/{news-slug}` and Success Story details use `/success-stories/{story-slug}`. The old collection page rows `/what-we-do/news` and `/what-we-do/success-stories` are removed during the regular non-destructive seed; their old exact URLs are compatibility redirects only, not independent pages. Old nested detail URLs are canonicalized to root-level detail routes. Home is the only fixed database root. The editable navigation groups are Main Navigation, Who We Are, and What We Do; News and Success Stories are standard What We Do entries whose public hrefs remain `/news` and `/success-stories`.
- Migration `0012_cms_content_routing_and_collections.sql` creates missing collection pages, ensures `/carrer-job` is a published primary-nav item even if the prior database lacked that nav row, backfills `routeParent`, and replaces the old global component/slug index. The runtime lazy schema has been aligned to preserve that new index instead of recreating the old one.

## Latest source verification (2026-10-28)

- `tests/functional-contract.test.ts` and `tests/job-application-validation.test.ts`: **28 passed, 0 failed** using the available global TypeScript/ts-node runner.
- TypeScript/TSX syntax transpilation: **211 files checked, 0 syntax errors**. This is a syntax check, not a semantic `tsc --noEmit` run.
- Full Next.js build, lint, migration against a real Neon database and browser end-to-end checks are still required after installing dependencies and configuring a non-production database/storage account.
