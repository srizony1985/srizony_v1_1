'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Database, Download, FileSpreadsheet, KeyRound, Palette, Save, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { REPORTS, getReportRows, type ReportKey, type ReportRow } from '@/lib/api/reports'
import { createUser, deleteUser, getDatabaseInfo, getThemes, getUsers, saveTheme, updateUser, type CmsUser, type DatabaseInfo, type Role, type Theme } from '@/lib/api/settings'
import { downloadCsv, toCsv } from '@/lib/csv'
import { AdminErrorState, PageLoading, useAdminFetch } from '../_components/AdminCommon'

const VIEWS = {
  users: { title: 'CMS Users', description: 'Create and manage the people who can sign in to this CMS.', icon: Users },
  theme: { title: 'Site Theme', description: 'Edit a theme palette. Saved values are shared with the public website.', icon: Palette },
  database: { title: 'Database & APIs', description: 'Table inventory and the API endpoints currently active.', icon: Database },
  reporting: { title: 'Reporting', description: 'Download table data as CSV — the whole table or only the rows you select.', icon: FileSpreadsheet },
} as const
type ViewKey = keyof typeof VIEWS
const ROLE_HELP: Record<Role, string> = { admin: 'Full access, users, theme and database.', editor: 'Create and edit content, navigation and jobs.', analyst: 'Read-only dashboards and reports.' }

export default function SettingsClient({ role }: { role: Role }) {
  const params = useSearchParams()
  const requested = params.get('view') || 'users'
  const view: ViewKey = requested in VIEWS ? (requested as ViewKey) : requested === 'appearance' ? 'theme' : 'users'
  const meta = VIEWS[view]
  return (
    <div className="admin-settings-page">
      <section className="admin-toolbar-panel"><div className="admin-toolbar-primary"><div className="admin-toolbar-copy"><h1>{meta.title}</h1><p>{meta.description}</p></div><Badge>{role}</Badge></div></section>
      {view === 'users' && <UsersView role={role} />}
      {view === 'theme' && <ThemeView role={role} />}
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

function ThemeView({ role }: { role: Role }) {
  const { data: themes, loading, error, reload } = useAdminFetch<Record<string, Theme>>(getThemes)
  const [name, setName] = useState('')
  const [palette, setPalette] = useState<Theme>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (themes) { const key = name in themes ? name : Object.keys(themes)[0] || ''; setName(key); setPalette(themes[key] || {}) } }, [themes, name])
  const entries = useMemo<Array<[string, string]>>(() => Object.entries(palette).filter((entry): entry is [string, string] => { const [key, value] = entry; return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) && !key.toLowerCase().includes('logo') }), [palette])
  async function save() {
    if (role !== 'admin') return toast.error('Administrator permission required.')
    // Do not submit nested label/typography metadata to the color editor API.
    // The server merges these color changes into the existing palette so theme
    // labels, font settings and corner-radius settings remain untouched.
    const colorTokens = Object.fromEntries(entries) as Theme
    if (!Object.keys(colorTokens).length) return toast.error('There are no editable color tokens to save.')
    setSaving(true)
    try { await saveTheme(name, colorTokens); toast.success('Theme palette saved.'); window.location.reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save theme.') } finally { setSaving(false) }
  }
  if (loading && !themes) return <PageLoading rows={2} />
  if (error) return <AdminErrorState message={error} onRetry={() => void reload()} />
  return <Card><CardHeader><CardTitle>Theme palette</CardTitle><CardDescription>Edit the color tokens below. Theme labels, typography and other settings are preserved automatically. Only administrators can save.</CardDescription></CardHeader><CardContent>
    <div className="admin-editor-toolbar"><select className="ui-select" value={name} onChange={(e) => { setName(e.target.value); setPalette(themes?.[e.target.value] || {}) }} aria-label="Theme palette">{Object.keys(themes || {}).map((n) => <option key={n} value={n}>{n}</option>)}</select><Button onClick={() => void save()} disabled={saving || role !== 'admin' || !name || !entries.length}><Save size={14} />{saving ? 'Saving…' : 'Save palette'}</Button></div>
    <div className="palette-grid">{entries.map(([key, value]) => <label className="palette-field" key={key}><span>{key}</span><Input type="color" value={value} onChange={(e) => setPalette((c) => ({ ...c, [key]: e.target.value }))} /><code>{value}</code></label>)}</div>
  </CardContent></Card>
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
    <Card><CardHeader><CardTitle>Active APIs</CardTitle><CardDescription>{data.apis.length} endpoints are deployed. “CMS session” endpoints require a signed-in admin.</CardDescription></CardHeader><CardContent>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Method</th><th>Path</th><th>Access</th><th>Purpose</th></tr></thead><tbody>{data.apis.map((a) => <tr key={`${a.method}${a.path}`}><td><Badge variant="outline">{a.method}</Badge></td><td><code>{a.path}</code></td><td>{a.access}</td><td>{a.description}</td></tr>)}</tbody></table></div>
    </CardContent></Card>
  </>
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
