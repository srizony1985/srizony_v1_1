# Page Builder, ContentFeed, homepage and CSP fixes

## What changed

### 1. Homepage and slug pages use one section renderer

The homepage previously selected only recognised landing compositions, which meant ordinary Page Builder sections could be saved but never displayed. The homepage now renders every section whose `visible` flag is not `false` through `SectionRenderer`, just like other CMS pages.

The homepage editor now offers both:

- **Add section** for normal section types such as Rich Text, Cards, Stats, ContentFeed, Gallery, Timeline, Table, CTA, and others.
- **Add landing composition** for specialised homepage elements such as Growth, Mission/Vision/Values, Office Locations, Development Areas, News Rail and Success Stories.

A stale `homeComponent` marker can no longer hide a section when its marker does not match its section type; that section falls back to its normal renderer.

### 2. New manual sections no longer default to empty database collections

New ordinary sections start with `contentCollection.enabled = false`. This keeps manually authored Rich Text, Cards, Stats and similar sections from silently rendering as empty collections. An admin can still enable a collection on supported section types through the Collection tab. A newly created `ContentFeed` starts with its collection enabled.

### 3. ContentFeed has section-specific content selection

For a ContentFeed, the editor can:

1. Choose one of the currently registered Site Content types (Project, News, Enterprise, Partner Agency, Health Service, Loan Product, Product/Service, Team, Notice, Report, Job, Success Story or Statistic).
2. Search the full catalogue for that type.
3. Include or hide individual published records in that specific section.
4. Create content from the section editor; a newly created and published record is selected in that section automatically.
5. Set maximum records and layout options.
6. Show or hide the public keyword, category/status and year filters for that section.

The include/hide checkbox changes only that section's `selectedRecordIds`; it does not delete or unpublish the Site Content record. Draft/unpublished records cannot be selected for public display.

The selected IDs and filter switches are persisted with the page document. Public rendering fetches only published records selected for that section. An explicitly saved empty `selectedRecordIds: []` remains empty and does not fall back to every record.

The current Site Content registry has 13 types. “Special cards” is currently a Page Builder presentation/section concept, not a separate registered Site Content type. To manage Special Cards as its own reusable content catalogue, a new content type and schema/registry fields would need to be designed and added separately.

### 4. Homepage compositions

New specialised landing compositions receive starter content so they render immediately:

- Growth / impact statistics: starter metric cards.
- Mission, Vision & Values: three starter story cards.
- Office Locations: section copy plus the existing Website Essentials location directory/map.
- Development Areas: starter development-area cards.

The map's branch and office records are sourced from Website Essentials. The map also needs valid location records in that directory. The homepage composition does not duplicate branch records into page JSON.

### 5. Notice and job feed layout guidance

When a section is connected to Notice or Job Site Content, the Collection editor now shows the responsive layout rule: two columns on medium and larger screens, one column on smaller screens. The renderer fixes the desktop/tablet column count at two, while the public stylesheet switches those feeds to one column at the 767px breakpoint.

### 6. CSP development reports

The reported `script-src` / `blocked: eval` event on `http://localhost:3000/` is consistent with Next.js/Turbopack development HMR. The CSP remains **Report-Only**, so those reports are telemetry and are not blocking the page.

The development CSP allows `unsafe-eval` only when `NODE_ENV` is not `production`; production CSP does not include it. The report endpoint suppresses only the expected local-development `eval` HMR noise. Detailed CSP report logging can be enabled explicitly with `CSP_REPORT_LOG=true`.

Restart the Next.js dev server after updating `next.config.ts` and the report route. If the same report persists after a restart and hard refresh, inspect the response headers in DevTools for any additional CSP header added by hosting, a reverse proxy, or a browser extension.

## Local update steps

1. Stop the current dev server with `Ctrl+C`.
2. Extract this updated project into a new folder; do not extract over the old project.
3. Copy your local `.env.local` into the new folder. Do not share or commit that file.
4. Make sure local `.env.local` has `CMS_STATIC_FALLBACK=false` (or remove the variable). With `CMS_STATIC_FALLBACK=true`, public pages intentionally use bundled fallback content instead of the saved database page document.
5. Select the same disposable Neon test branch in `DATABASE_URL` that you already seeded. No database reset or re-seed is required for these changes.
6. Install dependencies and validate:

```bash
nvm use
npm ci --include=dev
npm run test:functional
npm exec -- tsc --noEmit
npm run build
npm run dev
```

## Regression coverage

The JavaScript regression suite covers homepage generic-section rendering, homepage controls, section-level ContentFeed selection, empty selection behaviour, visitor filter configuration, collection defaults and stale landing marker fallback.

No migration is required for this change: the page configuration is stored in the existing JSON page document and the new values are optional properties within `contentCollection`.
