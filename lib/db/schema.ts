import { sql } from 'drizzle-orm'
import { pgTable, text, varchar, timestamp, serial, numeric, jsonb, date, integer, boolean, uniqueIndex, index, bigserial, bigint, smallint } from 'drizzle-orm/pg-core'

// Structural CMS tables are persisted in 0002_structural_entity_database.sql.
// These typed definitions cover the tables directly used by the public/form APIs.
export const mediaItems = pgTable('media_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
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

export const pages = pgTable('pages', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  titleEn: text('title_en').notNull(),
  titleBn: text('title_bn').notNull(),
  subtitleEn: text('subtitle_en'),
  subtitleBn: text('subtitle_bn'),
  heroImageId: bigint('hero_image_id', { mode: 'number' }),
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
  id: smallint('id').primaryKey().default(1),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const siteSettings = pgTable('site_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const donations = pgTable('donations', {
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
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 254 }).notNull(),
  submissionDate: date('submission_date').notNull().default(sql`(CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date`),
  submissionId: integer('submission_id'),
}, (table) => ({ dailyEmailUnique: uniqueIndex('enquiry_daily_email_date_uq').on(table.email, table.submissionDate) }))

export const submissions = pgTable('submissions', {
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
  id: serial('id').primaryKey(),
  visitorId: varchar('visitor_id', { length: 128 }),
  email: varchar('email', { length: 254 }),
  purpose: varchar('purpose', { length: 40 }).notNull().default('enquiry'),
  consented: boolean('consented').notNull().default(true),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
})

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 254 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('subscribed'),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull().defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
