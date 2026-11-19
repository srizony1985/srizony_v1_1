-- Location maps are opt-in and supported only on the landing and contact pages.
-- Reset older snapshots which may have been seeded with the previous visible-by-default behavior.
UPDATE pages
SET render_cache = jsonb_set(
  COALESCE(render_cache, '{}'::jsonb),
  '{showContactMap}',
  'false'::jsonb,
  true
),
updated_at = now()
WHERE COALESCE(render_cache->>'showContactMap', 'false') = 'true';
