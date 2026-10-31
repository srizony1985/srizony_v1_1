'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useParams } from 'next/navigation'
import { SectionToolbar, PageLoading, AdminErrorState } from '../../_components/AdminCommon'
import { REPORTS, getReportRows, type ReportKey } from '@/lib/api/reports'
import { setSubmissionStatus } from '@/lib/api/dashboard'

type RecordValue = Record<string, unknown>
type SortState = { key: string; direction: 'asc' | 'desc' }

const CONFIG = { visitors: REPORTS.visitors, submissions: REPORTS.submissions, donations: REPORTS.donations } as const

function textValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(textValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function displayValue(value: unknown) {
  const text = textValue(value)
  if (!text) return '—'
  if (/At$|Date$|created/i.test(text) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('en-BD')
  }
  return text
}

export default function ReportPage() {
  const params = useParams<{ report: string }>()
  const config = CONFIG[params.report as keyof typeof CONFIG]  // unknown keys fall through to the error state
  const [items, setItems] = useState<RecordValue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState<SortState>({ key: 'createdAt', direction: 'desc' })

  async function load() {
    if (!config) return
    setLoading(true)
    setError('')
    try {
      setItems(await getReportRows(params.report as ReportKey))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [params.report])

  const columns = useMemo(() => {
    const keys: string[] = []
    for (const item of items.slice(0, 100)) {
      for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key)
    }
    const preferred = ['id', 'name', 'email', 'type', 'transactionId', 'amount', 'status', 'createdAt', 'updatedAt', 'lastSeenAt']
    return [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))]
  }, [items])

  const statuses = useMemo(() => Array.from(new Set(items.map((item) => textValue(item.status)).filter(Boolean))).sort(), [items])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const next = items.filter((item) => {
      if (statusFilter !== 'all' && textValue(item.status) !== statusFilter) return false
      return !query || Object.values(item).some((value) => textValue(value).toLowerCase().includes(query))
    })
    const key = sort.key
    return next.sort((a, b) => {
      const av = textValue(a[key]).toLowerCase()
      const bv = textValue(b[key]).toLowerCase()
      const an = Number(av)
      const bn = Number(bv)
      const comparison = Number.isFinite(an) && Number.isFinite(bn) && av !== '' && bv !== '' ? an - bn : av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  }, [items, search, sort, statusFilter])

  if (!config) {
    return <AdminErrorState message="Unknown report." />
  }

  function toggleSort(key: string) {
    setSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  }

  async function updateStatus(id: number, status: string) {
    try { await setSubmissionStatus(id, status) } catch (cause) { return toast.error(cause instanceof Error ? cause.message : 'Unable to update request.') }
    setItems((current) => current.map((item) => Number(item.id) === id ? { ...item, status } : item))
    toast.success('Request updated.')
  }

  return <div className="admin-report-page">
    <SectionToolbar
      title={config.title}
      description={config.description}
      search={search}
      onSearch={setSearch}
      searchPlaceholder={`Search ${config.title.toLowerCase()}…`}
      count={filtered.length}
      onRefresh={() => void load()}
      refreshing={loading}
      filters={<select className="ui-select admin-filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>}
    />

    {loading && !items.length ? <PageLoading rows={4} /> : error ? <AdminErrorState message={error} onRetry={() => void load()} /> : (
      <section className="admin-data-card">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead><tr>{columns.map((key) => <th key={key}><button type="button" className="admin-sort-button" onClick={() => toggleSort(key)}>{key}{sort.key === key && (sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button></th>)}</tr></thead>
            <tbody>
              {filtered.map((item, rowIndex) => <tr key={String(item.id ?? `${rowIndex}`)}>{columns.map((key) => <td key={key} title={textValue(item[key])}>{key === 'status' && params.report === 'submissions' ? <select className="ui-select dashboard-status" value={textValue(item[key])} onChange={(event) => void updateStatus(Number(item.id), event.target.value)}>{['new', 'read', 'resolved', 'archived'].map((status) => <option key={status} value={status}>{status}</option>)}</select> : key === 'status' ? <Badge variant="outline">{displayValue(item[key])}</Badge> : displayValue(item[key])}</td>)}</tr>)}
              {!filtered.length && <tr><td colSpan={Math.max(1, columns.length)} className="admin-empty-cell"><Search size={16} /> No records match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="admin-report-footer"><span>{filtered.length.toLocaleString()} shown</span><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw size={13} /> Refresh</Button></div>
      </section>
    )}
  </div>
}
