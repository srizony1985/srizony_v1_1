'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity, AlertTriangle, Archive, Copy, Eye, EyeOff, FileJson,
  FileSpreadsheet, KeyRound, LockKeyhole, Plus, RefreshCw, RotateCcw, ShieldCheck,
  Trash2, Upload, UserPlus, Users, X, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import type { ExternalValue } from '@/types/json'
import { exportDatabaseJson, importDatabaseJson, type DatabaseImportResult } from '@/lib/api/adminResources'
import { getGoogleDriveBackupStatus, requestGoogleDriveBackup, requestGoogleDriveRestore, type DriveBackupItem, type DriveBackupStatus } from '@/lib/api/adminDatabase'
import { getThemeTypography, saveThemeTypography } from '@/lib/api/adminTheme'
import { REPORTS, getReportRows, type ReportKey, type ReportRow } from '@/lib/api/reports'
import { createUser, deleteUser, getDatabaseInfo, getUsers, updateUser, type CmsUser, type DatabaseInfo, type Role } from '@/lib/api/settings'
import { DEFAULT_THEME_TYPOGRAPHY, DEFAULT_THEME_TYPOGRAPHY_SETTINGS, THEME_FONT_FAMILIES, type ThemeTypographyPreferences, type ThemeTypographyScope, type ThemeTypographyScopedSettings } from '@/lib/themeTypography'
import { AdminErrorState, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'
import { useAdminTheme } from '@/app/admin/AdminThemeShell'
import { ensureThemeContrast } from '@/lib/themeRuntime'
import { AdminDataContainer, AdminTable, AdminTabs, AdminTypographyControls, AdminWorkspaceGrid, type AdminTableColumn, type AdminComponentTypographyKey, AdminToolbar } from '@/components/admin/cms'
import GrowthTreeView from './GrowthTreeView'

/* ------------------------------------------------------------------ */
/* Shared layout + style constants                                     */
/* ------------------------------------------------------------------ */

/** Fixed table viewport so short tables don't sit in a huge empty box. */
const TABLE_HEIGHT = 'min(76dvh, 720px)'
const TABLE_MIN_HEIGHT = '220px'

const FIELD = 'cms-field flex flex-col gap-1 text-[0.875rem] [&>span]:font-semibold [&_b]:text-destructive [&_:is(input,textarea,select):disabled]:cursor-default [&_:is(input,textarea,select):disabled]:opacity-100 [&_:is(input,textarea,select):disabled]:bg-[color-mix(in_srgb,var(--card)_94%,var(--muted-foreground))]'
const PANEL = 'settings-panel min-w-0 overflow-hidden border-border bg-card shadow-none'
const PANEL_HEADER = 'settings-panel-header flex items-start justify-between gap-3 pb-3 max-[520px]:flex-col [&_[data-slot=card-title]]:text-base [&_[data-slot=card-title]]:leading-tight [&_[data-slot=card-title]]:text-primary [&_[data-slot=card-description]]:text-xs [&_[data-slot=card-description]]:leading-snug [&_[data-slot=card-description]]:text-muted-foreground'
const PANEL_TITLE_WRAP = 'settings-panel-title-wrap flex min-w-0 items-start gap-2.5 [&>div]:grid [&>div]:min-w-0 [&>div]:gap-1'
const PANEL_ICON = 'settings-panel-icon grid size-8 flex-none place-items-center rounded-(--radius) bg-muted text-primary'
const ERROR_BOX = 'cms-save-error mt-3 grid gap-1 rounded-(--radius) border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 px-3.5 py-3 text-sm text-destructive [overflow-wrap:anywhere]'
const WARNING_BOX = 'cms-save-warning mt-3 flex items-start gap-2 rounded-(--radius) border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-normal text-primary [&_svg]:mt-px [&_svg]:flex-none [&_svg]:text-warning'
const SUCCESS_BOX = 'cms-save-success mt-3 flex items-center justify-center gap-2 font-bold font-weight-1000 rounded-(--radius) border border-success/30 bg-success/5 p-4 text-sm leading-normal text-success'
const EMPTY_STATE = 'settings-empty-state grid min-h-[150px] content-center justify-items-center gap-2 rounded-(--radius) border border-dashed border-border bg-background p-5 text-center text-muted-foreground [&>svg]:text-primary [&_strong]:text-sm [&_strong]:text-primary [&_p]:m-0 [&_p]:max-w-[360px] [&_p]:text-xs [&_p]:leading-normal'
const SUMMARY_STAT = '[&>div:not(.settings-report-actions)]:grid [&>div:not(.settings-report-actions)]:gap-1 [&>div:not(.settings-report-actions)]:px-1 [&>div:not(.settings-report-actions)>strong]:text-base [&>div:not(.settings-report-actions)>strong]:leading-none [&>div:not(.settings-report-actions)>strong]:tabular-nums [&>div:not(.settings-report-actions)>strong]:text-primary [&>div:not(.settings-report-actions)>span]:text-xs [&>div:not(.settings-report-actions)>span]:font-semibold [&>div:not(.settings-report-actions)>span]:text-muted-foreground'
const SUMMARY_BOX = `settings-report-summary my-3 grid items-center gap-2 rounded-(--radius) border border-border bg-background p-2.5 ${SUMMARY_STAT}`
const CONTROL_GROUP = 'settings-theme-control-group grid min-w-0 content-start gap-2 border border-border bg-background p-2 [&_h3]:m-0 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight [&_h3]:text-primary [&_[data-slot=native-select]]:min-h-[35px] [&_[data-slot=native-select]]:w-full [&_[data-slot=native-select]]:text-sm'
const RANGE = 'settings-theme-range grid min-w-0 gap-1.5 [&>span]:flex [&>span]:items-center [&>span]:justify-between [&>span]:gap-2 [&>span]:text-xs [&>span]:font-semibold [&>span]:text-muted-foreground [&_strong]:text-xs [&_strong]:tabular-nums [&_strong]:text-primary [&_input[type=range]]:w-full [&_input[type=range]]:min-w-0 [&_input[type=range]]:cursor-pointer [&_input[type=range]]:accent-primary [&_input[type=range]:disabled]:cursor-not-allowed [&_input[type=range]:disabled]:opacity-60'
const PW_WRAP = 'settings-password-input relative flex min-w-0 items-center [&_[data-slot=input]]:pr-10'
const PW_TOGGLE = 'settings-password-toggle absolute right-1 top-[3px] grid size-[30px] place-items-center rounded-[calc(var(--radius)-2px)] border-0 bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

const VIEWS = {
  users: { title: 'CMS Users', description: 'Manage who can access the CMS and what they are allowed to do.' },
  database: { title: 'Database & APIs', description: 'Table inventory and the API endpoints currently active.' },
  reporting: { title: 'Reporting', description: 'Review available records and export the full dataset or selected rows.' },
  theme: { title: 'Theme Typography', description: 'Customize the single site theme typography used across the public website and CMS.' },
  growth: { title: 'Homepage Growth Tree', description: 'Manage the 1985–2026 timeline branches displayed on the homepage.' },
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
  const router = useRouter()
  const requested = params.get('view') || 'users'
  useEffect(() => {
    if (requested === 'footer') router.replace('/admin/dashboard/footer')
  }, [requested, router])
  const view: ViewKey = Object.prototype.hasOwnProperty.call(VIEWS, requested) ? requested as ViewKey : 'users'
  const meta = VIEWS[view]

  return (
    <section
      id="settings-view-panel"
      className="admin-settings-tab-panel min-w-0"
      aria-label={`${meta.title} settings`}
      tabIndex={0}
    >
      {view === 'users' && <UsersView role={role} />}
      {view === 'database' && <DatabaseView role={role} />}
      {view === 'reporting' && <ReportingView />}
      {view === 'theme' && <ThemeTypographyView role={role} />}
      {view === 'growth' && <GrowthTreeView role={role} />}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

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
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY_USER_FORM))

  function add(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const email = form.email.trim().toLowerCase()
    if (!isValidEmail(email)) {
      setFormError('Enter a valid email address.')
      toast.error('Enter a valid email address.')
      return Promise.resolve()
    }
    if (!isValidPassword(form.password)) {
      setFormError('Use at least 10 characters, including one letter and one number.')
      toast.error('Please meet the temporary password requirements.')
      return Promise.resolve()
    }

    setBusy(true)
    setFormError('')
    return createUser({ email, password: form.password, role: form.role })
      .then(() => {
        toast.success(`${email} can now sign in to the CMS.`)
        setForm(EMPTY_USER_FORM)
        setBaseline(JSON.stringify(EMPTY_USER_FORM))
        setShowPassword(false)
        return reload()
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to create the user.'
        setFormError(message)
        toast.error(message)
      })
      .finally(() => setBusy(false))
  }

  function patch(user: CmsUser, change: Parameters<typeof updateUser>[1], successMessage: string): Promise<boolean> {
    if (user.source !== 'database' || !user.id) return Promise.resolve(false)
    return updateUser(user.id, change)
      .then(() => {
        toast.success(successMessage)
        return reload()
      })
      .then(() => true)
      .catch((cause: unknown) => {
        toast.error(cause instanceof Error ? cause.message : 'Unable to update the user.')
        return false
      })
  }

  function remove(user: CmsUser) {
    if (user.source !== 'database' || !user.id) return Promise.resolve()
    const confirmed = window.confirm(`Delete ${user.email}? They will immediately lose CMS access. This cannot be undone.`)
    if (!confirmed) return Promise.resolve()
    return deleteUser(user.id)
      .then(() => {
        toast.success('CMS user deleted.')
        return reload()
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to delete the user.'))
  }

  const users = useMemo(() => data ?? [], [data])
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

  const dirty = baseline !== JSON.stringify(form)
  useRegisterAdminActions('cms-user-create-form', {
    save: () => add(),
    reload: () => {
      setForm(EMPTY_USER_FORM)
      setBaseline(JSON.stringify(EMPTY_USER_FORM))
      setFormError('')
      setShowPassword(false)
      return reload()
    },
    dirty,
    saving: busy,
    label: 'Create CMS user',
  })

  if (role !== 'admin') {
    return <AdminErrorState message="Only administrators can manage CMS users. Ask an administrator to update user access." />
  }

  const metricsPending = (loading && !data) || Boolean(error)
  const clearFilters = () => { setQuery(''); setStatusFilter('all'); setRoleFilter('all') }

  return (
    <div className="admin-page-stack">
      <AdminWorkspaceGrid
        layout="split"
        columns="minmax(0, 0.75fr) minmax(0, 1.25fr)"
        ariaLabel="CMS user creation and user directory"
      >
        <AdminDataContainer
          label="CMS Users"
          description={
            <span className={PANEL_TITLE_WRAP}>
              <span className={PANEL_ICON}><UserPlus size={24} /></span>
              <span className="flex flex-col">
                <strong>Add a CMS user</strong>
                <small>Create a separate sign-in and assign the minimum role needed.</small>
              </span>
            </span>
          }
          actions={
            <div className="flex items-end max-[520px]:**:data-[slot=button]:w-full max-[520px]:**:data-[slot=button]:justify-center **:data-[slot=button]:min-h-9 **:data-[slot=button]:whitespace-nowrap">
              <Button type="submit" disabled={busy || !form.email.trim() || !form.password}>
                <Plus size={15} /> {busy ? 'Creating user…' : 'Create user'}
              </Button>
            </div>
          }
          footer={
            <section className="grid items-center grid-cols-2 gap-2 w-full" aria-label="CMS user summary">
              <MetricCard icon={Users} label="Total users" value={metricsPending ? '—' : counts.total} />
              <MetricCard icon={ShieldCheck} label="Active" value={metricsPending ? '—' : counts.active} tone="success" />
              <MetricCard icon={LockKeyhole} label="Disabled" value={metricsPending ? '—' : counts.disabled} tone="muted" />
              <MetricCard icon={Activity} label="Environment users" value={metricsPending ? '—' : counts.environment} tone="muted" />
            </section>
          }
        >
          <Card className={cn(PANEL, 'settings-create-user border-s-2 border-s-primary')}>
            <CardContent>
              <form
                className="settings-user-form grid grid-cols-1 items-end gap-3 [&_.cms-field]:min-w-0 [&_.cms-field>small]:text-sm [&_.cms-field>small]:leading-snug [&_.cms-field>small]:text-muted-foreground **:data-[slot=input]:min-h-9 **:data-[slot=input]:w-full **:data-[slot=native-select]:min-h-9 **:data-[slot=native-select]:w-full"
                onSubmit={(event) => void add(event)}
                noValidate
              >
                <label className={FIELD}>
                  <span>Email address</span>
                  <Input type="email" value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setFormError('') }} placeholder="name@example.org" autoComplete="off" inputMode="email" required aria-invalid={Boolean(formError && !isValidEmail(form.email))} />
                  <small>Use the email address the person will use to sign in.</small>
                </label>
                <div className={cn(FIELD, 'settings-password-field')}>
                  <label htmlFor="new-user-password" className="font-semibold">Temporary password</label>
                  <div className={PW_WRAP}>
                    <Input id="new-user-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => { setForm((current) => ({ ...current, password: event.target.value })); setFormError('') }} placeholder="At least 10 characters" autoComplete="new-password" required aria-invalid={Boolean(formError && !isValidPassword(form.password))} />
                    <Button type="button" variant="ghost" className={PW_TOGGLE} onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  <label htmlFor="confirm-user-password" className="font-semibold">Confirm Temporary password</label>
                  <div className={PW_WRAP}>
                    <Input id="confirm-user-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => { setForm((current) => ({ ...current, password: event.target.value })); setFormError('') }} placeholder="At least 10 characters" autoComplete="new-password" required aria-invalid={Boolean(formError && !isValidPassword(form.password))} />
                    <Button type="button" variant="ghost" className={PW_TOGGLE} onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  <small>At least 10 characters with one letter and one number.</small>
                  {//write validation code for passwords(10 char, match both) and email(checking in DB if same email exists if yes return user exists)
                  }
                </div>
                <label className={FIELD}>
                  <span>Access role</span>
                  <NativeSelect value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as Role }))}>
                    {(Object.keys(ROLE_HELP) as Role[]).map((key) => <option key={key} value={key}>{ROLE_HELP[key].title}</option>)}
                  </NativeSelect>
                  <small>{ROLE_HELP[form.role].description}</small>
                </label>
                {formError && <p className="settings-inline-error col-span-full -mt-0.5 mb-0 text-xs text-destructive" role="alert">{formError}</p>}
              </form>
              <p className="settings-security-note mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground [&_svg]:flex-none"><LockKeyhole size={13} /> Passwords are stored as salted scrypt hashes and cannot be viewed after creation.</p>
            </CardContent>
          </Card>
        </AdminDataContainer>
        
        <AdminDataContainer
          label="User List"
          headerContent={
            <SectionToolbar
              onSearch={(value) => setQuery(value)}
              searchPlaceholder="Search email, role or source…"
              filters={
                <div className="flex gap-2">
                  <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as UserStatusFilter)}>
                    <option value="all">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option>
                  </NativeSelect>
                  <NativeSelect value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}>
                    <option value="all">All roles</option><option value="admin">Administrator</option><option value="editor">Editor</option><option value="analyst">Analyst</option>
                  </NativeSelect>
                </div>
              }
              description={
                <span className={cn(PANEL_HEADER, 'items-center max-[520px]:flex-row max-[520px]:items-center')}>
                  <span className={PANEL_TITLE_WRAP}>
                    <span className={PANEL_ICON}><Users size={24} /></span>
                    <span className="flex flex-col">
                      <strong>People with CMS access</strong>
                      <small>{filteredUsers.length} of {users.length} users shown. Environment users are managed by deployment settings.</small>
                    </span>
                  </span>
                </span>
              }
              actions={
                (query || statusFilter !== 'all' || roleFilter !== 'all') && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
              }
            />
          }

        >
          {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : filteredUsers.length ? (
            <AdminDataContainer
              label="CMS user directory"
              bodyScroll="hidden"
              height="70vh"
              minHeight={TABLE_MIN_HEIGHT}
              instructions="Environment-provided accounts are read-only. Database users can be managed using the row actions."
            >
              <AdminTable
                rows={filteredUsers}
                height={TABLE_HEIGHT}
                columns={[
                  { key: 'email', label: 'User', accessor: (user) => user.email, render: (user) => <><strong className="settings-user-email text-sm text-primary wrap-anywhere">{user.email}</strong><small className="block text-muted-foreground">{user.createdAt ? `Added ${formatDate(user.createdAt)}` : 'CMS account'}</small></> },
                  { key: 'role', label: 'Role', accessor: (user) => ROLE_HELP[user.role].title, render: (user) => user.source === 'database' && Boolean(user.id)
                    ? <NativeSelect className="settings-role-select min-h-7.5 max-w-37.5 ps-2 pe-6 text-xs" value={user.role} onChange={(event) => void patch(user, { role: event.target.value as Role }, 'User role updated.')} aria-label={`Change role for ${user.email}`}>{(Object.keys(ROLE_HELP) as Role[]).map((key) => <option key={key} value={key}>{ROLE_HELP[key].title}</option>)}</NativeSelect>
                    : <Badge variant="outline">{ROLE_HELP[user.role].title}</Badge> },
                  { key: 'status', label: 'Access', accessor: (user) => user.status, render: (user) => <Badge className={cn('settings-status-badge min-h-5.5 px-2 py-0.5 text-xs font-semibold', user.status === 'active' ? 'is-active border-success/35 bg-success-soft text-success' : 'is-disabled border-border bg-muted text-muted-foreground')} variant="outline">{user.status === 'active' ? 'Active' : 'Disabled'}</Badge> },
                  { key: 'source', label: 'Source', accessor: (user) => user.source, render: (user) => <><span className="settings-source-label text-sm text-primary">{user.source === 'environment' ? 'Environment' : 'CMS database'}</span>{user.source === 'environment' && <small className="block text-muted-foreground">Read-only</small>}</> },
                  { key: 'lastLoginAt', label: 'Last sign-in', accessor: (user) => user.lastLoginAt, render: (user) => formatDate(user.lastLoginAt) },
                  { key: 'actions', label: 'Actions', sortable: false, exportable: false, className: 'settings-actions-cell', render: (user) => user.source === 'database' && Boolean(user.id) ? <div className="settings-user-actions flex flex-wrap items-center gap-1.5 **:data-[slot=button]:min-h-7.25 **:data-[slot=button]:gap-1.5 **:data-[slot=button]:whitespace-nowrap **:data-[slot=button]:px-2 **:data-[slot=button]:text-sm">
                    <Button variant="outline" size="sm" onClick={() => setResetTarget(user)} title={`Reset password for ${user.email}`} aria-label={`Reset password for ${user.email}`}><KeyRound size={14} /><span>Reset password</span></Button>
                    <Button variant="outline" size="sm" onClick={() => void patch(user, { status: user.status === 'active' ? 'disabled' : 'active' }, user.status === 'active' ? 'User disabled.' : 'User enabled.')} title={user.status === 'active' ? 'Disable account' : 'Enable account'}><span>{user.status === 'active' ? 'Disable' : 'Enable'}</span></Button>
                    <Button variant="outline" size="sm" className="settings-delete-user text-destructive hover:border-destructive/45 hover:bg-destructive/10" onClick={() => void remove(user)} title={`Delete ${user.email}`} aria-label={`Delete ${user.email}`}><Trash2 size={14} /><span>Delete</span></Button>
                  </div> : <span className="settings-readonly-label text-sm text-muted-foreground">No direct actions</span> },
                ] as AdminTableColumn<CmsUser>[]}
                getRowId={(user) => `${user.source}:${user.email}`}
                caption="CMS users and access controls"
                emptyMessage="No users match these filters."
                exportable={false}
                tableClassName="settings-users-table"
              />
            </AdminDataContainer>
          ) : (
            <div className={EMPTY_STATE}>
              <Users size={23} />
              <strong>{users.length ? 'No users match these filters' : 'No CMS users found'}</strong>
              <p>{users.length ? 'Try another search term or clear the filters.' : 'Create the first CMS user using the form above.'}</p>
              {users.length > 0 && <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>}
            </div>
          )}
        </AdminDataContainer>
      </AdminWorkspaceGrid>

      {resetTarget && <PasswordResetDialog user={resetTarget} onClose={closeReset} onSave={(password) => patch(resetTarget, { password }, 'Password updated successfully.').then((updated) => {
        if (updated) closeReset()
        return updated
      })} />}
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

  useEffect(() => {
    savingRef.current = saving
  }, [saving])

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValidPassword(password)) {
      setError('Use at least 10 characters, including one letter and one number.')
      return
    }
    setSaving(true)
    setError('')
    return onSave(password)
      .then((updated) => {
        if (!updated) setError('Password was not updated. Please review the error notification and try again.')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to reset the password.'))
      .finally(() => setSaving(false))
  }

  return (
    <div
      className="settings-dialog-backdrop fixed inset-0 z-(--sf-z-modal) grid place-items-center overscroll-contain bg-[rgb(10_15_25/58%)] p-4 backdrop-blur-[3px]"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}
    >
      <section
        ref={dialogRef}
        className="settings-dialog max-h-[min(88dvh,760px)] w-[min(440px,100%)] overflow-y-auto overscroll-contain rounded-(--radius) border border-border bg-card p-4 text-primary shadow-lg max-[520px]:p-3.5 [&_.cms-field_small]:text-sm [&_.cms-field_small]:text-muted-foreground **:data-[slot=input]:min-h-9.5 **:data-[slot=input]:w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-reset-title"
        tabIndex={-1}
      >
        <header className="settings-dialog-header mb-4 flex items-start justify-between gap-3 [&_h3]:m-0 [&_h3]:text-lg [&_p]:mb-0 [&_p]:mt-1 [&_p]:text-xs [&_p]:text-muted-foreground [&_p]:wrap-anywhere">
          <div className="flex items-start gap-2.5">
            <span className={PANEL_ICON}><KeyRound size={17} /></span>
            <div><h3 id="settings-reset-title">Reset password</h3><p>Set a new temporary password for {user.email}.</p></div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Close password reset"><X size={18} /></Button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <div className={FIELD}>
            <label htmlFor="settings-reset-password" className="font-semibold">New temporary password</label>
            <div className={PW_WRAP}>
              <Input id="settings-reset-password" ref={inputRef} type={visible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="At least 10 characters" autoComplete="new-password" />
              <Button type="button" variant="ghost" className={PW_TOGGLE} onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</Button>
            </div>
            <small>At least 10 characters with one letter and one number.</small>
          </div>
          {error && <p className="settings-inline-error mt-2 text-xs text-destructive" role="alert">{error}</p>}
          <div className="settings-dialog-actions mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !password}>{saving ? 'Updating…' : 'Update password'}</Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone = 'default' }: { icon: LucideIcon; label: string; value: number | string; tone?: 'default' | 'success' | 'muted' }) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value
  const iconTone = tone === 'success' ? 'bg-success-soft text-success' : tone === 'muted' ? 'bg-muted text-muted-foreground' : 'bg-muted text-primary'
  return (
    <div className={cn('settings-metric-card flex min-h-17.5 items-center gap-2.5 rounded-(--radius) border border-border bg-card px-3 py-2.5 max-[520px]:min-h-16 max-[520px]:gap-2 max-[520px]:p-2', `tone-${tone}`)}>
      <span className={cn('settings-metric-icon grid size-8.5 flex-none place-items-center rounded-(--radius) max-[520px]:size-7.5', iconTone)}><Icon size={17} /></span>
      <div className="grid gap-0.5">
        <strong className="text-lg font-semibold leading-normal tabular-nums text-primary max-[520px]:text-base">{displayValue}</strong>
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Database                                                            */
/* ------------------------------------------------------------------ */


type DBtabs = "db-info" | "db-inventory" | "db-apis";

function DatabaseView({ role }: { role: Role }) {
  const { data, loading, error, reload } = useAdminFetch<DatabaseInfo>(getDatabaseInfo);
  const [dbTab, setDbTab] = useState<DBtabs>("db-info");

  if (role !== "admin") {
    return (
      <AdminErrorState message="Only administrators can view database information." />
    );
  }

  if (loading && !data) return <PageLoading rows={3} />;
  if (error || !data) {
    return (
      <AdminErrorState
        message={error || "No data."}
        onRetry={() => void reload()}
      />
    );
  }

  const tabs: { value: DBtabs; label: string }[] = [
    { value: "db-info", label: "Database Info & Transfer" },
    { value: "db-inventory", label: "Database Inventory" },
    { value: "db-apis", label: "Database APIs" },
  ];

  return (
    <div className="admin-page-stack min-w-0">
      <SectionToolbar
        tabs={
          <AdminTabs
            id="database-view-tabs"
            panelId="database-view-panel"
            label="Database settings sections"
            value={dbTab}
            onChange={(value) => setDbTab(value as DBtabs)}
            items={tabs}
          />
        }
      />

      <section id="database-view-panel" role="tabpanel" aria-label={tabs.find((tab) => tab.value === dbTab)?.label}>
        <AdminWorkspaceGrid
          layout={dbTab === "db-info" ? "split" : "single"}
          columns="minmax(0, 1fr) minmax(0, 1fr)"
          ariaLabel="Database & APIs"
        >
          {dbTab === "db-info" && (
            <>
              <AdminDataContainer
                label="Database information"
                title="Database information"
                description="Connection state and database inventory summary."
                height="min(76dvh, 760px)"
                minHeight="320px"
                bodyScroll="auto"
                status={{ content: data.connected ? "Primary database connected." : "DATABASE_URL is not configured." }}
              >
                <div className="grid min-w-0 gap-3 p-3 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
                    <div className="grid min-w-0 gap-1">
                      <strong className="text-sm text-primary">Primary database</strong>
                      <span className="text-xs text-muted-foreground">Neon PostgreSQL · transactional source of truth</span>
                    </div>
                    <Badge variant={data.connected ? "default" : "destructive"}>
                      {data.connected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                  
                  <GoogleDriveBackupPanel />

                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <div className="grid min-w-0 gap-1 rounded-lg border border-border bg-background p-3">
                      <strong className="text-xl tabular-nums text-primary">{data.tables.length.toLocaleString()}</strong>
                      <span className="text-xs font-semibold text-muted-foreground">Database tables</span>
                    </div>
                    <div className="grid min-w-0 gap-1 rounded-lg border border-border bg-background p-3">
                      <strong className="text-xl tabular-nums text-primary">{data.apis.length.toLocaleString()}</strong>
                      <span className="text-xs font-semibold text-muted-foreground">Deployed API endpoints</span>
                    </div>
                  </div>

                  {!data.connected && (
                    <div className={WARNING_BOX} role="status">
                      <AlertTriangle size={16} />
                      <span>Database counts may be unavailable until DATABASE_URL is configured and the primary database is reachable.</span>
                    </div>
                  )}
                </div>
              </AdminDataContainer>

              <AdminDataContainer
                label="Database backup and transfer"
                title="Backup & transfer"
                description="Manage database backups, Google Drive snapshots and CMS data transfer."
                height="min(76dvh, 760px)"
                minHeight="320px"
                bodyScroll="auto"
              >
                <div className="grid min-w-0 gap-4 p-3 sm:p-4">
                  <DatabaseTransfer />
                </div>
              </AdminDataContainer>
            </>
          )}

          {dbTab === "db-inventory" && (
            <AdminDataContainer
              label="Database table inventory"
              title="Database tables"
              description="Logical data groups, descriptions and current record counts."
              className="settings-data-table-container"
              bodyScroll="hidden"
              height={TABLE_HEIGHT}
              minHeight={TABLE_MIN_HEIGHT}
            >
              <AdminTable
                rows={data.tables}
                columns={[
                  { key: "name", label: "Table", accessor: (table) => table.name, render: (table) => <strong>{table.name}</strong> },
                  { key: "label", label: "Description", accessor: (table) => table.label },
                  { key: "count", label: "Records", accessor: (table) => table.count ?? -1, render: (table) => table.count === null ? "—" : table.count.toLocaleString(), align: "right" },
                ] as AdminTableColumn<DatabaseInfo["tables"][number]>[]}
                getRowId={(table) => table.name}
                caption="Database table inventory"
                fileName="database-inventory.csv"
                exportable
                tableClassName="settings-database-table"
              />
            </AdminDataContainer>
          )}

          {dbTab === "db-apis" && (
            <AdminDataContainer
              label="Active APIs"
              title="Deployed API endpoints"
              description={`${data.apis.length} endpoints are deployed. CMS session endpoints require a signed-in admin.`}
              className="settings-data-table-container"
              bodyScroll="hidden"
              height={TABLE_HEIGHT}
              minHeight={TABLE_MIN_HEIGHT}
            >
              <AdminTable
                rows={data.apis}
                columns={[
                  { key: "method", label: "Method", accessor: (api) => api.method, render: (api) => <Badge variant="outline">{api.method}</Badge> },
                  { key: "path", label: "Path", accessor: (api) => api.path, render: (api) => <code className="settings-api-path">{api.path}</code> },
                  { key: "access", label: "Access", accessor: (api) => api.access },
                  { key: "description", label: "Purpose", accessor: (api) => api.description },
                ] as AdminTableColumn<DatabaseInfo["apis"][number]>[]}
                getRowId={(api) => `${api.method}:${api.path}`}
                caption="Active API endpoints"
                exportable
                fileName='active-apis.csv'
                tableClassName="settings-database-table"
              />
            </AdminDataContainer>
          )}
        </AdminWorkspaceGrid>
      </section>
    </div>
  );
}

function formatBackupSize(bytes: number) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1 }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

function GoogleDriveBackupPanel() {
  const [status, setStatus] = useState<DriveBackupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedRestoreId, setSelectedRestoreId] = useState('')

  const reload = useCallback((): Promise<void> => {
    setLoading(true)
    setError('')
    return getGoogleDriveBackupStatus()
      .then((payload) => {
        setStatus(payload)
        setSelectedRestoreId((current) => payload.backups?.some((item) => item.id === current && item.restorable)
          ? current
          : payload.backups?.find((item) => item.type === 'point-in-time' && item.restorable)?.id || '')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to read Google Drive backup status.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void Promise.resolve().then(reload)
  }, [reload])

  const requestBackup = (): void => {
    setBusy(true)
    setError('')
    void requestGoogleDriveBackup()
      .then((payload) => toast.success(payload.message || 'Point-in-time backup job started.'))
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to start a point-in-time backup.'
        setError(message)
        toast.error(message)
      })
      .finally(() => setBusy(false))
  }

  const requestRestore = (backup: DriveBackupItem): void => {
    if (!backup.restorable) return
    const confirmation = window.prompt(
      `This will overwrite the production Neon database and both configured media buckets with ${backup.name}. A fresh safety backup will be created first.\n\nType RESTORE PRODUCTION to continue.`,
    )
    if (confirmation !== 'RESTORE PRODUCTION') return
    setBusy(true)
    setError('')
    void requestGoogleDriveRestore(backup.id, 'RESTORE PRODUCTION')
      .then((payload) => toast.success(payload.message || 'Restore job started. The site will be updated after the workflow succeeds.'))
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to start the selected restore.'
        setError(message)
        toast.error(message)
      })
      .finally(() => setBusy(false))
  }

  const backups = status?.backups ?? []
  const pointInTimeBackups = backups.filter((backup) => backup.type === 'point-in-time')
  const selectedRestorePoint = pointInTimeBackups.find((backup) => backup.id === selectedRestoreId) || null
  const mirrorFiles = backups.filter((backup) => backup.type === 'json-mirror')
  const workflowReady = Boolean(status?.workflow?.available)
  const canCreateArchive = Boolean(status?.readiness?.canCreateArchive)
  const canRestoreArchive = Boolean(status?.readiness?.canRestore)
  const readinessChecks = status ? [
    { label: 'Google authentication', ready: status.configured, detail: 'Service-account token and backup folder access.' },
    { label: 'Folder listing', ready: status.canListChildren !== false, detail: 'Drive files can be discovered and enumerated.' },
    { label: 'Full archive upload', ready: canCreateArchive, detail: status.readiness?.createArchiveError || (canCreateArchive ? 'Shared Drive upload permission and active workflow confirmed.' : 'Requires a Shared Drive with file-creation permission and an active GitHub workflow.') },
    { label: 'JSON mirror updates', ready: Boolean(status.readiness?.canUpdateJsonMirrors), detail: `${status.readiness?.writableJsonMirrorCount ?? 0} of ${status.readiness?.jsonMirrorCount ?? 0} existing mirror files are editable.` },
    { label: 'Restore download', ready: (status.readiness?.downloadableRestoreCount ?? 0) > 0, detail: `${status.readiness?.downloadableRestoreCount ?? 0} verified restore archive(s) are downloadable.` },
    { label: 'GitHub Actions workflow', ready: workflowReady, detail: status.workflow?.available ? `${status.workflow.name || 'Backup workflow'} · ${status.workflow.state || 'active'}` : status.workflow?.error || 'Workflow is not available to the configured GitHub token.' },
  ] : []

  return <Card>
    <CardHeader>
      <div className="settings-actions-row flex flex-wrap items-center justify-between gap-2">
        <div className="settings-controls-row flex items-start gap-3">
          <span className={PANEL_ICON}><Archive size={24} /></span>
          <div>
            <CardTitle>Point-in-time backups & recovery</CardTitle>
            <CardDescription>Complete timestamped archives stored in Google Drive, including the PostgreSQL database, CMS data/configuration and private/public object storage.</CardDescription>
          </div>
        </div>
        <div className="settings-control-actions flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading || busy}><RefreshCw size={14} className={loading ? 'settings-spin animate-spin' : ''} /> Refresh</Button>
          <Button size="sm" onClick={requestBackup} disabled={busy || !canCreateArchive}><Archive size={14} />{busy ? 'Working…' : 'Create backup now'}</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {loading && !status ? <PageLoading rows={2} /> : error ? <div className={ERROR_BOX} role="alert">{error}</div> : status?.configured ? <>
        <div className={cn(SUMMARY_BOX, 'grid-cols-3 max-[520px]:gap-1.5 max-[520px]:px-1.5')}>
          <div><strong className="settings-base-text text-sm">Connected</strong><span>Google Drive status</span></div>
          <div><strong className="settings-base-text text-sm">{status.folderName || 'Backup folder'}</strong><span>Destination folder</span></div>
          <div><strong className="settings-base-text text-sm">{pointInTimeBackups.length.toLocaleString()}</strong><span>Full restore points</span></div>
        </div>
        <section className="settings-drive-readiness" aria-labelledby="settings-drive-readiness-title">
          <div className="settings-drive-readiness-heading">
            <div><strong id="settings-drive-readiness-title">Integration readiness</strong><p>Live permission and workflow checks for the Google Drive backup integration.</p></div>
            <Badge variant={canCreateArchive ? 'default' : 'outline'}>{canCreateArchive ? 'Backup ready' : 'Action required'}</Badge>
          </div>
          <div className="settings-drive-readiness-grid">
            {readinessChecks.map((check) => (
              <div className="settings-drive-readiness-item" data-ready={check.ready ? 'true' : 'false'} key={check.label}>
                <span className="settings-drive-readiness-indicator" aria-hidden="true" />
                <div><strong>{check.label}</strong><small>{check.detail}</small></div>
                <Badge variant="outline">{check.ready ? 'Ready' : 'Check'}</Badge>
              </div>
            ))}
          </div>
        </section>
        <div className="settings-actions-row flex flex-wrap items-center justify-between gap-2">
          <p className="admin-small-note">Automatic full backup: every day at <strong>2:00 AM Bangladesh time (Asia/Dhaka)</strong>. Hourly incremental JSON mirroring remains enabled as an additional recovery layer.</p>
          <Badge variant="outline">All archives retained by default</Badge>
        </div>
        {pointInTimeBackups.length ? <>
          <section className="settings-restore-picker my-3 grid gap-2.5 rounded-(--radius) border border-border bg-background p-3" aria-labelledby="settings-restore-picker-title">
            <div className="settings-restore-picker-heading flex items-start justify-between gap-3 [&_p]:m-0 [&_p]:text-xs [&_p]:text-muted-foreground [&_strong]:text-sm">
              <div><strong id="settings-restore-picker-title">Choose a restore point</strong><p>Select a timestamped archive discovered in the connected Google Drive backup folder.</p></div>
              <Badge variant="outline">{pointInTimeBackups.length.toLocaleString()} Drive files</Badge>
            </div>
            <label className="settings-restore-select-label text-sm font-semibold text-primary" htmlFor="settings-restore-point">Available point-in-time files</label>
            <NativeSelect id="settings-restore-point" className="settings-restore-select min-h-10 w-full" value={selectedRestoreId} onChange={(event) => setSelectedRestoreId(event.target.value)} disabled={busy}>
              <option value="">Select a restore point…</option>
              {pointInTimeBackups.map((backup) => <option key={backup.id} value={backup.id}>
                {formatDate(backup.createdTime)} · {backup.name} · {backup.restorable ? 'Verified' : 'Not verified'}
              </option>)}
            </NativeSelect>
            {selectedRestorePoint && <div className="settings-restore-selection flex flex-wrap items-start justify-between gap-3 rounded-(--radius) border border-border bg-card p-2.5" aria-live="polite">
              <div className="settings-restore-selection-copy grid min-w-0 flex-1 gap-1 wrap-anywhere [&_span]:text-xs [&_span]:leading-normal [&_span]:text-muted-foreground [&_strong]:text-sm [&_strong]:text-primary">
                <strong>{selectedRestorePoint.name}</strong>
                <span>Snapshot time: {formatDate(selectedRestorePoint.createdTime)} · {formatBackupSize(selectedRestorePoint.sizeBytes)}</span>
                <span>{selectedRestorePoint.sha256 ? `SHA-256: ${selectedRestorePoint.sha256}` : 'Checksum metadata unavailable'}</span>
              </div>
              <div className="settings-restore-selection-actions flex flex-wrap items-center justify-end gap-2 max-[620px]:w-full max-[620px]:justify-start">
                <Badge variant="outline" className={selectedRestorePoint.restorable ? 'settings-backup-verified' : 'settings-backup-unverified'}>{selectedRestorePoint.restorable ? 'Verified full archive' : 'Not eligible for restore'}</Badge>
                <Button type="button" size="sm" onClick={() => requestRestore(selectedRestorePoint)} disabled={busy || !canRestoreArchive || !selectedRestorePoint.restorable || selectedRestorePoint.canDownload === false}><RotateCcw size={13} /> Restore selected point</Button>
              </div>
            </div>}
            <p className="admin-small-note">Only archives created and tagged by the Srizony full-backup workflow can be restored. Other archive files remain visible for inspection but are not eligible for production restore.</p>
          </section>
          <AdminDataContainer label="Available backup archives" title="Point-in-time recovery archives" description="Verified archive metadata and recovery eligibility." className="settings-data-table-container" bodyScroll="hidden" height={TABLE_HEIGHT} minHeight={TABLE_MIN_HEIGHT}>
            <AdminTable
              rows={pointInTimeBackups}
              columns={[
                { key: 'name', label: 'Backup point', accessor: (backup) => backup.name, render: (backup) => backup.webViewLink ? <a href={backup.webViewLink} target="_blank" rel="noreferrer" className="settings-api-path">{backup.name}</a> : <code>{backup.name}</code> },
                { key: 'createdTime', label: 'Created', accessor: (backup) => backup.createdTime, render: (backup) => formatDate(backup.createdTime) },
                { key: 'sizeBytes', label: 'Size', accessor: (backup) => backup.sizeBytes, render: (backup) => formatBackupSize(backup.sizeBytes) },
                { key: 'sha256', label: 'SHA-256', accessor: (backup) => backup.sha256 || '', render: (backup) => backup.sha256 ? <Button type="button" variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(backup.sha256 || '').then(() => toast.success('SHA-256 copied.')).catch(() => toast.error('Could not copy the checksum.')) }} aria-label="Copy backup SHA-256"><Copy size={13} />{backup.sha256.slice(0, 12)}…</Button> : 'Not verified' },
                { key: 'restorable', label: 'Recovery status', accessor: (backup) => backup.restorable ? 'Verified full archive' : 'Not restorable', render: (backup) => <span className={backup.restorable ? 'settings-backup-status is-verified' : 'settings-backup-status is-unverified'}>{backup.restorable ? 'Verified full archive' : 'Not restorable'}</span> },
              ] as AdminTableColumn<DriveBackupItem>[]}
              getRowId={(backup) => backup.id}
              caption="Available point-in-time backups"
              rowClassName={(backup) => backup.id === selectedRestoreId ? 'is-selected' : ''}
              exportable={false}
              tableClassName="settings-database-table"
            />
          </AdminDataContainer>
        </> : <p className="admin-small-note">No point-in-time archive files were found in the connected Google Drive folder. Create the first full backup manually or wait for the next scheduled run.</p>}
        {mirrorFiles.length > 0 && <details className="settings-backup-mirror-details mt-3 border-t border-border pt-2 [&>summary]:cursor-pointer [&>summary]:text-xs [&>summary]:font-semibold [&>summary]:text-primary">
          <summary>Additional JSON mirror files ({mirrorFiles.length})</summary>
          <div className="mt-2">
            <AdminDataContainer label="Google Drive JSON mirror files" className="settings-data-table-container settings-mirror-data-container" bodyScroll="hidden" height={TABLE_HEIGHT} minHeight={TABLE_MIN_HEIGHT}>
              <AdminTable
                rows={mirrorFiles.slice(0, 20)}
                columns={[
                  { key: 'name', label: 'Mirror file', accessor: (backup) => backup.name, render: (backup) => <code>{backup.name}</code> },
                  { key: 'createdTime', label: 'Updated', accessor: (backup) => backup.createdTime, render: (backup) => formatDate(backup.createdTime) },
                  { key: 'sizeBytes', label: 'Size', accessor: (backup) => backup.sizeBytes, render: (backup) => formatBackupSize(backup.sizeBytes) },
                ] as AdminTableColumn<DriveBackupItem>[]}
                getRowId={(backup) => backup.id}
                caption="Additional JSON mirror files"
                footerSummary={`${Math.min(mirrorFiles.length, 20).toLocaleString()} of ${mirrorFiles.length.toLocaleString()} mirror files shown`}
                exportable={false}
                tableClassName="settings-database-table"
              />
            </AdminDataContainer>
          </div>
        </details>}
        <div className={WARNING_BOX} role="note"><AlertTriangle size={16} /><span>Restoring replaces production database objects and both configured media buckets. The workflow creates a fresh pre-restore backup first, verifies the selected archive checksum, and then performs the restore. Schedule windows can be delayed by GitHub Actions.</span></div>
        {!status.isSharedDrive && <div className={WARNING_BOX} role="alert"><AlertTriangle size={16} /><span>This folder is in My Drive. A standalone Google service account cannot own uploaded archive files because it has no personal Drive storage quota. Move the backup folder to a Shared Drive and add the service account as a Contributor or Content manager. Existing, pre-created JSON mirror files may still be readable or editable.</span></div>}
        {status.isSharedDrive && status.canAddChildren === false && <div className={WARNING_BOX} role="alert"><AlertTriangle size={16} /><span>The connected Shared Drive folder cannot create new backup archives. Grant the service account a role that allows adding files, such as Contributor or Content manager.</span></div>}
        {!workflowReady && <div className={WARNING_BOX} role="alert"><AlertTriangle size={16} /><span>{status.workflow?.error || 'The GitHub Actions backup workflow is not active or the token cannot access it. Check GITHUB_BACKUP_TOKEN, repository Actions permissions and the workflow file on the configured ref.'}</span></div>}
        {(status.readiness?.jsonMirrorCount ?? 0) > 0 && !status.readiness?.canUpdateJsonMirrors && <div className={WARNING_BOX} role="alert"><AlertTriangle size={16} /><span>Existing JSON mirror files were found, but none are confirmed editable by this service account. Grant Editor access to those files or their parent folder.</span></div>}
        <p className="admin-small-note">Google Drive JSON snapshots provide validated read-only failover for public content and supported CMS read screens when Neon is unavailable. CMS edits, user-role changes, uploads, applications, donations and other transactional writes still require the live primary database. The backup workflow also validates BACKUP_DATABASE_URL and the object-storage credentials at job runtime; the GitHub API does not expose secret values for preflight verification.</p>
      </> : <>
        <div className="settings-provider-status-row flex flex-wrap items-center gap-2"><Badge variant="outline">Not configured</Badge><span className="admin-small-note">Google Drive backup connection is not ready.</span></div>
        <p className="settings-inline-error mt-2 text-xs text-destructive" role="alert">{status?.error || 'Configure the Google service account and backup folder environment variables.'}</p>
        <p className="admin-small-note">See <code>docs/GOOGLE_DRIVE_BACKUPS.md</code> for the backup folder, service-account and secret configuration.</p>
      </>}
    </CardContent>
  </Card>
}

/* ------------------------------------------------------------------ */
/* Theme typography                                                    */
/* ------------------------------------------------------------------ */

const SCOPES: ThemeTypographyScope[] = ['global', 'header', 'content', 'footer', 'cms']
const SCOPE_DESCRIPTIONS: Record<ThemeTypographyScope, string> = {
  global: 'Site-wide defaults',
  header: 'Brand and navigation',
  content: 'Pages and sections',
  footer: 'Footer area',
  cms: 'CMS shell, nav, tables and controls',
}

function ThemeTypographyView({ role }: { role: Role }) {
  const router = useRouter()
  const { mode } = useAdminTheme()
  const [draft, setDraft] = useState<ThemeTypographyScopedSettings>(DEFAULT_THEME_TYPOGRAPHY_SETTINGS)
  const [scope, setScope] = useState<ThemeTypographyScope>('global')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [readOnly, setReadOnly] = useState(false)

  useEffect(() => {
    let active = true
    void getThemeTypography()
      .then((payload) => {
        if (!active) return
        setDraft(payload.typography || DEFAULT_THEME_TYPOGRAPHY_SETTINGS)
        setReadOnly(Boolean(payload.readOnly))
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load site typography settings.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const activeTypography: ThemeTypographyPreferences = scope === 'global'
    ? draft.global
    : { ...draft.global, ...draft[scope] }
  const previewSurfaces = mode === 'light' ? ['#ffffff', '#edf3f7'] : ['#111c24', '#16252f']
  const previewHeadingColor = ensureThemeContrast(activeTypography.headingColor || (mode === 'light' ? '#172632' : '#eef5fa'), previewSurfaces, 7)
  const previewBodyColor = ensureThemeContrast(activeTypography.bodyColor || (mode === 'light' ? '#53616c' : '#bdcbd5'), previewSurfaces, 4.5)
  const previewNavColor = ensureThemeContrast(activeTypography.navColor || (mode === 'light' ? '#173d5b' : '#91b4d1'), previewSurfaces, 4.5)

  function update<K extends keyof ThemeTypographyPreferences>(key: K, value: ThemeTypographyPreferences[K]) {
    setDraft((current) => scope === 'global'
      ? { ...current, global: { ...current.global, [key]: value } }
      : { ...current, [scope]: { ...current[scope], [key]: value } })
    setNotice('')
  }

  function resetScope() {
    setDraft((current) => scope === 'global'
      ? { ...current, global: DEFAULT_THEME_TYPOGRAPHY }
      : { ...current, [scope]: {} })
    setNotice(scope === 'global' ? 'Global typography reset to the theme defaults.' : `${scope[0].toUpperCase()}${scope.slice(1)} now inherits Global typography.`)
  }

  function save(): Promise<void> {
    if (role === 'analyst' || readOnly) return Promise.resolve()
    setSaving(true)
    setError('')
    setNotice('')
    return saveThemeTypography(draft)
      .then((payload) => {
        const saved = payload.typography || draft
        setDraft(saved)
        setNotice('Typography saved. Public-site scopes and CMS component tokens have been applied.')
        toast.success('Theme typography saved.')
        window.dispatchEvent(new Event('sf-admin-typography-updated'))
        router.refresh()
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save site typography settings.'
        setError(message)
        toast.error(message)
      })
      .finally(() => setSaving(false))
  }

  const bodyStack = THEME_FONT_FAMILIES[activeTypography.bodyFont]
  const displayStack = THEME_FONT_FAMILIES[activeTypography.displayFont]
  const scopeLabel = scope === 'global' ? 'Global' : scope === 'cms' ? 'Admin interface' : scope[0].toUpperCase() + scope.slice(1)
  const locked = role === 'analyst' || saving || readOnly
  const fontOptions = Object.keys(THEME_FONT_FAMILIES).map((name) => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)

  return (
    <div className="admin-page-stack">
      <AdminWorkspaceGrid layout="single" ariaLabel="Theme typography settings">
        <AdminDataContainer
          label="Theme typography workspace"
          bodyScroll="auto"
          minHeight="360px"
          headerContent={
            <>
              <AdminToolbar
                tabs={
                  <div className="settings-theme-scope-picker grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Typography scope">
                  {SCOPES.map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant="outline"
                      aria-pressed={scope === item}
                      onClick={() => { setScope(item); setNotice('') }}
                      className={cn(
                        'flex flex-col items-start h-auto min-w-0 gap-1 rounded-(--radius) border border-border bg-card p-2 text-left text-primary shadow-none transition-colors hover:bg-muted/30',
                        scope === item && 'is-active border-primary bg-primary/10 ring-1 ring-primary hover:bg-primary/10',
                      )}
                    >
                      <strong className="text-sm">{item === 'cms' ? 'Admin interface' : item[0].toUpperCase() + item.slice(1)}</strong>
                      <span className="text-xs leading-snug text-muted-foreground">{SCOPE_DESCRIPTIONS[item]}</span>
                    </Button>
                  ))}
                </div>
                }
              />
              <section className="settings-theme-preview bg-card text-primary max-[620px]:p-3" aria-label={`${scopeLabel} typography preview`}>
                <div className="grid [&>span]:text-xs [&>span]:font-semibold [&>span]:uppercase [&>span]:tracking-[.08em] [&>span]:text-muted-foreground">
                  <span>Live type preview · {scopeLabel} scope</span>
                  <h2
                    className="settings-theme-preview-heading m-0 min-w-0 leading-tight [font-family:var(--sf-preview-font-family)] [font-size:var(--sf-preview-font-size)] font-(--sf-preview-font-weight) tracking-(--sf-preview-letter-spacing) text-(--sf-preview-color) wrap-anywhere"
                    style={{ '--sf-preview-font-family': displayStack, '--sf-preview-font-weight': activeTypography.headingWeight, '--sf-preview-font-size': `${Math.round(28 * activeTypography.headingScale)}px`, '--sf-preview-letter-spacing': `${activeTypography.letterSpacing}em`, '--sf-preview-color': previewHeadingColor } as CSSProperties}
                  >
                    A thoughtful foundation for every community
                  </h2>
                  <p
                    className="settings-theme-preview-body m-0 min-w-0 [font-family:var(--sf-preview-font-family)] [font-size:var(--sf-preview-font-size)] font-(--sf-preview-font-weight) leading-(--sf-preview-line-height) text-(--sf-preview-color) wrap-anywhere"
                    style={{ '--sf-preview-font-family': bodyStack, '--sf-preview-font-weight': activeTypography.bodyWeight, '--sf-preview-font-size': `${activeTypography.baseSize}px`, '--sf-preview-line-height': activeTypography.lineHeight, '--sf-preview-color': previewBodyColor } as CSSProperties}
                  >
                    This preview reflects the {scopeLabel.toLowerCase()} typography scope.
                  </p>
                  {(scope === 'global' || scope === 'header') && 
                  <nav
                    className="settings-theme-preview-nav flex min-w-0 flex-wrap gap-4.5 border-t border-border pt-2.5 [font-family:var(--sf-preview-font-family)] [font-size:var(--sf-preview-font-size)] font-(--sf-preview-font-weight) text-(--sf-preview-color) wrap-anywhere max-[620px]:gap-3"
                    aria-label="Navigation typography preview"
                    style={{ '--sf-preview-font-family': bodyStack, '--sf-preview-font-size': `${activeTypography.navFontSize}px`, '--sf-preview-font-weight': activeTypography.navFontWeight, '--sf-preview-color': previewNavColor } as CSSProperties}
                  >
                    <span>Home</span><span>About</span><span>Our Work</span><span>Contact</span>
                  </nav>}
                </div>
                </section>
            </>
          }
          footer={
            <div className="flex w-full justify-end">
              {role === 'analyst'
                ? <p className="admin-small-note">Analyst access is read-only. An administrator or editor can update typography settings.</p>
                : <div className="settings-theme-actions flex flex-wrap items-center justify-end gap-2">
                  <Button type="button" onClick={() => void save()} disabled={saving || loading || readOnly}><Check size={15} />{saving ? 'Saving…' : 'Save typography'}</Button>
                  <Button type="button" variant="outline" onClick={resetScope} disabled={saving || readOnly}><RotateCcw size={14} />Reset {scopeLabel}</Button>
                </div>}
            </div>
          }
        >
          {notice && <div className={SUCCESS_BOX} role="status"><div className="border-3 rounded-lg p-1"><Check size={20} /></div>{notice}</div>}
          {readOnly && <div className={WARNING_BOX} role="status"><AlertTriangle size={16} /><span>Typography is loaded from a Google Drive snapshot and is read-only until Neon is available. Your changes cannot be committed to the primary database right now.</span></div>}
          {error && <div className={ERROR_BOX} role="alert">{error}</div>}
          <div className={`settings-theme-typography-grid grid ${scope !== 'header' && scope !== 'footer' ? "grid-cols-2" : ""} max-[620px]:grid-cols-1 p-2 rounded-full`}>
            {scope !== 'header' && scope !== 'footer' && 
            <div className={CONTROL_GROUP}>
              <> 
                <h3>Public text components</h3>
                <p className="admin-small-note">Control independent text roles used by the public header, pages, cards, forms, and footer. Scopes inherit Global unless overridden.</p>
                {([['bodyScale', 'Body text'], ['h1Scale', 'Page title (H1)'], ['h2Scale', 'Section heading (H2)'], ['h3Scale', 'Card / subheading (H3)'], ['leadScale', 'Lead / intro text'], ['eyebrowScale', 'Eyebrow / overline'], ['cardTitleScale', 'Card title'], ['cardBodyScale', 'Card description'], ['buttonScale', 'Buttons and action links'], ['breadcrumbScale', 'Breadcrumbs'], ['metaScale', 'Dates and metadata'], ['labelScale', 'Form and field labels']] as const).map(([key, label]) => <label key={key} className={RANGE}><span>{label} <strong>{activeTypography[key].toFixed(2)}×</strong></span><Input type="range" min="0.75" max="1.5" step="0.05" value={activeTypography[key]} onChange={(event) => update(key, Number(event.target.value))} disabled={locked} /></label>)}
                <label className={FIELD}><span>Button font weight</span><NativeSelect value={activeTypography.buttonWeight} onChange={(event) => update('buttonWeight', Number(event.target.value))} disabled={locked}>{[400, 500, 600, 700, 800].map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect></label>
              </>
              {(scope === 'global' ) && <label className={RANGE}><span>Brand name <strong>{activeTypography.brandScale.toFixed(2)}×</strong></span><Input type="range" min="0.75" max="1.5" step="0.05" value={activeTypography.brandScale} onChange={(event) => update('brandScale', Number(event.target.value))} disabled={locked} /></label>}
              {(scope === 'global' ) && <>
                <label className={RANGE}><span>Footer headings <strong>{activeTypography.footerHeadingScale.toFixed(2)}×</strong></span><Input type="range" min="0.75" max="1.5" step="0.05" value={activeTypography.footerHeadingScale} onChange={(event) => update('footerHeadingScale', Number(event.target.value))} disabled={locked} /></label>
              </>}
            </div>}


            <div className={CONTROL_GROUP}>
              <h3>Font, Scaling & Color</h3>
              <label className={RANGE}><span>Body line height <strong>{activeTypography.lineHeight.toFixed(2)}</strong></span><Input type="range" min="1.2" max="2" step="0.05" value={activeTypography.lineHeight} onChange={(event) => update('lineHeight', Number(event.target.value))} disabled={locked} /></label>
              <label className={RANGE}><span>Letter spacing <strong>{activeTypography.letterSpacing.toFixed(3)}em</strong></span><Input type="range" min="-0.06" max="0.1" step="0.005" value={activeTypography.letterSpacing} onChange={(event) => update('letterSpacing', Number(event.target.value))} disabled={locked} /></label>
              {(scope === 'global' || scope === 'header') && <>
                <label className={RANGE}><span>Navigation font size <strong>{activeTypography.navFontSize}px</strong></span><Input type="range" min="12" max="20" step="1" value={activeTypography.navFontSize} onChange={(event) => update('navFontSize', Number(event.target.value))} disabled={locked} /></label>
                <label className={FIELD}><span>Navigation font weight</span>
                  <NativeSelect value={activeTypography.navFontWeight} onChange={(event) => update('navFontWeight', Number(event.target.value))} disabled={locked}>{[400, 500, 600, 700, 800].map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect>
                </label>
              </>}
              <div className="settings-theme-colors grid grid-cols-3 gap-2 [&_input[type=color]]:h-8.5 [&_input[type=color]]:w-full [&_input[type=color]]:min-w-0 [&_input[type=color]]:cursor-pointer [&_input[type=color]]:rounded-[calc(var(--radius)-2px)] [&_input[type=color]]:border [&_input[type=color]]:border-border [&_input[type=color]]:bg-card [&_input[type=color]]:p-0.75 [&_label]:grid [&_label]:min-w-0 [&_label]:gap-1 [&_label]:text-sm [&_label]:font-semibold [&_label]:text-muted-foreground">
                <label><span>Body text colour</span><Input type="color" value={activeTypography.bodyColor || '#1d2b36'} onChange={(event) => update('bodyColor', event.target.value)} disabled={locked} /></label>
                <label><span>Heading colour</span><Input type="color" value={activeTypography.headingColor || '#1d2b36'} onChange={(event) => update('headingColor', event.target.value)} disabled={locked} /></label>
                {(scope === 'global' || scope === 'header') && <label><span>Navigation colour</span><Input type="color" value={activeTypography.navColor || '#263b4b'} onChange={(event) => update('navColor', event.target.value)} disabled={locked} /></label>}
              </div>
              <p className="admin-small-note">Text and navigation colours are automatically adjusted to maintain contrast in light and dark mode.</p>
              <Button type="button" variant="link" className="settings-theme-reset-colors h-auto justify-self-start p-0 text-xs font-semibold" onClick={() => { update('bodyColor', ''); update('headingColor', ''); update('navColor', '') }} disabled={locked}>Use inherited colours</Button>
              <label className={FIELD}><span>Body font</span>
                <NativeSelect value={activeTypography.bodyFont} onChange={(event) => update('bodyFont', event.target.value as ThemeTypographyPreferences['bodyFont'])} disabled={locked}>{fontOptions}</NativeSelect>
              </label>
              <label className={FIELD}><span>Heading / display font</span>
                <NativeSelect value={activeTypography.displayFont} onChange={(event) => update('displayFont', event.target.value as ThemeTypographyPreferences['displayFont'])} disabled={locked}>{fontOptions}</NativeSelect>
              </label>
              <label className={RANGE}><span>Base font size <strong>{activeTypography.baseSize}px</strong></span><Input type="range" min="13" max="20" step="1" value={activeTypography.baseSize} onChange={(event) => update('baseSize', Number(event.target.value))} disabled={locked} /></label>
              <label className={FIELD}><span>Body font weight</span>
                <NativeSelect value={activeTypography.bodyWeight} onChange={(event) => update('bodyWeight', Number(event.target.value))} disabled={locked}>{[300, 400, 500, 600, 700].map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect>
              </label>
              <label className={FIELD}><span>Heading font weight</span>
                <NativeSelect value={activeTypography.headingWeight} onChange={(event) => update('headingWeight', Number(event.target.value))} disabled={locked}>{[500, 600, 700, 800, 900].map((n) => <option key={n} value={n}>{n}</option>)}</NativeSelect>
              </label>
              <label className={RANGE}><span>Heading scale <strong>{activeTypography.headingScale.toFixed(2)}×</strong></span><Input type="range" min="0.85" max="1.25" step="0.05" value={activeTypography.headingScale} onChange={(event) => update('headingScale', Number(event.target.value))} disabled={locked} /></label>
            </div>
          </div>

          {scope === 'cms' && <AdminTypographyControls
            value={activeTypography}
            disabled={locked}
            onChange={(key: AdminComponentTypographyKey, nextValue: number) => update(key, nextValue)}
          />}
        </AdminDataContainer>
      </AdminWorkspaceGrid>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Data transfer                                                       */
/* ------------------------------------------------------------------ */

function DatabaseTransfer() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [rawJson, setRawJson] = useState('')
  const [preview, setPreview] = useState<Record<string, number> | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function clearSelection() {
    setPreview(null); setRawJson(''); setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function exportJson() {
    setBusy(true); setError('')
    return exportDatabaseJson()
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `srizony-cms-site-data-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(anchor); anchor.click(); anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 0)
        toast.success('CMS site data exported as JSON.')
      })
      .catch((cause: unknown) => { const message = cause instanceof Error ? cause.message : 'Export failed.'; setError(message); toast.error(message) })
      .finally(() => setBusy(false))
  }

  function selectFile(file?: File) {
    setError(''); setPreview(null); setRawJson(''); setFileName('')
    if (!file) return Promise.resolve()
    if (file.size > 20 * 1024 * 1024) { setError('Choose a JSON file smaller than 20 MB.'); return Promise.resolve() }
    return file.text()
      .then((text) => {
        const parsed = JSON.parse(text)
        if (parsed?.format !== 'srizony-cms-site-data' || parsed?.version !== 1 || !parsed?.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) throw new Error('This is not a supported Srizony CMS export file.')
        const counts: Record<string, number> = {}
        for (const [table, rows] of Object.entries(parsed.data)) {
          if (!Array.isArray(rows) || !rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) throw new Error(`Invalid record list for ${table}.`)
          counts[table] = rows.length
        }
        if (!Object.keys(counts).length) throw new Error('The JSON file does not contain any CMS site data.')
        setFileName(file.name); setRawJson(text); setPreview(counts)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to read this JSON file.'))
  }

  function importJson() {
    if (!rawJson || !preview) return Promise.resolve()
    const total = Object.values(preview).reduce((sum, count) => sum + count, 0)
    if (!window.confirm(`Import ${total.toLocaleString()} records across ${Object.keys(preview).length} tables? Matching records will be updated. Records missing from the file are not deleted. Export a fresh backup first for large changes.`)) return Promise.resolve()
    setBusy(true); setError('')
    return importDatabaseJson(rawJson)
      .then((result: DatabaseImportResult) => {
        const importedTotal = Object.values(result.imported ?? {}).reduce<number>((sum, count) => sum + Number(count ?? 0), 0)
        toast.success(`Imported ${importedTotal.toLocaleString()} records.`)
        clearSelection()
      })
      .catch((cause: unknown) => { const message = cause instanceof Error ? cause.message : 'Import failed.'; setError(message); toast.error(message) })
      .finally(() => setBusy(false))
  }

  return <Card>
    <CardHeader>
      <CardTitle>CMS site-data transfer</CardTitle>
      <CardDescription>Export all editable public website and CMS content records—including page documents, section collections, navigation, media metadata, Website Essentials and CMS JSON documents—into a structured JSON file, edit them in bulk, then upload the revised file. The importer validates the structure and database columns before writing. Existing primary keys are updated, new rows may receive database-generated IDs, and records absent from the file are not deleted. Authentication, private form submissions, user passwords, visitor logs, job applications, transaction records and non-CMS operational settings are intentionally excluded. Uploaded media files remain in media storage; the JSON includes their database metadata and URLs.</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="admin-editor-toolbar mt-2.5 flex flex-wrap items-center gap-2 max-[700px]:flex-col max-[700px]:items-stretch max-[700px]:**:data-[slot=button]:w-full">
        <Button onClick={() => void exportJson()} disabled={busy}><FileJson size={15} /> {busy ? 'Working…' : 'Export CMS data (.json)'}</Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={15} /> Select updated JSON</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(event) => void selectFile(event.target.files?.[0])} />
      </div>
      {fileName && preview && <div className="cms-json-import-preview mt-3 grid min-w-0 gap-3 rounded-(--radius) border border-border bg-background p-4 text-primary">
        <strong>Import preview: {fileName}</strong>
        <p className="admin-small-note">{Object.values(preview).reduce((sum, count) => sum + count, 0).toLocaleString()} records in {Object.keys(preview).length} tables. The import will update matching primary keys and will not delete records.</p>
        <AdminDataContainer 
          label="JSON import preview" 
          className="settings-data-table-container settings-json-preview-container" 
          bodyScroll="hidden" 
          height={TABLE_HEIGHT} 
          minHeight={TABLE_MIN_HEIGHT}
        >
          <AdminTable
            rows={Object.entries(preview).map(([table, count]) => ({ table, count }))}
            columns={[
              { key: 'table', label: 'Table', accessor: (row) => row.table, render: (row) => <code>{row.table}</code> },
              { key: 'count', label: 'Records in file', accessor: (row) => row.count, render: (row) => row.count.toLocaleString(), align: 'right' },
            ]}
            getRowId={(row) => row.table}
            caption="CMS import preview"
            footerSummary={`${Object.keys(preview).length.toLocaleString()} table collections in the import preview`}
            exportable={false}
          />
        </AdminDataContainer>
        <div className="cms-form-footer mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={clearSelection} disabled={busy}>Cancel</Button>
          <Button onClick={() => void importJson()} disabled={busy}>{busy ? 'Importing…' : 'Apply JSON changes'}</Button>
        </div>
      </div>}
      {error && <div className={ERROR_BOX} role="alert">{error}</div>}
    </CardContent>
  </Card>
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

function cellText(value: ExternalValue) {
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

  const reload = useCallback(() => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError('')
    return getReportRows(table)
      .then((rows) => { if (requestId === requestIdRef.current) setData(rows) })
      .catch((cause: unknown) => { if (requestId === requestIdRef.current) setError(cause instanceof Error ? cause.message : 'Unable to load this report.') })
      .finally(() => { if (requestId === requestIdRef.current) setLoading(false) })
  }, [table])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) void reload() })
    return () => { active = false; requestIdRef.current += 1 }
  }, [reload])

  function changeTable(nextTable: ReportKey) {
    setTable(nextTable)
    setSelected(new Set())
    setSearch('')
    setData(null)
  }

  const columns = useMemo(() => {
    const keys: string[] = []
    for (const row of (data ?? []).slice(0, 250)) for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key)
    return keys
  }, [data])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data ?? []).map((row, index) => ({ row, index })).filter(({ row }) => !term || Object.values(row).some((value) => cellText(value).toLowerCase().includes(term)))
  }, [data, search])

  return (
    <div className="admin-page-stack">
      <AdminWorkspaceGrid layout="single" ariaLabel="CMS reporting and data exports">

        {loading && !data ? 
        <PageLoading rows={4} /> : 
        error ? 
        <AdminErrorState message={error} onRetry={() => void reload()} /> :
        data?.length ? (
        <AdminDataContainer 
          label={`${REPORTS[table].title} table viewport`}
          title={`${REPORTS[table].title} records`} 
          bodyScroll="hidden" 
          minHeight={TABLE_MIN_HEIGHT} 
          headerContent={
            <AdminToolbar
              onRefresh={reload}
              refreshing={loading}
              onSearch={(event) => setSearch(event)}
              searchPlaceholder="Search any field in this dataset…"
              filters={
                <label className={cn(FIELD, 'settings-report-picker **:data-[slot=native-select]:min-h-8 **:data-[slot=native-select]:w-full')}>
                  <NativeSelect value={table} onChange={(event) => changeTable(event.target.value as ReportKey)}>
                    {(Object.keys(REPORTS) as ReportKey[]).map((key) => <option key={key} value={key}>{REPORTS[key].title}</option>)}
                  </NativeSelect>
                </label>
              }
            />
          }
          footer={
            "Select rows in the first column. Export selected or all records using the report controls above."
          }
        >
          <AdminTable
            rows={visible}
            columns={columns.map((column) => ({
              key: column,
              label: column.replace(/_/g, ' '),
              accessor: (entry) => entry.row[column],
              render: (entry) => <span title={cellText(entry.row[column])}>{cellText(entry.row[column]) || '—'}</span>,
            })) as AdminTableColumn<{ row: ReportRow; index: number }>[]}
            getRowId={(entry) => String(entry.index)}
            caption={`${REPORTS[table].title} dataset export rows`}
            selectable
            selectedIds={[...selected].map(String)}
            onSelectionChange={(ids) => setSelected(new Set(ids.map(Number).filter(Number.isFinite)))}
            exportable
            selectedExportable
            fileName={`${table}.csv`}
            sortable
            emptyMessage="No records match this filter."
            tableClassName="settings-report-table"
            footerSummary={`${visible.length.toLocaleString()} matching of ${(data ?? []).length.toLocaleString()} records`}
          />
        </AdminDataContainer>
        ) : (
          <div className={EMPTY_STATE}>
            <FileSpreadsheet size={23} />
            <strong>This dataset is empty</strong>
            <p>There are no records available to export.</p>
          </div>
        )}
      </AdminWorkspaceGrid>
    </div>
  )
}
