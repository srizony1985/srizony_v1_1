# CMS feature and duplication audit — Srizony v1.2

Audit scope: the uploaded application source, API routes, CMS admin pages, Drizzle migrations, GitHub Actions workflows and existing backup utilities. This is an implementation audit, not a claim that every feature available in every CMS product is necessary for this website.

## Capabilities found in the existing application

- Structured page and section builder with reorder, hide/show, duplicate and JSON advanced editing.
- Single navigation tree with nested folders, route-aware page links, visibility, ordering and section rendering.
- Bilingual English/Bangla content fields and localized site UI.
- Draft/published/hidden/archived states across relevant content areas.
- Page SEO descriptions, canonical route/slug behavior and Open Graph page image support.
- Media upload/selection, private/public object storage and media endpoints.
- CMS users and role checks, protected admin routes, audit logs, and optimistic update timestamps in several editors.
- Job posting management, applicant status and resume handling.
- Database export/import and table inventory/reporting tools.
- Google Drive table mirror and a full database/object-storage archive script (the CMS controls were incomplete before this change).

## Implemented in this update

- Full timestamped archive inventory and a CMS manual backup action.
- Daily full backup schedule at 02:00 `Asia/Dhaka`; hourly JSON mirror remains as an additional recovery layer.
- Protected restore dispatch: admin-only, exact confirmation phrase, archive allow-list/checksum verification, and automatic pre-restore archive.
- Read-only public page/global settings/navigation fallback using recent, manifest-listed Google Drive snapshots when Neon is unavailable or has a transient network error. CMS/business writes remain Neon-only.
- Job application custom-field builder with bilingual labels, field types, required/optional state, character/number bounds, select options, server-side validation, migration-backed storage and applicant-view display.
- Typography override controls for page, section, content detail and navigation entries (font family, weight, size, color, letter spacing and line height). Footer navigation inherits the navigation typography.
- Added the API registry entries for the new admin and public application-form routes.

## Duplicated functionality reviewed

- Removed redundant package-script aliases for the JSON backup command; the canonical `backup:google-drive`, `backup:google-drive:full`, `backup:google-drive:list`, and `backup:google-drive:archive` commands remain.
- Kept a single full-archive writer (`scripts/backup-google-drive.mjs`) and a single archive restore entry point (`scripts/restore-google-drive.mjs`). The JSON table mirror is a different recovery format and is not a second full-archive implementation.
- `GET`, `POST`, `PATCH`, and `DELETE` exports repeated in different `app/api/**/route.ts` files are Next.js route handlers for different endpoints, not duplicated implementations.
- CMS navigation tree reads and public navigation reads serve different projections and permissions; they should not be collapsed into one query.

## Still recommended / not implemented in this pass

These require broader UX decisions, content-model changes, or separate integrations rather than adding generic controls without a workflow:

1. **Editorial approval workflow**: a formal draft → review → approved → published state machine, reviewer assignment, rejection comments and separation of author/publisher permissions. Current draft/published visibility is not a complete approval workflow.
2. **Scheduled publishing and expiry**: publish-at/unpublish-at timestamps with a reliable scheduler and timezone-aware preview. A publication date field alone does not schedule publication.
3. **Visual rich-text editor**: accessible WYSIWYG/block editor with safe HTML sanitization, internal link picker, embeds and paste cleanup. Existing structured text fields are not a full WYSIWYG editor.
4. **Media library enhancements**: crop/resize focal point, asset tags/collections, duplicate detection, expiry/rights metadata, alt-text quality checks and bulk media operations.
5. **SEO operations**: explicit 301/302 redirect manager with loop detection, broken-link checker, social preview inspector, structured-data validation, and per-route sitemap/indexation controls.
6. **Accessibility governance**: editor-side heading hierarchy, link-purpose, contrast and image-alt checks plus an accessibility report. Frontend semantics alone do not provide an editor QA workflow.
7. **Content version diff**: side-by-side revision comparison and one-click restore for individual pages/content records. Existing audit/version data does not replace a complete revision browser.
8. **Search controls**: synonyms, stop words, weighting, typo tolerance and index status controls for the public search.
9. **Preview/share workflow**: expiring signed preview links for unpublished content and review comments.

The public-sector CMS guidance used for this gap review emphasizes role-based access, approval workflows, versioning/audit trails, metadata, search, navigation, content types and accessibility. See the GCIS CMS Guidelines and the Australian Public Service Academy CMS requirements checklist:

- https://www.gcis.gov.za/content/resourcecentre/guidelines/cms-guidelines
- https://www.apsc.gov.au/working-aps/aps-employees-and-managers/digital-professionals/content-management-system-cms-requirements

## Required production checks

- Apply migrations 0020 and 0021 before using custom application fields or navigation typography.
- Configure GitHub Actions backup secrets and grant the backup service account file-creation access to a Shared Drive folder.
- Run and inspect one manual full backup; verify it appears in CMS Settings.
- Test a restore against staging Neon and isolated object-storage buckets before enabling production recovery use.
- Simulate a Neon network failure in staging and confirm public pages/navigation serve recent Drive snapshots while all writes fail closed.
- Verify custom application fields with required/optional, string length, number bounds, checkbox and select cases.
- Verify typography per page/section/navigation/content detail in both English and Bangla, desktop and mobile.
