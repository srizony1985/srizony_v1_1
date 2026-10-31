-- Move Career / Jobs into the main navigation without destructive reseeding.
-- Also publish entry points for the administrator-managed staff directory and resource downloads.
INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
VALUES ('primary', 'Main Navigation', 'প্রধান নেভিগেশন', -1)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
DO $$
DECLARE
  primary_group_id BIGINT;
  job_item_id BIGINT;
  next_order INTEGER;
  contact_order INTEGER;
BEGIN
  SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;
  IF primary_group_id IS NOT NULL THEN
    SELECT id INTO job_item_id
      FROM nav_items
      WHERE href IN ('/job-circular', '/job-circulars', '/career')
      ORDER BY CASE WHEN group_id = primary_group_id THEN 0 ELSE 1 END, id
      LIMIT 1;
    SELECT sort_order INTO contact_order
      FROM nav_items
      WHERE group_id = primary_group_id AND parent_id IS NULL AND href IN ('/contact', '/contact-us')
      ORDER BY sort_order, id LIMIT 1;
    IF contact_order IS NOT NULL THEN
      -- Keep Career / Jobs before Contact, matching the bundled fallback navigation.
      UPDATE nav_items SET sort_order = sort_order + 1
      WHERE group_id = primary_group_id AND parent_id IS NULL
        AND (job_item_id IS NULL OR id <> job_item_id) AND sort_order >= contact_order;
      next_order := contact_order;
    ELSE
      SELECT COALESCE(MAX(sort_order) + 1, 0) INTO next_order
        FROM nav_items
        WHERE group_id = primary_group_id AND parent_id IS NULL AND (job_item_id IS NULL OR id <> job_item_id);
    END IF;
    IF job_item_id IS NULL THEN
      INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, featured, sort_order, menu_type)
      VALUES (primary_group_id, NULL, 'Career / Jobs', 'ক্যারিয়ার / চাকরি', '/job-circular', false, next_order, 'page');
    ELSE
      UPDATE nav_items
      SET group_id = primary_group_id, parent_id = NULL,
          label_en = 'Career / Jobs', label_bn = 'ক্যারিয়ার / চাকরি',
          href = '/job-circular', sort_order = next_order, menu_type = 'page'
      WHERE id = job_item_id;
      DELETE FROM nav_items
      WHERE href IN ('/job-circular', '/job-circulars', '/career') AND id <> job_item_id;
    END IF;
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, featured, sort_order, menu_type)
SELECT g.id, NULL, 'Management Staff', 'ব্যবস্থাপনা কর্মকর্তা', '/management-staff', false,
       COALESCE((SELECT MAX(n.sort_order) + 1 FROM nav_items n WHERE n.group_id = g.id AND n.parent_id IS NULL), 0), 'page'
FROM nav_groups g
WHERE g.key = 'who-we-are'
  AND NOT EXISTS (SELECT 1 FROM nav_items n WHERE n.group_id = g.id AND n.href = '/management-staff');
--> statement-breakpoint
INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, featured, sort_order, menu_type)
SELECT g.id, NULL, 'Documents & Resources', 'ডকুমেন্ট ও ডাউনলোড', '/resources', false,
       COALESCE((SELECT MAX(n.sort_order) + 1 FROM nav_items n WHERE n.group_id = g.id AND n.parent_id IS NULL), 0), 'page'
FROM nav_groups g
WHERE g.key = 'who-we-are'
  AND NOT EXISTS (SELECT 1 FROM nav_items n WHERE n.group_id = g.id AND n.href = '/resources');
