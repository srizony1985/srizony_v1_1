# CMS reusable illustration library

## What changed

The site now has one reusable illustration renderer at `components/home/CmsCardIllustration.tsx` backed by the named illustration registry in `components/home/Illustration.tsx`.

Each card/stat item can choose its own visual:

- Mission — progress journey
- Vision — shared horizon
- Values — balance and integrity
- Heart / health
- Book / education
- People / community
- Coins / financial inclusion
- Sprout / agriculture
- Store / enterprise
- Women in business, small enterprise, agriculture, migrant household, rural development, career and education scenes
- A custom CMS image that overrides the preset illustration

The shared renderer is used by Mission/Vision/Values, development-area cards, ordinary page cards and statistics tiles. It is designed so those components share one visual library without sharing their content or layout.

## Where administrators change illustrations

Open **Admin Dashboard → Page Builder** and edit the relevant page/section.

For each card or statistic, expand its item and use **Reusable illustration**. The editor shows a preview. Choose **Automatic / component default** to restore the component's semantic default, or select another preset. Use **Custom illustration image** to upload or select media from the CMS media library; the custom image takes precedence over the preset.

For Mission, Vision and Values, the defaults are distinct: Mission uses the progress-journey illustration, Vision uses the horizon illustration, and Values uses the balance-and-integrity illustration. The controls are independent for each item.

## Data ownership and persistence

- Portfolio owns Mission/Vision/Values titles and descriptions.
- Page Builder owns the per-card illustration selection and custom media.
- Page Builder saves the illustration name and media reference in the page's database-backed `pages.render_cache` JSON.
- Existing `card_items.illustration` remains compatible with the normalized cards table.
- `applyPortfolioToPage` merges Portfolio text with saved Page Builder artwork, preventing portfolio updates from resetting illustration choices.
- No new database table or destructive migration is required.

## Verification

Run:

```bash
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

The focused regression suite is `tests/illustration-management.test.mjs`.
