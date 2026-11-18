-- 0002_structural_entity_database.sql
-- Relational content model derived from types/entityType.ts.
-- Operational tables (visitors/forms/donations/etc.) remain relational and are preserved.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'cms_menu_content' AND relkind = 'r') THEN
    ALTER TABLE cms_menu_content RENAME TO cms_menu_content_legacy;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'cms_documents' AND relkind = 'r') THEN
    ALTER TABLE cms_documents RENAME TO cms_documents_legacy;
  END IF;
END $$;
DROP VIEW IF EXISTS cms_menu_content CASCADE;
DROP VIEW IF EXISTS cms_documents CASCADE;

CREATE TABLE IF NOT EXISTS media_items (
  id BIGSERIAL PRIMARY KEY,
  src TEXT NOT NULL,
  alt_en TEXT NOT NULL DEFAULT '',
  alt_bn TEXT NOT NULL DEFAULT '',
  caption_en TEXT,
  caption_bn TEXT,
  kind VARCHAR(20) NOT NULL DEFAULT 'image',
  hover_src TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pages (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  subtitle_en TEXT,
  subtitle_bn TEXT,
  hero_image_id BIGINT REFERENCES media_items(id) ON DELETE SET NULL,
  hero_tone VARCHAR(20),
  meta_description_en TEXT,
  meta_description_bn TEXT,
  render_cache JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pages ADD COLUMN IF NOT EXISTS render_cache JSONB;

CREATE TABLE IF NOT EXISTS sections (
  id BIGSERIAL PRIMARY KEY,
  page_id BIGINT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  section_type VARCHAR(40) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sections_page_order_idx ON sections(page_id, sort_order);

CREATE TABLE IF NOT EXISTS rich_text_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  eyebrow_en TEXT,
  eyebrow_bn TEXT,
  heading_en TEXT,
  heading_bn TEXT,
  body_en TEXT[] NOT NULL DEFAULT '{}',
  body_bn TEXT[] NOT NULL DEFAULT '{}',
  image_id BIGINT REFERENCES media_items(id) ON DELETE SET NULL,
  reverse BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS stats_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stat_items (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES stats_sections(section_id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  note_en TEXT,
  note_bn TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cards_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  eyebrow_en TEXT,
  eyebrow_bn TEXT,
  heading_en TEXT,
  heading_bn TEXT,
  columns SMALLINT CHECK (columns IN (2,3,4))
);

CREATE TABLE IF NOT EXISTS card_items (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES cards_sections(section_id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  icon VARCHAR(40),
  image_id BIGINT REFERENCES media_items(id) ON DELETE SET NULL,
  illustration VARCHAR(80),
  href TEXT,
  tag_en TEXT,
  tag_bn TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gallery_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT,
  columns SMALLINT CHECK (columns IN (2,3,4))
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES gallery_sections(section_id) ON DELETE CASCADE,
  media_id BIGINT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS timeline_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT
);

CREATE TABLE IF NOT EXISTS timeline_items (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES timeline_sections(section_id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS diagram_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT,
  body_en TEXT,
  body_bn TEXT,
  variant VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS table_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT
);

CREATE TABLE IF NOT EXISTS table_section_headers (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES table_sections(section_id) ON DELETE CASCADE,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS table_section_rows (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES table_sections(section_id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS table_section_cells (
  id BIGSERIAL PRIMARY KEY,
  row_id BIGINT NOT NULL REFERENCES table_section_rows(id) ON DELETE CASCADE,
  value_en TEXT NOT NULL DEFAULT '',
  value_bn TEXT NOT NULL DEFAULT '',
  column_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS video_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT,
  body_en TEXT,
  body_bn TEXT,
  poster TEXT NOT NULL,
  embed_url TEXT,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS cta_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT NOT NULL,
  heading_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  primary_label_en TEXT NOT NULL,
  primary_label_bn TEXT NOT NULL,
  primary_href TEXT NOT NULL,
  secondary_label_en TEXT,
  secondary_label_bn TEXT,
  secondary_href TEXT
);

CREATE TABLE IF NOT EXISTS notice_list_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT
);

CREATE TABLE IF NOT EXISTS notice_items (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES notice_list_sections(section_id) ON DELETE CASCADE,
  date_value TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  href TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT,
  address_en TEXT NOT NULL,
  address_bn TEXT NOT NULL,
  phones TEXT[] NOT NULL DEFAULT '{}',
  emails TEXT[] NOT NULL DEFAULT '{}',
  map_label_en TEXT,
  map_label_bn TEXT
);

CREATE TABLE IF NOT EXISTS contact_locations (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES contact_sections(section_id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  address_en TEXT NOT NULL,
  address_bn TEXT NOT NULL,
  map_query TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  kind VARCHAR(20),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS donation_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  heading_en TEXT,
  heading_bn TEXT,
  body_en TEXT,
  body_bn TEXT
);

CREATE TABLE IF NOT EXISTS carousel_sections (
  section_id BIGINT PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  eyebrow_en TEXT,
  eyebrow_bn TEXT,
  heading_en TEXT,
  heading_bn TEXT,
  body_en TEXT,
  body_bn TEXT
);

CREATE TABLE IF NOT EXISTS carousel_items (
  id BIGSERIAL PRIMARY KEY,
  section_id BIGINT NOT NULL REFERENCES carousel_sections(section_id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  body_en TEXT,
  body_bn TEXT,
  image_id BIGINT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  href TEXT,
  tag_en TEXT,
  tag_bn TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hero_data (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  eyebrow_en TEXT NOT NULL,
  eyebrow_bn TEXT NOT NULL,
  heading_line_one_en TEXT NOT NULL,
  heading_line_one_bn TEXT NOT NULL,
  heading_line_two_en TEXT NOT NULL,
  heading_line_two_bn TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_bn TEXT NOT NULL,
  primary_action_label_en TEXT NOT NULL,
  primary_action_label_bn TEXT NOT NULL,
  primary_action_href TEXT NOT NULL,
  secondary_action_label_en TEXT NOT NULL,
  secondary_action_label_bn TEXT NOT NULL,
  secondary_action_href TEXT NOT NULL,
  autoplay BOOLEAN NOT NULL DEFAULT true,
  autoplay_interval INTEGER,
  video_href TEXT
);

CREATE TABLE IF NOT EXISTS hero_slides (
  id VARCHAR(120) PRIMARY KEY,
  image_id BIGINT NOT NULL REFERENCES media_items(id) ON DELETE RESTRICT,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_bn TEXT NOT NULL,
  href TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hero_stats (
  id VARCHAR(120) PRIMARY KEY,
  icon VARCHAR(40) NOT NULL,
  value_en TEXT NOT NULL DEFAULT '',
  value_bn TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nav_groups (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(120) NOT NULL,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nav_items (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES nav_groups(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES nav_items(id) ON DELETE CASCADE,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  href TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Navigation group keys are used by later migrations with ON CONFLICT (key).
-- Establish the unique index here, before migration 0008 first relies on it.
-- Older partially provisioned databases may contain duplicate keys; preserve
-- every group and its nav_items by assigning deterministic, collision-free
-- legacy keys to the duplicate rows before enforcing uniqueness.
DO $$
DECLARE
  duplicate_group RECORD;
  replacement_key TEXT;
  suffix INTEGER;
BEGIN
  FOR duplicate_group IN
    SELECT id
    FROM (
      SELECT id, row_number() OVER (PARTITION BY key ORDER BY id) AS row_number
      FROM nav_groups
    ) ranked
    WHERE row_number > 1
    ORDER BY id
  LOOP
    replacement_key := 'legacy-' || duplicate_group.id::text;
    suffix := 0;

    WHILE EXISTS (SELECT 1 FROM nav_groups WHERE key = replacement_key) LOOP
      suffix := suffix + 1;
      replacement_key := 'legacy-' || duplicate_group.id::text || '-' || suffix::text;
    END LOOP;

    UPDATE nav_groups
    SET key = replacement_key
    WHERE id = duplicate_group.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS nav_groups_key_uq ON nav_groups(key);

CREATE TABLE IF NOT EXISTS content_entries (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_bn TEXT NOT NULL,
  excerpt_en TEXT NOT NULL,
  excerpt_bn TEXT NOT NULL,
  date_value TEXT,
  category VARCHAR(30) NOT NULL,
  image_id BIGINT REFERENCES media_items(id) ON DELETE SET NULL,
  href TEXT
);

CREATE TABLE IF NOT EXISTS content_entry_bodies (
  id BIGSERIAL PRIMARY KEY,
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_entry_tags (
  id BIGSERIAL PRIMARY KEY,
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  tag_en TEXT NOT NULL,
  tag_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS content_entry_related (
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  related_slug VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(content_entry_id, related_slug)
);

CREATE TABLE IF NOT EXISTS content_entry_gallery (
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  media_id BIGINT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(content_entry_id, media_id)
);

CREATE TABLE IF NOT EXISTS content_entry_video (
  content_entry_id BIGINT PRIMARY KEY REFERENCES content_entries(id) ON DELETE CASCADE,
  embed_url TEXT NOT NULL,
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS themes (
  name VARCHAR(120) PRIMARY KEY,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  background TEXT NOT NULL,
  surface TEXT NOT NULL,
  surface_alt TEXT NOT NULL,
  surface_raised TEXT NOT NULL,
  border TEXT NOT NULL,
  ink TEXT NOT NULL,
  muted TEXT NOT NULL,
  header_bg TEXT NOT NULL,
  header_ink TEXT NOT NULL,
  footer_bg TEXT NOT NULL,
  footer_ink TEXT NOT NULL,
  success TEXT NOT NULL,
  warning TEXT NOT NULL,
  danger TEXT NOT NULL,
  focus TEXT NOT NULL,
  dark_background TEXT NOT NULL,
  dark_surface TEXT NOT NULL,
  dark_surface_alt TEXT NOT NULL,
  dark_surface_raised TEXT NOT NULL,
  dark_border TEXT NOT NULL,
  dark_ink TEXT NOT NULL,
  dark_muted TEXT NOT NULL,
  dark_header_bg TEXT NOT NULL,
  dark_header_ink TEXT NOT NULL,
  dark_footer_bg TEXT NOT NULL,
  dark_footer_ink TEXT NOT NULL,
  typography_body TEXT NOT NULL,
  typography_display TEXT NOT NULL,
  typography_tracking TEXT NOT NULL,
  typography_radius TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ui_content (
  id BIGSERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL UNIQUE,
  value_en TEXT NOT NULL DEFAULT '',
  value_bn TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_info (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email TEXT NOT NULL,
  primary_phone TEXT NOT NULL,
  address_en TEXT NOT NULL,
  address_bn TEXT NOT NULL,
  head_office_map TEXT
);

CREATE TABLE IF NOT EXISTS contact_phones (
  id BIGSERIAL PRIMARY KEY,
  contact_id SMALLINT NOT NULL REFERENCES contact_info(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contact_socials (
  id BIGSERIAL PRIMARY KEY,
  contact_id SMALLINT NOT NULL REFERENCES contact_info(id) ON DELETE CASCADE,
  network VARCHAR(40) NOT NULL,
  url TEXT NOT NULL,
  UNIQUE(contact_id, network)
);

CREATE TABLE IF NOT EXISTS contact_footprint (
  id BIGSERIAL PRIMARY KEY,
  contact_id SMALLINT NOT NULL REFERENCES contact_info(id) ON DELETE CASCADE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  address_en TEXT NOT NULL,
  address_bn TEXT NOT NULL,
  map_query TEXT NOT NULL,
  kind VARCHAR(20),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sdg_steps (
  id VARCHAR(40) PRIMARY KEY,
  number_value TEXT NOT NULL,
  en TEXT NOT NULL,
  bn TEXT NOT NULL,
  en_text TEXT NOT NULL,
  bn_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_global_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_info (
  id VARCHAR(30) PRIMARY KEY,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  note_en TEXT NOT NULL,
  note_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Read-only compatibility projections for legacy public reads.
CREATE OR REPLACE VIEW cms_menu_content AS
SELECT
  id,
  split_part(trim(both '/' from slug), '/', 1) AS menu_key,
  slug,
  'page'::varchar(40) AS type,
  title_en,
  title_bn,
  COALESCE(render_cache, '{}'::jsonb) AS content,
  status,
  updated_at
FROM pages;

CREATE OR REPLACE VIEW cms_documents AS
SELECT
  'page:' || slug AS key,
  'page'::varchar(40) AS type,
  COALESCE(render_cache, '{}'::jsonb) AS value,
  updated_at
FROM pages
UNION ALL
SELECT 'site-global', 'global'::varchar(40), value, updated_at
FROM site_global_state;

