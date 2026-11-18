'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import type { ExternalValue, JsonObject } from '@/types/json'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import { PageLoading, AdminErrorState } from '../../_components/AdminCommon'
import { AdminDataContainer, AdminTable, AdminToolbar, type AdminTableColumn } from '@/components/admin/cms'
import { REPORTS, getReportRows, type ReportKey } from '@/lib/api/reports'
import { setSubmissionStatus } from '@/lib/api/dashboard'

type RecordValue = JsonObject

const CONFIG = { visitors: REPORTS.visitors, submissions: REPORTS.submissions, donations: REPORTS.donations } as const
const SUBMISSION_STATUSES = ['new', 'read', 'resolved', 'archived']
const PREFERRED_COLUMNS = ['id', 'name', 'email', 'type', 'transactionId', 'amount', 'status', 'createdAt', 'updatedAt', 'lastSeenAt']

function textValue(value: ExternalValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.map(textValue).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function displayValue(value: ExternalValue, key = '') {
  const text = textValue(value)
  if (!text) return '—'
  // Date formatting is based on the column name, not the cell contents.
  if (/(?:At|Date|created|updated|lastSeen)/i.test(key) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    const date = new Date(text)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })
  }
  return text
}

export default function ReportPage() {
  const params = useParams<{ report: string }>()
  const config = CONFIG[params.report as keyof typeof CONFIG] // unknown keys fall through to the error state
  const [items, setItems] = useState<RecordValue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const load = useCallback(() => {
    if (!config) return Promise.resolve()
    setLoading(true)
    setError('')
    return getReportRows(params.report as ReportKey)
      .then((rows) => setItems(rows))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load report.'))
      .finally(() => setLoading(false))
  }, [config, params.report])

  useEffect(() => {
    const task = Promise.resolve().then(() => load())
    return () => { void task }
  }, [load])

  const updateStatus = useCallback((id: number, status: string) => {
    return setSubmissionStatus(id, status)
      .then(() => {
        setItems((current) => current.map((item) => Number(item.id) === id ? { ...item, status } : item))
        toast.success('Request updated.')
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to update request.'))
  }, [])

  const columns = useMemo(() => {
    const keys: string[] = []
    for (const item of items.slice(0, 100)) {
      for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key)
    }
    return [...PREFERRED_COLUMNS.filter((key) => keys.includes(key)), ...keys.filter((key) => !PREFERRED_COLUMNS.includes(key))]
  }, [items])

  const statuses = useMemo(() => Array.from(new Set(items.map((item) => textValue(item.status)).filter(Boolean))).sort(), [items])

  // Filtering only. AdminTable owns column sorting; rows arrive newest-first so the
  // default view matches the old "createdAt desc" behaviour until a header is clicked.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const matches = items.filter((item) => {
      if (statusFilter !== 'all' && textValue(item.status) !== statusFilter) return false
      return !query || Object.values(item).some((value) => textValue(value).toLowerCase().includes(query))
    })
    return matches.sort((a, b) => textValue(b.createdAt).localeCompare(textValue(a.createdAt)))
  }, [items, search, statusFilter])

  const tableColumns = useMemo<AdminTableColumn<RecordValue>[]>(() => columns.map((key) => ({
    key,
    label: key,
    // Readable text for both sorting and CSV export (booleans, arrays, objects).
    accessor: (item) => textValue(item[key]),
    render: (item) => {
      if (key === 'status' && params.report === 'submissions') {
        return (
          <NativeSelect
            className="h-9 text-xs font-semibold"
            aria-label="Request status"
            value={textValue(item[key])}
            onChange={(event) => void updateStatus(Number(item.id), event.target.value)}
          >
            {SUBMISSION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </NativeSelect>
        )
      }
      if (key === 'status') return <Badge variant="outline">{displayValue(item[key], key)}</Badge>
      return <span className="admin-report-cell-value min-w-0 break-words">{displayValue(item[key], key)}</span>
    },
  })), [columns, params.report, updateStatus])

  if (!config) {
    return <AdminErrorState message="Unknown report." />
  }

  return (
    <AdminDataContainer
      label={`${config.title} records`}
      headerContent={
        <AdminToolbar
          title={config.title}
          description="Click a column heading to sort, select rows to export them, or export the whole filtered view."
          count={filtered.length}
          search={search}
          onSearch={setSearch}
          searchPlaceholder={`Search ${config.title.toLowerCase()}…`}
          filters={
            <NativeSelect aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </NativeSelect>
          }
          className="static border-b-0 bg-transparent p-0 backdrop-blur-none"
        />
      }
      bodyScroll="hidden"
    >
      {loading && !items.length ? (
        <div className="p-4"><PageLoading rows={4} /></div>
      ) : error ? (
        <div className="p-4"><AdminErrorState message={error} onRetry={() => void load()} /></div>
      ) : (
        <AdminTable
          rows={filtered}
          columns={tableColumns}
          getRowId={(item, index) => String(item.id ?? index)}
          caption={`${config.title} report`}
          emptyMessage="No records match your filters."
          loading={loading}
          selectable
          exportable
          selectedExportable
          fileName={`${params.report}-report.csv`}
          footerSummary={`${filtered.length.toLocaleString()} visible of ${items.length.toLocaleString()} total records · Updated from the connected CMS data provider`}
        />
      )}
    </AdminDataContainer>
  )
}