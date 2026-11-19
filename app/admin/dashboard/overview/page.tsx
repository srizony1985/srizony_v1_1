'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileText,
  Megaphone,
  Send,
  BriefcaseBusiness,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { Badge } from '@/components/ui/badge'
import { AdminSectionTabs, SectionToolbar, PageLoading } from '../_components/AdminCommon'
import { getDashboard, getRecentDonations } from '@/lib/api/dashboard'
import type { JsonObject } from '@/types/json'
import { AdminDataContainer, AdminDataGroup, AdminGrid, AdminTable, type AdminTableColumn } from '@/components/admin/cms'
type TrendPoint = {
  date: string
  label: string
  visitors: number
  applications: number
  donations: number
  donationAmount: number
}

type DashboardResponse = {
  range: number
  stats: {
    pages: number
    postedJobs: number
    openJobs: number
    applicants: number
    visitors: number
    visits: number
    returningVisitors: number
    donations: number
    donationTotal: number
    rangeDonationTotal: number
  }
  trends: TrendPoint[]
  topPages: Array<{ path: string; visits: number }>
  referrers: Array<{ referrer: string; visits: number }>
}

type Donation = {
  id: number
  transactionId: string
  amount: string
  status: string
  createdAt: string
}

function normalizeDonation(value: JsonObject): Donation | null {
  const id = Number(value.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return {
    id,
    transactionId: typeof value.transactionId === 'string' ? value.transactionId : '',
    amount: typeof value.amount === 'string' || typeof value.amount === 'number' ? String(value.amount) : '0',
    status: typeof value.status === 'string' ? value.status : 'pending',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `৳ ${amount.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `৳ ${value}`
}

function getExecutionDuration(startedAt: number, finishedAt: number) {
  return Math.max(0, Math.round(finishedAt - startedAt))
}

function MiniChart({
  title,
  subtitle,
  points,
  valueKey,
  total,
}: {
  title: string
  subtitle: string
  points: TrendPoint[]
  valueKey: keyof Pick<TrendPoint, 'visitors' | 'applications' | 'donations'>
  total: number
}) {
  const width = 720
  const height = 190
  const paddingX = 12
  const paddingY = 18
  const values = points.map((point) => Number(point[valueKey]) || 0)
  const max = Math.max(1, ...values)
  const step = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0
  const coords = values.map((value, index) => {
    const x = points.length === 1 ? width / 2 : paddingX + step * index
    const y = height - paddingY - (value / max) * (height - paddingY * 2)
    return { x, y }
  })
  const path = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const area = coords.length ? `${path} L ${coords.at(-1)!.x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z` : ''
  const labelIndexes = points.length <= 8
    ? points.map((_, index) => index)
    : [0, Math.floor(points.length / 2), points.length - 1]

  return (
    <section className="dashboard-chart-panel [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [overflow:hidden] [padding:12px] max-[1100px]:[&_.dashboard-chart]:[height:190px] max-[700px]:[padding:10px] [border-radius:var(--radius,_var(--radius))]">
      <div className="dashboard-panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:10px] [min-width:0] [&_h2]:[margin:0] [&_h2]:[font-size:1.125rem] [&_h2]:[line-height:1.25] [&_h2]:[font-weight:600] [&_p]:[margin:4px_0_0] [&_p]:[font-size:0.75rem] [&_p]:[line-height:1.5] [&_p]:[color:var(--muted-foreground)] [&>a]:[display:inline-flex] [&>a]:[align-items:center] [&>a]:[gap:2px] [&>a]:[flex:0_0_auto] [&>a]:[color:var(--primary,var(--primary))] [&>a]:[font-size:0.75rem] [&>a]:[font-weight:600] [&>a]:[color:var(--primary)] [&>a]:[min-height:42px]">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="dashboard-total [display:grid] [place-items:center] [min-width:42px] [padding:4px_7px] [border-radius:999px] [background:var(--muted)] [color:var(--primary)] [font-size:0.75rem] [font-weight:600] [font-variant-numeric:tabular-nums] [color:var(--primary-hover)]">{total.toLocaleString()}</span>
      </div>

      {points.length ? (
        <div className="dashboard-chart [height:170px] [margin-top:7px] [&_svg]:[display:block] [&_svg]:[width:100%] [&_svg]:[height:100%] [&_svg]:[overflow:visible] max-[700px]:![height:165px] max-[700px]:[height:165px]" role="img" aria-label={`${title}: ${total.toLocaleString()} total`}>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={`fill-${valueKey}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" className="dashboard-gradient-start [stop-color:var(--primary)] [stop-opacity:.18]" />
                <stop offset="100%" className="dashboard-gradient-end [stop-color:var(--primary)] [stop-opacity:0]" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1={paddingX} x2={width - paddingX} y1={height - paddingY - ratio * (height - paddingY * 2)} y2={height - paddingY - ratio * (height - paddingY * 2)} className="dashboard-grid-line [stroke:var(--border)] [stroke-width:1] [stroke-dasharray:3_5] [vector-effect:non-scaling-stroke]" />
            ))}
            <path d={area} className="dashboard-chart-area [opacity:.8]" fill={`url(#fill-${valueKey})`} />
            <path d={path} className="dashboard-chart-line [fill:none] [stroke:var(--primary)] [stroke-width:2.5] [stroke-linecap:round] [stroke-linejoin:round] [vector-effect:non-scaling-stroke]" />
            {coords.map((point, index) => (
              <circle key={points[index].date} cx={point.x} cy={point.y} r={points.length > 45 ? 0 : 2.8} className="dashboard-chart-dot [fill:var(--card)] [stroke:var(--primary)] [stroke-width:2] [vector-effect:non-scaling-stroke]">
                <title>{`${points[index].label}: ${values[index].toLocaleString()}`}</title>
              </circle>
            ))}
            {labelIndexes.map((index) => (
              <text key={points[index].date} x={coords[index].x} y={height - 2} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="dashboard-chart-label [fill:var(--muted-foreground)] [font-size:0.875rem]">
                {points[index].label}
              </text>
            ))}
          </svg>
        </div>
      ) : (
        <div className="dashboard-empty [display:grid] [place-items:center] [height:170px] [font-size:0.75rem] [color:var(--muted-foreground)]">No activity recorded for this period.</div>
      )}
    </section>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
  href,
  note,
}: {
  label: string
  value: number
  icon: typeof Eye
  href: string
  note?: string
}) {
  return (
    <Link href={href} className="dashboard-metric [position:relative] [display:flex] [align-items:center] [gap:9px] [min-width:0] [padding:11px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--foreground)] [transition:transform_.16s_ease,border-color_.16s_ease,background-color_.16s_ease] [&:hover]:[transform:translateY(-1px)] [&:hover]:[border-color:color-mix(in_srgb,var(--primary)_38%,var(--border))] [&:hover]:[background:color-mix(in_srgb,var(--primary)_4%,var(--card))] max-[700px]:[padding:9px] [border-radius:var(--radius,_var(--radius))] [min-height:42px]">
      <span className="dashboard-metric-icon min-w-10 min-h-10 grid place-items-center flex-[0_0_auto] [border-radius:var(--radius)] [background:var(--muted)] text-(--primary,var(--primary)) max-[700px]:min-w-4 max-[700px]:min-h-4"><Icon className="flex w-8 h-8 sm:w-16 sm:h-16" aria-hidden="true" /></span>
      <span className="dashboard-metric-copy [display:grid] [min-width:0] [line-height:1.5] [&>span]:[overflow:hidden] [&>span]:[text-overflow:ellipsis] [&>span]:[white-space:nowrap] [&>span]:[font-size:0.75rem] [&>span]:[font-weight:600] [&>span]:[color:var(--muted-foreground)] [&_strong]:[margin-top:3px] [&_strong]:[font-size:1.125rem] [&_strong]:[letter-spacing:0em] [&_strong]:[font-variant-numeric:tabular-nums] [&_small]:[margin-top:3px] [&_small]:[font-size:0.75rem] [&_small]:[color:var(--muted-foreground)] max-[700px]:[&_strong]:[font-size:1.125rem] max-[700px]:[&_small]:[font-size:0.75rem] max-[480px]:[&>span]:[font-size:0.75rem] max-[480px]:[&_strong]:[font-size:1rem]">
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
        {note && <small className="hidden sm:inline">{note}</small>}
      </span>
      <ChevronRight className="dashboard-metric-arrow [margin-left:auto] [flex:0_0_auto] [color:var(--muted-foreground)]" size={14} aria-hidden="true" />
    </Link>
  )
}

export default function OverviewPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [donationError, setDonationError] = useState('')
  const [actualExecutionMs, setActualExecutionMs] = useState<number | null>(null)
  const requestIdRef = useRef(0)
  const loadDashboard = useCallback(async (showRefresh = false) => {
    const requestId = ++requestIdRef.current
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    setDonationError('')
    const startedAt = performance.now()

    try {
      const [dashboardResult, donationsResult] = await Promise.allSettled([
        getDashboard<DashboardResponse>(days),
        getRecentDonations(),
      ])
      if (requestId !== requestIdRef.current) return

      if (dashboardResult.status === 'rejected') throw dashboardResult.reason
      setData(dashboardResult.value)

      if (donationsResult.status === 'fulfilled') {
        setDonations(donationsResult.value.slice(0, 6).map(normalizeDonation).filter((item): item is Donation => item !== null))
      } else {
        setDonations([])
        setDonationError(donationsResult.reason instanceof Error ? donationsResult.reason.message : 'Unable to load donations.')
      }
    } catch (cause: unknown) {
      if (requestId !== requestIdRef.current) return
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard data.')
    } finally {
      if (requestId === requestIdRef.current) {
        setActualExecutionMs(getExecutionDuration(startedAt, performance.now()))
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [days])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(() => {
      if (!cancelled) return loadDashboard()
    })
    return () => {
      cancelled = true
      requestIdRef.current += 1
    }
  }, [loadDashboard])

  const stats = data?.stats ?? {
    pages: 0, postedJobs: 0, openJobs: 0, applicants: 0, visitors: 0, visits: 0,
    returningVisitors: 0, donations: 0,
    donationTotal: 0, rangeDonationTotal: 0,
  }
  const recentDonations = useMemo(() => donations.slice(0, 6), [donations])

  if (loading && !data) return <PageLoading rows={4} />

  if (!data) {
    return (
      <>
        <SectionToolbar title="Dashboard" description="Operational snapshot of the CMS and public website." />
        <section className="dashboard-error-panel [display:grid] [grid-template-columns:auto_minmax(0,1fr)_auto] [align-items:center] [gap:12px] [padding:22px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [&>div]:[min-width:0] [&_strong]:[display:block] [&_strong]:[color:var(--foreground)] [&_strong]:[font-size:0.875rem] [&_p]:[margin:4px_0_0] [&_p]:[font-size:0.75rem] max-[700px]:[grid-template-columns:auto_minmax(0,1fr)] max-[700px]:[&_button]:[grid-column:1/-1] [border-radius:var(--radius,_var(--radius))]">
          <Activity size={20} />
          <div>
            <strong>Dashboard unavailable</strong>
            <p>{error || 'Dashboard data is temporarily unavailable.'}</p>
          </div>
          <Button onClick={() => void loadDashboard(true)} disabled={refreshing}>Reload</Button>
        </section>
      </>
    )
  }

  const metricGroups = [
    { label: 'Unique visitors', value: stats.visitors, icon: Eye, href: '/admin/dashboard/reports/visitors', note: `${stats.returningVisitors.toLocaleString()} returning` },
    { label: 'Visits', value: stats.visits, icon: BarChart3, href: '/admin/dashboard/reports/visitors', note: `${days} day activity` },
    { label: 'Donations', value: stats.donations, icon: CircleDollarSign, href: '/admin/dashboard/reports/donations', note: 'Gateway records' },
    { label: 'Published pages', value: stats.pages, icon: FileText, href: '/admin/dashboard/navigation', note: 'Public CMS pages' },
    { label: 'Total posted jobs', value: stats.postedJobs, icon: BriefcaseBusiness, href: '/admin/dashboard/jobs', note: 'Published vacancies' },
    { label: 'Total open jobs', value: stats.openJobs, icon: BriefcaseBusiness, href: '/admin/dashboard/jobs', note: 'Accepting applications' },
    { label: 'Total applicants', value: stats.applicants, icon: Users, href: '/admin/dashboard/jobs', note: 'All job applications' },
  ]

  return (
    <div className="admin-page-stack">
      <SectionToolbar
        title="Dashboard"
        onRefresh={() => void loadDashboard(true)}
        refreshing={refreshing}
        actions={
          <NativeSelect className="admin-filter-select dashboard-range-select min-w-26.25" value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)} aria-label="Analytics range">
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </NativeSelect>
        }
      />

      {error && <div className="dashboard-error-strip flex items-center gap-1.75 p-[8px_10px] [border:1px_solid_color-mix(in_srgb,var(--primary)_30%,var(--border))] [border-radius:var(--radius)] [background:var(--muted)] text-muted-foreground text-[0.75rem]" role="alert"><Activity size={14} />{error}</div>}
      <section className="dashboard-execution-strip grid grid-cols-2 gap-2.5 m-[10px_0] [&_>_div]:grid [&_>_div]:grid-cols-[minmax(0,1fr)_auto] [&_>_div]:items-center [&_>_div]:gap-[2px_12px] [&_>_div]:min-w-0 [&_>_div]:p-[10px_12px] [&_>_div]:[border:1px_solid_var(--border)] [&_>_div]:rounded-(--radius,var(--radius)) [&_>_div]:[background:var(--card)] [&_span]:text-muted-foreground [&_span]:[font-size:0.75rem] [&_span]:[font-weight:600] [&_strong]:[color:var(--primary)] [&_strong]:[font-size:0.875rem] [&_strong]:[font-variant-numeric:tabular-nums] [&_small]:[grid-column:1/-1] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] max-[480px]:[grid-template-columns:1fr]" aria-label="Dashboard request execution timing" aria-live="polite">
        <div><span>Estimated target</span><strong>≤ 2.0 s</strong><small>Parallel dashboard data load</small></div>
        <div><span>Actual execution</span><strong>{actualExecutionMs === null ? '—' : actualExecutionMs >= 1000 ? `${(actualExecutionMs / 1000).toFixed(2)} s` : `${actualExecutionMs} ms`}</strong><small>Observed in this browser</small></div>
      </section>

      <AdminGrid as="section" ariaLabel="Website metrics" columns="repeat(auto-fit, minmax(min(100%, 190px), 1fr))" gap="12px" className="dashboard-metrics grid grid-cols-4 gap-2 max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2 max-[700px]:gap-1.5 max-[480px]:[grid-template-columns:1fr_1fr]">
        {metricGroups.map((metric) => <Metric key={metric.label} {...metric} />)}
      </AdminGrid>

      <section className="dashboard-visualization-section grid mt-2" aria-label="Activity analytics">
        <section className="dashboard-charts grid sm:grid-cols-3 gap-2.5" role="tabpanel" aria-label="Mini Chart">
          <MiniChart title="Visitor frequency" subtitle="Visitor events recorded over time." points={data.trends} valueKey="visitors" total={data.trends.reduce((sum, point) => sum + point.visitors, 0)} />
          <MiniChart title="Job application frequency" subtitle="Applications received over time." points={data.trends} valueKey="applications" total={data.trends.reduce((sum, point) => sum + point.applications, 0)} />
          <MiniChart title="Donation frequency" subtitle="Donation records created over time." points={data.trends} valueKey="donations" total={data.trends.reduce((sum, point) => sum + point.donations, 0)} />
        </section>
      </section>

      <section className="dashboard-visualization-section grid gap-2" aria-label="Dashboard insights">
        <section className="dashboard-insight-grid grid sm:grid-cols-3 gap-3 mt-2" role="tabpanel" aria-label="table insights">
          <section className="dashboard-data-panel min-w-0 [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [overflow:hidden] [padding:12px] max-[700px]:[padding:10px]"><div className="dashboard-panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:10px] [min-width:0] [&_h2]:[margin:0] [&_h2]:[font-size:1.125rem] [&_h2]:[line-height:1.25] [&_h2]:[font-weight:600] [&_p]:[margin:4px_0_0] [&_p]:[font-size:0.75rem] [&_p]:[line-height:1.5] [&_p]:[color:var(--muted-foreground)] [&>a]:[display:inline-flex] [&>a]:[align-items:center] [&>a]:[gap:2px] [&>a]:[flex:0_0_auto] [&>a]:[color:var(--primary,var(--primary))] [&>a]:[font-size:0.75rem] [&>a]:[font-weight:600] [&>a]:[color:var(--primary)] [&>a]:[min-height:42px]"><div><h2>Donation value</h2><p>Successful gateway value in BDT.</p></div><strong className="dashboard-insight-number [font-size:1.125rem] [line-height:1] [font-weight:600] [letter-spacing:0em]">৳ {stats.rangeDonationTotal.toLocaleString('en-BD', { maximumFractionDigits: 0 })}</strong></div><div className="dashboard-insight-copy [display:flex] [justify-content:space-between] [gap:12px] [margin-top:10px] [color:var(--muted-foreground)] [font-size:0.875rem]"><span>{days}-day successful donations</span><span>{`৳ ${stats.donationTotal.toLocaleString('en-BD', { maximumFractionDigits: 0 })} lifetime`}</span></div></section>
          <section className="dashboard-data-panel min-w-0 [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [overflow:hidden] [padding:12px] max-[700px]:[padding:10px]"><div className="dashboard-panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:10px] [min-width:0] [&_h2]:[margin:0] [&_h2]:[font-size:1.125rem] [&_h2]:[line-height:1.25] [&_h2]:[font-weight:600] [&_p]:[margin:4px_0_0] [&_p]:[font-size:0.75rem] [&_p]:[line-height:1.5] [&_p]:[color:var(--muted-foreground)] [&>a]:[display:inline-flex] [&>a]:[align-items:center] [&>a]:[gap:2px] [&>a]:[flex:0_0_auto] [&>a]:[color:var(--primary,var(--primary))] [&>a]:[font-size:0.75rem] [&>a]:[font-weight:600] [&>a]:[color:var(--primary)] [&>a]:[min-height:42px]"><div><h2>Top pages</h2><p>Most visited paths in this range.</p></div></div><div className="dashboard-mini-list [display:grid] [gap:7px] [margin-top:8px] [&>div]:[display:flex] [&>div]:[justify-content:space-between] [&>div]:[gap:12px] [&>div]:[padding:8px_0] [&>div]:[border-bottom:1px_solid_var(--border)] [&>div:last-child]:[border-bottom:0] [&_span]:[min-width:0] [&_span]:[overflow:hidden] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap] [&_span]:[color:var(--muted-foreground)] [&_strong]:[flex:0_0_auto]">{data.topPages.map((item) => <div key={item.path}><span>{item.path}</span><strong>{item.visits.toLocaleString()}</strong></div>)}{!data.topPages.length && <span className="dashboard-empty [display:grid] [place-items:center] [height:170px] [font-size:0.75rem] [color:var(--muted-foreground)]">No page activity recorded.</span>}</div></section>
          <section className="dashboard-data-panel min-w-0 [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [overflow:hidden] [padding:12px] max-[700px]:[padding:10px]"><div className="dashboard-panel-heading [display:flex] [align-items:flex-start] [justify-content:space-between] [gap:10px] [min-width:0] [&_h2]:[margin:0] [&_h2]:[font-size:1.125rem] [&_h2]:[line-height:1.25] [&_h2]:[font-weight:600] [&_p]:[margin:4px_0_0] [&_p]:[font-size:0.75rem] [&_p]:[line-height:1.5] [&_p]:[color:var(--muted-foreground)] [&>a]:[display:inline-flex] [&>a]:[align-items:center] [&>a]:[gap:2px] [&>a]:[flex:0_0_auto] [&>a]:[color:var(--primary,var(--primary))] [&>a]:[font-size:0.75rem] [&>a]:[font-weight:600] [&>a]:[color:var(--primary)] [&>a]:[min-height:42px]"><div><h2>Referrers</h2><p>Top traffic sources recorded.</p></div></div><div className="dashboard-mini-list [display:grid] [gap:7px] [margin-top:8px] [&>div]:[display:flex] [&>div]:[justify-content:space-between] [&>div]:[gap:12px] [&>div]:[padding:8px_0] [&>div]:[border-bottom:1px_solid_var(--border)] [&>div:last-child]:[border-bottom:0] [&_span]:[min-width:0] [&_span]:[overflow:hidden] [&_span]:[text-overflow:ellipsis] [&_span]:[white-space:nowrap] [&_span]:[color:var(--muted-foreground)] [&_strong]:[flex:0_0_auto]">{data.referrers.map((item) => <div key={item.referrer}><span title={item.referrer}>{item.referrer}</span><strong>{item.visits.toLocaleString()}</strong></div>)}{!data.referrers.length && <span className="dashboard-empty [display:grid] [place-items:center] [height:170px] [font-size:0.75rem] [color:var(--muted-foreground)]">No referrer data recorded.</span>}</div></section>
        </section>
      </section>

      <section className="admin-data-container mt-2 grid h-(--cms-data-height) min-h-(--cms-data-min-height) min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-border bg-card text-primary shadow-sm max-h-(--cms-data-max-height,none) text-(length:--cms-control-font-size,13px) admin-report-data-container">

        <AdminDataGroup
          title="Recent donations"
          description="Latest gateway records and transaction status."
          count={recentDonations.length}
          className="dashboard-data-panel min-w-0 [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] overflow-hidden p-3 max-[720px]:p-2.5 dashboard-recent-donations-group"
          actions={<Link type="button" className="flex items-center p-2 border border-border rounded-lg" href="/admin/dashboard/reports/donations">View all <ChevronRight size={13} /></Link>}
        >
          {donationError && <div className="dashboard-error-strip flex items-center gap-1.75 p-[8px_10px] [border:1px_solid_color-mix(in_srgb,var(--primary)_30%,var(--border))] [border-radius:var(--radius)] [background:var(--muted)] text-muted-foreground text-[0.75rem] dashboard-panel-error m-[10px_0_0]" role="alert"><Activity size={14} />{donationError}</div>}
          <AdminDataContainer
            label="Recent donations dataset"
            className="dashboard-data-table-container"
            bodyScroll="hidden"
            status={{ content: `${recentDonations.length.toLocaleString()} recent donation records` }}
            instructions="Use View all to open the complete donation report."
            minHeight="0"
            height={`${donations.length === 0 ? "10vh" : donations.length*10}vh`}
            maxHeight="75vh 720px"
          >
            <AdminTable
            rows={recentDonations}
            columns={[
              { key: 'transactionId', label: 'Transaction', accessor: (item) => item.transactionId, render: (item) => <strong>{item.transactionId}</strong> },
              { key: 'amount', label: 'Amount', accessor: (item) => Number(item.amount), render: (item) => formatAmount(item.amount), align: 'right' },
              { key: 'status', label: 'Status', accessor: (item) => item.status, render: (item) => <Badge variant={['paid', 'success'].includes(item.status) ? 'default' : 'outline'}>{item.status}</Badge> },
              { key: 'createdAt', label: 'Created', accessor: (item) => item.createdAt, render: (item) => formatDate(item.createdAt) },
            ] as AdminTableColumn<Donation>[]}
            getRowId={(item) => item.id}
            caption="Recent donation transactions"
            emptyMessage="No donations yet."
            exportable={false}
          />
          </AdminDataContainer>
        </AdminDataGroup>
      </section>

      <section className="dashboard-quick-links min-w-0 [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] overflow-hidden p-3 max-[700px]:p-2.5 mt-2">
        <div className="dashboard-panel-heading flex flex-start justify-content:space-between gap-2.5 min-w-0 [h2]:m-0 [h2]:text-[1.125rem] [h2]:leading-tight [h2]:font-semibold [p]:m-[4px_0_0] [p]:text-[0.75rem] [p]:leading-normal [p]:text-muted-foreground [&>a]:inline-flex [&>a]:items-center [&>a]:gap-0.5 [&>a]:flex-[0_0_auto] [&>a]:text-(--primary,var(--primary)) [&>a]:text-[0.75rem] [&>a]:font-semibold [&>a]:min-h-10.5">
          <div><h2>Manage website</h2><p>Open the dedicated CMS editor or operational report.</p></div>
        </div>
        <div className="dashboard-quick-grid grid grid-cols-5 gap-1.5 mt-2.25 max-[700px]:grid-cols-2 max-[480px]:[grid-template-columns:1fr]">
          {[
            ['/admin/dashboard/navigation', 'Site Navigation', FileText],
            ['/admin/dashboard/site-content', 'Site Content', Send],
            ['/admin/dashboard/jobs', 'Jobs', Megaphone],
            ['/admin/dashboard/reports/visitors', 'Visitors', Eye],
            ['/admin/dashboard/reports/donations', 'Donations', CircleDollarSign],
          ].map(([href, label, Icon]) => (
            <Link key={String(href)} href={String(href)} className="dashboard-quick-link flex items-center gap-1.75 min-w-0 p-2 [border:1px_solid_var(--border)] [border-radius:var(--radius)] text-primary [transition:border-color_.16s,background-color_.16s] [&:hover]:border-[color-mix(in_srgb,var(--primary)_35%,var(--border))] [&:hover]:[background:var(--muted)] [&>span]:w-6.5 [&>span]:h-6.5 [&>span]:grid [&>span]:place-items-center [&>span]:flex-[0_0_auto] [&>span]:[border-radius:var(--radius)] [&>span]:[background:var(--muted)] [&_strong]:min-w-0 [&_strong]:overflow-hidden [&_strong]:text-ellipsis [&_strong]:whitespace-nowrap [&_strong]:text-[0.75rem] [&>svg]:ml-auto [&>svg]:flex-[0_0_auto] [&>svg]:text-muted-foreground [&_>_span]:[border-radius:var(--radius)] [&>span]:text-primary min-h-10.5">
              <span><Icon size={15} /></span>
              <strong>{String(label)}</strong>
              <ChevronRight size={13} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
