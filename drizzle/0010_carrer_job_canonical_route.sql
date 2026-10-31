-- Make /carrer-job the canonical CMS-managed Career / Jobs page.
-- Preserve the existing page content and any nested pages before moving menu URLs.
--> statement-breakpoint
WITH legacy_pages AS (
  SELECT p.*,
         CASE
           WHEN p.slug = '/job-circular' OR p.slug LIKE '/job-circular/%' THEN '/carrer-job' || substring(p.slug from length('/job-circular') + 1)
           WHEN p.slug = '/job-circulars' OR p.slug LIKE '/job-circulars/%' THEN '/carrer-job' || substring(p.slug from length('/job-circulars') + 1)
           WHEN p.slug = '/career-job' OR p.slug LIKE '/career-job/%' THEN '/carrer-job' || substring(p.slug from length('/career-job') + 1)
           WHEN p.slug = '/career' OR p.slug LIKE '/career/%' THEN '/carrer-job' || substring(p.slug from length('/career') + 1)
         END AS new_slug
  FROM pages p
  WHERE p.slug IN ('/job-circular', '/job-circulars', '/career-job', '/career')
     OR p.slug LIKE '/job-circular/%' OR p.slug LIKE '/job-circulars/%'
     OR p.slug LIKE '/career-job/%' OR p.slug LIKE '/career/%'
), preferred_pages AS (
  SELECT DISTINCT ON (new_slug) *
  FROM legacy_pages
  WHERE new_slug IS NOT NULL AND new_slug <> slug
  ORDER BY new_slug,
    CASE
      WHEN slug = '/job-circular' OR slug LIKE '/job-circular/%' THEN 0
      WHEN slug = '/career' OR slug LIKE '/career/%' THEN 1
      WHEN slug = '/career-job' OR slug LIKE '/career-job/%' THEN 2
      ELSE 3
    END,
    length(slug)
)
INSERT INTO pages (
  slug, title_en, title_bn, subtitle_en, subtitle_bn, hero_image_id, hero_tone,
  meta_description_en, meta_description_bn, render_cache, status, sort_order, created_at, updated_at
)
SELECT
  p.new_slug, p.title_en, p.title_bn, p.subtitle_en, p.subtitle_bn, p.hero_image_id, p.hero_tone,
  p.meta_description_en, p.meta_description_bn,
  CASE WHEN p.render_cache IS NULL THEN NULL ELSE jsonb_set(p.render_cache, '{slug}', to_jsonb(p.new_slug::text), true) END,
  p.status, p.sort_order, p.created_at, now()
FROM preferred_pages p
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
UPDATE nav_items
SET href = CASE
  WHEN href = '/job-circular' OR href LIKE '/job-circular/%' THEN '/carrer-job' || substring(href from length('/job-circular') + 1)
  WHEN href = '/job-circulars' OR href LIKE '/job-circulars/%' THEN '/carrer-job' || substring(href from length('/job-circulars') + 1)
  WHEN href = '/career-job' OR href LIKE '/career-job/%' THEN '/carrer-job' || substring(href from length('/career-job') + 1)
  WHEN href = '/career' OR href LIKE '/career/%' THEN '/carrer-job' || substring(href from length('/career') + 1)
  ELSE href
END
WHERE href IN ('/job-circular', '/job-circulars', '/career-job', '/career')
   OR href LIKE '/job-circular/%' OR href LIKE '/job-circulars/%'
   OR href LIKE '/career-job/%' OR href LIKE '/career/%';
--> statement-breakpoint
INSERT INTO pages (slug, title_en, title_bn, render_cache, status, sort_order, updated_at)
SELECT '/carrer-job', 'Career / Jobs', 'ক্যারিয়ার / চাকরি',
       jsonb_build_object(
         'slug', '/carrer-job',
         'title', jsonb_build_object('en', 'Career / Jobs', 'bn', 'ক্যারিয়ার / চাকরি'),
         'subtitle', jsonb_build_object('en', '', 'bn', ''),
         'sections', jsonb_build_array(jsonb_build_object(
           'type', 'contentFeed', 'visible', true,
           'heading', jsonb_build_object('en', 'Current Vacancies', 'bn', 'চলমান চাকরির সুযোগ'),
           'components', jsonb_build_array('job'), 'items', jsonb_build_array()
         )),
         'status', 'published', 'sortOrder', 0
       ), 'published', 0, now()
WHERE NOT EXISTS (SELECT 1 FROM pages WHERE slug = '/carrer-job')
  AND EXISTS (SELECT 1 FROM nav_items WHERE href = '/carrer-job' AND COALESCE(menu_type, 'page') = 'page')
ON CONFLICT (slug) DO NOTHING;
