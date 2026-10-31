-- CMS routing model v2: stable type collection roots, scoped detail slugs, and
-- an always-present Career / Jobs listing independent of a pre-existing menu row.

-- 1) Ensure the collection pages exist. Existing editorial page snapshots are preserved.
WITH route(slug, component, title_en, title_bn, subtitle_en, subtitle_bn, heading_en, heading_bn, sort_order) AS (
  VALUES
    ('/project', 'project', 'Projects', 'প্রকল্পসমূহ', 'Explore published projects and programmes.', 'প্রকাশিত প্রকল্প ও কর্মসূচি দেখুন।', 'Projects', 'প্রকল্পসমূহ', 10),
    ('/news', 'news', 'News', 'সংবাদ', 'Updates and stories from Srizony Foundation.', 'সৃজনী ফাউন্ডেশনের খবর ও গল্প।', 'Latest News', 'সর্বশেষ সংবাদ', 20),
    ('/enterprise', 'enterprise', 'Enterprises', 'উদ্যোগসমূহ', 'Explore foundation enterprise profiles.', 'ফাউন্ডেশনের উদ্যোগসমূহ দেখুন।', 'Enterprises', 'উদ্যোগসমূহ', 30),
    ('/partner-agency', 'partner-agency', 'Partner Agencies', 'অংশীদার সংস্থা', 'Our partners and institutional networks.', 'আমাদের অংশীদার ও প্রাতিষ্ঠানিক নেটওয়ার্ক।', 'Partner Agencies', 'অংশীদার সংস্থা', 40),
    ('/health-service', 'health-service', 'Health Services', 'স্বাস্থ্যসেবা', 'Health services and community guidance.', 'স্বাস্থ্যসেবা ও কমিউনিটি নির্দেশনা।', 'Health Services', 'স্বাস্থ্যসেবা', 50),
    ('/loan-product', 'loan-product', 'Loan Products', 'ঋণ পণ্য', 'Loan products, eligibility and guidance.', 'ঋণ পণ্য, যোগ্যতা ও নির্দেশনা।', 'Loan Products', 'ঋণ পণ্য', 60),
    ('/product', 'product', 'Products & Services', 'পণ্য ও সেবা', 'Products, services and enterprise offerings.', 'পণ্য, সেবা ও উদ্যোগের প্রস্তাবনা।', 'Products & Services', 'পণ্য ও সেবা', 70),
    ('/team', 'team', 'Team', 'আমাদের টিম', 'Meet the published team and staff.', 'প্রকাশিত টিম ও কর্মীদের সঙ্গে পরিচিত হোন।', 'Our Team', 'আমাদের টিম', 80),
    ('/notice', 'notice', 'Notices', 'নোটিশ', 'Official notices and announcements.', 'অফিসিয়াল নোটিশ ও ঘোষণা।', 'Notices', 'নোটিশ', 90),
    ('/report', 'report', 'Reports', 'প্রতিবেদন', 'Published reports and documents.', 'প্রকাশিত প্রতিবেদন ও নথি।', 'Reports', 'প্রতিবেদন', 100),
    ('/carrer-job', 'job', 'Career / Jobs', 'ক্যারিয়ার / চাকরি', 'Build your career with a purpose-driven organization.', 'উদ্দেশ্যভিত্তিক প্রতিষ্ঠানের সঙ্গে আপনার ক্যারিয়ার গড়ুন।', 'Current Vacancies', 'চলমান চাকরির সুযোগ', 110),
    ('/success-story', 'success-story', 'Success Stories', 'সাফল্যের গল্প', 'Stories of people and communities.', 'মানুষ ও কমিউনিটির সাফল্যের গল্প।', 'Success Stories', 'সাফল্যের গল্প', 120)
)
INSERT INTO pages (slug, title_en, title_bn, subtitle_en, subtitle_bn, render_cache, status, sort_order, updated_at)
SELECT r.slug, r.title_en, r.title_bn, r.subtitle_en, r.subtitle_bn,
  jsonb_build_object(
    'slug', r.slug,
    'title', jsonb_build_object('en', r.title_en, 'bn', r.title_bn),
    'subtitle', jsonb_build_object('en', r.subtitle_en, 'bn', r.subtitle_bn),
    'status', 'published', 'sortOrder', r.sort_order,
    'sections', jsonb_build_array(jsonb_build_object(
      'type', 'contentFeed', 'visible', true,
      'heading', jsonb_build_object('en', r.heading_en, 'bn', r.heading_bn),
      'components', jsonb_build_array(r.component), 'items', '[]'::jsonb
    ))
  ), 'published', r.sort_order, now()
FROM route r
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint

-- Career / Jobs is always a published route, even if the old database never had a
-- corresponding navigation row (the reason the public jobs list could be missing).
UPDATE pages
SET title_en = CASE WHEN COALESCE(title_en, '') = '' THEN 'Career / Jobs' ELSE title_en END,
    title_bn = CASE WHEN COALESCE(title_bn, '') = '' THEN 'ক্যারিয়ার / চাকরি' ELSE title_bn END,
    status = 'published',
    render_cache = jsonb_set(
      COALESCE(render_cache, '{}'::jsonb), '{status}', '"published"'::jsonb, true
    ),
    updated_at = now()
WHERE slug = '/carrer-job';
--> statement-breakpoint

-- Convert the legacy "Open Opportunities" notice section into a one-type job feed.
UPDATE pages p
SET render_cache = jsonb_set(
  COALESCE(p.render_cache, '{}'::jsonb), '{sections}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN section->>'type' = 'noticeList'
          AND lower(COALESCE(section->'heading'->>'en', '')) ~ '(career|job|open opportunities|current vacancies)'
        THEN jsonb_build_object(
          'type', 'contentFeed',
          'visible', COALESCE((section->>'visible')::boolean, true),
          'heading', COALESCE(section->'heading', jsonb_build_object('en','Current Vacancies','bn','চলমান চাকরির সুযোগ')),
          'components', jsonb_build_array('job'), 'items', '[]'::jsonb,
          'buttonConfig', COALESCE(section->'buttonConfig', jsonb_build_object('visible',false,'mode','primary','label',jsonb_build_object('en','Learn more','bn','আরও জানুন'),'href','/contact','action','route'))
        )
        ELSE section
      END ORDER BY ord
    )
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.render_cache->'sections') = 'array' THEN p.render_cache->'sections' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS existing(section, ord)
  ), '[]'::jsonb), true),
  updated_at = now()
WHERE p.slug = '/carrer-job';
--> statement-breakpoint

-- Every collection page has exactly the feed section for its own type. This is
-- idempotent and preserves all existing non-matching sections.
WITH route(slug, component, title_en, title_bn, heading_en, heading_bn) AS (
  VALUES
    ('/project', 'project', 'Projects', 'প্রকল্পসমূহ', 'Projects', 'প্রকল্পসমূহ'),
    ('/news', 'news', 'News', 'সংবাদ', 'Latest News', 'সর্বশেষ সংবাদ'),
    ('/enterprise', 'enterprise', 'Enterprises', 'উদ্যোগসমূহ', 'Enterprises', 'উদ্যোগসমূহ'),
    ('/partner-agency', 'partner-agency', 'Partner Agencies', 'অংশীদার সংস্থা', 'Partner Agencies', 'অংশীদার সংস্থা'),
    ('/health-service', 'health-service', 'Health Services', 'স্বাস্থ্যসেবা', 'Health Services', 'স্বাস্থ্যসেবা'),
    ('/loan-product', 'loan-product', 'Loan Products', 'ঋণ পণ্য', 'Loan Products', 'ঋণ পণ্য'),
    ('/product', 'product', 'Products & Services', 'পণ্য ও সেবা', 'Products & Services', 'পণ্য ও সেবা'),
    ('/team', 'team', 'Team', 'আমাদের টিম', 'Our Team', 'আমাদের টিম'),
    ('/notice', 'notice', 'Notices', 'নোটিশ', 'Notices', 'নোটিশ'),
    ('/report', 'report', 'Reports', 'প্রতিবেদন', 'Reports', 'প্রতিবেদন'),
    ('/carrer-job', 'job', 'Career / Jobs', 'ক্যারিয়ার / চাকরি', 'Current Vacancies', 'চলমান চাকরির সুযোগ'),
    ('/success-story', 'success-story', 'Success Stories', 'সাফল্যের গল্প', 'Success Stories', 'সাফল্যের গল্প')
)
UPDATE pages p
SET render_cache = jsonb_set(
  COALESCE(p.render_cache, '{}'::jsonb), '{sections}',
  COALESCE(CASE WHEN jsonb_typeof(p.render_cache->'sections') = 'array' THEN p.render_cache->'sections' ELSE '[]'::jsonb END, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object(
      'type','contentFeed','visible',true,
      'heading',jsonb_build_object('en',r.heading_en,'bn',r.heading_bn),
      'components',jsonb_build_array(r.component),'items','[]'::jsonb
    )), true),
    updated_at = now()
FROM route r
WHERE p.slug = r.slug
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p.render_cache->'sections') = 'array' THEN p.render_cache->'sections' ELSE '[]'::jsonb END
    ) AS sec(value)
    WHERE sec.value->>'type' = 'contentFeed' AND sec.value->'components' @> jsonb_build_array(r.component)
  );
--> statement-breakpoint

-- Give every legacy content record a stable route parent. The landing page remains
-- unique at '/', and future edits can move a record to another published menu page.
UPDATE cms_content_items
SET attributes = jsonb_set(
  COALESCE(attributes, '{}'::jsonb), '{routeParent}',
  to_jsonb(CASE component
    WHEN 'project' THEN '/project' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise'
    WHEN 'partner-agency' THEN '/partner-agency' WHEN 'health-service' THEN '/health-service'
    WHEN 'loan-product' THEN '/loan-product' WHEN 'product' THEN '/product' WHEN 'team' THEN '/team'
    WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/report' WHEN 'job' THEN '/carrer-job'
    WHEN 'success-story' THEN '/success-story' ELSE '/' END), true
), updated_at = now()
WHERE NULLIF(attributes->>'routeParent', '') IS NULL;
--> statement-breakpoint

-- Legacy versions allowed the same slug for different component types on one
-- parent page. That would make a single URL ambiguous. Preserve each item and
-- its slug, but return colliding legacy items to their component collection root
-- before creating the route-scoped unique index.
WITH routed_items AS (
  SELECT id, component, slug,
    COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
      WHEN 'project' THEN '/project' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise'
      WHEN 'partner-agency' THEN '/partner-agency' WHEN 'health-service' THEN '/health-service'
      WHEN 'loan-product' THEN '/loan-product' WHEN 'product' THEN '/product' WHEN 'team' THEN '/team'
      WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/report' WHEN 'job' THEN '/carrer-job'
      WHEN 'success-story' THEN '/success-story' ELSE '/' END) AS route_parent,
    COUNT(*) OVER (PARTITION BY COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
      WHEN 'project' THEN '/project' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise'
      WHEN 'partner-agency' THEN '/partner-agency' WHEN 'health-service' THEN '/health-service'
      WHEN 'loan-product' THEN '/loan-product' WHEN 'product' THEN '/product' WHEN 'team' THEN '/team'
      WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/report' WHEN 'job' THEN '/carrer-job'
      WHEN 'success-story' THEN '/success-story' ELSE '/' END), slug) AS collision_count
  FROM cms_content_items
)
UPDATE cms_content_items AS target
SET attributes = jsonb_set(COALESCE(target.attributes, '{}'::jsonb), '{routeParent}', to_jsonb(CASE target.component
      WHEN 'project' THEN '/project' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise'
      WHEN 'partner-agency' THEN '/partner-agency' WHEN 'health-service' THEN '/health-service'
      WHEN 'loan-product' THEN '/loan-product' WHEN 'product' THEN '/product' WHEN 'team' THEN '/team'
      WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/report' WHEN 'job' THEN '/carrer-job'
      WHEN 'success-story' THEN '/success-story' ELSE '/' END), true),
    updated_at = now()
FROM routed_items AS collision
WHERE target.id = collision.id AND collision.collision_count > 1;
--> statement-breakpoint

-- Slugs belong to a concrete parent route. Two records can use "impact" under
-- different pages, but there can never be two records for the same public URL.
CREATE UNIQUE INDEX IF NOT EXISTS cms_content_items_route_slug_uq
  ON cms_content_items (
    (COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
      WHEN 'project' THEN '/project' WHEN 'news' THEN '/news' WHEN 'enterprise' THEN '/enterprise'
      WHEN 'partner-agency' THEN '/partner-agency' WHEN 'health-service' THEN '/health-service'
      WHEN 'loan-product' THEN '/loan-product' WHEN 'product' THEN '/product' WHEN 'team' THEN '/team'
      WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/report' WHEN 'job' THEN '/carrer-job'
      WHEN 'success-story' THEN '/success-story' ELSE '/' END)), slug
  );
--> statement-breakpoint
DROP INDEX IF EXISTS cms_content_items_component_slug_uq;
--> statement-breakpoint

-- Ensure Career / Jobs is an actual main-navigation item, not only an alias or a page.
INSERT INTO nav_groups (key, label_en, label_bn, sort_order)
VALUES ('primary', 'Main Navigation', 'প্রধান নেভিগেশন', -1)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
DO $$
DECLARE
  primary_group_id BIGINT;
  job_item_id BIGINT;
BEGIN
  SELECT id INTO primary_group_id FROM nav_groups WHERE key = 'primary' LIMIT 1;
  SELECT id INTO job_item_id
  FROM nav_items
  WHERE href IN ('/carrer-job', '/job-circular', '/job-circulars', '/career', '/career-job')
  ORDER BY CASE WHEN href = '/carrer-job' THEN 0 ELSE 1 END, id
  LIMIT 1;

  IF job_item_id IS NULL THEN
    INSERT INTO nav_items (group_id, parent_id, label_en, label_bn, href, featured, sort_order, menu_type, content_types, section_count, section_content_type, section_button_type)
    VALUES (primary_group_id, NULL, 'Career / Jobs', 'ক্যারিয়ার / চাকরি', '/carrer-job', false, -100, 'page', '["contentFeed"]'::jsonb, 1, 'contentFeed', 'none');
  ELSE
    UPDATE nav_items
    SET group_id = primary_group_id, parent_id = NULL,
        label_en = 'Career / Jobs', label_bn = 'ক্যারিয়ার / চাকরি', href = '/carrer-job',
        menu_type = 'page', content_types = '["contentFeed"]'::jsonb,
        section_count = 1, section_content_type = 'contentFeed', section_button_type = 'none', sort_order = -100
    WHERE id = job_item_id;
    DELETE FROM nav_items
    WHERE id <> job_item_id AND href IN ('/carrer-job', '/job-circular', '/job-circulars', '/career', '/career-job');
  END IF;
END $$;
--> statement-breakpoint

-- Revalidate at runtime when the next content write occurs; the migration itself is
-- intentionally limited to data/schema changes and does not manufacture job posts.
