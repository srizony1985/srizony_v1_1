# Website task list implementation

This change adds the code paths needed to manage the nine website checklist items from the Srizony Foundation CMS. It is additive and does not reset or overwrite existing page content.

## Implemented in this source tree

- **Colorful working-location map:** increased map tile saturation/contrast and added a restrained multicolor district palette, with a dark-mode variant. Admins can manage map locations in the Website Essentials editor. Bundled branch data remains the fallback when no custom location list is saved.
- **Career / Jobs in the main navigation:** added the Career / Jobs entry to the bundled fallback navigation and an additive migration that moves an existing Career/Job menu into the CMS `primary` group (or adds it when absent). The entry remains editable/removable in Site Navigation.
- **Menu management:** uses the existing CMS navigation editor and navigation API; this change adds the initial menu entries for Management Staff and Documents & Resources.
- **Staff and locations PDFs:** the Website Essentials editor can upload, preview, publish, and replace public PDF documents. Existing upload MIME/signature checks remain in force; public PDF files are deliberately stored in the public assets bucket, while private documents remain authenticated.
- **Homepage social links:** added an accessible, responsive social strip at the top of the public header. Official HTTPS social URLs are editable through Website Essentials. Only LinkedIn is pre-filled because that is the official URL already present in the project data.
- **Management staff:** created public English/Bangla directory routes and CMS CRUD controls for staff profiles. Draft profiles are excluded from anonymous API responses and public pages.
- **Admin panel:** added the Website Essentials sidebar route and a shared API backed by `site_settings`. The settings include PDFs, official social URLs, staff profiles, and bilingual working-location records. Updates are validated and audited.
- **Performance/security hooks:** public settings responses are `no-store`, social URLs must be HTTPS, staff photo/document links are constrained to HTTPS or same-origin paths, PDF uploads require editor/admin access, and the existing public media endpoint only permits explicitly public images or PDF documents anonymously.
- **SEO/API documentation:** sitemap entries and API registry entries added for the new public pages and settings API.

## Database migration

The new migration is `drizzle/0008_website_tasklist.sql`. Apply it with the existing Drizzle migration workflow:

```bash
npm run db:migrate
```

Do not run a destructive reset/seed command in production. The migration is additive and should preserve existing CMS content. It changes navigation rows to bring Career / Jobs into the editable primary navigation and adds the two public resource links under the existing Who We Are group, when that group exists.

## How to publish the remaining organization-approved content

1. Sign in to the admin panel and open **Website Essentials**.
2. Confirm official social URLs, then save.
3. Upload the approved staff-list PDF and working-locations PDF, preview each one, then save changes.
4. Add the approved management staff records. Keep entries unpublished while drafting; publish only after the names, designations, biographies and optional photos are authorized.
5. Check every working-location name, bilingual label and exact map coordinate. The bundled coordinates are approximate district-headquarters coordinates, not proof of each branch's exact location. Save the verified directory.
6. Open **Site Navigation** to change the labels, placement, nesting, ordering or visibility of Career / Jobs, Management Staff and Documents & Resources.
7. Open **Jobs** to create/edit/publish/close vacancies and test the public listing and application flow.

The source archive did not include the current approved staff roster or final PDFs, so those are not fabricated or auto-published by this patch.

## Production verification and backup requirements

Before release, run:

```bash
npm ci
npm run lint
npm run build
npm run db:migrate
```

Then smoke-test on staging and production with an administrator and an anonymous browser: navigation order and nested items, both language routes, public PDFs, inaccessible private documents, unpublished staff redaction, map markers/popups and mobile layout, job publishing/applications, role checks, broken links, and upload failure behavior.

The repository now includes `.github/workflows/production-backup.yml` and `scripts/backup-production.sh` for daily PostgreSQL and private/public media backups to a dedicated S3-compatible backup bucket. The workflow remains inactive until the repository secrets/variables and destination bucket are configured; see `docs/OPERATIONS_BACKUPS.md`. `app/api/cron/maintenance/route.ts` is maintenance only, not a backup. Configure bucket lifecycle retention and failure alerts, and perform a restore drill to a separate environment. The archive cannot provision cloud buckets or secrets or prove a production restore.

## Nested page and content routing update

The latest routing changes establish the following contract (English routes are canonical; the Bangla prefix `/bn` can be used for the same route tree):

- Landing page: `/` only. The root page is always published and cannot be renamed or nested in Site Navigation.
- Top-level internal menu: `/<menu-slug>`; creating it also creates a published page snapshot with an initial section.
- Submenu: `/<menu-slug>/<submenu-slug>`; the parent path is composed automatically from the selected parent menu.
- Content-feed items inherit their container page path: `/<content-slug>` from the landing page, `/<menu-slug>/<content-slug>` from a top-level menu, and `/<menu-slug>/<submenu-slug>/<content-slug>` from a submenu.
- Every `contentFeed` section stores one content component. To display a second collection, add another section and select its content component. Detail routing resolves a slug only against the content type selected in the parent page's feed. Existing menu/page paths take precedence over a colliding content slug.
- `/carrer-job` is the canonical Career / Jobs page; legacy `/job-circular`, `/job-circulars`, `/career`, and `/career-job` paths redirect to it, including child detail paths. The editable menu stays in the CMS navigation. Newly created job records are explicitly saved with status `published` and appear in the live job feed when the deadline is current. If a job is hidden or its deadline has passed, it is intentionally excluded.

Apply `drizzle/0009_nested_content_routes.sql` and `drizzle/0010_carrer_job_canonical_route.sql` after the previous migrations (or run `npm run db:migrate` to apply all pending migrations). Migration 0009 copies page snapshots to their hierarchical paths before updating nav URLs and creates a basic page for any remaining internal menu route without one. Migration 0010 moves Career / Jobs to the requested canonical `/carrer-job` route while preserving older snapshots and redirecting legacy aliases in application routing. Review any legacy duplicate or stale page records in staging before deleting them; migrations intentionally leave old page snapshots in place to avoid accidental data loss.


## Job application form and functional preview data

The job detail renderer now identifies CMS job records and renders a bilingual application form. Applicants must provide a name, email, and PDF resume. Resumes are uploaded into private object storage, validated by MIME type and PDF signature, limited to 4 MB, rate-limited, and linked through a short-lived single-use token. The application endpoint validates the job status/deadline and duplicate email before creating the application record. Applicants receive a reference number; admins can open the resume only through authenticated media access.

Apply migration `0011_job_application_resume_uploads.sql` via `npm run db:migrate`. The migration creates the one-time resume token store and hashed per-IP public form rate-limit table.

Demo data and three PDF fixtures live in `tests/fixtures/`. See `docs/FUNCTIONAL_VERIFICATION.md` for test steps. Demo seed must be explicitly enabled against local or isolated staging only:

```bash
NODE_ENV=development ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY npm run db:seed:demo
npm run test:functional
```

Remove the seeded demo records and restore prior Website Essentials settings with `NODE_ENV=development ALLOW_DEMO_PREVIEW_SEED=YES_DEMO_ONLY npm run db:seed:demo:remove`. The fictional vacancy, sample applicant and preview staff/location must not be published on production.
