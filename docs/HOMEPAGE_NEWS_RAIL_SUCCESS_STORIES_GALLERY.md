# Homepage News Rail and Success Stories Gallery

## Presentation split

- `NewsRail` is the animated horizontal rail for published `news` CMS records only. Every item uses `/news/{slug}`.
- `SuccessStoriesGallery` is a separate asymmetrical editorial photo gallery for published `success-story` records that have an approved image. Each card displays the image and title only and uses `/success-stories/{slug}`.
- The normal `/success-stories` collection page uses its page-level `contentFeed` and normal page card renderer. The landing gallery does not replace or share that page renderer. The registered landing gallery may also be reused on a normal page through the landing-component registry, consistent with the site component-layer rule; ordinary page cards cannot be inserted into the homepage.

## CMS configuration

In Admin → Page Builder → Landing Page, add:

1. `News rail` (`homeComponent: news`, `collectionKind: news`, `dataSource: published-news`).
2. `Success stories gallery` (`homeComponent: successStories`, `collectionKind: success-stories`, `dataSource: published-success-stories`).

Both compositions read record data from Site Content. Their section forms edit only their heading/eyebrow/intro and view-all button; manual carousel items are intentionally hidden. Add/edit/publish News and Success Stories under their respective Site Content collections.

Existing `homeComponent: stories` rail records are normalized to the News Rail. A legacy section titled “Success Story of Srizony” is treated as the old News Rail and relabelled. When an older saved homepage contains the legacy `stories` key or a “Success Story of Srizony” rail, the homepage normalizer now preserves that rail as News and automatically inserts the separate Success Stories Gallery composition. Administrators can then reorder, hide, or edit the gallery heading and view-all button in Page Builder.

## Verification

Run `npm run test:functional`, `npx tsc --noEmit`, and `npm run build` in the project environment. Run `npm run db:seed` once after deployment to migrate existing News and Success Story route metadata to the new root-level detail parents. This is a non-destructive migration; do not use the reset seed command.

## Older `HomePage` switch-based implementation

The current project uses `HomePage` → `LandingSectionRenderer` → registered landing components. If applying this change to an older copy that still has a hand-written section switch:

- Replace the `StoryRail` import/component with `NewsRail` for the `carousel` section whose `homeComponent` is `news` (legacy `stories` is normalized to `news`).
- Add `SuccessStoriesGallery` for the `carousel` section whose `homeComponent` is `successStories`.
- Remove any old branch that treats “Success Stories of Srizony” as a `cards` section rendered by `DevelopmentAreas`.
- Do not route ordinary page card components into `HomePage`; the special landing gallery is its own registered composition.

Both sections are supplied by the server-side CMS data gateway. News cards use the `/news/{slug}` detail route. Gallery cards use `/success-stories/{slug}` and render the story image and title only.
