import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getAdminSession } from '@/lib/adminAuth'
import { db, withDbRetry } from '@/lib/db'
import { ensureDonationsSchema } from '@/lib/db/ensureOperationalSchema'

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
      stats: { pages: 0, enquiries: 0, users: 0, visitors: 0, visits: 0, returningVisitors: 0, donations: 0, completedDonations: 0, donationTotal: 0, rangeDonationTotal: 0, conversionRate: 0, activeVisitors: 0 },
      topPages: [],
      referrers: [],
      range: days,
      trends: [],
    })
  }

  try {
    await ensureDonationsSchema()
    const [result, trendsResult, topPagesResult, referrersResult, conversionResult] = await Promise.all([
      withDbRetry(() => database.execute(sql`
        SELECT
          (SELECT COUNT(*)::int FROM pages WHERE status = 'published') AS pages,
          (SELECT COUNT(*)::int FROM submissions WHERE type = 'query') AS enquiries,
          (SELECT COUNT(*)::int FROM submissions WHERE type = 'query' AND status = 'new') AS new_enquiries,
          (SELECT COUNT(*)::int FROM form_users) AS users,
          (SELECT COUNT(*)::int FROM site_visitors) AS visitors,
          (SELECT COUNT(*)::int FROM visitor_events) AS visits,
          (SELECT COUNT(*)::int FROM site_visitors WHERE page_views > 1) AS returning_visitors,
          (SELECT COUNT(*)::int FROM donations) AS donations,
          (SELECT COUNT(*)::int FROM donations WHERE status IN ('paid', 'success')) AS completed_donations,
          COALESCE((SELECT SUM(amount::numeric) FROM donations WHERE status IN ('paid', 'success')), 0) AS donation_total,
          COALESCE((SELECT SUM(amount::numeric) FROM donations WHERE status IN ('paid', 'success') AND (created_at AT TIME ZONE 'Asia/Dhaka')::date >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')), 0) AS range_donation_total
      `)),
      withDbRetry(() => database.execute(sql`
        WITH days AS (
          SELECT generate_series(
            (CURRENT_DATE - (${days - 1} * INTERVAL '1 day'))::date,
            CURRENT_DATE::date,
            INTERVAL '1 day'
          )::date AS day
        )
        SELECT
          to_char(days.day, 'YYYY-MM-DD') AS date,
          to_char(days.day, 'DD Mon') AS label,
          (SELECT COUNT(*)::int FROM visitor_events ve WHERE (ve.created_at AT TIME ZONE 'Asia/Dhaka')::date = days.day) AS visitors,
          (SELECT COUNT(*)::int FROM submissions s WHERE s.type = 'query' AND (s.created_at AT TIME ZONE 'Asia/Dhaka')::date = days.day) AS enquiries,
          (SELECT COUNT(*)::int FROM donations d WHERE (d.created_at AT TIME ZONE 'Asia/Dhaka')::date = days.day) AS donations,
          COALESCE((SELECT SUM(d.amount::numeric) FROM donations d WHERE d.status IN ('paid','success') AND (d.created_at AT TIME ZONE 'Asia/Dhaka')::date = days.day), 0) AS donation_amount
        FROM days
        ORDER BY days.day
      `)),
      withDbRetry(() => database.execute(sql`
        SELECT ve.path, COUNT(*)::int AS visits
        FROM visitor_events ve
        WHERE (ve.created_at AT TIME ZONE 'Asia/Dhaka')::date >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')
        GROUP BY ve.path
        ORDER BY visits DESC, ve.path ASC
        LIMIT 5
      `)),
      withDbRetry(() => database.execute(sql`
        SELECT ve.referrer, COUNT(*)::int AS visits
        FROM visitor_events ve
        WHERE NULLIF(TRIM(ve.referrer), '') IS NOT NULL
          AND (ve.created_at AT TIME ZONE 'Asia/Dhaka')::date >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')
        GROUP BY ve.referrer
        ORDER BY visits DESC, ve.referrer ASC
        LIMIT 5
      `)),
      withDbRetry(() => database.execute(sql`
        SELECT
          COUNT(DISTINCT ve.visitor_id)::int AS active_visitors,
          (SELECT COUNT(*)::int FROM submissions s WHERE (s.created_at AT TIME ZONE 'Asia/Dhaka')::date >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day') AND s.type = 'query') AS enquiries
        FROM visitor_events ve
        WHERE (ve.created_at AT TIME ZONE 'Asia/Dhaka')::date >= CURRENT_DATE - (${days - 1} * INTERVAL '1 day')
      `)),
    ])

    const row = (result.rows[0] || {}) as Record<string, unknown>

    return NextResponse.json({
      stats: {
        pages: Number(row.pages ?? 0),
        enquiries: Number(row.enquiries ?? 0),
        newEnquiries: Number(row.new_enquiries ?? 0),
        users: Number(row.users ?? 0),
        visitors: Number(row.visitors ?? 0),
        visits: Number(row.visits ?? 0),
        returningVisitors: Number(row.returning_visitors ?? 0),
        donations: Number(row.donations ?? 0),
        completedDonations: Number(row.completed_donations ?? 0),
        donationTotal: Number(row.donation_total ?? 0),
        rangeDonationTotal: Number(row.range_donation_total ?? 0),
        conversionRate: Number((((Number((conversionResult.rows[0] as Record<string, unknown> | undefined)?.enquiries ?? 0)) / Math.max(1, Number((conversionResult.rows[0] as Record<string, unknown> | undefined)?.active_visitors ?? 0))) * 100).toFixed(2)),
        activeVisitors: Number((conversionResult.rows[0] as Record<string, unknown> | undefined)?.active_visitors ?? 0),
      },
      range: days,
      trends: trendsResult.rows.map((trend) => {
        const point = trend as Record<string, unknown>
        return {
          date: String(point.date),
          label: String(point.label),
          visitors: Number(point.visitors ?? 0),
          enquiries: Number(point.enquiries ?? 0),
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
