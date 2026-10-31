# Complete Landing Page CMS Management

## News Rail and Success Stories Gallery cards

Both homepage collections are managed directly from the Landing Page Page Builder. Open **Admin Dashboard → Page Builder → Landing Page**, then expand the **News Rail** or **Success Stories Gallery** section.

- **Add news card** creates a normal News record in the canonical Site Content database collection.
- **Add success story card** creates a normal Success Story record in the canonical Site Content database collection.
- Existing entries can be edited or deleted from the same panel. Draft, published, and hidden states remain managed by the shared `ContentEditor` workflow.
- Each record supports an editable slug, English/Bangla title, summary, body, publish date, media, and landing-card display order.
- Success Story records require an approved CMS image both when saving and when publishing because the homepage gallery is an image-and-title-only visual component. Legacy seed artwork does not count as an approved CMS image; records without an approved image do not render in the gallery or become publishable.
- Lower `displayOrder` values appear first. A blank order uses publication date as the fallback ordering.
- The section's **Maximum cards displayed** setting controls the number of published records retrieved for the homepage.

The Page Builder does not duplicate collection records into the page JSON. The page JSON stores layout, title/eyebrow/body, visibility, button settings, and maximum item count. The cards themselves remain in `cms_content_items`, so Site Content, detail pages, collection pages and the landing page all use the same records.

Canonical detail routes:

- News: `/news/{slug}`
- Success Story: `/success-stories/{slug}`

The News and Success Story collection pages remain separate from those detail routes.

## Earlier `newsFeed` homepage identity

An earlier homepage implementation stored the News Rail as `homeComponent: "newsFeed"` with the heading “Latest News”. That identity is accepted as a deprecated compatibility alias, mapped to the News Rail renderer and editor, and normalized to the current `news` identity when the homepage is read. This ensures the card manager is visible for older saved homepages too.

## Landing page controls available in the CMS

The Landing Page Page Builder controls section order, visibility, duplication and removal. Its registered special compositions have dedicated data controls:

| Landing composition | CMS editing location | Managed values |
|---|---|---|
| Hero | Page Builder → Landing Page Hero | Slides, images, alt text, titles, descriptions, destinations, autoplay and hero options |
| Growth / impact | Page Builder → Growth section | Bilingual statistics, labels, figures and section copy |
| Mission, Vision & Values | Portfolio + Page Builder | Bilingual titles/copy, individual reusable illustrations and custom card artwork |
| Office locations | Portfolio / Website Essentials + Page Builder | Branch names, addresses, coordinates, manager contacts, section copy |
| Development Areas | Page Builder → Development Areas | Bilingual card text, images and reusable illustrations |
| News Rail | Page Builder → News Rail | Published News records, images, card order and card limit |
| Success Stories Gallery | Page Builder → Success Stories Gallery | Published image-backed Success Story records, card order and card limit |
| Donation CTA | Page Builder → Donation CTA | Bilingual copy, buttons, button visibility and destination routes |

Portfolio-owned fields remain in the Portfolio/Website Essentials editor because those same records are reused across multiple pages. Page Builder owns homepage composition and per-section presentation. This avoids maintaining duplicate versions of locations or mission/vision/values.

## Data persistence

No new database tables or schema migration are required for these controls:

- News and Success Story card data is stored in the existing `cms_content_items` rows and JSONB attributes.
- Landing section configuration and order are stored in the existing `pages` record for `/` (`render_cache`).
- `displayOrder` is a validated content attribute; `maxItems` is a validated section setting.
- All writes use existing authenticated CMS APIs, audit logging, route revalidation and the shared DB repository.

After deploying source changes, run the project's normal build and checks. No destructive database reset or reseed is needed for these additions.
