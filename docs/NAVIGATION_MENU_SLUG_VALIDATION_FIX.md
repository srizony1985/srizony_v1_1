# Navigation menu slug validation fix

## Root cause

The top-level menu validator checked the route depth **after** `normalizeSlug()` had run `canonicalizeCmsRoute()`. That meant a single-segment input could be rewritten by a legacy alias into a nested route before the depth check. This continues to apply to true legacy aliases such as:

| Entered slug | Legacy canonical route |
|---|---|
| `/partners` | `/about-us/partners-networks` |
| `/news` | Now available as a CMS-managed top-level page |
| `/success-stories` | Now available as a CMS-managed top-level page |
| `/health-program` | `/social-development/health-program` |

The route depth check then saw two or more segments and displayed the generic message that top-level menus require one slug, even though the administrator entered one segment. The message did not identify the alias conflict.

The editor also discarded the item's `parent_id` when opening an existing menu, which made an edited submenu appear to the UI as if it were top-level.

## Changes

- Added `inspectTopLevelMenuSlug()` to validate the raw entered slug before legacy aliases are applied.
- Genuine multi-segment top-level inputs still receive the top-level/submenu validation message.
- One-segment slugs that are legacy aliases expanding to nested routes now receive an explicit message naming the canonical destination.
- The menu service uses the same validator as the admin form, so client and server agree.
- Navigation API data now includes `parentId`; editing a submenu retains its parent context.
- The slug help text and inline warning now distinguish actual submenus from top-level legacy aliases.
- No database schema or seed change is required.

## Expected behavior

- `/about-us` is accepted as a new top-level route.
- `/community-program` is accepted as a new top-level route.
- `/about-us/our-team` is rejected when creating a top-level menu; create it as a submenu instead.
- `/partners` remains a reserved alias and names its canonical route.
- `/news` and `/success-stories` are accepted as top-level CMS pages.
- Editing an existing submenu retains its parent context and continues to derive the canonical route from that parent.

## Verification

- 44 JavaScript functional tests passed, including the two new navigation regression contracts.
- Root route validation is covered by the News/Success Stories menu-route regression tests; 12 focused route-helper assertions passed in the follow-up fix.
- 221 TypeScript/TSX files passed syntax transpilation.
- Full semantic TypeScript typecheck and production build were not run in this workspace because project dependencies are not installed here.

No database migration, bootstrap or seed operation is needed. Replace the affected source files or use the supplied full project archive.


## Follow-up correction: News and Success Stories top-level routes

The earlier restriction on `/news` and `/success-stories` was too broad. Those exact roots are now allowed as CMS-managed top-level pages. The collection pages themselves are now the root routes `/news` and `/success-stories`, with root-level detail URLs `/news/{slug}` and `/success-stories/{slug}`. See `ROOT_NEWS_SLUG_MENU_ROUTE_FIX.md`.
