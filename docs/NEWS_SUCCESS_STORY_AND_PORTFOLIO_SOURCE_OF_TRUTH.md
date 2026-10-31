# News, Success Stories and Portfolio source of truth

## Canonical routes

- News collection: `/news`
- News details: `/news/{news-slug}`
- Success Stories collection: `/success-stories`
- Success Story details: `/success-stories/{story-slug}`

There is exactly one collection page for each content type. The former `/what-we-do/news` and `/what-we-do/success-stories` page rows are migrated to the root routes and removed. Requests to the old exact collection URLs are compatibility redirects only; they do not resolve to independent page records. Older nested detail URLs redirect to the root-level detail route.

The landing-page News Rail is a visual presentation of published CMS `news` records only. It is not a Success Stories carousel. Its collection CTA opens `/news`, and each tile opens `/news/{news-slug}`. Success Stories are displayed on their own `/success-stories` collection page and in the separate landing-page gallery. They are managed with the `success-story` content component in Site Content.

The CMS locks the `routeParent` for these two component types. This is enforced in the editor and server-side validation. The structural seed rewrites existing News and Success Story rows to their fixed root `routeParent` and `detailPath` values.

## Navigation

Home (`/`) is the fixed, non-editable entry. The public header renders Home, its Main Navigation links (`/projects`, `/carrer-job`, `/notice`, `/contact`), and the two navigation groups as peer layers. News and Success Stories are ordinary editable entries in What We Do, with explicit hrefs `/news` and `/success-stories`. Partners & Networks is an ordinary child of About Us. Reordering changes only menu parent/order metadata and never builds a route from a menu parent.

## Migration

Run the normal non-destructive seed after backing up the database:

```bash
npm run db:seed
```

Migration `0015_explicit_navigation_groups_and_routes.sql` installs the exact Main Navigation, Who We Are and What We Do groups and menu tree. Existing page records are retained. Legacy collection aliases remain routing redirects only. Run the database migration; do not use the destructive seed reset for this navigation update.

The routing contract tests are in `tests/root-news-success-routes.test.ts` and `tests/story-success-portfolio-routing.test.mjs`.
