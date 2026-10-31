'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Eye,
  FileText,
  Mail,
  Megaphone,
  RefreshCw,
  Send,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionToolbar, PageLoading } from '../_components/AdminCommon'
import { getDashboard, getRecentDonations, getRecentSubmissions, setSubmissionStatus } from '@/lib/api/dashboard'

type TrendPoint = {
  date: string
  label: string
  visitors: number
  enquiries: number
  donations: number
  donationAmount: number
}

type DashboardResponse = {
  range: number
  stats: {
    pages: number
    enquiries: number
    newEnquiries: number
    users: number
    visitors: number
    visits: number
    returningVisitors: number
    donations: number
    completedDonations: number
    donationTotal: number
    rangeDonationTotal: number
    conversionRate: number
    activeVisitors: number
  }
  trends: TrendPoint[]
  topPages: Array<{ path: string; visits: number }>
  referrers: Array<{ referrer: string; visits: number }>
}

type Submission = {
  id: number
  type: string
  name: string | null
  email: string | null
  message: string | null
  status: 'new' | 'read' | 'resolved' | 'archived'
  createdAt: string
}

type Donation = {
  id: number
  transactionId: string
  amount: string
  status: string
  createdAt: string
}

const STATUS_OPTIONS: Submission['status'][] = ['new', 'read', 'resolved', 'archived']

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatAmount(value: string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `৳ ${amount.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `৳ ${value}`
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
  valueKey: keyof Pick<TrendPoint, 'visitors' | 'enquiries' | 'donations'>
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
    <section className="dashboard-chart-panel">
      <div className="dashboard-panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="dashboard-total">{total.toLocaleString()}</span>
      </div>

      {points.length ? (
        <div className="dashboard-chart" role="img" aria-label={`${title}: ${total.toLocaleString()} total`}>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={`fill-${valueKey}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" className="dashboard-gradient-start" />
                <stop offset="100%" className="dashboard-gradient-end" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1={paddingX} x2={width - paddingX} y1={height - paddingY - ratio * (height - paddingY * 2)} y2={height - paddingY - ratio * (height - paddingY * 2)} className="dashboard-grid-line" />
            ))}
            <path d={area} className="dashboard-chart-area" fill={`url(#fill-${valueKey})`} />
            <path d={path} className="dashboard-chart-line" />
            {coords.map((point, index) => (
              <circle key={points[index].date} cx={point.x} cy={point.y} r={points.length > 45 ? 0 : 2.8} className="dashboard-chart-dot">
                <title>{`${points[index].label}: ${values[index].toLocaleString()}`}</title>
              </circle>
            ))}
            {labelIndexes.map((index) => (
              <text key={points[index].date} x={coords[index].x} y={height - 2} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="dashboard-chart-label">
                {points[index].label}
              </text>
            ))}
          </svg>
        </div>
      ) : (
        <div className="dashboard-empty">No activity recorded for this period.</div>
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
    <Link href={href} className="dashboard-metric">
      <span className="dashboard-metric-icon"><Icon size={16} aria-hidden="true" /></span>
      <span className="dashboard-metric-copy">
        <span>{label}</span>
        <strong>{value.toLocaleString()}</strong>
        {note && <small>{note}</small>}
      </span>
      <ChevronRight className="dashboard-metric-arrow" size={14} aria-hidden="true" />
    </Link>
  )
}

export default function OverviewPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [contactError, setContactError] = useState('')
  const [donationError, setDonationError] = useState('')
  const [actualExecutionMs, setActualExecutionMs] = useState<number | null>(null)

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    setContactError('')
    setDonationError('')
    const startedAt = performance.now()

    try {
      const [dashboardResult, contactsResult, donationsResult] = await Promise.allSettled([
        getDashboard<DashboardResponse>(days),
        getRecentSubmissions(),
        getRecentDonations(),
      ])
      if (dashboardResult.status === 'rejected') throw dashboardResult.reason
      setData(dashboardResult.value)
      if (contactsResult.status === 'fulfilled') setSubmissions(contactsResult.value.slice(0, 6))
      else { setSubmissions([]); setContactError(contactsResult.reason instanceof Error ? contactsResult.reason.message : 'Unable to load contact requests.') }
      if (donationsResult.status === 'fulfilled') setDonations(donationsResult.value.slice(0, 6))
      else { setDonations([]); setDonationError(donationsResult.reason instanceof Error ? donationsResult.reason.message : 'Unable to load donations.') }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard data.')
    } finally {
      setActualExecutionMs(Math.max(0, Math.round(performance.now() - startedAt)))
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [days])

  async function updateSubmission(id: number, status: Submission['status']) {
    try {
      await setSubmissionStatus(id, status)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update contact request.')
      return
    }
    setSubmissions((current) => current.map((item) => item.id === id ? { ...item, status } : item))
  }

  const stats = data?.stats ?? {
    pages: 0, enquiries: 0, newEnquiries: 0, users: 0, visitors: 0, visits: 0,
    returningVisitors: 0, donations: 0, completedDonations: 0,
    donationTotal: 0, rangeDonationTotal: 0, conversionRate: 0, activeVisitors: 0,
  }
  const recentSubmissions = useMemo(() => submissions.slice(0, 6), [submissions])
  const recentDonations = useMemo(() => donations.slice(0, 6), [donations])

  if (loading && !data) return <PageLoading rows={4} />

  if (!data) {
    return (
      <>
        <SectionToolbar title="Dashboard" description="Operational snapshot of the CMS and public website." />
        <section className="dashboard-error-panel">
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
    { label: 'Enquiries', value: stats.enquiries, icon: Mail, href: '/admin/dashboard/reports/submissions', note: `${stats.newEnquiries.toLocaleString()} new` },
    { label: 'Form users', value: stats.users, icon: Users, href: '/admin/dashboard/reports/submissions', note: 'Known identities' },
    { label: 'Donations', value: stats.donations, icon: CircleDollarSign, href: '/admin/dashboard/reports/donations', note: `${stats.completedDonations.toLocaleString()} completed` },
    { label: 'Published pages', value: stats.pages, icon: FileText, href: '/admin/dashboard/navigation', note: 'Public CMS pages' },
    { label: 'Completed donations', value: stats.completedDonations, icon: CheckCircle2, href: '/admin/dashboard/reports/donations', note: `৳ ${stats.donationTotal.toLocaleString('en-BD', { maximumFractionDigits: 0 })} lifetime` },
  ]

  return (
    <div className="dashboard-page">
      <SectionToolbar
        title="Dashboard"
        description="Compact website analytics and CMS control center."
        onRefresh={() => void loadDashboard(true)}
        refreshing={refreshing}
        actions={
          <select className="ui-select admin-filter-select dashboard-range-select" value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)} aria-label="Analytics range">
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        }
      />

      {error && <div className="dashboard-error-strip" role="alert"><Activity size={14} />{error}</div>}
      <section className="dashboard-execution-strip" aria-label="Dashboard request execution timing" aria-live="polite">
        <div><span>Estimated target</span><strong>≤ 2.0 s</strong><small>Parallel dashboard data load</small></div>
        <div><span>Actual execution</span><strong>{actualExecutionMs === null ? '—' : actualExecutionMs >= 1000 ? `${(actualExecutionMs / 1000).toFixed(2)} s` : `${actualExecutionMs} ms`}</strong><small>Observed in this browser</small></div>
      </section>

      <section className="dashboard-metrics" aria-label="Website metrics">
        {metricGroups.map((metric) => <Metric key={metric.label} {...metric} />)}
      </section>

      <section className="dashboard-charts" aria-label="Activity analytics">
        <MiniChart title="Visitor frequency" subtitle="Visitor events recorded over time." points={data.trends} valueKey="visitors" total={data.trends.reduce((sum, point) => sum + point.visitors, 0)} />
        <MiniChart title="Enquiry frequency" subtitle="Incoming contact requests over time." points={data.trends} valueKey="enquiries" total={data.trends.reduce((sum, point) => sum + point.enquiries, 0)} />
        <MiniChart title="Donation frequency" subtitle="Donation records created over time." points={data.trends} valueKey="donations" total={data.trends.reduce((sum, point) => sum + point.donations, 0)} />
      </section>

      <section className="dashboard-insight-grid" aria-label="Dashboard insights">
        <section className="dashboard-data-panel"><div className="dashboard-panel-heading"><div><h2>Donation value</h2><p>Successful gateway value in BDT.</p></div><strong className="dashboard-insight-number">৳ {stats.rangeDonationTotal.toLocaleString('en-BD', { maximumFractionDigits: 0 })}</strong></div><div className="dashboard-insight-copy"><span>{days}-day completed donations</span><span>{`৳ ${stats.donationTotal.toLocaleString('en-BD', { maximumFractionDigits: 0 })} lifetime`}</span></div></section>
        <section className="dashboard-data-panel"><div className="dashboard-panel-heading"><div><h2>Enquiry conversion</h2><p>Enquiries divided by active visitors.</p></div><strong className="dashboard-insight-number">{stats.conversionRate.toFixed(2)}%</strong></div><div className="dashboard-insight-copy"><span>{stats.activeVisitors.toLocaleString()} active visitors</span><span>{stats.enquiries.toLocaleString()} total enquiries</span></div></section>
        <section className="dashboard-data-panel"><div className="dashboard-panel-heading"><div><h2>Top pages</h2><p>Most visited paths in this range.</p></div></div><div className="dashboard-mini-list">{data.topPages.map((item) => <div key={item.path}><span>{item.path}</span><strong>{item.visits.toLocaleString()}</strong></div>)}{!data.topPages.length && <span className="dashboard-empty">No page activity recorded.</span>}</div></section>
        <section className="dashboard-data-panel"><div className="dashboard-panel-heading"><div><h2>Referrers</h2><p>Top traffic sources recorded.</p></div></div><div className="dashboard-mini-list">{data.referrers.map((item) => <div key={item.referrer}><span title={item.referrer}>{item.referrer}</span><strong>{item.visits.toLocaleString()}</strong></div>)}{!data.referrers.length && <span className="dashboard-empty">No referrer data recorded.</span>}</div></section>
      </section>

      <section className="dashboard-data-grid">
        <section className="dashboard-data-panel">
          <div className="dashboard-panel-heading">
            <div><h2>Recent contact requests</h2><p>Update request status without leaving the dashboard.</p></div>
            <Link href="/admin/dashboard/reports/submissions">View all <ChevronRight size={13} /></Link>
          </div>
          {contactError && <div className="dashboard-error-strip dashboard-panel-error" role="alert"><Activity size={14} />{contactError}</div>}
          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead><tr><th>Contact</th><th>Type</th><th>Created</th><th>Status</th></tr></thead>
              <tbody>
                {recentSubmissions.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name || 'Unnamed'}</strong><small>{item.email || 'No email'}</small></td>
                    <td>{item.type}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <select className={`dashboard-status status-${item.status}`} value={item.status} onChange={(event) => void updateSubmission(item.id, event.target.value as Submission['status'])} aria-label={`Status for request ${item.id}`}>
                        {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {!recentSubmissions.length && <tr><td colSpan={4} className="dashboard-empty-cell">No contact requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-data-panel">
          <div className="dashboard-panel-heading">
            <div><h2>Recent donations</h2><p>Latest gateway records and transaction status.</p></div>
            <Link href="/admin/dashboard/reports/donations">View all <ChevronRight size={13} /></Link>
          </div>
          {donationError && <div className="dashboard-error-strip dashboard-panel-error" role="alert"><Activity size={14} />{donationError}</div>}
          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead><tr><th>Transaction</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {recentDonations.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.transactionId}</strong></td>
                    <td>{formatAmount(item.amount)}</td>
                    <td><Badge variant={['paid', 'success'].includes(item.status) ? 'default' : 'outline'}>{item.status}</Badge></td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
                {!recentDonations.length && <tr><td colSpan={4} className="dashboard-empty-cell">No donations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="dashboard-quick-links">
        <div className="dashboard-panel-heading">
          <div><h2>Manage website</h2><p>Open the dedicated CMS editor or operational report.</p></div>
        </div>
        <div className="dashboard-quick-grid">
          {[
            ['/admin/dashboard/navigation', 'Site Navigation', FileText],
            ['/admin/dashboard/site-content', 'Site Content', Send],
            ['/admin/dashboard/jobs', 'Jobs', Megaphone],
            ['/admin/dashboard/reports/visitors', 'Visitors', Eye],
            ['/admin/dashboard/reports/submissions', 'Contact Requests', Mail],
            ['/admin/dashboard/reports/donations', 'Donations', CircleDollarSign],
          ].map(([href, label, Icon]) => (
            <Link key={String(href)} href={String(href)} className="dashboard-quick-link">
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
