import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { db, withDbRetry } from '@/lib/db'
import { API_REGISTRY } from '@/lib/apiRegistry'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'

const tables = [
  ['media_items', 'Media'],
  ['pages', 'Pages'],
  ['sections', 'Page sections'],
  ['rich_text_sections', 'Rich text sections'],
  ['stats_sections', 'Stats sections'],
  ['stat_items', 'Stat items'],
  ['cards_sections', 'Cards sections'],
  ['card_items', 'Card items'],
  ['gallery_sections', 'Gallery sections'],
  ['gallery_items', 'Gallery items'],
  ['timeline_sections', 'Timeline sections'],
  ['timeline_items', 'Timeline items'],
  ['diagram_sections', 'Diagram sections'],
  ['table_sections', 'Table sections'],
  ['table_section_headers', 'Table headers'],
  ['table_section_rows', 'Table rows'],
  ['table_section_cells', 'Table cells'],
  ['video_sections', 'Video sections'],
  ['cta_sections', 'CTA sections'],
  ['notice_list_sections', 'Notice sections'],
  ['notice_items', 'Notice items'],
  ['contact_sections', 'Contact sections'],
  ['contact_locations', 'Contact locations'],
  ['donation_sections', 'Donation sections'],
  ['carousel_sections', 'Carousel sections'],
  ['carousel_items', 'Carousel items'],
  ['hero_data', 'Hero configuration'],
  ['hero_slides', 'Hero slides'],
  ['hero_stats', 'Hero statistics'],
  ['nav_groups', 'Navigation groups'],
  ['nav_items', 'Navigation items'],
  ['content_entries', 'Content entries'],
  ['content_entry_bodies', 'Content bodies'],
  ['content_entry_tags', 'Content tags'],
  ['content_entry_related', 'Related content'],
  ['content_entry_gallery', 'Content galleries'],
  ['content_entry_video', 'Content videos'],
  ['ui_content', 'UI content'],
  ['contact_info', 'Contact information'],
  ['contact_phones', 'Contact phones'],
  ['contact_socials', 'Contact social links'],
  ['contact_footprint', 'Contact footprint'],
  ['sdg_steps', 'SDG steps'],
  ['site_global_state', 'Global site state'],
  ['payment_info', 'Payment information'],
  ['site_visitors', 'Unique site visitors'],
  ['visitor_events', 'Visitor page events'],
  ['form_users', 'Authenticated form users'],
  ['enquiry_daily_limits', 'Daily enquiry limits'],
  ['submissions', 'Enquiries & form submissions'],
  ['cookie_consents', 'Enquiry consent records'],
  ['newsletter_subscribers', 'Newsletter subscriptions'],
  ['donations', 'Donation transactions'],
  ['site_settings', 'CMS document data'],
  ['cms_content_items', 'Managed content (projects, products, team, notices, reports, jobs)'],
  ['job_applications', 'Job applications'],
  ['job_resume_uploads', 'Temporary private resume-upload tokens'],
  ['job_public_rate_limits', 'Public job form rate limits'],
  ['cms_users', 'CMS users'],
] as const

export async function GET() {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasAdminRole(admin, 'admin')) return NextResponse.json({ error: 'Administrator permission required.' }, { status: 403 })

  const database = db
  if (!database) return NextResponse.json({ tables: tables.map(([name, label]) => ({ name, label, count: null })), apis: API_REGISTRY, connected: false })

  try {
    await ensureCmsSchema()
    const countExpressions = tables.map(([name]) =>
      sql`(SELECT COUNT(*)::int FROM ${sql.raw(`"${name}"`)}) AS ${sql.raw(`"${name}"`)}`,
    )
    const row = await withDbRetry(() => database.execute(sql`SELECT ${sql.join(countExpressions, sql`, `)}`))
    const counts = (row.rows[0] || {}) as Record<string, unknown>

    return NextResponse.json({
      tables: tables.map(([name, label]) => ({ name, label, count: Number(counts[name] ?? 0) })),
      apis: API_REGISTRY,
      connected: true,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Unable to read database status.' }, { status: 503 })
  }
}
