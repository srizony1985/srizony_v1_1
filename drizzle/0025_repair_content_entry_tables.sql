-- Repair the legacy content-entry dependency chain after schema drift.
-- The old structural migration creates these tables, but an operator may have
-- removed one after its migration was recorded. Keep this idempotent.

CREATE TABLE IF NOT EXISTS cms_sites (
  id BIGSERIAL PRIMARY KEY,
  site_key VARCHAR(120) NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  primary_domain VARCHAR(255),
  base_url TEXT,
  default_locale VARCHAR(16) NOT NULL DEFAULT 'en',
  supported_locales JSONB NOT NULL DEFAULT '["en"]'::jsonb,
  identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO cms_sites(id, site_key, name) VALUES(1, 'default', '') ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('cms_sites', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM cms_sites), 1), true);

CREATE TABLE IF NOT EXISTS media_items (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  src TEXT NOT NULL,
  alt_en TEXT NOT NULL DEFAULT '',
  alt_bn TEXT NOT NULL DEFAULT '',
  caption_en TEXT,
  caption_bn TEXT,
  kind VARCHAR(20) NOT NULL DEFAULT 'image',
  hover_src TEXT,
  storage_key TEXT,
  storage_bucket VARCHAR(120) NOT NULL DEFAULT 'uploads',
  content_type VARCHAR(120),
  size_bytes BIGINT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'ready',
  uploaded_by VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES cms_sites(id) ON DELETE CASCADE;
UPDATE media_items SET site_id = 1 WHERE site_id IS NULL;
ALTER TABLE media_items ALTER COLUMN site_id SET DEFAULT 1;
ALTER TABLE media_items ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(120) NOT NULL DEFAULT 'uploads';
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS content_type VARCHAR(120);
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS size_bytes BIGINT;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ready';
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(254);

CREATE TABLE IF NOT EXISTS content_entries (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_bn TEXT NOT NULL DEFAULT '',
  excerpt_en TEXT NOT NULL DEFAULT '',
  excerpt_bn TEXT NOT NULL DEFAULT '',
  date_value TEXT,
  category VARCHAR(30) NOT NULL DEFAULT 'project',
  image_id BIGINT REFERENCES media_items(id) ON DELETE SET NULL,
  href TEXT
);

ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES cms_sites(id) ON DELETE CASCADE;
UPDATE content_entries SET site_id = 1 WHERE site_id IS NULL;
ALTER TABLE content_entries ALTER COLUMN site_id SET DEFAULT 1;
ALTER TABLE content_entries ALTER COLUMN site_id SET NOT NULL;
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS title_bn TEXT NOT NULL DEFAULT '';
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS excerpt_en TEXT NOT NULL DEFAULT '';
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS excerpt_bn TEXT NOT NULL DEFAULT '';
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS date_value TEXT;
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'project';
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS image_id BIGINT REFERENCES media_items(id) ON DELETE SET NULL;
ALTER TABLE content_entries ADD COLUMN IF NOT EXISTS href TEXT;
ALTER TABLE content_entries ALTER COLUMN title_en DROP DEFAULT;
ALTER TABLE content_entries ALTER COLUMN title_bn DROP DEFAULT;
ALTER TABLE content_entries ALTER COLUMN excerpt_en DROP DEFAULT;
ALTER TABLE content_entries ALTER COLUMN excerpt_bn DROP DEFAULT;
ALTER TABLE content_entries ALTER COLUMN category DROP DEFAULT;
CREATE INDEX IF NOT EXISTS content_entries_site_idx ON content_entries(site_id, category, date_value DESC);

CREATE TABLE IF NOT EXISTS content_entry_bodies (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  body_en TEXT NOT NULL,
  body_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS content_entry_tags (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  tag_en TEXT NOT NULL,
  tag_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS content_entry_related (
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  related_slug VARCHAR(255) NOT NULL REFERENCES content_entries(slug) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(content_entry_id, related_slug)
);
CREATE TABLE IF NOT EXISTS content_entry_gallery (
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  content_entry_id BIGINT NOT NULL REFERENCES content_entries(id) ON DELETE CASCADE,
  media_id BIGINT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(content_entry_id, media_id)
);
CREATE TABLE IF NOT EXISTS content_entry_video (
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  content_entry_id BIGINT PRIMARY KEY REFERENCES content_entries(id) ON DELETE CASCADE,
  embed_url TEXT NOT NULL,
  source_url TEXT
);

CREATE INDEX IF NOT EXISTS content_entry_bodies_entry_order_idx ON content_entry_bodies(content_entry_id, sort_order);
CREATE INDEX IF NOT EXISTS content_entry_tags_entry_order_idx ON content_entry_tags(content_entry_id, sort_order);

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'content_entry_bodies','content_entry_tags','content_entry_related',
    'content_entry_gallery','content_entry_video'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES cms_sites(id) ON DELETE CASCADE', table_name);
    EXECUTE format('UPDATE public.%I SET site_id = 1 WHERE site_id IS NULL', table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN site_id SET DEFAULT 1', table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN site_id SET NOT NULL', table_name);
  END LOOP;
END $$;
