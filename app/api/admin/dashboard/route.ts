import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession } from '@/lib/adminAuth'
import { db, withDbRetry } from '@/lib/db'
import { ensureDonationsSchema } from '@/lib/db/ensureOperationalSchema'
import { ensureCmsSchema } from '@/lib/cms/ensureSchema'

function clampDays(value: number) {
  if (!Number.isFinite(value)) return 30
  return Math.max(7, Math.min(90, Math.trunc(value)))
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const database = db
  const days = clampDays(Number(new URL(request.url).searchParams.get('days') || 30))

  if (!database) {
    return NextResponse.json({
      stats: { pages: 0, postedJobs: 0, openJobs: 0, applicants: 0, visitors: 0, visits: 0, returningVisitors: 0, donations: 0, donationTotal: 0, rangeDonationTotal: 0 },
      topPages: [],
      referrers: [],
      range: days,
      trends: [],
    })
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

    const row = (result.rows[0] || {}) as Record<string, unknown>

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
        const point = trend as Record<string, unknown>
        return {
          date: String(point.date),
          label: String(point.label),
          visitors: Number(point.visitors ?? 0),
          applications: Number(point.applications ?? 0),
          donations: Number(point.donations ?? 0),
          donationAmount: Number(point.donation_amount ?? 0),
        }
      }),
      topPages: topPagesResult.rows.map((row) => ({ path: String((row as Record<string, unknown>).path || '/'), visits: Number((row as Record<string, unknown>).visits || 0) })),
      referrers: referrersResult.rows.map((row) => ({ referrer: String((row as Record<string, unknown>).referrer || ''), visits: Number((row as Record<string, unknown>).visits || 0) })),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Admin dashboard summary failed:', error)
    return NextResponse.json({ error: 'Unable to load dashboard summary.' }, { status: 503 })
  }
}
