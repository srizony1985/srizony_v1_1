# Success Stories missing from the landing page — fix

## Root causes corrected

1. The homepage fetched Success Stories using the legacy collection path `/what-we-do/success-stories`. Detail records are now stored under the canonical detail parent `/success-stories`, so the SQL parent filter could exclude valid published records. The homepage feed now queries `/success-stories`.
2. Existing saved homepage snapshots did not receive a missing `successStories` gallery unless they matched a narrow legacy `stories` migration case. The runtime landing normalizer now restores the registered gallery when it is missing, even when the homepage has already been saved in the CMS.
3. The structural seed now adds/repairs the gallery section in existing `pages.render_cache` snapshots without replacing administrator-authored copy. It keeps the gallery before the homepage CTA and enforces the gallery's database-feed identity.
4. A Success Stories section with an old/wrong section type is repaired from the registered landing-section default, rather than being left registered but unrenderable.
5. When there are no published, image-backed Success Story records, the gallery section remains visible with a bilingual empty-state message instead of silently returning `null`.

## Data requirements

The gallery intentionally renders only published Success Story records that have:

- component `success-story`;
- a valid slug and published status;
- a CMS-managed image;
- a bilingual title;
- canonical detail URL `/success-stories/{slug}`.

The supplied project does not include starter Success Story records in `data/contentDetails.ts` or another bundled story catalogue. No invented people, case studies, results or images were added. Create/publish real records under **Admin → Site Content → Success Stories** and select an approved image for each story. Once published, the homepage gallery will load them from PostgreSQL automatically.

## Deploy

From the project directory, install dependencies if needed and run:

```bash
npm ci
npm run db:seed
npx tsc --noEmit
npm run build
```

Use the normal seed command. It repairs the saved homepage section configuration and does not reset CMS-managed content. Do not run `npm run db:seed:reset` against production.

After deploying, verify:

- The homepage shows the Success Stories Gallery section after News and before the final call-to-action.
- Published image-backed stories appear as image-and-title-only gallery cards.
- Each card opens `/success-stories/{slug}`.
- The Success Stories collection page is `/success-stories`; the old `/what-we-do/success-stories` page row is removed by the normal seed.
- If no qualifying records exist yet, the gallery displays its bilingual empty state rather than disappearing.
