-- Install the site's three explicit, editable navigation groups.
-- The fixed Home record is the only database root.
-- All route hrefs are saved explicitly and never recomposed after drag/drop.

DO $$
DECLARE
  primary_group_id BIGINT;
  who_group_id BIGINT;
  what_group_id BIGINT;
  landing_id BIGINT;
  parent_item_id BIGINT;
  item_id BIGINT;
  duplicate_id BIGINT;
  keep_ids BIGINT[] := ARRAY[]::BIGINT[];
  item RECORD;
BEGIN
  INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
  VALUES
    ('primary', 'Main Navigation', 'প্রধান নেভিগেশন', -1),
    ('who-we-are', 'Who We Are', 'আমরা যারা', 0),
    ('what-we-do', 'What We Do', 'আমাদের কার্যক্রম', 1)
  ON CONFLICT (key) DO UPDATE SET
    label_en = EXCLUDED.label_en,
    label_bn = EXCLUDED.label_bn,
    sort_order = EXCLUDED.sort_order;

  SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;
  SELECT id INTO who_group_id FROM nav_groups WHERE key = 'who-we-are' LIMIT 1;
  SELECT id INTO what_group_id FROM nav_groups WHERE key = 'what-we-do' LIMIT 1;

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

  -- Merge old Home duplicates without losing their child records.
  FOR duplicate_id IN
    SELECT id FROM nav_items WHERE href = '/' AND id <> landing_id ORDER BY id
  LOOP
    UPDATE nav_items SET parent_id = landing_id WHERE parent_id = duplicate_id;
    DELETE FROM nav_items WHERE id = duplicate_id;
  END LOOP;

  UPDATE nav_items
  SET group_id = primary_group_id,
      parent_id = NULL,
      label_en = 'Home',
      label_bn = 'হোম',
      menu_type = 'page',
      sort_order = 0,
      is_visible = true
  WHERE id = landing_id;

  keep_ids := array_append(keep_ids, landing_id);

  -- First-level entries are deliberately ordered before their own children.
  FOR item IN
    SELECT * FROM (VALUES
      ('primary', '/projects', 'Projects', 'প্রকল্পসমূহ', '/', 0),
      ('primary', '/carrer-job', 'Career / Jobs', 'ক্যারিয়ার / চাকরি', '/', 1),
      ('primary', '/notice', 'Notice', 'নোটিশ', '/', 2),
      ('primary', '/contact', 'Contact', 'যোগাযোগ', '/', 3),

      ('who-we-are', '/about-us', 'About Us', 'আমাদের সম্পর্কে', '/', 0),
      ('who-we-are', '/about-us/founders-footprint', 'Founders Footprint', 'প্রতিষ্ঠাতার অবদান', '/about-us', 0),
      ('who-we-are', '/about-us/awards-recognition', 'Awards & Recognition', 'পুরস্কার ও স্বীকৃতি', '/about-us', 1),
      ('who-we-are', '/about-us/executive-committee', 'Executive Committee', 'নির্বাহী কমিটি', '/about-us', 2),
      ('who-we-are', '/about-us/operational-structure', 'Operational Structure', 'অপারেশনাল কাঠামো', '/about-us', 3),
      ('who-we-are', '/about-us/partners-networks', 'Partners & Networks', 'অংশীদার ও নেটওয়ার্ক', '/about-us', 4),
      ('who-we-are', '/about-us/governing-body', 'Governing Body', 'গভর্নিং বডি', '/about-us', 5),
      ('who-we-are', '/at-a-glance', 'At A Glance', 'এক নজরে', '/', 1),
      ('who-we-are', '/impact-on-sdg', 'Impact on SDG', 'এসডিজিতে প্রভাব', '/', 2),
      ('who-we-are', '/good-governance', 'Good Governance', 'সুশাসন', '/', 3),
      ('who-we-are', '/management-staff', 'Management Staff', 'ব্যবস্থাপনা কর্মকর্তা', '/', 4),
      ('who-we-are', '/resources', 'Documents & Resources', 'ডকুমেন্ট ও ডাউনলোড', '/', 5),

      ('what-we-do', '/social-development', 'Social Development', 'সামাজিক উন্নয়ন', '/', 0),
      ('what-we-do', '/social-development/health-program', 'Health Program', 'স্বাস্থ্য কর্মসূচি', '/social-development', 0),
      ('what-we-do', '/social-development/education-program', 'Education Program', 'শিক্ষা কর্মসূচি', '/social-development', 1),
      ('what-we-do', '/social-development/human-rights', 'Human Rights', 'মানবাধিকার', '/social-development', 2),
      ('what-we-do', '/social-development/human-resource', 'Human Resource', 'মানবসম্পদ', '/social-development', 3),
      ('what-we-do', '/social-development/climate-change', 'Climate Change', 'জলবায়ু পরিবর্তন', '/social-development', 4),
      ('what-we-do', '/social-development/agriculture-livelihood', 'Agriculture & Livelihood', 'কৃষি ও জীবিকা', '/social-development', 5),
      ('what-we-do', '/organizational-development', 'Organizational Development', 'প্রাতিষ্ঠানিক উন্নয়ন', '/', 1),
      ('what-we-do', '/organizational-development/women-business-loan', 'Women Business Loan', 'নারী ব্যবসা ঋণ', '/organizational-development', 0),
      ('what-we-do', '/organizational-development/small-enterprise-loan', 'Small Enterprise Loan', 'ক্ষুদ্র উদ্যোক্তা ঋণ', '/organizational-development', 1),
      ('what-we-do', '/organizational-development/agri-development-loan', 'Agri Development Loan', 'কৃষি উন্নয়ন ঋণ', '/organizational-development', 2),
      ('what-we-do', '/organizational-development/household-migrant-loan', 'Household Migrant Loan', 'অভিবাসী পরিবার ঋণ', '/organizational-development', 3),
      ('what-we-do', '/organizational-development/rural-development-loan', 'Rural Development Loan', 'গ্রামীণ উন্নয়ন ঋণ', '/organizational-development', 4),
      ('what-we-do', '/organizational-development/job-holders-loan', 'Job Holders Loan', 'চাকরিজীবী ঋণ', '/organizational-development', 5),
      ('what-we-do', '/organizational-development/student-loan', 'Student Loan', 'শিক্ষার্থী ঋণ', '/organizational-development', 6),
      ('what-we-do', '/enterprise-development', 'Enterprise Development', 'এন্টারপ্রাইজ উন্নয়ন', '/', 2),
      ('what-we-do', '/enterprise-development/srizony-hospital', 'Srizony Hospital', 'সৃজনী হাসপাতাল', '/enterprise-development', 0),
      ('what-we-do', '/enterprise-development/srizony-university', 'Srizony University', 'সৃজনী ইউনিভার্সিটি', '/enterprise-development', 1),
      ('what-we-do', '/enterprise-development/srizony-polytechnic', 'Srizony Polytechnic', 'সৃজনী পলিটেকনিক', '/enterprise-development', 2),
      ('what-we-do', '/enterprise-development/srizony-printing-press', 'Srizony Printing Press', 'সৃজনী প্রিন্টিং প্রেস', '/enterprise-development', 3),
      ('what-we-do', '/enterprise-development/srizony-filling-station', 'Srizony Filling Station', 'সৃজনী ফিলিং স্টেশন', '/enterprise-development', 4),
      ('what-we-do', '/enterprise-development/srizony-internet', 'Srizony Internet', 'সৃজনী ইন্টারনেট', '/enterprise-development', 5),
      ('what-we-do', '/enterprise-development/srizony-computer-garden', 'Srizony Computer Garden', 'সৃজনী কম্পিউটার গার্ডেন', '/enterprise-development', 6),
      ('what-we-do', '/enterprise-development/srizony-motors', 'Srizony Motors', 'সৃজনী মোটরস', '/enterprise-development', 7),
      ('what-we-do', '/microfinance-program', 'Microfinance Program', 'ক্ষুদ্রঋণ কর্মসূচি', '/', 3),
      ('what-we-do', '/success-stories', 'Success Stories', 'সাফল্যের গল্প', '/', 4),
      ('what-we-do', '/news', 'News', 'সংবাদ', '/', 5)
    ) AS desired(group_key, href, label_en, label_bn, parent_href, sort_order)
    ORDER BY CASE WHEN parent_href = '/' THEN 0 ELSE 1 END,
             group_key, parent_href, sort_order
  LOOP
    IF item.group_key = 'primary' THEN
      parent_item_id := landing_id;
    ELSE
      parent_item_id := landing_id;
    END IF;

    IF item.parent_href <> '/' THEN
      SELECT id INTO parent_item_id
      FROM nav_items
      WHERE href = item.parent_href
        AND group_id = CASE item.group_key
          WHEN 'who-we-are' THEN who_group_id
          WHEN 'what-we-do' THEN what_group_id
          ELSE primary_group_id
        END
        AND COALESCE(menu_type, 'page') = 'page'
      ORDER BY id
      LIMIT 1;
      IF parent_item_id IS NULL THEN
        RAISE EXCEPTION 'Missing navigation parent % for route %', item.parent_href, item.href;
      END IF;
    END IF;

    SELECT id INTO item_id
    FROM nav_items
    WHERE href = item.href AND COALESCE(menu_type, 'page') = 'page'
    ORDER BY CASE
      WHEN group_id = CASE item.group_key
        WHEN 'who-we-are' THEN who_group_id
        WHEN 'what-we-do' THEN what_group_id
        ELSE primary_group_id
      END THEN 0 ELSE 1 END,
      id
    LIMIT 1;

    IF item_id IS NULL THEN
      INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, menu_type, sort_order, is_visible)
      VALUES (
        CASE item.group_key WHEN 'who-we-are' THEN who_group_id WHEN 'what-we-do' THEN what_group_id ELSE primary_group_id END,
        parent_item_id, item.label_en, item.label_bn, item.href, 'page', item.sort_order, true
      ) RETURNING id INTO item_id;
    ELSE
      UPDATE nav_items
      SET group_id = CASE item.group_key WHEN 'who-we-are' THEN who_group_id WHEN 'what-we-do' THEN what_group_id ELSE primary_group_id END,
          parent_id = parent_item_id,
          label_en = item.label_en,
          label_bn = item.label_bn,
          href = item.href,
          menu_type = 'page',
          sort_order = item.sort_order,
          is_visible = true
      WHERE id = item_id;
    END IF;

    -- Merge duplicated menu rows into the retained record; page data is not deleted.
    FOR duplicate_id IN
      SELECT id FROM nav_items
      WHERE href = item.href AND COALESCE(menu_type, 'page') = 'page' AND id <> item_id
    LOOP
      UPDATE nav_items SET parent_id = item_id
      WHERE parent_id = duplicate_id;
      DELETE FROM nav_items WHERE id = duplicate_id;
    END LOOP;

    keep_ids := array_append(keep_ids, item_id);
  END LOOP;

  -- Every internal menu target must resolve to a page snapshot. Existing
  -- editorial pages are never overwritten; only missing snapshots are created.
  INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at)
  SELECT n.href,
         n.label_en,
         COALESCE(NULLIF(n.label_bn, ''), n.label_en),
         '',
         '',
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
         ),
         'published', n.sort_order, now()
  FROM nav_items n
  WHERE n.id = ANY(keep_ids)
    AND COALESCE(n.menu_type, 'page') = 'page'
    AND n.href !~* '^https?://'
    AND NOT EXISTS (SELECT 1 FROM pages p WHERE p.slug = n.href)
  ON CONFLICT (slug) DO NOTHING;

  -- Only the paths in the approved navigation specification remain in the menu.
  -- Removing a nav row never deletes its underlying page record.
  DELETE FROM nav_items WHERE NOT (id = ANY(keep_ids));

  -- Remove obsolete navigation groups while preserving the three named groups.
  DELETE FROM nav_groups WHERE key NOT IN ('primary', 'who-we-are', 'what-we-do');
END $$;

-- The old unique index encoded a Partners & Networks menu exception.
-- That page is now a normal editable child of About Us.
DROP INDEX IF EXISTS nav_items_partners_collection_singleton_uq;

-- Keep the landing-only root invariant without imposing any special menu rules
-- on collection pages or individual menu slugs.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nav_items_landing_only_root_chk') THEN
    ALTER TABLE nav_items
      ADD CONSTRAINT nav_items_landing_only_root_chk
      CHECK (parent_id IS NOT NULL OR href = '/');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS nav_items_single_landing_root_uq
  ON nav_items (href)
  WHERE parent_id IS NULL;
