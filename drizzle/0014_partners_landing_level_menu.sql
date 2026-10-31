-- Normalize the canonical Partners & Networks menu to one required, visible
-- first-level item beneath Landing. Its public href is intentionally unchanged.
DO $$
DECLARE
  primary_group_id BIGINT;
  who_group_id BIGINT;
  landing_id BIGINT;
  partners_id BIGINT;
  partners_group_id BIGINT;
  duplicate_id BIGINT;
BEGIN
  SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;
  IF primary_group_id IS NULL THEN
    RAISE EXCEPTION 'Primary navigation group is missing; run the structural seed first.';
  END IF;

  SELECT id INTO landing_id
  FROM nav_items
  WHERE group_id = primary_group_id AND href = '/' AND parent_id IS NULL
  ORDER BY id LIMIT 1;
  IF landing_id IS NULL THEN
    RAISE EXCEPTION 'Landing navigation item is missing; run the structural seed first.';
  END IF;

  INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
  VALUES ('who-we-are', 'Who We Are', 'আমরা যারা', 0)
  ON CONFLICT (key) DO NOTHING;
  SELECT id INTO who_group_id FROM nav_groups WHERE key = 'who-we-are' LIMIT 1;

  SELECT i.id, i.group_id INTO partners_id, partners_group_id
  FROM nav_items i
  JOIN nav_groups g ON g.id = i.group_id
  WHERE i.href = '/about-us/partners-networks'
    AND COALESCE(i.menu_type, 'page') = 'page'
  ORDER BY CASE WHEN g.key = 'who-we-are' THEN 0 ELSE 1 END, i.id
  LIMIT 1;

  IF partners_id IS NULL THEN
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
    VALUES (
      who_group_id,
      landing_id,
      'Partners & Networks',
      'অংশীদার ও নেটওয়ার্ক',
      '/about-us/partners-networks',
      'page',
      COALESCE((SELECT MAX(sort_order) + 1 FROM nav_items WHERE group_id = who_group_id AND parent_id = landing_id), 0),
      true
    ) RETURNING id, group_id INTO partners_id, partners_group_id;
  ELSE
    FOR duplicate_id IN
      SELECT id FROM nav_items
      WHERE href = '/about-us/partners-networks' AND id <> partners_id
        AND COALESCE(menu_type, 'page') = 'page'
    LOOP
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM nav_items WHERE parent_id = duplicate_id
        UNION ALL SELECT child.id FROM nav_items child JOIN descendants parent ON child.parent_id = parent.id
      ) UPDATE nav_items SET group_id = partners_group_id WHERE id IN (SELECT id FROM descendants);

      UPDATE nav_items SET parent_id = landing_id WHERE parent_id = duplicate_id;
      DELETE FROM nav_items WHERE id = duplicate_id;
    END LOOP;
  END IF;

  UPDATE nav_items
  SET group_id = partners_group_id, parent_id = landing_id, is_visible = true
  WHERE id = partners_id;

  WITH RECURSIVE descendants(id) AS (
    SELECT id FROM nav_items WHERE parent_id = partners_id
    UNION ALL SELECT child.id FROM nav_items child JOIN descendants parent ON child.parent_id = parent.id
  ) UPDATE nav_items SET group_id = partners_group_id WHERE id IN (SELECT id FROM descendants);

  -- The collection landing cannot act as a submenu parent; its former children
  -- are kept as first-level Landing siblings.
  UPDATE nav_items SET parent_id = landing_id WHERE parent_id = partners_id;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS nav_items_partners_collection_singleton_uq
  ON nav_items (href)
  WHERE href = '/about-us/partners-networks' AND COALESCE(menu_type, 'page') = 'page';
