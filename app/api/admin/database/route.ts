import type { JsonObject } from '@/types/json'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession, hasAdminRole } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveSnapshotManifestInfo } from '@/lib/google/drive-snapshot'
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
  const driveFallback = async () => {
    try {
      const manifest = await readDriveSnapshotManifestInfo()
      const entries = new Map((manifest?.tables ?? []).map((entry) => [entry.table, entry]))
      const snapshots = tables.map(([name, label]) => {
        const snapshot = entries.get(name)
        return { name, label, snapshot }
      })
      const available = snapshots.filter((item) => item.snapshot?.available)
      if (!available.length) return NextResponse.json({ error: 'No recent verified Google Drive snapshots are available.', tables: tables.map(([name, label]) => ({ name, label, count: null, available: false })), apis: API_REGISTRY, connected: false, dataSource: 'unavailable' }, { status: 503 })
      const oldestAge = Math.max(...available.map((item) => item.snapshot!.ageMs ?? 0))
      return NextResponse.json({
        tables: snapshots.map(({ name, label, snapshot }) => ({ name, label, count: snapshot?.available ? snapshot.rowCount : null, available: Boolean(snapshot?.available), sizeBytes: snapshot?.sizeBytes ?? null, revision: snapshot?.revision ?? null, snapshotAt: snapshot?.updatedAt ?? null })),
        apis: API_REGISTRY,
        connected: false,
        dataSource: 'google-drive-snapshot',
        readOnly: true,
        snapshotAgeMs: oldestAge,
        manifestExportedAt: manifest?.exportedAt ?? null,
        missingSnapshots: snapshots.filter((item) => !item.snapshot?.available).map((item) => item.name),
      }, { headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', Warning: '110 - \"Response is stale\"' } })
    } catch (error) {
      console.error('[cms-database] Google Drive manifest could not be read.', error)
      return NextResponse.json({ error: 'Google Drive snapshot manifest is unavailable.', tables: tables.map(([name, label]) => ({ name, label, count: null, available: false })), apis: API_REGISTRY, connected: false, dataSource: 'unavailable' }, { status: 503 })
    }
  }
  if (!database) return driveFallback()

  try {
    await ensureCmsSchema()
    const countExpressions = tables.map(([name]) =>
      sql`(SELECT COUNT(*)::int FROM ${sql.raw(`"${name}"`)}) AS ${sql.raw(`"${name}"`)}`,
    )
    const row = await withDbRetry(() => database.execute(sql`SELECT ${sql.join(countExpressions, sql`, `)}`))
    const counts = (row.rows[0] || {}) as JsonObject

    return NextResponse.json({
      tables: tables.map(([name, label]) => ({ name, label, count: Number(counts[name] ?? 0) })),
      apis: API_REGISTRY,
      connected: true,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isTransientDatabaseError(error)) return driveFallback()
    console.error('Unable to read database status.', error)
    return NextResponse.json({ error: 'Unable to read database status.' }, { status: 503 })
  }
}
