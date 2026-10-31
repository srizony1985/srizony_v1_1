-- Replace the three navigation groups with one editable hierarchical tree.
-- Home is the fixed root. Who We Are / What We Do are ordinary folder records
-- (no URL); all page destinations retain the explicit slugs supplied below.

DO $$
DECLARE
  primary_group_id BIGINT;
  landing_id BIGINT;
  who_folder_id BIGINT;
  what_folder_id BIGINT;
  parent_item_id BIGINT;
  item_id BIGINT;
  duplicate_id BIGINT;
  keep_ids BIGINT[] := ARRAY[]::BIGINT[];
  item RECORD;
BEGIN
  INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
  VALUES ('primary', 'Site Navigation', 'সাইট নেভিগেশন', 0)
  ON CONFLICT (key) DO UPDATE SET label_en = EXCLUDED.label_en, label_bn = EXCLUDED.label_bn, sort_order = 0;
  SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;

  SELECT id INTO landing_id
  FROM nav_items
  WHERE href = '/' AND COALESCE(menu_type, 'page') = 'page'
  ORDER BY CASE WHEN group_id = primary_group_id THEN 0 ELSE 1 END, id
  LIMIT 1;
  IF landing_id IS NULL THEN
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
    VALUES (primary_group_id, NULL, 'Home', 'হোম', '/', 'page', 0, true)
    RETURNING id INTO landing_id;
  END IF;

  -- Merge legacy Home rows into one stable root.
  FOR duplicate_id IN SELECT id FROM nav_items WHERE href = '/' AND id <> landing_id ORDER BY id LOOP
    UPDATE nav_items SET parent_id = landing_id WHERE parent_id = duplicate_id;
    DELETE FROM nav_items WHERE id = duplicate_id;
  END LOOP;

  -- Merge legacy menu groups into the single primary group before pruning.
  UPDATE nav_items SET group_id = primary_group_id WHERE group_id <> primary_group_id;
  UPDATE nav_items
  SET group_id = primary_group_id, parent_id = NULL, label_en = 'Home', label_bn = 'হোম',
      menu_type = 'page', sort_order = 0, is_visible = true
  WHERE id = landing_id;
  UPDATE nav_items SET parent_id = landing_id WHERE parent_id IS NULL AND id <> landing_id;

  -- URL-less dropdown folders: these are normal reorderable menu nodes, not nav groups.
  SELECT id INTO who_folder_id FROM nav_items
    WHERE group_id = primary_group_id AND menu_type = 'folder' AND label_en = 'Who We Are'
    ORDER BY id LIMIT 1;
  IF who_folder_id IS NULL THEN
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
    VALUES (primary_group_id, landing_id, 'Who We Are', 'আমরা যারা', '', 'folder', 0, true)
    RETURNING id INTO who_folder_id;
  ELSE
    UPDATE nav_items SET parent_id = landing_id, href = '', menu_type = 'folder', label_bn = 'আমরা যারা', sort_order = 0, is_visible = true WHERE id = who_folder_id;
  END IF;

  SELECT id INTO what_folder_id FROM nav_items
    WHERE group_id = primary_group_id AND menu_type = 'folder' AND label_en = 'What We Do'
    ORDER BY id LIMIT 1;
  IF what_folder_id IS NULL THEN
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
    VALUES (primary_group_id, landing_id, 'What We Do', 'আমাদের কার্যক্রম', '', 'folder', 1, true)
    RETURNING id INTO what_folder_id;
  ELSE
    UPDATE nav_items SET parent_id = landing_id, href = '', menu_type = 'folder', label_bn = 'আমাদের কার্যক্রম', sort_order = 1, is_visible = true WHERE id = what_folder_id;
  END IF;

  keep_ids := array_append(keep_ids, landing_id);
  keep_ids := array_append(keep_ids, who_folder_id);
  keep_ids := array_append(keep_ids, what_folder_id);

  -- Each row is a page route with its intended parent path. Folder parents use
  -- the explicit tokens #who-we-are and #what-we-do; routes are never inferred.
  FOR item IN
    SELECT * FROM (VALUES
      ('/projects', 'Projects', 'প্রকল্পসমূহ', '/', 2),
      ('/carrer-job', 'Career / Jobs', 'ক্যারিয়ার / চাকরি', '/', 3),
      ('/notice', 'Notice', 'নোটিশ', '/', 4),
      ('/contact', 'Contact', 'যোগাযোগ', '/', 5),

      ('/about-us', 'About Us', 'আমাদের সম্পর্কে', '#who-we-are', 0),
      ('/about-us/founders-footprint', 'Founders Footprint', 'প্রতিষ্ঠাতার অবদান', '/about-us', 0),
      ('/about-us/awards-recognition', 'Awards & Recognition', 'পুরস্কার ও স্বীকৃতি', '/about-us', 1),
      ('/about-us/executive-committee', 'Executive Committee', 'নির্বাহী কমিটি', '/about-us', 2),
      ('/about-us/operational-structure', 'Operational Structure', 'অপারেশনাল কাঠামো', '/about-us', 3),
      ('/about-us/partners-networks', 'Partners & Networks', 'অংশীদার ও নেটওয়ার্ক', '/about-us', 4),
      ('/about-us/governing-body', 'Governing Body', 'গভর্নিং বডি', '/about-us', 5),
      ('/at-a-glance', 'At A Glance', 'এক নজরে', '#who-we-are', 1),
      ('/impact-on-sdg', 'Impact on SDG', 'এসডিজিতে প্রভাব', '#who-we-are', 2),
      ('/good-governance', 'Good Governance', 'সুশাসন', '#who-we-are', 3),
      ('/management-staff', 'Management Staff', 'ব্যবস্থাপনা কর্মকর্তা', '#who-we-are', 4),
      ('/resources', 'Documents & Resources', 'ডকুমেন্ট ও রিসোর্স', '#who-we-are', 5),

      ('/social-development', 'Social Development', 'সামাজিক উন্নয়ন', '#what-we-do', 0),
      ('/social-development/health-program', 'Health Program', 'স্বাস্থ্য কর্মসূচি', '/social-development', 0),
      ('/social-development/education-program', 'Education Program', 'শিক্ষা কর্মসূচি', '/social-development', 1),
      ('/social-development/human-rights', 'Human Rights', 'মানবাধিকার', '/social-development', 2),
      ('/social-development/human-resource', 'Human Resource', 'মানবসম্পদ', '/social-development', 3),
      ('/social-development/climate-change', 'Climate Change', 'জলবায়ু পরিবর্তন', '/social-development', 4),
      ('/social-development/agriculture-livelihood', 'Agriculture & Livelihood', 'কৃষি ও জীবিকা', '/social-development', 5),

      ('/organizational-development', 'Organizational Development', 'প্রাতিষ্ঠানিক উন্নয়ন', '#what-we-do', 1),
      ('/organizational-development/women-business-loan', 'Women Business Loan', 'নারী ব্যবসা ঋণ', '/organizational-development', 0),
      ('/organizational-development/small-enterprise-loan', 'Small Enterprise Loan', 'ক্ষুদ্র উদ্যোক্তা ঋণ', '/organizational-development', 1),
      ('/organizational-development/agri-development-loan', 'Agri Development Loan', 'কৃষি উন্নয়ন ঋণ', '/organizational-development', 2),
      ('/organizational-development/household-migrant-loan', 'Household Migrant Loan', 'অভিবাসী পরিবার ঋণ', '/organizational-development', 3),
      ('/organizational-development/rural-development-loan', 'Rural Development Loan', 'গ্রামীণ উন্নয়ন ঋণ', '/organizational-development', 4),
      ('/organizational-development/job-holders-loan', 'Job Holders Loan', 'চাকরিজীবী ঋণ', '/organizational-development', 5),
      ('/organizational-development/student-loan', 'Student Loan', 'শিক্ষার্থী ঋণ', '/organizational-development', 6),

      ('/enterprise-development', 'Enterprise Development', 'এন্টারপ্রাইজ উন্নয়ন', '#what-we-do', 2),
      ('/enterprise-development/srizony-hospital', 'Srizony Hospital', 'সৃজনী হাসপাতাল', '/enterprise-development', 0),
      ('/enterprise-development/srizony-university', 'Srizony University', 'সৃজনী ইউনিভার্সিটি', '/enterprise-development', 1),
      ('/enterprise-development/srizony-polytechnic', 'Srizony Polytechnic', 'সৃজনী পলিটেকনিক', '/enterprise-development', 2),
      ('/enterprise-development/srizony-printing-press', 'Srizony Printing Press', 'সৃজনী প্রিন্টিং প্রেস', '/enterprise-development', 3),
      ('/enterprise-development/srizony-filling-station', 'Srizony Filling Station', 'সৃজনী ফিলিং স্টেশন', '/enterprise-development', 4),
      ('/enterprise-development/srizony-internet', 'Srizony Internet', 'সৃজনী ইন্টারনেট', '/enterprise-development', 5),
      ('/enterprise-development/srizony-computer-garden', 'Srizony Computer Garden', 'সৃজনী কম্পিউটার গার্ডেন', '/enterprise-development', 6),
      ('/enterprise-development/srizony-motors', 'Srizony Motors', 'সৃজনী মোটরস', '/enterprise-development', 7),
      ('/microfinance-program', 'Microfinance Program', 'ক্ষুদ্রঋণ কর্মসূচি', '#what-we-do', 3),
      ('/success-stories', 'Success Stories', 'সাফল্যের গল্প', '#what-we-do', 4),
      ('/news', 'News', 'সংবাদ', '#what-we-do', 5)
    ) AS desired(href, label_en, label_bn, parent_route, sort_order)
    ORDER BY array_length(string_to_array(trim(both '/' from href), '/'), 1), parent_route, sort_order
  LOOP
    IF item.parent_route = '/' THEN
      parent_item_id := landing_id;
    ELSIF item.parent_route = '#who-we-are' THEN
      parent_item_id := who_folder_id;
    ELSIF item.parent_route = '#what-we-do' THEN
      parent_item_id := what_folder_id;
    ELSE
      SELECT id INTO parent_item_id FROM nav_items
      WHERE group_id = primary_group_id AND href = item.parent_route AND menu_type = 'page'
      ORDER BY id LIMIT 1;
    END IF;
    IF parent_item_id IS NULL THEN
      RAISE EXCEPTION 'Missing parent % for navigation route %', item.parent_route, item.href;
    END IF;

    SELECT id INTO item_id FROM nav_items
    WHERE group_id = primary_group_id AND href = item.href AND menu_type = 'page'
    ORDER BY id LIMIT 1;
    IF item_id IS NULL THEN
      INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
      VALUES (primary_group_id, parent_item_id, item.label_en, item.label_bn, item.href, 'page', item.sort_order, true)
      RETURNING id INTO item_id;
    ELSE
      UPDATE nav_items
      SET group_id = primary_group_id, parent_id = parent_item_id, label_en = item.label_en,
          label_bn = item.label_bn, href = item.href, menu_type = 'page', sort_order = item.sort_order, is_visible = true
      WHERE id = item_id;
    END IF;

    -- Reparent children of duplicate route rows before deleting the duplicates.
    FOR duplicate_id IN
      SELECT id FROM nav_items
      WHERE href = item.href AND menu_type = 'page' AND id <> item_id
    LOOP
      UPDATE nav_items SET parent_id = item_id WHERE parent_id = duplicate_id;
      DELETE FROM nav_items WHERE id = duplicate_id;
    END LOOP;
    keep_ids := array_append(keep_ids, item_id);
  END LOOP;

  -- Create missing page snapshots but never overwrite existing editorial content.
  INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at)
  SELECT n.href, n.label_en, COALESCE(NULLIF(n.label_bn, ''), n.label_en), '', '',
    jsonb_build_object(
      'slug', n.href,
      'title', jsonb_build_object('en', n.label_en, 'bn', COALESCE(NULLIF(n.label_bn, ''), n.label_en)),
      'subtitle', jsonb_build_object('en', '', 'bn', ''),
      'sections', jsonb_build_array(jsonb_build_object('type', 'richText', 'visible', true,
        'heading', jsonb_build_object('en', n.label_en, 'bn', COALESCE(NULLIF(n.label_bn, ''), n.label_en)),
        'body', jsonb_build_array(jsonb_build_object('en', '', 'bn', '')))),
      'status', 'published', 'sortOrder', n.sort_order
    ), 'published', n.sort_order, now()
  FROM nav_items n
  WHERE n.id = ANY(keep_ids) AND n.menu_type = 'page' AND n.href <> '/'
    AND n.href !~* '^https?://'
    AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.slug = n.href)
  ON CONFLICT (slug) DO NOTHING;

  -- Remove old/unlisted navigation records, but keep every page snapshot.
  DELETE FROM nav_items WHERE NOT (id = ANY(keep_ids));
  DELETE FROM nav_groups WHERE id <> primary_group_id;
END $$;

-- The obsolete Partners & Networks singleton rule is incompatible with a normal menu tree.
DROP INDEX IF EXISTS nav_items_partners_collection_singleton_uq;

-- Preserve the fixed Home root constraint while allowing folder nodes to have an empty href.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nav_items_landing_only_root_chk') THEN
    ALTER TABLE nav_items ADD CONSTRAINT nav_items_landing_only_root_chk CHECK (parent_id IS NOT NULL OR href = '/');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS nav_items_single_landing_root_uq ON nav_items (href) WHERE parent_id IS NULL;
