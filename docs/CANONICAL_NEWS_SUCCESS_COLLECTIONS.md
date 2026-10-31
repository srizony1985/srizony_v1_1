# Canonical News and Success Stories collections

## Required URL contract

| Route | Purpose |
|---|---|
| `/news` | News collection page |
| `/news/{news-slug}` | News detail page |
| `/success-stories` | Success Stories collection page |
| `/success-stories/{story-slug}` | Success Story detail page |

There are no separate collection pages at `/what-we-do/news` or `/what-we-do/success-stories`. Those old exact collection URLs are compatibility redirects to the corresponding root collection route; they do not have independent CMS page records. Older nested detail URLs also redirect to their root-level detail path.

## Navigation structure

Menu placement is independent from a page's public route. The CMS contains three editable groups beneath the fixed Home record: Main Navigation, Who We Are, and What We Do. News and Success Stories are ordinary editable entries in What We Do, and their stored href values remain `/news` and `/success-stories`. Partners & Networks is an ordinary child of About Us. No collection page receives a menu-only placement or visibility rule.

The navigation editor persists only group, parent and sort-order metadata when an entry is rearranged. The page href is stored explicitly and does not change when the item is moved. Only Home (`/`) is fixed and cannot be edited, hidden, deleted or reordered.

## Page and content migration

The normal seed canonicalizes old page slugs, route-bearing links, menu hrefs and content metadata. When an old collection page and a root collection page both exist, it merges the old collection section into the root page if the root page does not already contain that collection section, then deletes the old page row. If only the old page exists, it is renamed to the root route. The final page-pruning pass also removes any remaining non-canonical alias row.

News content is fixed to `routeParent = '/news'` and `detailPath = '/news/{slug}'`. Success Story content is fixed to `routeParent = '/success-stories'` and `detailPath = '/success-stories/{slug}'`.

## Deployment

1. Back up the Neon database branch.
2. Replace the source with this project update.
3. Apply the navigation migration and then run the normal, non-destructive seed if content/page snapshot data also needs syncing:

   ```bash
   npm run db:seed
   ```

4. Verify the page rows and navigation entries. There should be one `pages` row each for `/news` and `/success-stories`, and the navigation rows should sit in What We Do while retaining those same hrefs.
5. Run functional tests and the production build:

   ```bash
   npm run test:functional
   npx tsc --noEmit
   npm run build
   ```

Do not run `db:seed:reset` for this route migration. Existing page sections and published content are preserved by the normal seed.

## Checks added

- Root collection definitions are unique and fixed.
- Root detail paths remain canonical.
- Old exact collection paths resolve to the canonical root route, not a separate page.
- News and Success Stories are ordinary What We Do menu entries with explicit root-level public hrefs.
- Navigation structure is migrated into the three requested groups without deleting the underlying page records.
