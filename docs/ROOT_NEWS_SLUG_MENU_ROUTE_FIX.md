# Canonical News and Success Stories collection routes

## Final route contract

There is exactly one collection page for each content type:

- News collection: `/news`
- News detail: `/news/{news-slug}`
- Success Stories collection: `/success-stories`
- Success Story detail: `/success-stories/{story-slug}`

The former collection paths `/what-we-do/news` and `/what-we-do/success-stories` are not pages and are not seeded into the database. Requests to those exact URLs redirect to their canonical collection roots. Legacy nested detail URLs redirect to the canonical root-level detail routes.

## CMS behavior

- The Page Builder collection definitions use `/news` and `/success-stories`.
- Site Content locks News detail records to `/news` and Success Story records to `/success-stories`.
- Creating a navigation menu at either collection root attaches the menu to the existing collection page and preserves its sections instead of overwriting it with a blank template.
- The structural seed moves old collection page rows to the canonical roots, merges the relevant content-feed section when a root page already exists, and removes duplicate old rows.
- Navigation links, News Rail CTAs, Success Stories Gallery CTAs, catalogue rendering and sitemap entries use only the root routes.

News and Success Stories are top-level navigation items because their collection routes are root-level; neither collection appears as a submenu under “What We Do”. The non-destructive seed reparents old menu rows beneath the fixed Landing item, removes duplicate links, and preserves existing child items.

## Deployment

Run the normal non-destructive seed once after deploying:

```bash
npm run db:seed
```

This migrates existing page slugs, navigation hrefs and News/Success Story `routeParent`/`detailPath` attributes. It does not require a destructive reset. Take a database backup before deployment.

## Verification

The route tests assert that the old collection paths canonicalize directly to the root collection routes, and that the old collection slugs are absent from the bundled page catalogue.
