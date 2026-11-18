-- Repair missing navigation base tables before any CMS runtime ALTER TABLE statements.
-- Idempotent and additive: existing menu rows are retained.

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
--> statement-breakpoint

INSERT INTO cms_sites (id, site_key, name) VALUES (1, 'default', '') ON CONFLICT DO NOTHING;
--> statement-breakpoint

SELECT setval(pg_get_serial_sequence('cms_sites', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM cms_sites), 1), true);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS nav_groups (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  key VARCHAR(120) NOT NULL,
  label_en TEXT NOT NULL DEFAULT '',
  label_bn TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint

ALTER TABLE nav_groups ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES cms_sites(id) ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE nav_groups ADD COLUMN IF NOT EXISTS key VARCHAR(120);
--> statement-breakpoint

ALTER TABLE nav_groups ADD COLUMN IF NOT EXISTS label_en TEXT NOT NULL DEFAULT '';
--> statement-breakpoint

ALTER TABLE nav_groups ADD COLUMN IF NOT EXISTS label_bn TEXT NOT NULL DEFAULT '';
--> statement-breakpoint

ALTER TABLE nav_groups ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint

UPDATE nav_groups SET key = 'legacy-' || id::text WHERE key IS NULL OR btrim(key) = '';
--> statement-breakpoint

WITH ranked AS (SELECT id, row_number() OVER (PARTITION BY key ORDER BY id) AS row_num FROM nav_groups) UPDATE nav_groups AS target SET key = 'legacy-' || target.id::text FROM ranked WHERE ranked.id = target.id AND ranked.row_num > 1;
--> statement-breakpoint

UPDATE nav_groups SET site_id = 1 WHERE site_id IS NULL;
--> statement-breakpoint

ALTER TABLE nav_groups ALTER COLUMN key SET NOT NULL;
--> statement-breakpoint

ALTER TABLE nav_groups ALTER COLUMN site_id SET DEFAULT 1;
--> statement-breakpoint

ALTER TABLE nav_groups ALTER COLUMN site_id SET NOT NULL;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS nav_groups_key_uq ON nav_groups(key);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS nav_items (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL DEFAULT 1 REFERENCES cms_sites(id) ON DELETE CASCADE,
  group_id BIGINT NOT NULL REFERENCES nav_groups(id) ON DELETE CASCADE,
  parent_id BIGINT REFERENCES nav_items(id) ON DELETE CASCADE,
  label_en TEXT NOT NULL DEFAULT '',
  label_bn TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  menu_type VARCHAR(20) NOT NULL DEFAULT 'page',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  section_count INTEGER NOT NULL DEFAULT 1,
  section_content_type VARCHAR(40) NOT NULL DEFAULT 'richText',
  section_button_type VARCHAR(20) NOT NULL DEFAULT 'none',
  typography JSONB
);
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES cms_sites(id) ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS group_id BIGINT REFERENCES nav_groups(id) ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES nav_items(id) ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS label_en TEXT NOT NULL DEFAULT '';
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS label_bn TEXT NOT NULL DEFAULT '';
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS href TEXT NOT NULL DEFAULT '';
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS content_types JSONB NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS menu_type VARCHAR(20) NOT NULL DEFAULT 'page';
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS section_count INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS section_content_type VARCHAR(40) NOT NULL DEFAULT 'richText';
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS section_button_type VARCHAR(20) NOT NULL DEFAULT 'none';
--> statement-breakpoint

ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS typography JSONB;
--> statement-breakpoint

INSERT INTO nav_groups (site_id, key, label_en, label_bn, sort_order) VALUES (1, 'primary', 'Site Navigation', 'সাইট নেভিগেশন', 0) ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint

UPDATE nav_items SET group_id = (SELECT id FROM nav_groups WHERE key = 'primary' LIMIT 1) WHERE group_id IS NULL;
--> statement-breakpoint

UPDATE nav_items SET site_id = 1 WHERE site_id IS NULL;
--> statement-breakpoint

ALTER TABLE nav_items ALTER COLUMN group_id SET NOT NULL;
--> statement-breakpoint

ALTER TABLE nav_items ALTER COLUMN site_id SET DEFAULT 1;
--> statement-breakpoint

ALTER TABLE nav_items ALTER COLUMN site_id SET NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS nav_items_site_group_parent_sort_idx ON nav_items(site_id, group_id, parent_id, sort_order);
