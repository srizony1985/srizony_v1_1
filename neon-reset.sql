-- DESTRUCTIVE MAINTENANCE ONLY. This deletes all CMS/content and operational records.
-- Run only in an isolated maintenance session after verifying the target database:
--   SET srizony.allow_destructive_reset = 'YES';
--   SET srizony.expected_database = 'the-exact-database-name';
--   \i neon-reset.sql
-- Do not place either SET command in deployment automation.
DO $$
BEGIN
  IF current_setting('srizony.allow_destructive_reset', true) IS DISTINCT FROM 'YES'
     OR current_setting('srizony.expected_database', true) IS DISTINCT FROM current_database() THEN
    RAISE EXCEPTION 'Blocked: set srizony.allow_destructive_reset=YES and srizony.expected_database to the exact current database name in this session.';
  END IF;
END
$$;
BEGIN;
TRUNCATE TABLE
  payment_info,
  sdg_steps,
  contact_footprint,
  contact_socials,
  contact_phones,
  contact_info,
  ui_content,
  themes,
  site_global_state,
  content_entry_video,
  content_entry_gallery,
  content_entry_related,
  content_entry_tags,
  content_entry_bodies,
  content_entries,
  nav_items,
  nav_groups,
  hero_stats,
  hero_slides,
  hero_data,
  carousel_items,
  carousel_sections,
  donation_sections,
  contact_locations,
  contact_sections,
  notice_items,
  notice_list_sections,
  cta_sections,
  video_sections,
  table_section_cells,
  table_section_rows,
  table_section_headers,
  table_sections,
  diagram_sections,
  timeline_items,
  timeline_sections,
  gallery_items,
  gallery_sections,
  card_items,
  cards_sections,
  stat_items,
  stats_sections,
  rich_text_sections,
  sections,
  pages,
  media_items,
  newsletter_subscribers,
  cookie_consents,
  enquiry_daily_limits,
  submissions,
  form_users,
  visitor_events,
  site_visitors,
  donations,
  site_settings
RESTART IDENTITY CASCADE;
COMMIT;

-- Then repopulate structural content from the checked-in source model:
--   npm run db:seed
