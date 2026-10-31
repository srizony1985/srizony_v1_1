# Canonical News and Success Story routes

- News collection: `/news`
- News detail: `/news/{news-slug}`
- Success Stories collection: `/success-stories`
- Success Story detail: `/success-stories/{story-slug}`

No separate collection pages exist at `/what-we-do/news` or `/what-we-do/success-stories`. Those exact old URLs redirect to the canonical roots. Old nested detail paths redirect to the canonical detail routes.

Landing is the sole top-level navigation item. News and Success Stories are direct child menus under Landing; their public collection URLs remain root routes (`/news` and `/success-stories`) rather than nested under “What We Do”.

The structural seed migrates the old page rows, nav links and content parent metadata without resetting existing CMS content.
