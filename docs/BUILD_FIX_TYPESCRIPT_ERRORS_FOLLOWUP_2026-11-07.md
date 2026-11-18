# Srizony Foundation — TypeScript remediation follow-up

Date: 7 November 2026

## Input

This follow-up addresses the additional TypeScript diagnostics supplied after the first 7 November remediation archive. The reported errors were concentrated in the Jobs, Dashboard Overview, Page Builder, Portfolio editor, and CMS user-list mapping.

## Changes applied

- **Jobs dashboard:** replaced optional `mode?.kind` values in `useAdminFetch` dependency arrays with the stable string fallback `idle`. The dependency arrays now conform to the hook's `JsonValue[]` contract without changing loader behavior.
- **Donation dashboard:** added a row normalizer that validates the donation ID and converts the API's generic JSON values into the dashboard's `Donation` model before updating state. Missing optional display values receive safe fallbacks rather than being treated as typed donation fields.
- **Page Builder:** narrowed generic JSON before rendering bilingual and media controls. Bilingual values are normalized into `{ en, bn }`, media URL values are accepted only when strings, and scroll-hint/map-label fields use the same guarded conversion. Legacy string bilingual values remain editable in both language inputs.
- **Portfolio CMS:** replaced the generic `JsonObject` alias with an explicit portfolio/brand model. Database JSON is narrowed with object/array guards before accessing fields; people/value lists accept only object records; media `src` fields are read from guarded objects; nested socials/maps are guarded; and editor updates accept valid `JsonValue` values rather than `ExternalValue` values that could include `undefined`.
- **CMS user mapping:** wrapped `toUser` in a one-argument callback so `Array.map` does not pass its numeric index into the optional source discriminator.

## Validation performed

- TypeScript/TSX/JavaScript syntax transpilation: **300 files checked, 0 syntax errors**.
- Isolated strict TypeScript check for the portfolio JSON model, object/array normalizers, state updates, and conversion into the site-global JSON object: **passed**.
- Full Next.js production build and dependency-aware whole-project typecheck: **not run**. The extracted source does not include installed project dependencies; the prior install attempt failed because the npm registry DNS lookup returned `EAI_AGAIN`. This follow-up does not claim that `npm run build` has passed.

## Files updated in this follow-up

- `app/admin/dashboard/jobs/page.tsx`
- `app/admin/dashboard/overview/page.tsx`
- `app/admin/dashboard/page-builder/page.tsx`
- `app/admin/dashboard/portfolio/page.tsx`
- `lib/cms/users.ts`

The first remediation is documented in `BUILD_FIX_TYPESCRIPT_ERRORS_2026-11-07.md`.
