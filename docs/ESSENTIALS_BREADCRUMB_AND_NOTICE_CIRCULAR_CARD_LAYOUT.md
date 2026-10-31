# Documents & Resources, Management Staff, and Notice/Job Circular Card UI

## Changes

### Documents & Resources
- Replaced the simple back-to-home action with a semantic breadcrumb.
- Breadcrumb is localized and links to the localized homepage.
- Resource cards use the shared SF semantic token contract for surfaces, borders, text, link color, radii, and shadows.
- Resource cards stretch to equal heights within their grid row; actions align consistently at the bottom.

### Management Staff
- Added a hierarchical breadcrumb: Home → Documents & Resources → Management Staff.
- Breadcrumb links use the current locale.
- Staff cards use the same theme-token surface/border/radius/shadow aliases and stretch to equal grid-row heights.

### Notices and Job Circulars
- Notice and job feed sections use the same two-column desktop/tablet grid, one-column mobile grid, and fixed 18px gap.
- CMS-specific card-layout/column overrides are intentionally not applied to these two feed types, ensuring their card widths remain consistent between Notices and Job Circulars.
- Grid tracks and card wrappers stretch to equal heights. Cards have a shared minimum height of 224px (206px on narrow screens).
- Notice and job titles/summaries are clamped to consistent line counts to prevent long content from changing card geometry.

## Files changed
- `components/ui/PublicBreadcrumb.tsx` (new)
- `app/[...slug]/page.tsx` and `app/bn/[[...slug]]/page.tsx` resolve `/resources` and `/management-staff` through the shared slug-page template.
- `components/pages/SectionContent.tsx`
- `app/site-polish.css`
- `site-polish.css` (compatibility copy, synchronized)
- `tests/essentials-breadcrumb-and-feed-card-layout.test.mjs` (new)
- `tests/ui-layout-contract.test.ts`

## Database impact
No database schema, seed, or migration changes are required. These changes affect only presentation and rendering.

## Verification performed in the packaging environment
- JavaScript tests: 55 passed, 0 failed.
- Focused TypeScript UI tests: 13 passed, 0 failed (Node's experimental type-stripping runner for these file-only tests).
- TypeScript/TSX syntax transpilation: 235 files, 0 syntax errors.
- `app/site-polish.css` and root `site-polish.css`: identical.
- Full dependency-backed semantic typecheck and Next.js production build: not run in this environment.

## Local verification
Run after replacing the project files:

```bash
npm run test:functional
npx tsc --noEmit
npm run build
```
