# CMS routing and content-management model

## Canonical public URLs

| Page/item type | Canonical pattern | Example |
|---|---|---|
| Landing page | `/` | `/` |
| Landing-page content | `/{content-slug}` | `/community-impact` |
| Main navigation page | `/{menu-slug}` | `/about-us` |
| Content on a main navigation page | `/{menu-slug}/{content-slug}` | `/about-us/our-team` |
| Submenu page | `/{menu-slug}/{submenu-slug}` | `/about-us/our-team` |
| Content on a submenu page | `/{menu-slug}/{submenu-slug}/{content-slug}` | `/about-us/our-team/field-staff` |
| Job listing | `/carrer-job` | `/carrer-job` |
| Job detail/application | `/carrer-job/{job-slug}` | `/carrer-job/community-field-officer` |

`/` is a unique reserved landing page. Internal main-menu slugs have one segment and submenu pages two; content can be placed on Home, a main page, or a submenu page only. External links do not create local pages.

## How content is maintained

1. In **Admin → Site Navigation**, create an internal menu. The CMS creates a corresponding page with section/container defaults. Add a submenu by selecting an internal parent. Reorder or move items, save, and inspect the public route.
2. In **Admin → Page Builder**, add and edit sections. A `contentFeed` section displays one content type selected from its single-type selector. To show projects and notices, add two sections instead of combining both into one.
3. In **Admin → Site Content**, select a content type, enter a slug and bilingual content, choose **Publish under page**, select Draft/Published/Hidden, and review the public route preview before saving. Existing content can be moved by changing the destination page.
4. When the item is published, it is included in the configured destination section and links to the concrete hierarchical URL. Draft/hidden content is not included in public feeds. For jobs, application deadlines are also checked before public display.

## Route and collision rules

- Content detail paths inherit the page on which the matching content feed appears. The URL parent must be the same route selected in the editor.
- A content-feed section is normalized on save to a one-item `components` array. The CMS must not use multiple content types in a single feed section because that would make item slugs ambiguous.
- Content slugs are unique per destination route (route parent + slug). The same short slug may exist under two different parents, but not twice under the same parent.
- A content detail URL cannot be created if it collides with a page or internal navigation route. Creating a menu is rejected if existing content already occupies that URL.
- The database index is `cms_content_items_route_slug_uq`. `lib/cms/ddl.ts` mirrors this design; it intentionally drops the legacy `cms_content_items_component_slug_uq` index before creating the route-scoped index. If a legacy database already contains same-parent/same-slug collisions across different content types, the migration preserves the content and slug but returns the colliding records to their own type collection routes before adding the unique index.

## Career / Jobs behavior

- `/carrer-job` is the canonical public job collection and a main-navigation item. The legacy routes `/career-job` and `/job-circular` should redirect to it.
- The migration adds the collection page independently of whether an old navigation record exists, so this is not dependent on a menu having been created manually.
- New job content defaults to the `/carrer-job` destination. Published jobs with a non-expired deadline appear in the page's job feed and link to `/carrer-job/{job-slug}`.
- The detail page includes the validated application form. Resume upload and application submission use the job application endpoints; resumes are private and opened from the admin area only.

## Migration and checks

Apply migrations in order using `npm run db:migrate`, including `0012_cms_content_routing_and_collections.sql`. Backup the database before applying this production migration, and verify it on staging first.

Run `npm run test:functional`; then run `npm run lint` and `npm run build`. The included contract tests check canonical route helpers, page/menu/content collision guards, migration registration, the Career / Jobs feed, job application validation and surrounding website features. They do not replace a database migration run or browser E2E test.
