import { sql } from 'drizzle-orm'
import { pgTable, text, varchar, timestamp, serial, numeric, jsonb, date, integer, boolean, uniqueIndex, index, bigserial, bigint, smallint, primaryKey, char, type AnyPgColumn } from 'drizzle-orm/pg-core'

// Structural CMS tables are installed by the ordered SQL migrations. These typed
// definitions must stay aligned with both the legacy catalogue and current public APIs.
export const mediaItems = pgTable('media_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  src: text('src').notNull(),
  storageKey: text('storage_key'),
  storageBucket: text('storage_bucket').notNull().default('uploads'),
  contentType: varchar('content_type', { length: 120 }),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  isPublic: boolean('is_public').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('ready'),
  uploadedBy: varchar('uploaded_by', { length: 254 }),
  altEn: text('alt_en').notNull().default(''),
  altBn: text('alt_bn').notNull().default(''),
  captionEn: text('caption_en'),
  captionBn: text('caption_bn'),
  kind: varchar('kind', { length: 20 }).notNull().default('image'),
  hoverSrc: text('hover_src'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Legacy catalogue tables remain typed because imports, related content and
 * older page modules still use them. Keep the schema aligned with migrations. */
export const contentEntries = pgTable('content_entries', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  excerptEn: text('excerpt_en').notNull(),
  excerptBn: text('excerpt_bn').notNull(),
  dateValue: text('date_value'),
  category: varchar('category', { length: 30 }).notNull(),
  imageId: bigint('image_id', { mode: 'number' }).references(() => mediaItems.id, { onDelete: 'set null' }),
  href: text('href'),
}, (table) => ({ siteFeedIdx: index('content_entries_site_idx').on(table.siteId, table.category, table.dateValue.desc()) }))

export const contentEntryBodies = pgTable('content_entry_bodies', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  contentEntryId: bigint('content_entry_id', { mode: 'number' }).notNull().references(() => contentEntries.id, { onDelete: 'cascade' }),
  bodyEn: text('body_en').notNull(),
  bodyBn: text('body_bn').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({ entryOrderIdx: index('content_entry_bodies_entry_order_idx').on(table.contentEntryId, table.sortOrder) }))

export const contentEntryTags = pgTable('content_entry_tags', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  contentEntryId: bigint('content_entry_id', { mode: 'number' }).notNull().references(() => contentEntries.id, { onDelete: 'cascade' }),
  tagEn: text('tag_en').notNull(),
  tagBn: text('tag_bn').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({ entryOrderIdx: index('content_entry_tags_entry_order_idx').on(table.contentEntryId, table.sortOrder) }))

export const contentEntryRelated = pgTable('content_entry_related', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  contentEntryId: bigint('content_entry_id', { mode: 'number' }).notNull().references(() => contentEntries.id, { onDelete: 'cascade' }),
  relatedSlug: varchar('related_slug', { length: 255 }).notNull().references(() => contentEntries.slug, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({ relatedPairPk: primaryKey({ columns: [table.contentEntryId, table.relatedSlug], name: 'content_entry_related_pkey' }) }))

export const contentEntryGallery = pgTable('content_entry_gallery', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  contentEntryId: bigint('content_entry_id', { mode: 'number' }).notNull().references(() => contentEntries.id, { onDelete: 'cascade' }),
  mediaId: bigint('media_id', { mode: 'number' }).notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({ galleryPairPk: primaryKey({ columns: [table.contentEntryId, table.mediaId], name: 'content_entry_gallery_pkey' }) }))

export const contentEntryVideo = pgTable('content_entry_video', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  contentEntryId: bigint('content_entry_id', { mode: 'number' }).primaryKey().references(() => contentEntries.id, { onDelete: 'cascade' }),
  embedUrl: text('embed_url').notNull(),
  sourceUrl: text('source_url'),
})

export const pages = pgTable('pages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  subtitleEn: text('subtitle_en'),
  subtitleBn: text('subtitle_bn'),
  heroImageId: bigint('hero_image_id', { mode: 'number' }).references(() => mediaItems.id, { onDelete: 'set null' }),
  heroTone: varchar('hero_tone', { length: 20 }),
  metaDescriptionEn: text('meta_description_en'),
  metaDescriptionBn: text('meta_description_bn'),
  renderCache: jsonb('render_cache'),
  status: varchar('status', { length: 20 }).notNull().default('published'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const siteGlobalState = pgTable('site_global_state', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: smallint('id').primaryKey().default(1),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const siteSettings = pgTable('site_settings', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})



/** Per-deployment website configuration. Website identity is data, not a build-time constant. */
export const cmsSites = pgTable('cms_sites', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteKey: varchar('site_key', { length: 120 }).notNull().unique(),
  name: text('name').notNull().default(''),
  primaryDomain: varchar('primary_domain', { length: 255 }),
  baseUrl: text('base_url'),
  defaultLocale: varchar('default_locale', { length: 16 }).notNull().default('en'),
  supportedLocales: jsonb('supported_locales').notNull().default(sql`'["en"]'::jsonb`),
  identity: jsonb('identity').notNull().default(sql`'{}'::jsonb`),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cmsContentTypeDefinitions = pgTable('cms_content_type_definitions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().references(() => cmsSites.id, { onDelete: 'cascade' }),
  componentKey: varchar('component_key', { length: 80 }).notNull(),
  label: text('label').notNull(),
  pluralLabel: text('plural_label').notNull(),
  description: text('description').notNull().default(''),
  collectionPath: text('collection_path'),
  detailPathPattern: text('detail_path_pattern'),
  fieldsSchema: jsonb('fields_schema').notNull().default(sql`'[]'::jsonb`),
  capabilities: jsonb('capabilities').notNull().default(sql`'{}'::jsonb`),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ siteComponentUnique: uniqueIndex('cms_content_type_site_key_uq').on(table.siteId, table.componentKey), enabledOrderIdx: index('cms_content_type_definitions_enabled_idx').on(table.siteId, table.enabled, table.sortOrder) }))

export const cmsContentFieldDefinitions = pgTable('cms_content_field_definitions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().references(() => cmsSites.id, { onDelete: 'cascade' }),
  componentKey: varchar('component_key', { length: 80 }).notNull(),
  fieldKey: varchar('field_key', { length: 100 }).notNull(),
  label: text('label').notNull(),
  fieldType: varchar('field_type', { length: 32 }).notNull(),
  localized: boolean('localized').notNull().default(false),
  required: boolean('required').notNull().default(false),
  options: jsonb('options').notNull().default(sql`'[]'::jsonb`),
  validation: jsonb('validation').notNull().default(sql`'{}'::jsonb`),
  helpText: text('help_text'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ fieldUnique: uniqueIndex('cms_content_field_site_component_key_uq').on(table.siteId, table.componentKey, table.fieldKey), orderIdx: index('cms_content_field_definitions_order_idx').on(table.siteId, table.componentKey, table.sortOrder) }))

export const cmsDataPipelines = pgTable('cms_data_pipelines', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().references(() => cmsSites.id, { onDelete: 'cascade' }),
  domainKey: varchar('domain_key', { length: 100 }).notNull(),
  sourceTable: varchar('source_table', { length: 63 }).notNull(),
  primaryKeyColumn: varchar('primary_key_column', { length: 63 }).notNull().default('id'),
  readEnabled: boolean('read_enabled').notNull().default(true),
  writeEnabled: boolean('write_enabled').notNull().default(true),
  readStrategy: varchar('read_strategy', { length: 32 }).notNull().default('relational'),
  writeStrategy: varchar('write_strategy', { length: 32 }).notNull().default('relational'),
  fallbackStrategy: varchar('fallback_strategy', { length: 32 }).notNull().default('drive_snapshot_read_only'),
  fieldMapping: jsonb('field_mapping').notNull().default(sql`'{}'::jsonb`),
  validationRules: jsonb('validation_rules').notNull().default(sql`'{}'::jsonb`),
  pipelineOptions: jsonb('pipeline_options').notNull().default(sql`'{}'::jsonb`),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ siteDomainUnique: uniqueIndex('cms_data_pipeline_site_domain_uq').on(table.siteId, table.domainKey), enabledIdx: index('cms_data_pipelines_enabled_idx').on(table.siteId, table.enabled, table.domainKey) }))

export const cmsSiteConfig = pgTable('cms_site_config', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().references(() => cmsSites.id, { onDelete: 'cascade' }),
  configKey: varchar('config_key', { length: 160 }).notNull(),
  configValue: jsonb('config_value').notNull(),
  isSecret: boolean('is_secret').notNull().default(false),
  updatedBy: varchar('updated_by', { length: 254 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ siteConfigUnique: uniqueIndex('cms_site_config_site_key_uq').on(table.siteId, table.configKey) }))

export const cmsContentItems = pgTable('cms_content_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  component: varchar('component', { length: 20 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  routeParent: text('route_parent').notNull().default('/'),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull().default(''),
  summaryEn: text('summary_en').notNull().default(''),
  summaryBn: text('summary_bn').notNull().default(''),
  bodyEn: text('body_en').notNull().default(''),
  bodyBn: text('body_bn').notNull().default(''),
  imageSrc: text('image_src'),
  publishedAt: date('published_at').notNull().default(sql`CURRENT_DATE`),
  status: varchar('status', { length: 20 }).notNull().default('published'),
  attributes: jsonb('attributes').notNull().default(sql`'{}'::jsonb`),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  routeUnique: uniqueIndex('cms_content_items_route_slug_uq').on(table.siteId, table.routeParent, table.slug),
  feedIdx: index('cms_content_items_site_feed_idx').on(table.siteId, table.status, table.component, table.publishedAt.desc(), table.sortOrder, table.id.desc()),
  parentIdx: index('cms_content_items_site_parent_idx').on(table.siteId, table.routeParent, table.status, table.publishedAt.desc()),
}))


export const donations = pgTable('donations', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  transactionId: varchar('transaction_id', { length: 64 }).notNull().unique(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('pending'),
  donor: jsonb('donor'),
  receiptSentAt: timestamp('receipt_sent_at', { withTimezone: true }),
  idempotencyKey: varchar('idempotency_key', { length: 64 }),
  idempotencyFingerprint: varchar('idempotency_fingerprint', { length: 64 }),
  gatewayPageUrl: text('gateway_page_url'),
  gatewayRiskLevel: smallint('gateway_risk_level'),
  gatewayRiskTitle: varchar('gateway_risk_title', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})


export const authEmailChallenges = pgTable('auth_email_challenges', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: varchar('email', { length: 254 }).notNull(),
  codeHash: varchar('code_hash', { length: 128 }).notNull(),
  purpose: varchar('purpose', { length: 30 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  attempts: smallint('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ emailPurposeIdx: index('auth_email_challenges_email_purpose_idx').on(table.email, table.purpose), expiresIdx: index('auth_email_challenges_expires_idx').on(table.expiresAt) }))

export const adminLoginAttempts = pgTable('admin_login_attempts', {
  key: varchar('key', { length: 255 }).primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  firstAttemptAt: timestamp('first_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const adminAuditLog = pgTable('admin_audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  actorEmail: varchar('actor_email', { length: 254 }).notNull(),
  action: varchar('action', { length: 80 }).notNull(),
  entity: varchar('entity', { length: 120 }),
  entityId: varchar('entity_id', { length: 255 }),
  metadata: jsonb('metadata'),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ actorCreatedIdx: index('admin_audit_log_actor_created_idx').on(table.actorEmail, table.createdAt), createdIdx: index('admin_audit_log_created_idx').on(table.createdAt) }))

export const siteVisitors = pgTable('site_visitors', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  visitorId: varchar('visitor_id', { length: 128 }).notNull().unique(),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  pageViews: integer('page_views').notNull().default(0),
  lastPath: text('last_path'),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
})

export const visitorEvents = pgTable('visitor_events', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  visitorId: varchar('visitor_id', { length: 128 }).notNull(),
  path: text('path').notNull(),
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ createdIdx: index('visitor_events_created_idx').on(table.createdAt), visitorIdx: index('visitor_events_visitor_idx').on(table.visitorId) }))

export const formUsers = pgTable('form_users', {
  id: serial('id').primaryKey(),
  provider: varchar('provider', { length: 16 }),
  providerId: varchar('provider_id', { length: 255 }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  name: text('name'),
  email: varchar('email', { length: 254 }).notNull().unique(),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const enquiryDailyLimits = pgTable('enquiry_daily_limits', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 254 }).notNull(),
  submissionDate: date('submission_date').notNull().default(sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date`),
  submissionId: integer('submission_id'),
}, (table) => ({ dailyEmailUnique: uniqueIndex('enquiry_daily_email_date_uq').on(table.email, table.submissionDate) }))

export const submissions = pgTable('submissions', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 24 }).notNull(),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  message: text('message'),
  payload: jsonb('payload'),
  status: varchar('status', { length: 24 }).notNull().default('new'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cookieConsents = pgTable('cookie_consents', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  visitorId: varchar('visitor_id', { length: 128 }),
  email: varchar('email', { length: 254 }),
  purpose: varchar('purpose', { length: 40 }).notNull().default('enquiry'),
  consented: boolean('consented').notNull().default(true),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
})



/** Operational and workflow tables managed by the ordered SQL migrations. */
export const cmsUsers = pgTable('cms_users', {
  id: serial('id').primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  email: varchar('email', { length: 254 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('editor'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdBy: varchar('created_by', { length: 254 }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  sessionVersion: integer('session_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobApplications = pgTable('job_applications', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  jobId: bigint('job_id', { mode: 'number' }).notNull().references(() => cmsContentItems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: varchar('email', { length: 254 }).notNull(),
  phone: text('phone'),
  coverLetter: text('cover_letter'),
  resumeUrl: text('resume_url'),
  status: varchar('status', { length: 20 }).notNull().default('new'),
  customFields: jsonb('custom_fields').notNull().default(sql`'{}'::jsonb`),
  statusChangedAt: timestamp('status_changed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  jobCreatedIdx: index('job_applications_job_idx').on(table.jobId, table.createdAt),
  createdIdx: index('job_applications_created_idx').on(table.createdAt.desc()),
}))

export const jobResumeUploads = pgTable('job_resume_uploads', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  tokenHash: char('token_hash', { length: 64 }).primaryKey(),
  mediaId: bigint('media_id', { mode: 'number' }).notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ expiryIdx: index('job_resume_uploads_expiry_idx').on(table.expiresAt) }))

export const jobPublicRateLimits = pgTable('job_public_rate_limits', {
  rateKey: varchar('rate_key', { length: 100 }).primaryKey(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
}, (table) => ({ windowIdx: index('job_public_rate_limits_window_idx').on(table.windowStartedAt) }))

export const publicApiRateLimits = pgTable('public_api_rate_limits', {
  scope: varchar('scope', { length: 60 }).notNull(),
  subjectHash: char('subject_hash', { length: 64 }).notNull(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scopeSubjectPk: primaryKey({ columns: [table.scope, table.subjectHash], name: 'public_api_rate_limits_pkey' }),
  updatedIdx: index('public_api_rate_limits_updated_idx').on(table.updatedAt),
}))

export const donationReceiptJobs = pgTable('donation_receipt_jobs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  donationId: integer('donation_id').notNull().unique().references(() => donations.id, { onDelete: 'cascade' }),
  recipientEmail: varchar('recipient_email', { length: 254 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ dueIdx: index('donation_receipt_jobs_due_idx').on(table.nextAttemptAt).where(sql`${table.sentAt} IS NULL`) }))

export const driveSyncState = pgTable('drive_sync_state', {
  tableName: text('table_name').primaryKey(),
  revision: bigint('revision', { mode: 'number' }).notNull().default(0),
  syncedRevision: bigint('synced_revision', { mode: 'number' }).notNull().default(0),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
}, (table) => ({ pendingIdx: index('drive_sync_state_pending_idx').on(table.changedAt, table.tableName).where(sql`${table.revision} > ${table.syncedRevision}`) }))

export const jobEmailOutbox = pgTable('job_email_outbox', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  eventKey: varchar('event_key', { length: 240 }).notNull().unique(),
  applicationId: bigint('application_id', { mode: 'number' }).references(() => jobApplications.id, { onDelete: 'set null' }),
  recipientEmail: varchar('recipient_email', { length: 254 }).notNull(),
  subject: text('subject').notNull(),
  textBody: text('text_body').notNull(),
  htmlBody: text('html_body').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lastError: text('last_error'),
  providerMessageId: text('provider_message_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (table) => ({ deliveryIdx: index('job_email_outbox_delivery_idx').on(table.status, table.nextAttemptAt, table.createdAt) }))

export const jobVacancyInterviews = pgTable('job_vacancy_interviews', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  jobId: bigint('job_id', { mode: 'number' }).notNull().unique().references(() => cmsContentItems.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  minutesPerApplicant: integer('minutes_per_applicant').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('scheduled'),
  revision: integer('revision').notNull().default(1),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const jobApplicationInterviews = pgTable('job_application_interviews', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  interviewId: bigint('interview_id', { mode: 'number' }).notNull().references(() => jobVacancyInterviews.id, { onDelete: 'cascade' }),
  applicationId: bigint('application_id', { mode: 'number' }).notNull().unique().references(() => jobApplications.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ scheduleIdx: index('job_application_interviews_schedule_idx').on(table.interviewId, table.startsAt) }))

export const navGroups = pgTable('nav_groups', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  key: varchar('key', { length: 120 }).notNull(),
  labelEn: text('label_en').notNull().default(''),
  labelBn: text('label_bn').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => ({ keyUnique: uniqueIndex('nav_groups_key_uq').on(table.key) }))

export const navItems = pgTable('nav_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  groupId: bigint('group_id', { mode: 'number' }).notNull().references(() => navGroups.id, { onDelete: 'cascade' }),
  parentId: bigint('parent_id', { mode: 'number' }).references((): AnyPgColumn => navItems.id, { onDelete: 'cascade' }),
  labelEn: text('label_en').notNull().default(''),
  labelBn: text('label_bn').notNull().default(''),
  href: text('href').notNull().default(''),
  featured: boolean('featured').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  contentTypes: jsonb('content_types').notNull().default(sql`'[]'::jsonb`),
  menuType: varchar('menu_type', { length: 20 }).notNull().default('page'),
  isVisible: boolean('is_visible').notNull().default(true),
  sectionCount: integer('section_count').notNull().default(1),
  sectionContentType: varchar('section_content_type', { length: 40 }).notNull().default('richText'),
  sectionButtonType: varchar('section_button_type', { length: 20 }).notNull().default('none'),
  typography: jsonb('typography'),
}, (table) => ({
  parentIdx: index('nav_items_site_group_parent_sort_idx').on(table.siteId, table.groupId, table.parentId, table.sortOrder),
}))

export const pageRevisions = pgTable('page_revisions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  pageId: bigint('page_id', { mode: 'number' }).notNull().references(() => pages.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: jsonb('content').notNull(),
  createdBy: varchar('created_by', { length: 254 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pageCreatedIdx: index('page_revisions_page_created_idx').on(table.pageId, table.createdAt.desc()),
  pageVersionUnique: uniqueIndex('page_revisions_page_id_version_key').on(table.pageId, table.version),
}))


export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('subscribed'),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Additional physical tables created by the structural-content and operations migrations.
// Compatibility views cms_documents and cms_menu_content intentionally are not pgTable declarations.

export const contactInfo = pgTable('contact_info', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: smallint('id').default(1).primaryKey(),
  email: text('email').notNull(),
  primaryPhone: text('primary_phone').notNull(),
  addressEn: text('address_en').notNull(),
  addressBn: text('address_bn').notNull(),
  headOfficeMap: text('head_office_map'),
})

export const heroData = pgTable('hero_data', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: smallint('id').default(1).primaryKey(),
  eyebrowEn: text('eyebrow_en').notNull(),
  eyebrowBn: text('eyebrow_bn').notNull(),
  headingLineOneEn: text('heading_line_one_en').notNull(),
  headingLineOneBn: text('heading_line_one_bn').notNull(),
  headingLineTwoEn: text('heading_line_two_en').notNull(),
  headingLineTwoBn: text('heading_line_two_bn').notNull(),
  descriptionEn: text('description_en').notNull(),
  descriptionBn: text('description_bn').notNull(),
  primaryActionLabelEn: text('primary_action_label_en').notNull(),
  primaryActionLabelBn: text('primary_action_label_bn').notNull(),
  primaryActionHref: text('primary_action_href').notNull(),
  secondaryActionLabelEn: text('secondary_action_label_en').notNull(),
  secondaryActionLabelBn: text('secondary_action_label_bn').notNull(),
  secondaryActionHref: text('secondary_action_href').notNull(),
  autoplay: boolean('autoplay').notNull().default(true),
  autoplayInterval: integer('autoplay_interval'),
  videoHref: text('video_href'),
})

export const heroSlides = pgTable('hero_slides', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: varchar('id', { length: 120 }).primaryKey(),
  imageId: bigint('image_id', { mode: 'number' }).notNull().references(() => mediaItems.id, { onDelete: 'restrict' }),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  descriptionEn: text('description_en').notNull(),
  descriptionBn: text('description_bn').notNull(),
  href: text('href').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const heroStats = pgTable('hero_stats', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: varchar('id', { length: 120 }).primaryKey(),
  icon: varchar('icon', { length: 40 }).notNull(),
  valueEn: text('value_en').notNull().default(''),
  valueBn: text('value_bn').notNull().default(''),
  labelEn: text('label_en').notNull(),
  labelBn: text('label_bn').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const paymentInfo = pgTable('payment_info', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: varchar('id', { length: 30 }).primaryKey(),
  labelEn: text('label_en').notNull(),
  labelBn: text('label_bn').notNull(),
  noteEn: text('note_en').notNull(),
  noteBn: text('note_bn').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const sdgSteps = pgTable('sdg_steps', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: varchar('id', { length: 40 }).primaryKey(),
  numberValue: text('number_value').notNull(),
  en: text('en').notNull(),
  bn: text('bn').notNull(),
  enText: text('en_text').notNull(),
  bnText: text('bn_text').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const sections = pgTable('sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  pageId: bigint('page_id', { mode: 'number' }).notNull().references(() => pages.id, { onDelete: 'cascade' }),
  sectionType: varchar('section_type', { length: 40 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ pageOrderIdx: index('sections_page_order_idx').on(table.pageId, table.sortOrder) }))

export const themes = pgTable('themes', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  name: varchar('name', { length: 120 }).primaryKey(),
  labelEn: text('label_en').notNull(),
  labelBn: text('label_bn').notNull(),
  primaryColor: text('primary_color').notNull(),
  secondaryColor: text('secondary_color').notNull(),
  accentColor: text('accent_color').notNull(),
  background: text('background').notNull(),
  surface: text('surface').notNull(),
  surfaceAlt: text('surface_alt').notNull(),
  surfaceRaised: text('surface_raised').notNull(),
  border: text('border').notNull(),
  ink: text('ink').notNull(),
  muted: text('muted').notNull(),
  headerBg: text('header_bg').notNull(),
  headerInk: text('header_ink').notNull(),
  footerBg: text('footer_bg').notNull(),
  footerInk: text('footer_ink').notNull(),
  success: text('success').notNull(),
  warning: text('warning').notNull(),
  danger: text('danger').notNull(),
  focus: text('focus').notNull(),
  darkBackground: text('dark_background').notNull(),
  darkSurface: text('dark_surface').notNull(),
  darkSurfaceAlt: text('dark_surface_alt').notNull(),
  darkSurfaceRaised: text('dark_surface_raised').notNull(),
  darkBorder: text('dark_border').notNull(),
  darkInk: text('dark_ink').notNull(),
  darkMuted: text('dark_muted').notNull(),
  darkHeaderBg: text('dark_header_bg').notNull(),
  darkHeaderInk: text('dark_header_ink').notNull(),
  darkFooterBg: text('dark_footer_bg').notNull(),
  darkFooterInk: text('dark_footer_ink').notNull(),
  typographyBody: text('typography_body').notNull(),
  typographyDisplay: text('typography_display').notNull(),
  typographyTracking: text('typography_tracking').notNull(),
  typographyRadius: text('typography_radius').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const uiContent = pgTable('ui_content', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  valueEn: text('value_en').notNull().default(''),
  valueBn: text('value_bn').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const cardsSections = pgTable('cards_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  eyebrowEn: text('eyebrow_en'),
  eyebrowBn: text('eyebrow_bn'),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  columns: smallint('columns'),
})

export const carouselSections = pgTable('carousel_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  eyebrowEn: text('eyebrow_en'),
  eyebrowBn: text('eyebrow_bn'),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  bodyEn: text('body_en'),
  bodyBn: text('body_bn'),
})

export const contactFootprint = pgTable('contact_footprint', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  contactId: smallint('contact_id').notNull().references(() => contactInfo.id, { onDelete: 'cascade' }),
  nameEn: text('name_en').notNull(),
  nameBn: text('name_bn').notNull(),
  addressEn: text('address_en').notNull(),
  addressBn: text('address_bn').notNull(),
  mapQuery: text('map_query').notNull(),
  kind: varchar('kind', { length: 20 }),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const contactPhones = pgTable('contact_phones', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  contactId: smallint('contact_id').notNull().references(() => contactInfo.id, { onDelete: 'cascade' }),
  phone: text('phone').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const contactSections = pgTable('contact_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  addressEn: text('address_en').notNull(),
  addressBn: text('address_bn').notNull(),
  phones: text('phones').array().notNull().default(sql`'{}'::text[]`),
  emails: text('emails').array().notNull().default(sql`'{}'::text[]`),
  mapLabelEn: text('map_label_en'),
  mapLabelBn: text('map_label_bn'),
})

export const contactSocials = pgTable('contact_socials', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  contactId: smallint('contact_id').notNull().references(() => contactInfo.id, { onDelete: 'cascade' }),
  network: varchar('network', { length: 40 }).notNull(),
  url: text('url').notNull(),
}, (table) => ({ contactNetworkUnique: uniqueIndex('contact_socials_contact_id_network_key').on(table.contactId, table.network) }))

export const ctaSections = pgTable('cta_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en').notNull(),
  headingBn: text('heading_bn').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyBn: text('body_bn').notNull(),
  primaryLabelEn: text('primary_label_en').notNull(),
  primaryLabelBn: text('primary_label_bn').notNull(),
  primaryHref: text('primary_href').notNull(),
  secondaryLabelEn: text('secondary_label_en'),
  secondaryLabelBn: text('secondary_label_bn'),
  secondaryHref: text('secondary_href'),
})

export const diagramSections = pgTable('diagram_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  bodyEn: text('body_en'),
  bodyBn: text('body_bn'),
  variant: varchar('variant', { length: 20 }).notNull(),
})

export const donationSections = pgTable('donation_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  bodyEn: text('body_en'),
  bodyBn: text('body_bn'),
})

export const gallerySections = pgTable('gallery_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  columns: smallint('columns'),
})

export const noticeListSections = pgTable('notice_list_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
})

export const richTextSections = pgTable('rich_text_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  eyebrowEn: text('eyebrow_en'),
  eyebrowBn: text('eyebrow_bn'),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  bodyEn: text('body_en').array().notNull().default(sql`'{}'::text[]`),
  bodyBn: text('body_bn').array().notNull().default(sql`'{}'::text[]`),
  imageId: bigint('image_id', { mode: 'number' }).references(() => mediaItems.id, { onDelete: 'set null' }),
  reverse: boolean('reverse').notNull().default(false),
})

export const statsSections = pgTable('stats_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
})

export const tableSections = pgTable('table_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
})

export const timelineSections = pgTable('timeline_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
})

export const videoSections = pgTable('video_sections', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  sectionId: bigint('section_id', { mode: 'number' }).primaryKey().references(() => sections.id, { onDelete: 'cascade' }),
  headingEn: text('heading_en'),
  headingBn: text('heading_bn'),
  bodyEn: text('body_en'),
  bodyBn: text('body_bn'),
  poster: text('poster').notNull(),
  embedUrl: text('embed_url'),
  sourceUrl: text('source_url'),
})

export const cardItems = pgTable('card_items', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => cardsSections.sectionId, { onDelete: 'cascade' }),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyBn: text('body_bn').notNull(),
  icon: varchar('icon', { length: 40 }),
  imageId: bigint('image_id', { mode: 'number' }).references(() => mediaItems.id, { onDelete: 'set null' }),
  illustration: varchar('illustration', { length: 80 }),
  href: text('href'),
  tagEn: text('tag_en'),
  tagBn: text('tag_bn'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const carouselItems = pgTable('carousel_items', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => carouselSections.sectionId, { onDelete: 'cascade' }),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  bodyEn: text('body_en'),
  bodyBn: text('body_bn'),
  imageId: bigint('image_id', { mode: 'number' }).notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  href: text('href'),
  tagEn: text('tag_en'),
  tagBn: text('tag_bn'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const contactLocations = pgTable('contact_locations', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => contactSections.sectionId, { onDelete: 'cascade' }),
  nameEn: text('name_en').notNull(),
  nameBn: text('name_bn').notNull(),
  addressEn: text('address_en').notNull(),
  addressBn: text('address_bn').notNull(),
  mapQuery: text('map_query').notNull(),
  phone: text('phone'),
  email: text('email'),
  kind: varchar('kind', { length: 20 }),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const galleryItems = pgTable('gallery_items', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => gallerySections.sectionId, { onDelete: 'cascade' }),
  mediaId: bigint('media_id', { mode: 'number' }).notNull().references(() => mediaItems.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const noticeItems = pgTable('notice_items', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => noticeListSections.sectionId, { onDelete: 'cascade' }),
  dateValue: text('date_value').notNull(),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyBn: text('body_bn').notNull(),
  href: text('href'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const statItems = pgTable('stat_items', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => statsSections.sectionId, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  labelEn: text('label_en').notNull(),
  labelBn: text('label_bn').notNull(),
  noteEn: text('note_en'),
  noteBn: text('note_bn'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const tableSectionHeaders = pgTable('table_section_headers', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => tableSections.sectionId, { onDelete: 'cascade' }),
  labelEn: text('label_en').notNull(),
  labelBn: text('label_bn').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const tableSectionRows = pgTable('table_section_rows', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => tableSections.sectionId, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const timelineItems = pgTable('timeline_items', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sectionId: bigint('section_id', { mode: 'number' }).notNull().references(() => timelineSections.sectionId, { onDelete: 'cascade' }),
  year: text('year').notNull(),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyBn: text('body_bn').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const tableSectionCells = pgTable('table_section_cells', {
  siteId: bigint('site_id', { mode: 'number' }).notNull().default(1).references(() => cmsSites.id),
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  rowId: bigint('row_id', { mode: 'number' }).notNull().references(() => tableSectionRows.id, { onDelete: 'cascade' }),
  valueEn: text('value_en').notNull().default(''),
  valueBn: text('value_bn').notNull().default(''),
  columnOrder: integer('column_order').notNull().default(0),
})
