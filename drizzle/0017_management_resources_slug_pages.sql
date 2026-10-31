-- Management Staff and Documents & Resources are ordinary CMS slug pages.
-- Normalize any legacy folder-only records without replacing existing page content.
DO $$
DECLARE
  primary_group_id BIGINT;
  who_folder_id BIGINT;
  item_id BIGINT;
  duplicate_id BIGINT;
  item RECORD;
BEGIN
  SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;
  IF primary_group_id IS NULL THEN
    RAISE EXCEPTION 'The primary navigation tree is missing. Run migration 0016 first.';
  END IF;

  SELECT id INTO who_folder_id
  FROM nav_items
  WHERE group_id = primary_group_id AND menu_type = 'folder'
    AND lower(trim(label_en)) = 'who we are'
  ORDER BY id LIMIT 1;
  IF who_folder_id IS NULL THEN
    RAISE EXCEPTION 'The Who We Are navigation folder is missing. Run migration 0016 first.';
  END IF;

  FOR item IN
    SELECT * FROM (VALUES
      ('/management-staff', 'Management Staff', 'ব্যবস্থাপনা কর্মকর্তা', 4, ARRAY['management staff', 'management stuff']::TEXT[]),
      ('/resources', 'Documents & Resources', 'ডকুমেন্ট ও রিসোর্স', 5, ARRAY['documents & resources', 'documents and resources', 'resources']::TEXT[])
    ) AS entries(href, label_en, label_bn, sort_order, legacy_labels)
  LOOP
    SELECT id INTO item_id
    FROM nav_items
    WHERE group_id = primary_group_id
      AND (href = item.href OR lower(trim(label_en)) = ANY(item.legacy_labels))
    ORDER BY CASE WHEN href = item.href AND menu_type = 'page' THEN 0 WHEN href = item.href THEN 1 ELSE 2 END, id
    LIMIT 1;

    IF item_id IS NULL THEN
      INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
      VALUES (primary_group_id, who_folder_id, item.label_en, item.label_bn, item.href, 'page', item.sort_order, true)
      RETURNING id INTO item_id;
    ELSE
      UPDATE nav_items
      SET group_id = primary_group_id,
          parent_id = who_folder_id,
          label_en = item.label_en,
          label_bn = item.label_bn,
          href = item.href,
          menu_type = 'page',
          sort_order = item.sort_order,
          is_visible = true
      WHERE id = item_id;
    END IF;

    -- Remove duplicate slug/folder records while preserving any children.
    FOR duplicate_id IN
      SELECT id FROM nav_items
      WHERE group_id = primary_group_id
        AND id <> item_id
        AND (href = item.href OR lower(trim(label_en)) = ANY(item.legacy_labels))
    LOOP
      UPDATE nav_items SET parent_id = item_id WHERE parent_id = duplicate_id;
      DELETE FROM nav_items WHERE id = duplicate_id;
    END LOOP;

    -- Create a minimal page document only when one does not already exist.
    INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at)
    SELECT item.href, item.label_en, item.label_bn, '', '',
      jsonb_build_object(
        'slug', item.href,
        'title', jsonb_build_object('en', item.label_en, 'bn', item.label_bn),
        'subtitle', jsonb_build_object('en', '', 'bn', ''),
        'sections', jsonb_build_array(jsonb_build_object(
          'type', 'richText', 'visible', true,
          'heading', jsonb_build_object('en', item.label_en, 'bn', item.label_bn),
          'body', jsonb_build_array(jsonb_build_object('en', '', 'bn', ''))
        )),
        'status', 'published', 'sortOrder', item.sort_order
      ), 'published', item.sort_order, now()
    WHERE NOT EXISTS (SELECT 1 FROM pages p WHERE p.slug = item.href)
    ON CONFLICT (slug) DO NOTHING;
  END LOOP;
END $$;
