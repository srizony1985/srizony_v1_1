import { db } from '@/lib/db'
import { assertRequiredColumns } from '@/lib/db/schema-validation'

let ready: Promise<void> | null = null
let navigationTypographyReady: Promise<void> | null = null

const NAVIGATION_REQUIRED_COLUMNS = {
  nav_groups: ['id', 'site_id', 'key', 'label_en', 'label_bn', 'sort_order'],
  nav_items: [
    'id', 'site_id', 'group_id', 'parent_id', 'label_en', 'label_bn', 'href', 'featured',
    'sort_order', 'content_types', 'menu_type', 'is_visible', 'section_count',
    'section_content_type', 'section_button_type', 'typography',
  ],
} as const

const CMS_REQUIRED_COLUMNS = {
  cms_sites: ['id', 'site_key', 'name', 'primary_domain', 'base_url', 'default_locale', 'supported_locales', 'identity', 'settings', 'status', 'created_at', 'updated_at'],
  cms_content_type_definitions: ['id', 'site_id', 'component_key', 'label', 'plural_label', 'description', 'collection_path', 'detail_path_pattern', 'fields_schema', 'capabilities', 'enabled', 'sort_order', 'created_at', 'updated_at'],
  cms_content_field_definitions: ['id', 'site_id', 'component_key', 'field_key', 'label', 'field_type', 'localized', 'required', 'options', 'validation', 'help_text', 'sort_order', 'created_at', 'updated_at'],
  cms_data_pipelines: ['id', 'site_id', 'domain_key', 'source_table', 'primary_key_column', 'read_enabled', 'write_enabled', 'read_strategy', 'write_strategy', 'fallback_strategy', 'field_mapping', 'validation_rules', 'pipeline_options', 'enabled', 'created_at', 'updated_at'],
  cms_site_config: ['id', 'site_id', 'config_key', 'config_value', 'is_secret', 'updated_by', 'created_at', 'updated_at'],
  cms_content_items: ['id', 'site_id', 'component', 'slug', 'title_en', 'title_bn', 'summary_en', 'summary_bn', 'body_en', 'body_bn', 'image_src', 'published_at', 'status', 'attributes', 'sort_order', 'created_at', 'updated_at', 'route_parent'],
  cms_users: ['id', 'site_id', 'email', 'password_hash', 'role', 'status', 'created_by', 'last_login_at', 'created_at', 'updated_at', 'session_version'],
  pages: ['id', 'site_id', 'slug', 'title_en', 'title_bn', 'subtitle_en', 'subtitle_bn', 'hero_image_id', 'hero_tone', 'meta_description_en', 'meta_description_bn', 'render_cache', 'status', 'sort_order', 'created_at', 'updated_at'],
  site_global_state: ['id', 'site_id', 'value', 'updated_at'],
  site_settings: ['key', 'site_id', 'value', 'updated_at'],
  content_entries: ['id', 'site_id', 'slug', 'title_en', 'title_bn', 'excerpt_en', 'excerpt_bn', 'date_value', 'category', 'image_id', 'href'],
  content_entry_bodies: ['id', 'site_id', 'content_entry_id', 'body_en', 'body_bn', 'sort_order'],
  content_entry_tags: ['id', 'site_id', 'content_entry_id', 'tag_en', 'tag_bn', 'sort_order'],
  content_entry_gallery: ['site_id', 'content_entry_id', 'media_id', 'sort_order'],
  content_entry_video: ['site_id', 'content_entry_id', 'embed_url', 'source_url'],
  content_entry_related: ['site_id', 'content_entry_id', 'related_slug', 'sort_order'],
  media_items: ['id', 'site_id', 'src', 'alt_en', 'alt_bn', 'caption_en', 'caption_bn', 'kind', 'hover_src', 'storage_key', 'storage_bucket', 'content_type', 'size_bytes', 'is_public', 'status', 'uploaded_by', 'created_at', 'updated_at'],
  job_applications: ['id', 'site_id', 'job_id', 'name', 'email', 'phone', 'cover_letter', 'resume_url', 'status', 'created_at', 'custom_fields', 'status_changed_at'],
  job_resume_uploads: ['token_hash', 'site_id', 'media_id', 'expires_at', 'consumed_at', 'created_at'],
  job_public_rate_limits: ['rate_key', 'window_started_at', 'attempts'],
  job_email_outbox: ['id', 'site_id', 'event_key', 'application_id', 'recipient_email', 'subject', 'text_body', 'html_body', 'status', 'attempts', 'next_attempt_at', 'last_error', 'provider_message_id', 'created_at', 'updated_at', 'sent_at'],
  job_vacancy_interviews: ['id', 'site_id', 'job_id', 'starts_at', 'ends_at', 'minutes_per_applicant', 'status', 'revision', 'closed_at', 'created_at', 'updated_at'],
  job_application_interviews: ['id', 'site_id', 'interview_id', 'application_id', 'starts_at', 'ends_at', 'created_at'],
  page_revisions: ['id', 'page_id', 'version', 'content', 'created_by', 'created_at'],
} as const

/**
 * Check the navigation contract only. This runs on public reads, so it must be
 * cheap and read-only; navigation schema changes are applied by Drizzle migrations.
 */
export function ensureNavigationTypographySchema(): Promise<void> {
  if (!db) return Promise.reject(new Error('Database is not configured.'))
  navigationTypographyReady ??= assertRequiredColumns(db, NAVIGATION_REQUIRED_COLUMNS, 'Navigation')
    .catch((error) => {
      navigationTypographyReady = null
      throw error
    })
  return navigationTypographyReady
}

/** Validate the CMS schema without executing ad-hoc CREATE/ALTER statements. */
export function ensureCmsSchema(): Promise<void> {
  if (!db) return Promise.reject(new Error('Database is not configured.'))
  ready ??= assertRequiredColumns(db, CMS_REQUIRED_COLUMNS, 'CMS')
    .catch((error) => {
      ready = null
      throw error
    })
  return ready
}
