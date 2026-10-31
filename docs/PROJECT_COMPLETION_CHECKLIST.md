# Srizony Foundation Website — Completion Checklist

**Project source reviewed:** `sf-1.2.zip`, updated source package.  
**Prior public-site spot-check:** 29 October 2026 at `https://www.srizonyfoundation.org.bd/` (not repeated during this source edit).  
**Status key:** `Source implemented` means relevant UI/service code exists; it does **not** mean the live production database, real content, storage, and browser flow have been verified.

## Priority board

| # | Requirement | Source status | Remaining work | Priority |
|---|---|---|---|---|
| 1 | Colorful working-location map | **Implemented in source** — each SVG district receives a stable color from a light/dark theme-aware palette; Leaflet light/dark tiles, CMS locations and animated head-office/branch markers remain enabled. | Validate every office coordinate/name, verify the MapTiler key and offline fallback, and test search/selection/directions, touch controls, keyboard operation and narrow-screen overflow. | P1 |
| 2 | Career / Jobs in main navigation | **Implemented in source; production navigation must be checked** — `data/data.ts`, `drizzle/0012_cms_content_routing_and_collections.sql`, `lib/site.ts` and the Jobs admin screen reference `/carrer-job`. | In the live admin database, ensure Career / Jobs appears in desktop and mobile primary navigation, survives refresh, and leads to the same listing. Create and publish a test job and confirm it appears on `/carrer-job` after cache refresh. | P1 |
| 3 | Menu CRUD and routing | **Implemented in source** — `app/admin/dashboard/navigation/page.tsx`, `app/api/admin/navigation/route.ts`, `lib/cms/navigation.ts`; creating a menu creates a page with a section. | Test create/edit/delete/reorder, nested parent/child URLs, duplicate-route rejection, database persistence and both languages on staging. Verify `/`, `/{menu}`, `/{menu}/{submenu}` and their content-detail URLs. | P1 |
| 4 | Staff list PDF | **Admin upload and public resource slot exist** — `app/admin/dashboard/website-essentials/page.tsx`, `app/api/admin/media/upload/route.ts`, the shared dynamic slug-page route (`app/[...slug]/page.tsx`, including `/resources`). | Obtain the approved staff PDF, upload as a public PDF, fill approved English/Bangla titles, save, and test open/download on mobile/desktop. It is intentionally blank until an approved file is uploaded. | P1 |
| 5 | Working locations/branch PDF | **Admin upload and public resource slot exist** — same Website Essentials and Resources routes as above. | Confirm the official list and addresses, upload the approved PDF, save the URL, and test public download and replacement. Do not publish demo fixture PDFs as official records. | P1 |
| 6 | Homepage social links at top | **UI and editable fields exist** — `components/ui/NavBar.tsx` renders `.sf-social-topbar`; Website Essentials has Facebook, Instagram, YouTube and LinkedIn fields. Current bundled fallback only supplies LinkedIn. | Confirm which accounts are official, enter their HTTPS URLs in admin, save and verify visible icons, accessible labels and outbound targets on desktop/mobile and English/Bangla. Do not invent accounts. | P1 |
| 7 | Management staff website page | **Public directory and publish controls exist** — the shared dynamic slug-page route (`app/[...slug]/page.tsx` and `app/bn/[[...slug]]/page.tsx`) and Website Essentials support localized names, roles, bios, photo URLs, ordering and publish/draft. | Import the approved current management roster, validate portraits/consent and biographies, publish only approved records, then verify order, empty state and Bangla/English fallback. | P1 |
| 8 | Admin-managed menus, PDFs and job circulars | **Major CMS screens/APIs exist** — navigation editor, Website Essentials, `app/admin/dashboard/jobs/page.tsx`, `app/api/admin/jobs/route.ts` and CMS content routes. | Run an end-to-end staging checklist for menu save, section type selection, content visibility/routing, PDF upload/replace, job publishing, application submission, resume access, errors and administrator/editor permissions. Ensure published changes reach the public site. | P1 |
| 9 | Responsiveness, links, security and backups | **Source support added** — responsive public/admin styles, upload/session/role controls, global security headers, plus a daily GitHub Actions backup workflow for PostgreSQL and private/public media. | Configure GitHub repository secrets/variables and a dedicated backup bucket; confirm workflow succeeds, set retention/alerts, and prove restore on staging. Run lint/build and audit links, accessibility, responsiveness, Core Web Vitals and permissions. | Release gate |

## Suggested execution sequence

### Phase A — Public navigation and visual polish

- [ ] Confirm Career / Jobs is a visible item in the persisted primary navigation on desktop and mobile.
- [ ] Check the colorful location map on desktop, phone and tablet, including actual office coordinates and fallback when remote tiles/API are unavailable.
- [ ] Populate only verified official social URLs and verify the top bar.
- [ ] Apply/verify shared theme tokens on public and CMS preview pages; ensure link/icon foregrounds remain readable in dark and light modes.

### Phase B — Official content

- [ ] Receive and approve the staff list PDF.
- [ ] Receive and approve the working locations/branch PDF.
- [ ] Add the management staff roster and publish only approved profiles.
- [ ] Check English and Bangla page titles, content, empty states and downloads.

### Phase C — CMS and functional proofs

- [ ] Create a temporary staging menu, edit its label, reorder it, add a submenu, refresh, and verify persisted order and links; delete the temporary menu after testing.
- [ ] Create a demo project, set its destination page and visibility to published, verify it appears in the correct section at the calculated URL; switch it to draft and confirm it disappears from public lists.
- [ ] Create and publish a demo vacancy, confirm it appears on `/carrer-job`, open its details, upload the demo resume PDF, submit the application, and verify its record and restricted resume access in admin.
- [ ] Upload demo PDFs in staging, test public previews/downloads and replacement, then remove the demo links before production.
- [ ] Test unauthorized API requests return 401/403 and invalid file uploads are rejected.

### Phase D — Release readiness

- [ ] `npm ci`
- [ ] `npm run db:migrate` against staging after a database backup.
- [ ] `npm run test:functional`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Run route/link checks and verify all 9 acceptance areas in a real browser.
- [ ] Configure the scheduled workflow using `docs/OPERATIONS_BACKUPS.md`, set bucket retention/failure alerts, then document and successfully perform a restore test.
- [ ] Deploy only after the staging checks pass; keep demo data and demo PDF URLs out of production.

## Acceptance criteria

- The homepage is uniquely `/`.
- Main menus and submenus use the parent-aware routes defined by the CMS. Creating a menu creates a page with at least one section.
- Each content section selects one content type; public feeds respect destination path and visibility.
- Published jobs are visible on `/carrer-job`, and an applicant can submit the validated form and PDF resume without making the resume public.
- All public official files/social links/staff records are administrator-editable and contain approved data.
- Build, lint, functional tests, responsive checks and a backup restore test pass before release.

## Live-site source check (not a full QA run)

The homepage crawl showed a national-footprint section listing **14 offices**, and the navigation text exposed Career / Job in the site's link set but did not make its placement in the top primary navigation unambiguous. Thus, main-nav placement must be checked in a real browser/admin database. A public web crawl cannot prove map interactivity, upload/submission, admin persistence, API authorization or backups.
