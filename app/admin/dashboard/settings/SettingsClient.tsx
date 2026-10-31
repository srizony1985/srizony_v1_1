'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Database, Download, FileSpreadsheet, FileJson, KeyRound, Upload, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { REPORTS, getReportRows, type ReportKey, type ReportRow } from '@/lib/api/reports'
import { createUser, deleteUser, getDatabaseInfo, getUsers, updateUser, type CmsUser, type DatabaseInfo, type Role } from '@/lib/api/settings'
import { downloadCsv, toCsv } from '@/lib/csv'
import { AdminErrorState, PageLoading, useAdminFetch } from '../_components/AdminCommon'

const VIEWS = {
  users: { title: 'CMS Users', description: 'Create and manage the people who can sign in to this CMS.', icon: Users },
  database: { title: 'Database & APIs', description: 'Table inventory and the API endpoints currently active.', icon: Database },
  reporting: { title: 'Reporting', description: 'Download table data as CSV — the whole table or only the rows you select.', icon: FileSpreadsheet },
} as const
type ViewKey = keyof typeof VIEWS
const ROLE_HELP: Record<Role, string> = { admin: 'Full access, user management, database import and export.', editor: 'Create and edit content, navigation and jobs.', analyst: 'Read-only dashboards and reports.' }

export default function SettingsClient({ role }: { role: Role }) {
  const params = useSearchParams()
  const requested = params.get('view') || 'users'
  const view: ViewKey = requested in VIEWS ? (requested as ViewKey) : 'users'
  const meta = VIEWS[view]
  return (
    <div className="admin-settings-page">
      <section className="admin-toolbar-panel"><div className="admin-toolbar-primary"><div className="admin-toolbar-copy"><h1>{meta.title}</h1><p>{meta.description}</p></div><Badge>{role}</Badge></div></section>
      {view === 'users' && <UsersView role={role} />}
      {view === 'database' && <DatabaseView role={role} />}
      {view === 'reporting' && <ReportingView />}
    </div>
  )
}

function UsersView({ role }: { role: Role }) {
  const { data, loading, error, reload } = useAdminFetch<CmsUser[]>(getUsers)
  const [form, setForm] = useState({ email: '', password: '', role: 'editor' as Role })
  const [busy, setBusy] = useState(false)
  if (role !== 'admin') return <AdminErrorState message="Only administrators can manage CMS users." />

  async function add() {
    setBusy(true)
    try { await createUser(form); toast.success('User created.'); setForm({ email: '', password: '', role: 'editor' }); await reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to create the user.') } finally { setBusy(false) }
  }
  async function patch(u: CmsUser, change: Parameters<typeof updateUser>[1], ok: string) {
    try { await updateUser(u.id!, change); toast.success(ok); await reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to update the user.') }
  }
  async function resetPassword(u: CmsUser) {
    const password = window.prompt(`New password for ${u.email} (min 10 characters, with a letter and a number):`)
    if (password) await patch(u, { password }, 'Password updated.')
  }
  async function remove(u: CmsUser) {
    if (!window.confirm(`Delete ${u.email}? They will no longer be able to sign in.`)) return
    try { await deleteUser(u.id!); toast.success('User deleted.'); await reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to delete the user.') }
  }

  return <>
    <Card><CardHeader><CardTitle>Create user</CardTitle><CardDescription>Passwords are stored as salted scrypt hashes and are never shown again.</CardDescription></CardHeader><CardContent>
      <div className="cms-form-grid">
        <label className="cms-field"><span>Email</span><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" /></label>
        <label className="cms-field"><span>Temporary password</span><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" /></label>
        <label className="cms-field"><span>Role</span><select className="ui-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>{(Object.keys(ROLE_HELP) as Role[]).map((r) => <option key={r} value={r}>{r} — {ROLE_HELP[r]}</option>)}</select></label>
      </div>
      <div className="cms-form-footer"><Button onClick={() => void add()} disabled={busy || !form.email || !form.password}><UserPlus size={15} /> {busy ? 'Creating…' : 'Create user'}</Button></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>CMS users</CardTitle><CardDescription>Users from the server environment are read-only here.</CardDescription></CardHeader><CardContent>
      {loading && !data ? <PageLoading rows={2} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : (
        <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Source</th><th>Last sign-in</th><th /></tr></thead><tbody>
          {data?.map((u) => <tr key={`${u.source}:${u.email}`}><td><strong>{u.email}</strong></td>
            <td>{u.source === 'database' ? <select className="ui-select dashboard-status" value={u.role} onChange={(e) => void patch(u, { role: e.target.value as Role }, 'Role updated.')}>{(Object.keys(ROLE_HELP) as Role[]).map((r) => <option key={r}>{r}</option>)}</select> : <Badge variant="outline">{u.role}</Badge>}</td>
            <td>{u.source === 'database' ? <Button variant="outline" size="sm" onClick={() => void patch(u, { status: u.status === 'active' ? 'disabled' : 'active' }, u.status === 'active' ? 'User disabled.' : 'User enabled.')}>{u.status === 'active' ? 'Active — disable' : 'Disabled — enable'}</Button> : <Badge>active</Badge>}</td>
            <td>{u.source}</td><td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-BD') : '—'}</td>
            <td>{u.source === 'database' && <span className="cms-form-actions"><Button variant="outline" size="sm" onClick={() => void resetPassword(u)} title="Reset password"><KeyRound size={13} /></Button><Button variant="outline" size="sm" onClick={() => void remove(u)} title="Delete user"><Trash2 size={13} /></Button></span>}</td></tr>)}
        </tbody></table></div>)}
    </CardContent></Card>
  </>
}

function DatabaseView({ role }: { role: Role }) {
  const { data, loading, error, reload } = useAdminFetch<DatabaseInfo>(getDatabaseInfo)
  if (role !== 'admin') return <AdminErrorState message="Only administrators can view database information." />
  if (loading && !data) return <PageLoading rows={3} />
  if (error || !data) return <AdminErrorState message={error || 'No data.'} onRetry={() => void reload()} />
  return <>
    <Card><CardHeader><CardTitle>Database information</CardTitle><CardDescription>{data.connected ? 'Connected. Record counts per table:' : 'DATABASE_URL is not configured — counts are unavailable.'}</CardDescription></CardHeader><CardContent>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Table</th><th>Description</th><th>Records</th></tr></thead><tbody>{data.tables.map((t) => <tr key={t.name}><td><strong>{t.name}</strong></td><td>{t.label}</td><td>{t.count === null ? '—' : t.count.toLocaleString()}</td></tr>)}</tbody></table></div>
    </CardContent></Card>
    <DatabaseTransfer />
    <Card><CardHeader><CardTitle>Active APIs</CardTitle><CardDescription>{data.apis.length} endpoints are deployed. “CMS session” endpoints require a signed-in admin.</CardDescription></CardHeader><CardContent>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Purpose</th></tr></thead><tbody>{data.apis.map((a) => <tr key={`${a.method}${a.path}`}><td><Badge variant="outline">{a.method}</Badge></td><td><code>{a.path}</code></td><td>{a.access}</td><td>{a.description}</td></tr>)}</tbody></table></div>
    </CardContent></Card>
  </>
}

function DatabaseTransfer() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rawJson, setRawJson] = useState('')
  const [preview, setPreview] = useState<Record<string, number> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function exportJson() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/database/export', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'Unable to export database data.') }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `srizony-cms-site-data-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url)
      toast.success('CMS site data exported as JSON.')
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Export failed.'; setError(message); toast.error(message) }
    finally { setBusy(false) }
  }

  async function selectFile(file?: File) {
    setError(''); setPreview(null); setRawJson(''); setFileName('')
    if (!file) return
    if (file.size > 20 * 1024 * 1024) return setError('Choose a JSON file smaller than 20 MB.')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (parsed?.format !== 'srizony-cms-site-data' || parsed?.version !== 1 || !parsed?.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('This is not a supported Srizony CMS export file.')
      const counts: Record<string, number> = {}
      for (const [table, rows] of Object.entries(parsed.data)) {
        if (!Array.isArray(rows) || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error(`Invalid record list for ${table}.`)
        counts[table] = rows.length
      }
      if (!Object.keys(counts).length) throw new Error('The JSON file does not contain any CMS site data.')
      setFileName(file.name); setRawJson(text); setPreview(counts)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to read this JSON file.') }
  }

  async function importJson() {
    if (!rawJson || !preview) return
    const total = Object.values(preview).reduce((sum, count) => sum + count, 0)
    if (!window.confirm(`Import ${total.toLocaleString()} records across ${Object.keys(preview).length} tables? Existing matching records will be updated; supported new records can receive generated IDs. Export a fresh backup before importing large changes; imports do not delete rows omitted from the file. Records missing from the file will not be deleted.`)) return
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/admin/database/import', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: rawJson })
      const result = await response.json().catch(() => ({})) as { error?: string; imported?: Record<string, number | string | null | undefined> }
      if (!response.ok) throw new Error(result.error || 'Import failed.')
      const importedTotal = Object.values(result.imported ?? {}).reduce<number>((sum, count) => sum + Number(count ?? 0), 0)
      toast.success(`Imported ${importedTotal.toLocaleString()} records.`)
      setPreview(null); setRawJson(''); setFileName(''); if (fileRef.current) fileRef.current.value = ''
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Import failed.'; setError(message); toast.error(message) }
    finally { setBusy(false) }
  }

  return <Card><CardHeader><CardTitle>CMS site-data transfer</CardTitle><CardDescription>Export all editable public website and CMS content records—including page documents, section collections, navigation, media metadata, Website Essentials and CMS JSON documents—into a structured JSON file, edit them in bulk, then upload the revised file. The importer validates the structure and database columns before writing. Existing primary keys are updated, new rows may receive database-generated IDs, and records absent from the file are not deleted. Authentication, private form submissions, user passwords, visitor logs, job applications, transaction records and non-CMS operational settings are intentionally excluded. Uploaded media files remain in media storage; the JSON includes their database metadata and URLs.</CardDescription></CardHeader><CardContent>
    <div className="admin-editor-toolbar"><Button onClick={() => void exportJson()} disabled={busy}><FileJson size={15} /> {busy ? 'Working…' : 'Export CMS data (.json)'}</Button><Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} /> Select updated JSON</Button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(event) => void selectFile(event.target.files?.[0])} /></div>
    {fileName && preview && <div className="cms-json-import-preview"><strong>Import preview: {fileName}</strong><p className="admin-small-note">{Object.values(preview).reduce((sum, count) => sum + count, 0).toLocaleString()} records in {Object.keys(preview).length} tables. The import will update matching primary keys and will not delete records.</p><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Table</th><th>Records in file</th></tr></thead><tbody>{Object.entries(preview).map(([table, count]) => <tr key={table}><td><code>{table}</code></td><td>{count.toLocaleString()}</td></tr>)}</tbody></table></div><div className="cms-form-footer"><Button variant="outline" onClick={() => { setPreview(null); setRawJson(''); setFileName(''); if (fileRef.current) fileRef.current.value = '' }} disabled={busy}>Cancel</Button><Button onClick={() => void importJson()} disabled={busy}>{busy ? 'Importing…' : 'Apply JSON changes'}</Button></div></div>}
    {error && <div className="cms-save-error" role="alert">{error}</div>}
  </CardContent></Card>
}

function cellText(v: unknown) { return v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v) }

function ReportingView() {
  const [table, setTable] = useState<ReportKey>('visitors')
  const { data, loading, error, reload } = useAdminFetch<ReportRow[]>(() => getReportRows(table), [table])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  useEffect(() => { setSelected(new Set()); setSearch('') }, [table])

  const columns = useMemo(() => { const keys: string[] = []; for (const r of (data ?? []).slice(0, 200)) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k); return keys }, [data])
  const visible = useMemo(() => (data ?? []).map((row, index) => ({ row, index })).filter(({ row }) => !search.trim() || Object.values(row).some((v) => cellText(v).toLowerCase().includes(search.trim().toLowerCase()))), [data, search])
  const allVisibleSelected = visible.length > 0 && visible.every(({ index }) => selected.has(index))
  const toggleAll = () => setSelected((cur) => { const next = new Set(cur); if (allVisibleSelected) visible.forEach(({ index }) => next.delete(index)); else visible.forEach(({ index }) => next.add(index)); return next })
  const toggle = (i: number) => setSelected((cur) => { const next = new Set(cur); if (next.has(i)) next.delete(i); else next.add(i); return next })
  const stamp = new Date().toISOString().slice(0, 10)
  const exportRows = (rows: ReportRow[], suffix: string) => { if (!rows.length) return toast.error('There is no data to export.'); downloadCsv(`${table}-${suffix}-${stamp}`, toCsv(rows, columns)); toast.success(`Exported ${rows.length} row(s).`) }

  return <Card><CardHeader><CardTitle>Export tables to CSV</CardTitle><CardDescription>Tick rows to export only those, or download the full table.</CardDescription></CardHeader><CardContent>
    <div className="admin-editor-toolbar">
      <select className="ui-select" value={table} onChange={(e) => setTable(e.target.value as ReportKey)} aria-label="Table">{(Object.keys(REPORTS) as ReportKey[]).map((k) => <option key={k} value={k}>{REPORTS[k].title}</option>)}</select>
      <input className="ui-input admin-search-field" placeholder="Filter rows…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <Button variant="outline" onClick={() => exportRows([...selected].sort((a, b) => a - b).map((i) => data![i]), 'selected')} disabled={!selected.size}><Download size={14} /> Download selected ({selected.size})</Button>
      <Button onClick={() => exportRows(data ?? [], 'all')} disabled={!data?.length}><Download size={14} /> Download all ({data?.length ?? 0})</Button>
    </div>
    {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : (
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all rows" /></th>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>
        {visible.map(({ row, index }) => <tr key={index} className={selected.has(index) ? 'row-selected' : ''}><td><input type="checkbox" checked={selected.has(index)} onChange={() => toggle(index)} aria-label={`Select row ${index + 1}`} /></td>{columns.map((c) => <td key={c} title={cellText(row[c])}>{cellText(row[c]) || '—'}</td>)}</tr>)}
        {!visible.length && <tr><td colSpan={columns.length + 1} className="admin-empty-cell">No rows.</td></tr>}
      </tbody></table></div>)}
  </CardContent></Card>
}
