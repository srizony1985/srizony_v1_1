-- Site-configurable CMS foundation.
-- One site may be deployed per database. Every deployment has its own site record,
-- database-managed content schema and data-pipeline registry; content records are
-- explicitly linked to that site rather than relying on website-specific code paths.


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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cms_sites_status_check CHECK (status IN ('active', 'paused', 'archived')),
  CONSTRAINT cms_sites_supported_locales_array_check CHECK (jsonb_typeof(supported_locales) = 'array'),
  CONSTRAINT cms_sites_identity_object_check CHECK (jsonb_typeof(identity) = 'object'),
  CONSTRAINT cms_sites_settings_object_check CHECK (jsonb_typeof(settings) = 'object')
);

-- The default key is intentionally neutral. Deployment-specific identity comes from
-- environment configuration or the CMS; this SQL does not contain Srizony branding.
INSERT INTO cms_sites (site_key, name, default_locale, supported_locales)
VALUES ('default', '', 'en', '["en"]'::jsonb)
ON CONFLICT (site_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS cms_content_type_definitions (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES cms_sites(id) ON DELETE CASCADE,
  component_key VARCHAR(80) NOT NULL,
  label TEXT NOT NULL,
  plural_label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  collection_path TEXT,
  detail_path_pattern TEXT,
  fields_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cms_content_type_fields_array_check CHECK (jsonb_typeof(fields_schema) = 'array'),
  CONSTRAINT cms_content_type_capabilities_object_check CHECK (jsonb_typeof(capabilities) = 'object'),
  CONSTRAINT cms_content_type_site_key_uq UNIQUE (site_id, component_key)
);
CREATE INDEX IF NOT EXISTS cms_content_type_definitions_enabled_idx
  ON cms_content_type_definitions(site_id, enabled, sort_order);

CREATE TABLE IF NOT EXISTS cms_content_field_definitions (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES cms_sites(id) ON DELETE CASCADE,
  component_key VARCHAR(80) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  label TEXT NOT NULL,
  field_type VARCHAR(32) NOT NULL,
  localized BOOLEAN NOT NULL DEFAULT false,
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation JSONB NOT NULL DEFAULT '{}'::jsonb,
  help_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cms_content_field_options_array_check CHECK (jsonb_typeof(options) = 'array'),
  CONSTRAINT cms_content_field_validation_object_check CHECK (jsonb_typeof(validation) = 'object'),
  CONSTRAINT cms_content_field_site_component_key_uq UNIQUE (site_id, component_key, field_key),
  CONSTRAINT cms_content_field_type_check CHECK (field_type IN ('text','textarea','date','number','select','url','image','email','boolean','richtext','file'))
);
CREATE INDEX IF NOT EXISTS cms_content_field_definitions_order_idx
  ON cms_content_field_definitions(site_id, component_key, sort_order);

CREATE TABLE IF NOT EXISTS cms_data_pipelines (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES cms_sites(id) ON DELETE CASCADE,
  domain_key VARCHAR(100) NOT NULL,
  source_table VARCHAR(63) NOT NULL,
  primary_key_column VARCHAR(63) NOT NULL DEFAULT 'id',
  read_enabled BOOLEAN NOT NULL DEFAULT true,
  write_enabled BOOLEAN NOT NULL DEFAULT true,
  read_strategy VARCHAR(32) NOT NULL DEFAULT 'relational',
  write_strategy VARCHAR(32) NOT NULL DEFAULT 'relational',
  fallback_strategy VARCHAR(32) NOT NULL DEFAULT 'drive_snapshot_read_only',
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  pipeline_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cms_data_pipeline_mapping_object_check CHECK (jsonb_typeof(field_mapping) = 'object'),
  CONSTRAINT cms_data_pipeline_validation_object_check CHECK (jsonb_typeof(validation_rules) = 'object'),
  CONSTRAINT cms_data_pipeline_options_object_check CHECK (jsonb_typeof(pipeline_options) = 'object'),
  CONSTRAINT cms_data_pipeline_read_strategy_check CHECK (read_strategy IN ('relational','document','view','api')),
  CONSTRAINT cms_data_pipeline_write_strategy_check CHECK (write_strategy IN ('relational','document','api','disabled')),
  CONSTRAINT cms_data_pipeline_fallback_check CHECK (fallback_strategy IN ('none','drive_snapshot_read_only','cached_read_only')),
  CONSTRAINT cms_data_pipeline_site_domain_uq UNIQUE (site_id, domain_key)
);
CREATE INDEX IF NOT EXISTS cms_data_pipelines_enabled_idx
  ON cms_data_pipelines(site_id, enabled, domain_key);

-- Keep website identity and high-level website-owned records associated with the
-- configured site. Each deployment uses its active CMS_SITE_KEY; the default site
-- row preserves compatibility with existing data and fresh installations.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'pages','media_items','cms_content_items','nav_groups','nav_items',
    'site_settings','site_global_state','ui_content','themes','cms_users',
    'job_applications','job_resume_uploads','job_email_outbox','job_vacancy_interviews',
    'job_application_interviews','submissions','donations','contact_info','contact_phones',
    'contact_socials','contact_footprint','payment_info','hero_data','hero_slides','hero_stats',
    'sections','rich_text_sections','stats_sections','stat_items','cards_sections','card_items',
    'gallery_sections','gallery_items','timeline_sections','timeline_items','diagram_sections',
    'table_sections','table_section_headers','table_section_rows','table_section_cells',
    'video_sections','cta_sections','notice_list_sections','notice_items','contact_sections',
    'contact_locations','donation_sections','carousel_sections','carousel_items','sdg_steps',
    'content_entries','content_entry_bodies','content_entry_tags','content_entry_related',
    'content_entry_gallery','content_entry_video','site_visitors','visitor_events',
    'site_visit_events','cookie_consents','newsletter_subscribers','enquiry_daily_limits',
    'hero_data'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS site_id BIGINT REFERENCES cms_sites(id)', table_name);
      EXECUTE format('UPDATE public.%I SET site_id = 1 WHERE site_id IS NULL', table_name);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN site_id SET DEFAULT 1', table_name);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN site_id SET NOT NULL', table_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(site_id)', table_name || '_site_id_idx', table_name);
    END IF;
  END LOOP;
END $$;

-- Route parents are stored as first-class relational data. attributes.routeParent
-- remains mirrored for old application versions and old Drive snapshots.
ALTER TABLE cms_content_items ADD COLUMN IF NOT EXISTS route_parent TEXT;
UPDATE cms_content_items
SET route_parent = COALESCE(NULLIF(attributes->>'routeParent', ''), CASE component
  WHEN 'project' THEN '/projects' WHEN 'news' THEN '/news'
  WHEN 'enterprise' THEN '/enterprise-development'
  WHEN 'partner-agency' THEN '/about-us/partners-networks'
  WHEN 'health-service' THEN '/social-development/health-program'
  WHEN 'loan-product' THEN '/organizational-development'
  WHEN 'product' THEN '/enterprise-development' WHEN 'team' THEN '/management-staff'
  WHEN 'notice' THEN '/notice' WHEN 'report' THEN '/resources'
  WHEN 'job' THEN '/carrer-job' WHEN 'success-story' THEN '/success-stories'
  WHEN 'stat' THEN '/impact/statistics' ELSE '/' END)
WHERE route_parent IS NULL OR route_parent = '';
ALTER TABLE cms_content_items ALTER COLUMN route_parent SET DEFAULT '/';
ALTER TABLE cms_content_items ALTER COLUMN route_parent SET NOT NULL;

CREATE OR REPLACE FUNCTION public.cms_sync_content_route_parent()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.attributes ? 'routeParent' AND NULLIF(NEW.attributes->>'routeParent', '') IS NOT NULL THEN
    NEW.route_parent := NEW.attributes->>'routeParent';
  ELSIF NULLIF(NEW.route_parent, '') IS NOT NULL THEN
    NEW.attributes := jsonb_set(COALESCE(NEW.attributes, '{}'::jsonb), '{routeParent}', to_jsonb(NEW.route_parent), true);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cms_content_route_parent_sync ON cms_content_items;
CREATE TRIGGER cms_content_route_parent_sync
  BEFORE INSERT OR UPDATE OF attributes, route_parent ON cms_content_items
  FOR EACH ROW EXECUTE FUNCTION public.cms_sync_content_route_parent();
CREATE INDEX IF NOT EXISTS cms_content_items_site_feed_idx
  ON cms_content_items(site_id, status, component, published_at DESC, sort_order, id DESC);
CREATE INDEX IF NOT EXISTS cms_content_items_site_parent_idx
  ON cms_content_items(site_id, route_parent, status, published_at DESC);
-- Use only IMMUTABLE operators/functions in this expression index.
-- concat_ws is not immutable for PostgreSQL expression-index purposes.
CREATE INDEX IF NOT EXISTS cms_content_items_search_idx
  ON cms_content_items USING GIN (
    to_tsvector(
      'simple'::regconfig,
      COALESCE(title_en, '') || ' ' ||
      COALESCE(title_bn, '') || ' ' ||
      COALESCE(summary_en, '') || ' ' ||
      COALESCE(summary_bn, '') || ' ' ||
      COALESCE(body_en, '') || ' ' ||
      COALESCE(body_bn, '') || ' ' ||
      COALESCE(attributes->>'category_en', '') || ' ' ||
      COALESCE(attributes->>'category_bn', '')
    )
  );

DROP INDEX IF EXISTS cms_content_items_component_slug_uq;
DROP INDEX IF EXISTS cms_content_items_route_slug_uq;
CREATE UNIQUE INDEX IF NOT EXISTS cms_content_items_route_slug_uq
  ON cms_content_items(site_id, route_parent, slug);

-- Explicit website configuration has its own key namespace. Existing site_settings
-- remain available to legacy code while new integrations can use this typed config.
CREATE TABLE IF NOT EXISTS cms_site_config (
  id BIGSERIAL PRIMARY KEY,
  site_id BIGINT NOT NULL REFERENCES cms_sites(id) ON DELETE CASCADE,
  config_key VARCHAR(160) NOT NULL,
  config_value JSONB NOT NULL,
  is_secret BOOLEAN NOT NULL DEFAULT false,
  updated_by VARCHAR(254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cms_site_config_site_key_uq UNIQUE (site_id, config_key)
);
CREATE INDEX IF NOT EXISTS cms_site_config_site_idx ON cms_site_config(site_id, config_key);

-- Generic operational data source catalog for public collections and admin modules.
INSERT INTO cms_data_pipelines (site_id, domain_key, source_table, field_mapping, validation_rules, pipeline_options)
SELECT 1, item.domain_key, item.source_table, item.mapping::jsonb, item.validation::jsonb, item.options::jsonb
FROM (VALUES
  ('content','cms_content_items','{"title":"title_en","summary":"summary_en","body":"body_en","date":"published_at","route":"route_parent","metadata":"attributes"}','{"status":["published","draft","hidden"]}','{"search":"postgres_full_text","sort":"published_at_desc","driveFallback":"read_only"}'),
  ('pages','pages','{"slug":"slug","title":"title_en","body":"render_cache"}','{"status":["draft","published","archived"]}','{"sort":"sort_order"}'),
  ('navigation','nav_items','{"label":"label_en","path":"href","parent":"parent_id"}','{"menuType":["page","external"]}','{"sort":"sort_order"}'),
  ('media','media_items','{"url":"src","storageKey":"storage_key","mime":"content_type"}','{"status":["ready","quarantined","deleted"]}','{"imageEncoding":"base64"}'),
  ('jobs','cms_content_items','{"title":"title_en","deadline":"attributes.deadline","category":"attributes.category_en"}','{"component":"job"}','{"search":"postgres_full_text","filter":"category,deadline,status"}'),
  ('donations','donations','{"reference":"transaction_id","amount":"amount","status":"status"}','{"status":["pending","success","failed","cancelled","expired"]}','{"sensitive":true}')
) AS item(domain_key, source_table, mapping, validation, options)
ON CONFLICT (site_id, domain_key) DO UPDATE SET
  source_table = EXCLUDED.source_table,
  field_mapping = EXCLUDED.field_mapping,
  validation_rules = EXCLUDED.validation_rules,
  pipeline_options = EXCLUDED.pipeline_options,
  updated_at = now();

