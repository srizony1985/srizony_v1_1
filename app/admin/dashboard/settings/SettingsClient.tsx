'use client'

import './settings.css'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import {
  Activity, Download, Eye, EyeOff, FileJson,
  FileSpreadsheet, KeyRound, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck,
  Trash2, Upload, UserPlus, Users, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { databaseExportRequest, databaseImportRequest } from '@/lib/api/adminResources'
import { REPORTS, getReportRows, type ReportKey, type ReportRow } from '@/lib/api/reports'
import { createUser, deleteUser, getDatabaseInfo, getUsers, updateUser, type CmsUser, type DatabaseInfo, type Role } from '@/lib/api/settings'
import { downloadCsv, toCsv } from '@/lib/csv'
import { AdminErrorState, PageLoading, useAdminFetch } from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'

const VIEWS = {
  users: { title: 'CMS Users', description: 'Manage who can access the CMS and what they are allowed to do.' },
  database: { title: 'Database & APIs', description: 'Table inventory and the API endpoints currently active.' },
  reporting: { title: 'Reporting', description: 'Review available records and export the full dataset or selected rows.' },
} as const

type ViewKey = keyof typeof VIEWS
type UserStatusFilter = 'all' | 'active' | 'disabled'
type RoleFilter = 'all' | Role

type ScrollTargetResolver = () => HTMLElement | null

/*
 * A shared modal scroll lock avoids two common causes of a stuck page:
 * 1. restoring body overflow while the document root is still locked; and
 * 2. one dialog releasing a lock that is still owned by another dialog.
 *
 * Background wheel/touch scrolling is prevented, while scrolling inside an
 * active dialog remains available. Original inline styles are restored exactly.
 */
const activeScrollTargets = new Set<ScrollTargetResolver>()
let restoreDocumentScroll: (() => void) | null = null

function acquireModalScrollLock(resolveDialog: ScrollTargetResolver) {
  if (typeof document === 'undefined') return () => undefined

  activeScrollTargets.add(resolveDialog)

  if (!restoreDocumentScroll) {
    const root = document.documentElement
    const body = document.body
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)

    const preventBackgroundScroll = (event: Event) => {
      const target = event.target
      if (target instanceof Node) {
        for (const getDialog of activeScrollTargets) {
          const dialog = getDialog()
          if (dialog?.contains(target)) return
        }
      }
      event.preventDefault()
    }

    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    document.addEventListener('wheel', preventBackgroundScroll, { passive: false })
    document.addEventListener('touchmove', preventBackgroundScroll, { passive: false })

    restoreDocumentScroll = () => {
      document.removeEventListener('wheel', preventBackgroundScroll)
      document.removeEventListener('touchmove', preventBackgroundScroll)
      root.style.overflow = previousRootOverflow
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
    }
  }

  let released = false
  return () => {
    if (released) return
    released = true
    activeScrollTargets.delete(resolveDialog)

    if (activeScrollTargets.size === 0) {
      restoreDocumentScroll?.()
      restoreDocumentScroll = null
    }
  }
}

const EMPTY_USER_FORM = { email: '', password: '', role: 'editor' as Role }
const ROLE_HELP: Record<Role, { title: string; description: string }> = {
  admin: { title: 'Administrator', description: 'Full CMS access, including user management and administrative settings.' },
  editor: { title: 'Editor', description: 'Create and update website content, navigation, pages and job posts.' },
  analyst: { title: 'Analyst', description: 'View dashboards and reports without changing website content.' },
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function isValidPassword(value: string) {
  return value.length >= 10 && /[A-Za-z]/.test(value) && /\d/.test(value)
}

function formatDate(value?: string | null) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-BD', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function SettingsClient({ role }: { role: Role }) {
  const params = useSearchParams()
  const requested = params.get('view') || 'users'
  const view: ViewKey = Object.prototype.hasOwnProperty.call(VIEWS, requested) ? requested as ViewKey : 'users'
  const meta = VIEWS[view]

  return (
    <div className="admin-settings-page">
      <section className="admin-toolbar-panel settings-heading">
        <div className="admin-toolbar-primary">
          <div className="admin-toolbar-copy">
            <h1>{meta.title}</h1>
            <p>{meta.description}</p>
          </div>
          <Badge>{ROLE_HELP[role].title}</Badge>
        </div>
      </section>

      {view === 'users' && <UsersView role={role} />}
      {view === 'database' && <DatabaseView role={role} />}
      {view === 'reporting' && <ReportingView />}
    </div>
  )
}

function UsersView({ role }: { role: Role }) {
  const { data, loading, error, reload } = useAdminFetch<CmsUser[]>(getUsers)
  const [form, setForm] = useState(EMPTY_USER_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [resetTarget, setResetTarget] = useState<CmsUser | null>(null)
  const closeReset = useCallback(() => setResetTarget(null), [])
  const baselineRef = useRef(JSON.stringify(EMPTY_USER_FORM))

  async function add(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (!isValidEmail(email)) {
      setFormError('Enter a valid email address.')
      toast.error('Enter a valid email address.')
      return
    }
    if (!isValidPassword(form.password)) {
      setFormError('Use at least 10 characters, including one letter and one number.')
      toast.error('Please meet the temporary password requirements.')
      return
    }

    setBusy(true)
    setFormError('')
    try {
      await createUser({ email, password: form.password, role: form.role })
      toast.success(`${email} can now sign in to the CMS.`)
      setForm(EMPTY_USER_FORM)
      baselineRef.current = JSON.stringify(EMPTY_USER_FORM)
      setShowPassword(false)
      await reload()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to create the user.'
      setFormError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  async function patch(user: CmsUser, change: Parameters<typeof updateUser>[1], successMessage: string): Promise<boolean> {
    if (user.source !== 'database' || !user.id) return false
    try {
      await updateUser(user.id, change)
      toast.success(successMessage)
      await reload()
      return true
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to update the user.')
      return false
    }
  }

  async function remove(user: CmsUser) {
    if (user.source !== 'database' || !user.id) return
    const confirmed = window.confirm(`Delete ${user.email}? They will immediately lose CMS access. This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteUser(user.id)
      toast.success('CMS user deleted.')
      await reload()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to delete the user.')
    }
  }

  const users = data ?? []
  const counts = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.status === 'active').length,
    disabled: users.filter((user) => user.status === 'disabled').length,
    environment: users.filter((user) => user.source === 'environment').length,
  }), [users])

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesQuery = !term || [user.email, user.role, user.source, user.status].some((value) => String(value).toLowerCase().includes(term))
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      return matchesQuery && matchesStatus && matchesRole
    })
  }, [users, query, statusFilter, roleFilter])

  const dirty = baselineRef.current !== JSON.stringify(form)
  useRegisterAdminActions('cms-user-create-form', {
    save: () => add(),
    reload: async () => {
      setForm(EMPTY_USER_FORM)
      baselineRef.current = JSON.stringify(EMPTY_USER_FORM)
      setFormError('')
      setShowPassword(false)
      await reload()
    },
    dirty,
    saving: busy,
    label: 'Create CMS user',
  })

  if (role !== 'admin') {
    return <AdminErrorState message="Only administrators can manage CMS users. Ask an administrator to update user access." />
  }

  return (
    <div className="settings-users-view">
      <section className="settings-metrics" aria-label="CMS user summary">
        <MetricCard icon={Users} label="Total users" value={loading && !data || error ? '—' : counts.total} />
        <MetricCard icon={ShieldCheck} label="Active" value={loading && !data || error ? '—' : counts.active} tone="success" />
        <MetricCard icon={LockKeyhole} label="Disabled" value={loading && !data || error ? '—' : counts.disabled} tone="muted" />
        <MetricCard icon={Activity} label="Environment users" value={loading && !data || error ? '—' : counts.environment} tone="muted" />
      </section>

      <Card className="settings-panel settings-create-user">
        <CardHeader className="settings-panel-header">
          <div className="settings-panel-title-wrap">
            <span className="settings-panel-icon"><UserPlus size={17} /></span>
            <div>
              <CardTitle>Add a CMS user</CardTitle>
              <CardDescription>Create a separate sign-in and assign the minimum role needed.</CardDescription>
            </div>
          </div>
          <Badge variant="outline">Administrator only</Badge>
        </CardHeader>
        <CardContent>
          <form className="settings-user-form" onSubmit={(event) => void add(event)} noValidate>
            <label className="cms-field">
              <span>Email address</span>
              <Input type="email" value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setFormError('') }} placeholder="name@example.org" autoComplete="off" inputMode="email" required aria-invalid={Boolean(formError && !isValidEmail(form.email))} />
              <small>Use the email address the person will use to sign in.</small>
            </label>
            <div className="cms-field settings-password-field">
              <label htmlFor="settings-new-user-password">Temporary password</label>
              <div className="settings-password-input">
                <Input id="settings-new-user-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => { setForm((current) => ({ ...current, password: event.target.value })); setFormError('') }} placeholder="At least 10 characters" autoComplete="new-password" required aria-invalid={Boolean(formError && !isValidPassword(form.password))} />
                <button type="button" className="settings-password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <small>At least 10 characters with one letter and one number.</small>
            </div>
            <label className="cms-field">
              <span>Access role</span>
              <select className="ui-select" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}>
                {(Object.keys(ROLE_HELP) as Role[]).map((key) => <option key={key} value={key}>{ROLE_HELP[key].title}</option>)}
              </select>
              <small>{ROLE_HELP[form.role].description}</small>
            </label>
            <div className="settings-form-submit">
              <Button type="submit" disabled={busy || !form.email.trim() || !form.password}>
                <Plus size={15} /> {busy ? 'Creating user…' : 'Create user'}
              </Button>
            </div>
            {formError && <p className="settings-inline-error" role="alert">{formError}</p>}
          </form>
          <p className="settings-security-note"><LockKeyhole size={13} /> Passwords are stored as salted scrypt hashes and cannot be viewed after creation.</p>
        </CardContent>
      </Card>

      <Card className="settings-panel settings-user-list">
        <CardHeader className="settings-panel-header settings-user-list-header">
          <div className="settings-panel-title-wrap">
            <span className="settings-panel-icon"><Users size={17} /></span>
            <div>
              <CardTitle>People with CMS access</CardTitle>
              <CardDescription>{filteredUsers.length} of {users.length} users shown. Environment users are managed by deployment settings.</CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'settings-spin' : ''} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="settings-user-filters">
            <label className="settings-search" aria-label="Search CMS users">
              <Search size={15} aria-hidden="true" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search email, role or source…" aria-label="Search CMS users" />
            </label>
            <label className="settings-filter-label"><span>Status</span><select className="ui-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}><option value="all">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
            <label className="settings-filter-label"><span>Role</span><select className="ui-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}><option value="all">All roles</option><option value="admin">Administrator</option><option value="editor">Editor</option><option value="analyst">Analyst</option></select></label>
            {(query || statusFilter !== 'all' || roleFilter !== 'all') && <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setStatusFilter('all'); setRoleFilter('all') }}>Clear filters</Button>}
          </div>

          {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : filteredUsers.length ? (
            <div className="settings-table-scroll admin-table-scroll">
              <table className="admin-table settings-users-table">
                <thead><tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Access</th><th scope="col">Source</th><th scope="col">Last sign-in</th><th scope="col" className="settings-actions-heading">Actions</th></tr></thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const managed = user.source === 'database' && Boolean(user.id)
                    return (
                      <tr key={`${user.source}:${user.email}`}>
                        <td><strong className="settings-user-email">{user.email}</strong><small>{user.createdAt ? `Added ${formatDate(user.createdAt)}` : 'CMS account'}</small></td>
                        <td>{managed ? <select className="ui-select settings-role-select" value={user.role} onChange={(event) => void patch(user, { role: event.target.value as Role }, 'User role updated.')} aria-label={`Change role for ${user.email}`}>{(Object.keys(ROLE_HELP) as Role[]).map((key) => <option key={key} value={key}>{ROLE_HELP[key].title}</option>)}</select> : <Badge variant="outline">{ROLE_HELP[user.role].title}</Badge>}</td>
                        <td><Badge className={`settings-status-badge ${user.status === 'active' ? 'is-active' : 'is-disabled'}`} variant="outline">{user.status === 'active' ? 'Active' : 'Disabled'}</Badge></td>
                        <td><span className="settings-source-label">{user.source === 'environment' ? 'Environment' : 'CMS database'}</span>{user.source === 'environment' && <small>Read-only</small>}</td>
                        <td>{formatDate(user.lastLoginAt)}</td>
                        <td>
                          {managed ? <div className="settings-user-actions">
                            <Button variant="outline" size="sm" onClick={() => setResetTarget(user)} title={`Reset password for ${user.email}`} aria-label={`Reset password for ${user.email}`}><KeyRound size={14} /><span>Reset password</span></Button>
                            <Button variant="outline" size="sm" onClick={() => void patch(user, { status: user.status === 'active' ? 'disabled' : 'active' }, user.status === 'active' ? 'User disabled.' : 'User enabled.')} title={user.status === 'active' ? 'Disable account' : 'Enable account'}><span>{user.status === 'active' ? 'Disable' : 'Enable'}</span></Button>
                            <Button variant="outline" size="sm" className="settings-delete-user" onClick={() => void remove(user)} title={`Delete ${user.email}`} aria-label={`Delete ${user.email}`}><Trash2 size={14} /><span>Delete</span></Button>
                          </div> : <span className="settings-readonly-label">No direct actions</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="settings-empty-state"><Users size={23} /><strong>{users.length ? 'No users match these filters' : 'No CMS users found'}</strong><p>{users.length ? 'Try another search term or clear the filters.' : 'Create the first CMS user using the form above.'}</p>{users.length > 0 && <Button variant="outline" size="sm" onClick={() => { setQuery(''); setStatusFilter('all'); setRoleFilter('all') }}>Clear filters</Button>}</div>}
        </CardContent>
      </Card>

      {resetTarget && <PasswordResetDialog user={resetTarget} onClose={closeReset} onSave={async (password) => {
        const updated = await patch(resetTarget, { password }, 'Password updated successfully.')
        if (updated) closeReset()
        return updated
      }} />}
    </div>
  )
}

function PasswordResetDialog({ user, onClose, onSave }: { user: CmsUser; onClose: () => void; onSave: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const savingRef = useRef(saving)
  savingRef.current = saving

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const releaseScrollLock = acquireModalScrollLock(() => dialogRef.current)
    inputRef.current?.focus()

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !savingRef.current) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      releaseScrollLock()
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidPassword(password)) {
      setError('Use at least 10 characters, including one letter and one number.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const updated = await onSave(password)
      if (!updated) setError('Password was not updated. Please review the error notification and try again.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset the password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="settings-dialog-backdrop"
      role="presentation"
      style={{ overscrollBehavior: 'contain' }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}
    >
      <section
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-reset-title"
        tabIndex={-1}
        style={{
          maxHeight: 'min(88dvh, 760px)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <header className="settings-dialog-header">
          <div><span className="settings-panel-icon"><KeyRound size={17} /></span><div><h3 id="settings-reset-title">Reset password</h3><p>Set a new temporary password for {user.email}.</p></div></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close password reset"><X size={18} /></button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <div className="cms-field">
            <label htmlFor="settings-reset-password">New temporary password</label>
            <div className="settings-password-input">
              <Input id="settings-reset-password" ref={inputRef} type={visible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="At least 10 characters" autoComplete="new-password" />
              <button type="button" className="settings-password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <small>At least 10 characters with one letter and one number.</small>
          </div>
          {error && <p className="settings-inline-error" role="alert">{error}</p>}
          <div className="settings-dialog-actions"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || !password}>{saving ? 'Updating…' : 'Update password'}</Button></div>
        </form>
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone = 'default' }: { icon: LucideIcon; label: string; value: number | string; tone?: 'default' | 'success' | 'muted' }) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value
  return <div className={`settings-metric-card tone-${tone}`}><span className="settings-metric-icon"><Icon size={17} /></span><div><strong>{displayValue}</strong><span>{label}</span></div></div>
}

function DatabaseView({ role }: { role: Role }) {
  const { data, loading, error, reload } = useAdminFetch<DatabaseInfo>(getDatabaseInfo)
  if (role !== 'admin') return <AdminErrorState message="Only administrators can view database information." />
  if (loading && !data) return <PageLoading rows={3} />
  if (error || !data) return <AdminErrorState message={error || 'No data.'} onRetry={() => void reload()} />
  return <>
    <DatabaseTransfer />
    <Card><CardHeader><CardTitle>Database information</CardTitle><CardDescription>{data.connected ? 'Connected. Record counts per table:' : 'DATABASE_URL is not configured — counts are unavailable.'}</CardDescription></CardHeader><CardContent>
      <div className="settings-database-table-wrap">
        <table className="admin-table settings-database-table" aria-label="Database table inventory">
          <thead><tr><th scope="col">Table</th><th scope="col">Description</th><th scope="col">Records</th></tr></thead>
          <tbody>{data.tables.map((t) => <tr key={t.name}><td><strong>{t.name}</strong></td><td>{t.label}</td><td>{t.count === null ? '—' : t.count.toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Active APIs</CardTitle><CardDescription>{data.apis.length} endpoints are deployed. “CMS session” endpoints require a signed-in admin.</CardDescription></CardHeader><CardContent>
      <div className="settings-database-table-wrap">
        <table className="admin-table settings-database-table" aria-label="Active API endpoints">
          <thead><tr><th scope="col">Method</th><th scope="col">Path</th><th scope="col">Access</th><th scope="col">Purpose</th></tr></thead>
          <tbody>{data.apis.map((a) => <tr key={`${a.method}${a.path}`}><td><Badge variant="outline">{a.method}</Badge></td><td><code className="settings-api-path">{a.path}</code></td><td>{a.access}</td><td>{a.description}</td></tr>)}</tbody>
        </table>
      </div>
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
      const response = await databaseExportRequest()
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
      const response = await databaseImportRequest(rawJson)
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

function cellText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return '[Unserializable value]' }
  }
  return String(value)
}

function ReportingView() {
  const [table, setTable] = useState<ReportKey>('visitors')
  const [data, setData] = useState<ReportRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const selectAllRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    try {
      const rows = await getReportRows(table)
      if (requestId === requestIdRef.current) setData(rows)
    } catch (cause) {
      if (requestId === requestIdRef.current) setError(cause instanceof Error ? cause.message : 'Unable to load this report.')
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [table])

  useEffect(() => {
    setSelected(new Set())
    setSearch('')
    setData(null)
    void reload()
    return () => { requestIdRef.current += 1 }
  }, [reload])

  const columns = useMemo(() => {
    const keys: string[] = []
    for (const row of (data ?? []).slice(0, 250)) for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key)
    return keys
  }, [data])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data ?? []).map((row, index) => ({ row, index })).filter(({ row }) => !term || Object.values(row).some((value) => cellText(value).toLowerCase().includes(term)))
  }, [data, search])
  const allVisibleSelected = visible.length > 0 && visible.every(({ index }) => selected.has(index))
  const someVisibleSelected = visible.some(({ index }) => selected.has(index))

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current)
      if (allVisibleSelected) visible.forEach(({ index }) => next.delete(index))
      else visible.forEach(({ index }) => next.add(index))
      return next
    })
  }

  function toggleRow(index: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  function exportRows(rows: ReportRow[], suffix: string) {
    if (!rows.length) return toast.error('There is no data to export.')
    downloadCsv(`${table}-${suffix}-${stamp}`, toCsv(rows, columns))
    toast.success(`Exported ${rows.length.toLocaleString()} row(s).`)
  }

  const selectedRows = [...selected].sort((a, b) => a - b).map((index) => data?.[index]).filter((row): row is ReportRow => Boolean(row))
  const description = REPORTS[table].description

  return (
    <div className="settings-reporting-view">
      <Card className="settings-panel">
        <CardHeader className="settings-panel-header">
          <div className="settings-panel-title-wrap">
            <span className="settings-panel-icon"><FileSpreadsheet size={17} /></span>
            <div><CardTitle>Data exports</CardTitle><CardDescription>{description}</CardDescription></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSelected(new Set()); void reload() }} disabled={loading}><RefreshCw size={14} className={loading ? 'settings-spin' : ''} /> Refresh</Button>
        </CardHeader>
        <CardContent>
          <div className="settings-report-controls">
            <label className="cms-field settings-report-picker"><span>Dataset</span><select className="ui-select" value={table} onChange={(event) => setTable(event.target.value as ReportKey)}>{(Object.keys(REPORTS) as ReportKey[]).map((key) => <option key={key} value={key}>{REPORTS[key].title}</option>)}</select></label>
            <label className="cms-field settings-report-search"><span>Filter records</span><div className="settings-search"><Search size={15} aria-hidden="true" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search any field in this dataset…" /></div></label>
          </div>

          <div className="settings-report-summary" aria-live="polite">
            <div><strong>{loading && !data ? '—' : (data?.length ?? 0).toLocaleString()}</strong><span>Total records</span></div>
            <div><strong>{loading && !data ? '—' : visible.length.toLocaleString()}</strong><span>Matching records</span></div>
            <div><strong>{selected.size.toLocaleString()}</strong><span>Selected for export</span></div>
            <div className="settings-report-actions">
              <Button variant="outline" size="sm" onClick={() => exportRows(selectedRows, 'selected')} disabled={!selectedRows.length || loading}><Download size={14} /> Export selected</Button>
              <Button size="sm" onClick={() => exportRows(data ?? [], 'all')} disabled={!data?.length || loading}><Download size={14} /> Export all</Button>
            </div>
          </div>

          {selected.size > 0 && <div className="settings-selection-note"><span>{selected.size.toLocaleString()} row(s) selected. Selection is retained while filtering this dataset.</span><Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X size={13} /> Clear selection</Button></div>}

          {loading && !data ? <PageLoading rows={4} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : data?.length ? (
            <div className="settings-table-scroll admin-table-scroll">
              <table className="admin-table settings-report-table">
                <thead><tr><th className="settings-checkbox-col"><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all matching rows" disabled={!visible.length} /></th>{columns.map((column) => <th scope="col" key={column}>{column.replace(/_/g, ' ')}</th>)}</tr></thead>
                <tbody>
                  {visible.map(({ row, index }) => <tr key={index} className={selected.has(index) ? 'row-selected' : ''}><td className="settings-checkbox-col"><input type="checkbox" checked={selected.has(index)} onChange={() => toggleRow(index)} aria-label={`Select row ${index + 1}`} /></td>{columns.map((column) => <td key={column} title={cellText(row[column])}>{cellText(row[column]) || '—'}</td>)}</tr>)}
                  {!visible.length && <tr><td colSpan={columns.length + 1} className="admin-empty-cell">No records match this filter.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : <div className="settings-empty-state"><FileSpreadsheet size={23} /><strong>This dataset is empty</strong><p>There are no records available to export.</p></div>}
          <p className="settings-report-footnote">Exports are generated as CSV files. Sensitive fields are included only when the selected report endpoint exposes them to your CMS role.</p>
        </CardContent>
      </Card>
    </div>
  )
}
