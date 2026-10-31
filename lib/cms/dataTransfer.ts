/** Whitelisted CMS/site-data transfer. Authentication, audit and request-size checks live in API routes. */
export const CMS_TRANSFER_TABLES = [
  'media_items',
  'site_global_state',
  'site_settings',
  'payment_info',
  'nav_groups',
  'pages',
  'nav_items',
  'page_revisions',
  'cms_content_items',
  'sections',
  'rich_text_sections',
  'stats_sections',
  'stat_items',
  'cards_sections',
  'card_items',
  'gallery_sections',
  'gallery_items',
  'timeline_sections',
  'timeline_items',
  'diagram_sections',
  'table_sections',
  'table_section_headers',
  'table_section_rows',
  'table_section_cells',
  'video_sections',
  'cta_sections',
  'notice_list_sections',
  'notice_items',
  'contact_sections',
  'contact_locations',
  'donation_sections',
  'carousel_sections',
  'carousel_items',
  'hero_data',
  'hero_slides',
  'hero_stats',
  'content_entries',
  'content_entry_bodies',
  'content_entry_tags',
  'content_entry_related',
  'content_entry_gallery',
  'content_entry_video',
  'ui_content',
  'contact_info',
  'contact_phones',
  'contact_socials',
  'contact_footprint',
  'sdg_steps',
] as const

export type CmsTransferTable = typeof CMS_TRANSFER_TABLES[number]
export const CMS_TRANSFER_FORMAT = 'srizony-cms-site-data'
export const CMS_TRANSFER_VERSION = 1
export const CMS_TRANSFER_MAX_BYTES = 20 * 1024 * 1024
export const CMS_TRANSFER_MAX_ROWS_PER_TABLE = 50000

export function quoteIdentifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) throw new Error('Invalid database identifier.')
  return `"${value}"`
}
