-- Landing is the only top-level navigation item. Existing menu rows are moved
-- beneath the shared Landing row without rewriting their public hrefs; since
-- Landing resolves to `/`, current canonical routes remain unchanged.
DO $$
DECLARE
  primary_group_id BIGINT;
  landing_id BIGINT;
  duplicate_id BIGINT;
BEGIN
  SELECT id INTO primary_group_id
  FROM nav_groups
  WHERE key = 'primary'
  LIMIT 1;

  IF primary_group_id IS NULL THEN
    INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
    VALUES ('primary', 'Main Navigation', 'প্রধান নেভিগেশন', -1)
    ON CONFLICT (key) DO NOTHING;
    SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;
  END IF;

  SELECT id INTO landing_id
  FROM nav_items
  WHERE group_id = primary_group_id AND href = '/'
  ORDER BY id
  LIMIT 1;

  IF landing_id IS NULL THEN
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, sort_order)
    VALUES (primary_group_id, NULL, 'Home', 'হোম', '/', 0)
    RETURNING id INTO landing_id;
  END IF;

  -- Merge any duplicate Home rows safely before enforcing the fixed root.
  FOR duplicate_id IN
    SELECT id FROM nav_items WHERE href = '/' AND id <> landing_id ORDER BY id
  LOOP
    UPDATE nav_items SET parent_id = landing_id WHERE parent_id = duplicate_id;
    DELETE FROM nav_items WHERE id = duplicate_id;
  END LOOP;

  -- Keep each menu in its current navigation group, but make it a descendant
  -- of Landing. Existing child/submenu links keep their own parent relationship.
  UPDATE nav_items
  SET parent_id = landing_id
  WHERE parent_id IS NULL AND id <> landing_id;

  UPDATE nav_items SET parent_id = NULL, sort_order = 0 WHERE id = landing_id;
END $$;

-- Partners & Networks is a first-level item beneath the fixed Landing root.
-- Its public canonical URL remains /about-us/partners-networks independently of
-- menu placement, so the URL is never recomposed from the menu parent.
UPDATE nav_items AS collection
SET parent_id = landing.id, is_visible = true
FROM nav_items AS landing
JOIN nav_groups AS landing_group ON landing_group.id = landing.group_id
WHERE collection.href = '/about-us/partners-networks'
  AND landing.href = '/'
  AND landing_group.key = 'primary'
  AND landing.parent_id IS NULL
  AND collection.id <> landing.id
  AND COALESCE(collection.menu_type, 'page') = 'page';

-- Enforce the rule in PostgreSQL as well as in the CMS service. Only the fixed
-- Landing row may have a NULL parent, and it is the sole root row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'nav_items_landing_only_root_chk'
  ) THEN
    ALTER TABLE nav_items
      ADD CONSTRAINT nav_items_landing_only_root_chk
      CHECK (parent_id IS NOT NULL OR href = '/');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS nav_items_single_landing_root_uq
  ON nav_items (href)
  WHERE parent_id IS NULL;
