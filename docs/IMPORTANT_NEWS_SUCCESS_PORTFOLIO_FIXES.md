# News, Success Stories and Portfolio CMS routing

## Public routing

- News collection: `/news`; News details: `/news/{slug}`.
- Success Stories collection: `/success-stories`; Success Story details: `/success-stories/{slug}`.
- The previous collection page paths `/what-we-do/news` and `/what-we-do/success-stories` are removed from the page catalogue and migrated to root paths. The old exact URLs redirect to the canonical collection pages; they are not backed by separate database pages.
- Landing News Rail contains only published CMS `news` records. Its CTA points to `/news`.
- Landing Success Stories Gallery contains only published image-backed `success-story` records. Its CTA points to `/success-stories`.
- Existing nested legacy detail URLs redirect to the canonical root-level detail routes.

## CMS and migration

The Page Builder's collection definitions, Site Content fixed detail parents, database feed queries, public render hydration, fallback page catalogue and sitemap all use the root routes. Creating a menu at `/news` or `/success-stories` attaches to the already-existing collection page and preserves its configured sections.

Run `npm run db:seed` after deployment to non-destructively migrate old page slugs, navigation hrefs and content route metadata. Do not use `npm run db:seed:reset` on production.

## Portfolio

The Portfolio admin screen manages branch/location details and branch-manager contacts through the same Website Essentials database record used by the map. Mission, Vision and Values are independently managed.


News and Success Stories are ordinary editable menu entries in the What We Do group. Their public routes remain `/news` and `/success-stories`; menu placement does not construct or rewrite a page URL.
