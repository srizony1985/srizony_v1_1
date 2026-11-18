# Srizony Foundation — TypeScript build-error remediation

Date: 7 November 2026

## Input and scope

The remediation was made against the latest available project snapshot, `Srizony_updated_image_runtime_fix_2026-11-07.zip`, and the build output supplied in the conversation. The supplied build log reports that the optimized Next.js bundle compiled successfully and that the subsequent TypeScript phase stopped with 328 diagnostics across 34 files.

## Changes applied

- **Catch/error boundaries:** changed the shared CMS API `failure()` helper and database transient-error classifier to accept `unknown`, then safely narrow `status`, `field`, `cause`, and error messages. This removes the repeated invalid `unknown` → `ExternalValue` assumptions from API catch blocks without weakening application JSON types.
- **Database row typing:** introduced explicit database-row/record boundaries in CMS content and user mapping. JSONB values are narrowed before reading object properties, SQL row fields are normalized before entering CMS value types, and dates are converted deliberately.
- **CMS JSON and section handling:** hardened stored-image extraction and the legacy rendered-component parser for strings, arrays, nested objects, dates, and malformed values. Collection sections are read and updated through guarded record shapes.
- **Global site snapshot contract:** made the public snapshot return type explicit; partial or older `site_global_state` JSON is merged with the complete fallback shape. The fallback preserves the bundled `media` registry, and the readonly keyword tuple is copied into a mutable array required by `PublicGlobal`.
- **API and nullable database handles:** captured nullable database clients before using them in retry callbacks in the affected admin routes. Global content input is narrowed before merging nested portfolio, logo, image, and site-identity data.
- **Navigation and UI:** typed navigation reorder nodes from the shared navigation type, made the portfolio brand fallback non-null in `NavBar`, and fixed recursive menu-child traversal in `scripts/repair-cms.ts`.
- **Legacy structural seed:** isolated the legacy seed dataset's heterogeneous component-specific structure behind a local compatibility alias. This is limited to the one-off seed/migration script; application-wide JSON types and strict compiler settings were not loosened.

## Validation

- TypeScript/TSX syntax transpilation: **261 source files checked, 0 syntax errors**.
- Full `npm run build` / semantic TypeScript verification: **not completed in this environment**. The project dependencies were not present in the extracted archive, and `npm ci` could not fetch packages because the package registry DNS request failed (`EAI_AGAIN`). The offline install also could not proceed because the required packages were not cached.
- No claim is made that a full production build has passed. Run `npm ci` and then `npm run build` in the project's normal Node 24 development environment to complete dependency-aware verification.

## Files updated

- `app/api/admin/content/route.ts`
- `app/api/admin/form-users/route.ts`
- `app/api/admin/submissions/route.ts`
- `app/api/admin/ui-content/route.ts`
- `app/api/admin/visitors/route.ts`
- `components/ui/NavBar.tsx`
- `lib/cms/content.ts`
- `lib/cms/guard.ts`
- `lib/cms/navigation.ts`
- `lib/cms/rendered-components.ts`
- `lib/cms/settings-store.ts`
- `lib/cms/users.ts`
- `lib/db/index.ts`
- `lib/site.ts`
- `scripts/repair-cms.ts`
- `seed-structural.ts`

## Follow-up batch

A subsequent build log supplied on 7 November 2026 exposed additional errors in Jobs, Dashboard Overview, Page Builder, Portfolio, and CMS user mapping. Those were addressed in `BUILD_FIX_TYPESCRIPT_ERRORS_FOLLOWUP_2026-11-07.md`. The follow-up syntax check covered 300 TS/TSX/JS files with zero syntax errors, and its isolated strict portfolio JSON-model typecheck passed. A full dependency-aware build remains unverified because dependencies were unavailable in the extraction environment.
