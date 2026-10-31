# Srizony CMS — Build and Functional Test Fixes

This update addresses the verification output supplied from `srizony_v1_1`.

## Database bootstrap

The supplied log confirms that database bootstrap completed successfully:

- 45 pages seeded.
- 77 CMS content items seeded.
- Canonical catalogue validation: 75 bilingual catalogue records across 7 content types and 69 page routes.
- Navigation cleanup completed.
- No destructive reset was run.

No new database migration is required for this source-level fix. Do not rerun `db:seed:reset`.

## Six functional-test failures addressed

1. **Functional test command contract** — the package intentionally runs both TypeScript and JavaScript test suites. Updated the test to assert the actual combined command instead of the obsolete TypeScript-only command.
2. **Content detail resolver contract** — replaced assertions for an older inline `basePath` implementation with assertions for the shared `getContentRouteParent` route helper and the current database detail resolver.
3. **Seed image promotion contract** — the editor already uses the media picker; updated the contract to accept its required-field label while verifying that the selected media URL is wired into form state.
4. **CMS image upload contract** — updated the same stale JSX-shape assertion. The test still verifies upload kind, upload endpoint, returned URL propagation, and server-side media configuration.
5. **Notice/job feed guidance** — the renderer already enforced two columns from tablet/medium upward and one column on mobile. Added that behavior as visible Page Builder guidance.
6. **CMS content-feed columns** — updated the contract to verify the actual collection-level `setConfig({ columns })` control and the renderer's `collection.columns` CSS binding, rather than an obsolete `commonChange()` handler.

## TypeScript issues corrected from the supplied log

- Added the deprecated `newsFeed` identity to the shared `LandingComponentKey` union so legacy CMS snapshots remain typed while current records normalize to `news`.
- Safely narrow JSON-backed `contentCollection` data before reading `enabled` and `component`.
- Capture the database connection in a non-null local variable after the `DATABASE_URL` guard in database export/import handlers.
- Type the imported-record count reduction in the settings UI.
- Narrow carousel sections before reading their `maxItems`, and prefer collection-level `contentCollection.maxItems`.
- Normalize optional section headings before matching.
- Preserve literal carousel data-source types when inserting normalized fallback sections.

These changes correspond to the 27 TypeScript errors reported across 8 files.

## Verification performed in this workspace

- TypeScript test suite: 59/59 passed using a temporary TypeScript transpilation loader because the workspace dependency install did not complete.
- JavaScript test suite: 36/36 passed.
- TypeScript/TSX syntax transpilation: 233 files, 0 syntax errors.
- The source changes and test-contract updates are included in this archive.

## Checks still required on the developer machine

The temporary dependency installation in this workspace timed out, so a complete semantic `tsc` and Next.js production build could not be run here. Re-run these commands in the local project after replacing the source files:

```bash
npm run test:functional
npx tsc --noEmit
npm run build
```

The uploaded log also reports 9 npm audit findings (4 moderate, 4 high, 1 critical). Their package/advisory details were not included, so this update does not guess at dependency upgrades. Review `npm audit` output before applying targeted upgrades. Avoid `npm audit fix --force` without checking the breaking-change impact.

## Changed files

- `types/entityType.ts`
- `lib/cms/content.ts`
- `lib/site.ts`
- `app/api/admin/database/export/route.ts`
- `app/api/admin/database/import/route.ts`
- `app/admin/dashboard/settings/SettingsClient.tsx`
- `app/admin/dashboard/page-builder/page.tsx`
- `tests/functional-contract.test.ts`
- `tests/job-detail-ui.test.ts`
- `tests/ui-layout-contract.test.ts`
