# Public page usability refinement

This update refreshes four public-page experiences while keeping the existing CMS, bilingual content and website-essentials data sources intact.

## Career job details

- Reorganised the job overview into a facts panel and a separate application call-to-action panel.
- Added optional job circular PDF download/share actions and clearer deadline presentation.
- Kept the existing application form dialog, including Escape handling, focus trapping and background scroll locking.
- Added an optional `file` URL field to the CMS job component and mapped it into job detail data as `attachmentUrl`.

## Resources

- Added live search and category filters for reports and official documents.
- Pulled published report entries and their attachment URLs from CMS content-feed sections.
- Kept the Website Essentials staff-list and working-locations PDF links, with clear pending states when a URL is not configured.
- Added empty/error states and a route to the management directory.

## Management staff

- Reworked the directory into profile-led rows with portraits, names, designations and biography text.
- Added search across bilingual names, designations and biographies.
- Added an accessible expand/collapse action for longer biographies.

## SDG impact

- Replaced the multi-item diagram presentation with a focused single-goal slider.
- Added goal-specific icon selectors, previous/next controls, an active-goal counter and progress indicator.
- Preserved the existing SDG dataset and bilingual labels/descriptions.

## Route compatibility note

The existing CMS and job APIs use `/carrer-job` as the canonical collection route. `/career-job` is currently configured as an alias that redirects to `/carrer-job`. This UI update preserves that established data/routing convention; it does not migrate CMS route parents, stored navigation entries or database indexes.

## Validation

- `node --test tests/*.test.mjs`: 170 passed, 0 failed.
- TypeScript transpile/syntax checks passed for all eight changed TS/TSX source files.
- A full `tsc --noEmit` / Next.js build was not completed in this environment because dependency installation did not complete and required type-definition packages were unavailable.
