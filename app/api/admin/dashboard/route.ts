import type { JsonObject } from '@/types/json'
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession } from '@/lib/adminAuth'
import { db, isTransientDatabaseError, withDbRetry } from '@/lib/db'
import { readDriveTableSnapshotInfo } from '@/lib/google/drive-snapshot'
import { ensureDonationsSchema } from '@/lib/db/ensureOperationalSchema'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'

function clampDays(value: number) {
  if (!Number.isFinite(value)) return 30
  return Math.max(7, Math.min(90, Math.trunc(value)))
}

function isRecord(value: JsonObject[keyof JsonObject] | undefined): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function numberValue(value: JsonObject[keyof JsonObject] | undefined) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function dhakaDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const shifted = new Date(date.getTime() + 6 * 60 * 60 * 1000)
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
}

function addDays(dateKey: string, offset: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + offset))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function formatDayLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)))
}

async function buildDriveDashboard(days: number) {
  const tableNames = ['pages', 'cms_content_items', 'job_applications', 'site_visitors', 'visitor_events', 'donations'] as const
  const snapshots = await Promise.all(tableNames.map((table) => readDriveTableSnapshotInfo(table)))
  if (snapshots.some((snapshot) => !snapshot)) {
    throw new Error('Google Drive does not contain every table required for a complete dashboard snapshot.')
  }
  const byTable = new Map(tableNames.map((table, index) => [table, snapshots[index]!]))
  const asOfMs = Math.min(...snapshots.map((snapshot) => Date.parse(snapshot!.exportedAt)))
  const asOf = new Date(asOfMs).toISOString()
  const endDay = dhakaDateKey(asOf)
  const startDay = addDays(endDay, -(days - 1))
  const rows = (table: typeof tableNames[number]) => byTable.get(table)!.rows
  const pages = rows('pages').filter((row) => row.status === 'published')
  const jobs = rows('cms_content_items').filter((row) => row.component === 'job' && row.status === 'published')
  const applications = rows('job_applications')
  const visitors = rows('site_visitors')
  const events = rows('visitor_events').filter((row) => {
    const day = dhakaDateKey(String(row.created_at || ''))
    return day >= startDay && day <= endDay
  })
  const donations = rows('donations')
  const paidDonations = donations.filter((row) => ['paid', 'success'].includes(String(row.status || '').toLowerCase()))
  const inRange = (row: JsonObject) => {
    const day = dhakaDateKey(String(row.created_at || ''))
    return day >= startDay && day <= endDay
  }
  const rangePaidDonations = paidDonations.filter(inRange)
  const today = endDay
  const openJobs = jobs.filter((job) => {
    const attributes = isRecord(job.attributes) ? job.attributes : {}
    const deadline = typeof attributes.deadline === 'string' ? attributes.deadline : ''
    return !deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline) || deadline >= today
  })

  const trendMap = new Map<string, { visitors: number; applications: number; donations: number; donationAmount: number }>()
  for (let offset = 0; offset < days; offset += 1) trendMap.set(addDays(startDay, offset), { visitors: 0, applications: 0, donations: 0, donationAmount: 0 })
  for (const event of events) {
    const bucket = trendMap.get(dhakaDateKey(String(event.created_at || '')))
    if (bucket) bucket.visitors += 1
  }
  for (const application of applications) {
    const bucket = trendMap.get(dhakaDateKey(String(application.created_at || '')))
    if (bucket) bucket.applications += 1
  }
  for (const donation of donations.filter(inRange)) {
    const bucket = trendMap.get(dhakaDateKey(String(donation.created_at || '')))
    if (bucket) {
      bucket.donations += 1
      if (['paid', 'success'].includes(String(donation.status || '').toLowerCase())) bucket.donationAmount += numberValue(donation.amount)
    }
  }

  const countBy = (items: JsonObject[], field: string) => {
    const counts = new Map<string, number>()
    for (const item of items) {
      const key = String(item[field] || '').trim()
      if (key) counts.set(key, (counts.get(key) || 0) + 1)
    }
    return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, 5)
  }
  const oldestSnapshotAgeMs = Math.max(...snapshots.map((snapshot) => snapshot!.ageMs))

  return {
    stats: {
      pages: pages.length, postedJobs: jobs.length, openJobs: openJobs.length, applicants: applications.length,
      visitors: visitors.length, visits: events.length,
      returningVisitors: visitors.filter((visitor) => numberValue(visitor.page_views) > 1).length,
      donations: donations.length,
      donationTotal: paidDonations.reduce((sum, row) => sum + numberValue(row.amount), 0),
      rangeDonationTotal: rangePaidDonations.reduce((sum, row) => sum + numberValue(row.amount), 0),
    },
    range: days,
    trends: [...trendMap.entries()].map(([date, value]) => ({ date, label: formatDayLabel(date), ...value })),
    topPages: countBy(events, 'path').map((row) => ({ path: row.key, visits: row.count })),
    referrers: countBy(events, 'referrer').map((row) => ({ referrer: row.key, visits: row.count })),
    dataSource: 'google-drive-snapshot', snapshotAt: asOf, snapshotAgeMs: oldestSnapshotAgeMs,
  }
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  const days = clampDays(Number(new URL(request.url).searchParams.get('days') || 30))

  if (!database) {
    try {
      const fallback = await buildDriveDashboard(days)
      return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': String(fallback.snapshotAt), Warning: '110 - \"Response is stale\"' } })
    } catch (error) {
      console.error('Drive dashboard snapshot unavailable:', error)
      return NextResponse.json({ error: 'Dashboard data is unavailable. Configure Neon or refresh a complete Google Drive snapshot.' }, { status: 503 })
    }
  }

  try {
    await Promise.all([ensureDonationsSchema(), ensureCmsSchema()])
    const [result, trendsResult, topPagesResult, referrersResult] = await Promise.all([
      withDbRetry(() => database.execute(sql`
        WITH bounds AS (
          SELECT
            (((now() AT TIME ZONE 'Asia/Dhaka')::date - (${days - 1}::int))::timestamp AT TIME ZONE 'Asia/Dhaka') AS start_at,
            (((now() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka') AS end_at
        )
        SELECT
          (SELECT COUNT(*)::int FROM pages WHERE status = 'published') AS pages,
          (SELECT COUNT(*)::int FROM cms_content_items WHERE component = 'job' AND status = 'published') AS posted_jobs,
          (SELECT COUNT(*)::int FROM cms_content_items
            WHERE component = 'job' AND status = 'published'
              AND (NULLIF(attributes->>'deadline', '') IS NULL
                OR (attributes->>'deadline') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
                  AND attributes->>'deadline' >= TO_CHAR((now() AT TIME ZONE 'Asia/Dhaka')::date, 'YYYY-MM-DD'))
          ) AS open_jobs,
          (SELECT COUNT(*)::int FROM job_applications) AS applicants,
          (SELECT COUNT(*)::int FROM site_visitors) AS visitors,
          (SELECT COUNT(*)::int FROM visitor_events ve, bounds b WHERE ve.created_at >= b.start_at AND ve.created_at < b.end_at) AS visits,
          (SELECT COUNT(*)::int FROM site_visitors WHERE page_views > 1) AS returning_visitors,
          (SELECT COUNT(*)::int FROM donations) AS donations,
          COALESCE((SELECT SUM(amount::numeric) FROM donations WHERE status IN ('paid', 'success')), 0) AS donation_total,
          COALESCE((SELECT SUM(d.amount::numeric) FROM donations d, bounds b WHERE d.status IN ('paid', 'success') AND d.created_at >= b.start_at AND d.created_at < b.end_at), 0) AS range_donation_total
      `)),
      withDbRetry(() => database.execute(sql`
        WITH bounds AS (
          SELECT
            (now() AT TIME ZONE 'Asia/Dhaka')::date AS today,
            ((now() AT TIME ZONE 'Asia/Dhaka')::date - ${days - 1}::int) AS start_day,
            (((now() AT TIME ZONE 'Asia/Dhaka')::date - ${days - 1}::int)::timestamp AT TIME ZONE 'Asia/Dhaka') AS start_at,
            (((now() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka') AS end_at
        ), days AS (
          SELECT generate_series(bounds.start_day::timestamp, bounds.today::timestamp, INTERVAL '1 day')::date AS day
          FROM bounds
        ), visitor_daily AS (
          SELECT (ve.created_at AT TIME ZONE 'Asia/Dhaka')::date AS day, COUNT(*)::int AS visitors
          FROM visitor_events ve CROSS JOIN bounds b
          WHERE ve.created_at >= b.start_at AND ve.created_at < b.end_at
          GROUP BY 1
        ), application_daily AS (
          SELECT (ja.created_at AT TIME ZONE 'Asia/Dhaka')::date AS day, COUNT(*)::int AS applications
          FROM job_applications ja CROSS JOIN bounds b
          WHERE ja.created_at >= b.start_at AND ja.created_at < b.end_at
          GROUP BY 1
        ), donation_daily AS (
          SELECT (d.created_at AT TIME ZONE 'Asia/Dhaka')::date AS day,
                 COUNT(*)::int AS donations,
                 COALESCE(SUM(d.amount::numeric) FILTER (WHERE d.status IN ('paid','success')), 0) AS donation_amount
          FROM donations d CROSS JOIN bounds b
          WHERE d.created_at >= b.start_at AND d.created_at < b.end_at
          GROUP BY 1
        )
        SELECT
          to_char(days.day, 'YYYY-MM-DD') AS date,
          to_char(days.day, 'DD Mon') AS label,
          COALESCE(visitor_daily.visitors, 0)::int AS visitors,
          COALESCE(application_daily.applications, 0)::int AS applications,
          COALESCE(donation_daily.donations, 0)::int AS donations,
          COALESCE(donation_daily.donation_amount, 0) AS donation_amount
        FROM days
        LEFT JOIN visitor_daily ON visitor_daily.day = days.day
        LEFT JOIN application_daily ON application_daily.day = days.day
        LEFT JOIN donation_daily ON donation_daily.day = days.day
        ORDER BY days.day
      `)),
      withDbRetry(() => database.execute(sql`
        WITH bounds AS (
          SELECT (((now() AT TIME ZONE 'Asia/Dhaka')::date - (${days - 1}::int))::timestamp AT TIME ZONE 'Asia/Dhaka') AS start_at,
                 (((now() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka') AS end_at
        )
        SELECT ve.path, COUNT(*)::int AS visits
        FROM visitor_events ve CROSS JOIN bounds b
        WHERE ve.created_at >= b.start_at AND ve.created_at < b.end_at
        GROUP BY ve.path
        ORDER BY visits DESC, ve.path ASC
        LIMIT 5
      `)),
      withDbRetry(() => database.execute(sql`
        WITH bounds AS (
          SELECT (((now() AT TIME ZONE 'Asia/Dhaka')::date - (${days - 1}::int))::timestamp AT TIME ZONE 'Asia/Dhaka') AS start_at,
                 (((now() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp AT TIME ZONE 'Asia/Dhaka') AS end_at
        )
        SELECT ve.referrer, COUNT(*)::int AS visits
        FROM visitor_events ve CROSS JOIN bounds b
        WHERE ve.created_at >= b.start_at AND ve.created_at < b.end_at
          AND NULLIF(TRIM(ve.referrer), '') IS NOT NULL
        GROUP BY ve.referrer
        ORDER BY visits DESC, ve.referrer ASC
        LIMIT 5
      `)),
    ])

    const row = (result.rows[0] || {}) as JsonObject

    return NextResponse.json({
      stats: {
        pages: Number(row.pages ?? 0),
        postedJobs: Number(row.posted_jobs ?? 0),
        openJobs: Number(row.open_jobs ?? 0),
        applicants: Number(row.applicants ?? 0),
        visitors: Number(row.visitors ?? 0),
        visits: Number(row.visits ?? 0),
        returningVisitors: Number(row.returning_visitors ?? 0),
        donations: Number(row.donations ?? 0),
        donationTotal: Number(row.donation_total ?? 0),
        rangeDonationTotal: Number(row.range_donation_total ?? 0),
      },
      range: days,
      trends: trendsResult.rows.map((trend) => {
        const point = trend as JsonObject
        return {
          date: String(point.date),
          label: String(point.label),
          visitors: Number(point.visitors ?? 0),
          applications: Number(point.applications ?? 0),
          donations: Number(point.donations ?? 0),
          donationAmount: Number(point.donation_amount ?? 0),
        }
      }),
      topPages: topPagesResult.rows.map((row) => ({ path: String((row as JsonObject).path || '/'), visits: Number((row as JsonObject).visits || 0) })),
      referrers: referrersResult.rows.map((row) => ({ referrer: String((row as JsonObject).referrer || ''), visits: Number((row as JsonObject).visits || 0) })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (isTransientDatabaseError(error)) {
      try {
        const fallback = await buildDriveDashboard(days)
        return NextResponse.json(fallback, { headers: { 'Cache-Control': 'no-store', 'X-Srizony-Data-Source': 'google-drive-snapshot', 'X-Snapshot-Updated-At': String(fallback.snapshotAt), Warning: '110 - \"Response is stale\"' } })
      } catch (fallbackError) {
        console.error('Drive dashboard fallback failed:', fallbackError)
      }
    }
    console.error('Admin dashboard summary failed:', error)
    return NextResponse.json({ error: 'Unable to load dashboard summary.' }, { status: 503 })
  }
}
