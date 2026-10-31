-- Each contentFeed section represents exactly one collection. Keep the first valid
-- collection on existing snapshots so route resolution remains deterministic.
--> statement-breakpoint
UPDATE pages p
SET render_cache = jsonb_set(
  p.render_cache,
  '{sections}',
  (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN section.value->>'type' = 'contentFeed' THEN
          jsonb_set(
            section.value,
            '{components}',
            jsonb_build_array(
              CASE
                WHEN jsonb_typeof(section.value->'components') = 'array' THEN
                  CASE
                    WHEN jsonb_array_length(section.value->'components') > 0
                     AND section.value->'components'->>0 IN ('project','news','enterprise','partner-agency','health-service','loan-product','product','team','notice','report','job','success-story')
                    THEN to_jsonb(section.value->'components'->>0)
                    ELSE to_jsonb('project'::text)
                  END
                ELSE to_jsonb('project'::text)
              END
            ),
            true
          )
        ELSE section.value
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(p.render_cache->'sections') AS section(value)
  ),
  true
)
WHERE jsonb_typeof(p.render_cache->'sections') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p.render_cache->'sections') AS section(value)
    WHERE section.value->>'type' = 'contentFeed'
      AND CASE WHEN jsonb_typeof(section.value->'components') = 'array' THEN jsonb_array_length(section.value->'components') <> 1 ELSE TRUE END
  );
--> statement-breakpoint
-- Normalize navigation routes to mirror the parent/child menu tree.
-- Existing page snapshots are copied to the new hierarchical path before hrefs move.
--> statement-breakpoint
WITH RECURSIVE route_tree AS (
  SELECT
    n.id,
    n.parent_id,
    n.group_id,
    n.href AS old_href,
    n.menu_type,
    n.label_en,
    n.label_bn,
    n.sort_order,
    CASE
      WHEN COALESCE(n.menu_type, 'page') = 'external' OR n.href ~* '^https?://' THEN n.href
      WHEN n.href = '/' THEN '/'
      ELSE '/' || regexp_replace(trim(n.href, '/'), '^.*/', '')
    END AS new_href
  FROM nav_items n
  WHERE n.parent_id IS NULL

  UNION ALL

  SELECT
    child.id,
    child.parent_id,
    child.group_id,
    child.href AS old_href,
    child.menu_type,
    child.label_en,
    child.label_bn,
    child.sort_order,
    CASE
      WHEN COALESCE(child.menu_type, 'page') = 'external' OR child.href ~* '^https?://' THEN child.href
      WHEN parent.menu_type = 'external' OR parent.new_href ~* '^https?://' THEN '/' || regexp_replace(trim(child.href, '/'), '^.*/', '')
      WHEN parent.new_href = '/' THEN '/' || regexp_replace(trim(child.href, '/'), '^.*/', '')
      ELSE parent.new_href || '/' || regexp_replace(trim(child.href, '/'), '^.*/', '')
    END AS new_href
  FROM nav_items child
  JOIN route_tree parent ON parent.id = child.parent_id
),
page_moves AS (
  SELECT r.*, p.title_en, p.title_bn, p.subtitle_en, p.subtitle_bn, p.hero_tone,
         p.meta_description_en, p.meta_description_bn, p.render_cache, p.status, p.created_at, p.updated_at
  FROM route_tree r
  JOIN pages p ON p.slug = r.old_href
  WHERE r.menu_type <> 'external' AND r.new_href <> r.old_href
)
INSERT INTO pages (
  slug, title_en, title_bn, subtitle_en, subtitle_bn, hero_tone,
  meta_description_en, meta_description_bn, render_cache, status, sort_order, created_at, updated_at
)
SELECT
  m.new_href, m.title_en, m.title_bn, m.subtitle_en, m.subtitle_bn, m.hero_tone,
  m.meta_description_en, m.meta_description_bn,
  CASE WHEN m.render_cache IS NULL THEN NULL ELSE jsonb_set(m.render_cache, '{slug}', to_jsonb(m.new_href), true) END,
  m.status, m.sort_order, m.created_at, now()
FROM page_moves m
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint
WITH RECURSIVE route_tree AS (
  SELECT n.id, n.parent_id, n.group_id, n.href AS old_href, n.menu_type,
    CASE
      WHEN COALESCE(n.menu_type, 'page') = 'external' OR n.href ~* '^https?://' THEN n.href
      WHEN n.href = '/' THEN '/'
      ELSE '/' || regexp_replace(trim(n.href, '/'), '^.*/', '')
    END AS new_href
  FROM nav_items n WHERE n.parent_id IS NULL
  UNION ALL
  SELECT child.id, child.parent_id, child.group_id, child.href AS old_href, child.menu_type,
    CASE
      WHEN COALESCE(child.menu_type, 'page') = 'external' OR child.href ~* '^https?://' THEN child.href
      WHEN parent.menu_type = 'external' OR parent.new_href ~* '^https?://' THEN '/' || regexp_replace(trim(child.href, '/'), '^.*/', '')
      WHEN parent.new_href = '/' THEN '/' || regexp_replace(trim(child.href, '/'), '^.*/', '')
      ELSE parent.new_href || '/' || regexp_replace(trim(child.href, '/'), '^.*/', '')
    END AS new_href
  FROM nav_items child JOIN route_tree parent ON parent.id = child.parent_id
)
UPDATE nav_items n SET href = r.new_href
FROM route_tree r
WHERE r.id = n.id AND n.href IS DISTINCT FROM r.new_href;
--> statement-breakpoint
-- Guarantee every internal navigation item resolves to a page, even if older data omitted a snapshot.
INSERT INTO pages (slug, title_en, title_bn, render_cache, status, sort_order, updated_at)
SELECT n.href, n.label_en, n.label_bn,
       jsonb_build_object(
         'slug', n.href,
         'title', jsonb_build_object('en', n.label_en, 'bn', COALESCE(NULLIF(n.label_bn, ''), n.label_en)),
         'subtitle', jsonb_build_object('en', '', 'bn', ''),
         'sections', jsonb_build_array(jsonb_build_object(
           'type', 'richText', 'visible', true,
           'heading', jsonb_build_object('en', n.label_en, 'bn', COALESCE(NULLIF(n.label_bn, ''), n.label_en)),
           'body', jsonb_build_array(jsonb_build_object('en', '', 'bn', ''))
         )),
         'status', 'published', 'sortOrder', n.sort_order
       ), 'published', n.sort_order, now()
FROM nav_items n
WHERE COALESCE(n.menu_type, 'page') = 'page'
  AND n.href !~* '^https?://'
  AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.slug = n.href)
ON CONFLICT (slug) DO NOTHING;
