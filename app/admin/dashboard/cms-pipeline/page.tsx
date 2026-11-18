'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Database, PanelsTopLeft, Save, Server, Settings2, Table2, Workflow } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { SiteIdentity } from '@/types/site'
import { getCmsPipeline, saveCmsPipelineIdentity, type CmsPipelinePayload } from '@/lib/api/adminResources'
import {
  AdminDataContainer,
  AdminTable,
  AdminToolbar,
  AdminToolbarAction,
  AdminToolbarBadge,
  type AdminTableColumn,
} from '@/components/admin/cms'
import { AdminErrorState, AdminSectionTabs, PageLoading } from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'

type DomainStatus = { id: string; label: string; table: string; records: number | null; state: string; href: string }
type PipelineData = CmsPipelinePayload

const emptyIdentity: SiteIdentity = { name: '', alternateName: '', canonicalUrl: '', title: '', description: '', keywords: [], foundingDate: '', logo: '', ogImage: '' }

const EDITOR_LINKS = [
  { href: '/admin/dashboard/page-builder', label: 'Slug pages and sectional layouts' },
  { href: '/admin/dashboard/navigation', label: 'Navigation and submenu management' },
  { href: '/admin/dashboard/site-content', label: 'Projects, news, notices, reports and content collections' },
  { href: '/admin/dashboard/website-essentials', label: 'Staff, locations, documents and contact essentials' },
  { href: '/admin/dashboard/jobs', label: 'Job postings and application workflows' },
]

const FORM_GRID = 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'
const SPAN_2 = 'md:col-span-2'

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5 text-sm', className)}>
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

function Section({ icon, title, description, children }: { icon?: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-1 border-b border-border pb-3">
        <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-primary">{icon}{title}</h3>
        <p className="m-0 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Callout({ tone, icon, children }: { tone: 'warning' | 'error' | 'success'; icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'warning' && 'border-warning/30 bg-warning/10 text-primary',
        tone === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-success/30 bg-success/10 text-success',
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

function StatusCard({ icon, title, detail, ok }: { icon: ReactNode; title: string; detail: string; ok: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3.5">
      <span className="shrink-0 text-primary">{icon}</span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <strong className="break-words text-sm">{title}</strong>
        <span className="break-words text-xs leading-relaxed text-muted-foreground">{detail}</span>
      </div>
      {ok
        ? <CheckCircle2 size={19} className="shrink-0 text-success" aria-label="Healthy" />
        : <AlertTriangle size={19} className="shrink-0 text-warning" aria-label="Needs attention" />}
    </div>
  )
}

function domainStateLabel(state: string) {
  switch (state) {
    case 'ready': return 'Healthy'
    case 'empty': return 'Empty'
    case 'unavailable': return 'Unavailable'
    case 'fallback': return 'Fallback'
    default: return state.replace(/[-_]/g, ' ')
  }
}

const domainColumns: AdminTableColumn<DomainStatus>[] = [
  { key: 'label', label: 'Content domain', accessor: (domain) => domain.label, render: (domain) => <strong>{domain.label}</strong> },
  { key: 'table', label: 'Database table', accessor: (domain) => domain.table, render: (domain) => <code>{domain.table}</code> },
  { key: 'records', label: 'Records', accessor: (domain) => domain.records ?? -1, render: (domain) => domain.records === null ? '—' : domain.records.toLocaleString(), align: 'right' },
  {
    key: 'state',
    label: 'Data status',
    accessor: (domain) => domain.state,
    render: (domain) => {
      const warning = domain.state === 'empty' || domain.state === 'unavailable' || domain.state === 'fallback'
      return <AdminToolbarBadge tone={warning ? 'warning' : 'success'}>{domainStateLabel(domain.state)}</AdminToolbarBadge>
    },
  },
  {
    key: 'action',
    label: 'Action',
    sortable: false,
    exportable: false,
    render: (domain) => <Link href={domain.href} className="font-semibold text-primary hover:underline">Open editor <span aria-hidden="true">→</span></Link>,
  },
]

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function CmsPipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [activeTab, setActiveTab] = useState('status')
  const [identity, setIdentity] = useState<SiteIdentity>(emptyIdentity)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [baselineIdentity, setBaselineIdentity] = useState('')
  const loadRequestRef = useRef(0)

  const load = useCallback(() => {
    const requestId = ++loadRequestRef.current
    setLoading(true); setError('')
    return getCmsPipeline()
      .then((payload) => {
        if (requestId !== loadRequestRef.current) return
        setData(payload)
        const nextIdentity = { ...emptyIdentity, ...payload.identity }
        setIdentity(nextIdentity)
        setBaselineIdentity(JSON.stringify(nextIdentity))
      })
      .catch((cause: unknown) => {
        if (requestId === loadRequestRef.current) setError(cause instanceof Error ? cause.message : 'Unable to load CMS pipeline.')
      })
      .finally(() => {
        if (requestId === loadRequestRef.current) setLoading(false)
      })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  function patch<K extends keyof SiteIdentity>(key: K, value: SiteIdentity[K]) {
    setIdentity((current) => ({ ...current, [key]: value }))
  }

  function saveIdentity() {
    setSaving(true); setError(''); setNotice('')
    return saveCmsPipelineIdentity(identity)
      .then((payload) => {
        setIdentity(payload.siteIdentity); setBaselineIdentity(JSON.stringify(payload.siteIdentity))
        setNotice('Site identity saved to Neon PostgreSQL. Metadata and structured data have been revalidated.')
        return load()
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to save site identity.'))
      .finally(() => setSaving(false))
  }

  const dirty = useMemo(() => Boolean(data) && baselineIdentity !== JSON.stringify(identity), [data, identity, baselineIdentity])
  useRegisterAdminActions('cms-pipeline-identity', { save: saveIdentity, reload: load, dirty, saving, label: 'Site identity' })

  function reload() {
    if (dirty && !window.confirm('You have unsaved site-identity changes. Reload and discard them?')) return
    void load()
  }

  function discard() {
    if (!window.confirm('Discard unsaved site-identity changes?')) return
    setIdentity(JSON.parse(baselineIdentity) as SiteIdentity)
    setError('')
  }

  const tabs = (
    <AdminSectionTabs
      label="CMS pipeline sections"
      value={activeTab}
      onChange={setActiveTab}
      items={[
        { value: 'status', label: 'System status', icon: <Activity size={15} /> },
        { value: 'domains', label: 'Content domains', icon: <Table2 size={15} />, count: data?.domains.length },
        { value: 'identity', label: 'Site identity', icon: <Settings2 size={15} />, },
        { value: 'editors', label: 'CMS editors', icon: <PanelsTopLeft size={15} /> },
      ]}
    />
  )

  return (
    <AdminDataContainer
      label="CMS data pipeline"
      headerContent={<AdminToolbar title="CMS pipeline sections" tabs={tabs} />}
      actions={
        <>
          {dirty && <AdminToolbarBadge tone="warning">Unsaved changes</AdminToolbarBadge>}
          <AdminToolbarAction onClick={reload} disabled={loading || saving}>
            {loading ? 'Loading…' : 'Refresh'}
          </AdminToolbarAction>
        </>
      }
      status={{
        content: saving
          ? 'Saving site identity…'
          : dirty
            ? 'Site identity edits are not saved yet.'
            : 'Site identity is up to date.',
      }}
      footerActions={
        dirty || saving ? (
          <>
            <AdminToolbarAction variant="quiet" disabled={saving} onClick={discard}>Discard changes</AdminToolbarAction>
            <AdminToolbarAction variant="primary" icon={Save} disabled={loading || saving} onClick={() => void saveIdentity()}>
              {saving ? 'Saving…' : 'Save site identity'}
            </AdminToolbarAction>
          </>
        ) : null
      }
      bodyScroll="auto"
    >
      {loading && !data ? (
        <div className="p-4"><PageLoading rows={6} /></div>
      ) : error && !data ? (
        <div className="p-4"><AdminErrorState message={error} onRetry={() => void load()} /></div>
      ) : (
        data && (
          <div className="flex min-w-0 flex-col gap-4 p-4">

            {error && <Callout tone="error">{error}</Callout>}
            {notice && <Callout tone="success">{notice}</Callout>}

            <div hidden={activeTab !== 'status'} role="tabpanel" aria-label="System status">
              <Section icon={<Activity size={16} />} title="System status" description="Where content is stored and how the runtime behaves when the database is unavailable.">
                <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-3">
                  <StatusCard
                    icon={<Database size={20} />}
                    title={data.database.provider}
                    detail={data.database.connected ? 'Connected · authoritative content store' : 'Not connected'}
                    ok={data.database.connected}
                  />
                  <StatusCard icon={<Server size={20} />} title="Unified fallback gateway" detail={data.fallback.gateway} ok />
                  <StatusCard
                    icon={<Activity size={20} />}
                    title="Runtime fallback"
                    detail={data.fallback.runtimeMode === 'enabled' ? 'Enabled — check production configuration' : 'Disabled — database-first runtime'}
                    ok={data.fallback.runtimeMode !== 'enabled'}
                  />
                </div>
                <p className="m-0 flex items-start gap-2 text-xs leading-snug text-muted-foreground">
                  <Workflow size={15} className="mt-0.5 shrink-0" />
                  <span>
                    All editable content should be stored in PostgreSQL. The bundled <code>data/</code> catalogue is reserved for repeatable bootstrap, build preview and controlled recovery through the fallback gateway; it is not an independent runtime content provider.
                  </span>
                </p>
              </Section>
            </div>

            <div hidden={activeTab !== 'domains'} role="tabpanel" aria-label="Content domains">
              <Section icon={<Table2 size={16} />} title="Database-managed domains" description="Record counts are read directly from PostgreSQL. Open a domain editor to change its content; the public website reads the saved records through the unified gateway.">
                <AdminTable<DomainStatus>
                  rows={data.domains}
                  columns={domainColumns}
                  getRowId={(domain) => domain.id}
                  caption="Database content domains"
                  emptyMessage="No content domains were returned by the database pipeline."
                  height="min(60dvh, 560px)"
                  footerSummary={`${data.domains.length.toLocaleString()} data domains · Table names identify the database collections backing each editor`}
                />
              </Section>
            </div>

            <div hidden={activeTab !== 'identity'} role="tabpanel" aria-label="Site identity">
              <Section icon={<Settings2 size={16} />} title="Site identity editor" description="These fields control the organization identity used by SEO metadata and structured data. The logo is synchronized with the shared header and favicon; the visible brand name and descriptor can also be edited in Portfolio.">
                <div className={FORM_GRID}>
                  <Field label="Organization / SEO name"><Input value={identity.name} onChange={(event) => patch('name', event.target.value)} /></Field>
                  <Field label="Alternate name / বাংলা নাম"><Input value={identity.alternateName} onChange={(event) => patch('alternateName', event.target.value)} /></Field>
                  <Field label="Canonical website URL" className={SPAN_2}><Input type="url" value={identity.canonicalUrl} onChange={(event) => patch('canonicalUrl', event.target.value)} /></Field>
                  <Field label="Default SEO title" className={SPAN_2}><Input value={identity.title} onChange={(event) => patch('title', event.target.value)} /></Field>
                  <Field label="Default meta description" className={SPAN_2}><Textarea rows={3} value={identity.description} onChange={(event) => patch('description', event.target.value)} /></Field>
                  <Field label="SEO keywords (one per line)" className={SPAN_2}><Textarea rows={3} value={identity.keywords.join('\n')} onChange={(event) => patch('keywords', event.target.value.split('\n'))} /></Field>
                  <Field label="Founding date / year"><Input value={identity.foundingDate} onChange={(event) => patch('foundingDate', event.target.value)} /></Field>
                  <Field label="Logo URL"><Input value={identity.logo} onChange={(event) => patch('logo', event.target.value)} /></Field>
                  <Field label="Open Graph image URL" className={SPAN_2}><Input value={identity.ogImage} onChange={(event) => patch('ogImage', event.target.value)} /></Field>
                </div>

                {data.fallback.identitySource === 'fallback' && (
                  <Callout tone="warning" icon={<AlertTriangle size={15} />}>
                    Site identity is currently displayed from bootstrap defaults because the database does not yet contain <code>siteIdentity</code>. Save this form to create the database-managed identity record.
                  </Callout>
                )}
                <p className="m-0 text-xs text-muted-foreground">
                  {data.identityUpdatedAt ? `Global settings last updated: ${new Date(data.identityUpdatedAt).toLocaleString()}` : 'Global settings have not been seeded yet.'}
                </p>
              </Section>
            </div>

            <div hidden={activeTab !== 'editors'} role="tabpanel" aria-label="CMS editors">
              <Section icon={<PanelsTopLeft size={16} />} title="Content editing pipeline" description="Each CMS domain has a dedicated editor. These are the control points for updating live website data without code changes.">
                <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
                  {EDITOR_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex min-h-11 items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-primary no-underline hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        )
      )}
    </AdminDataContainer>
  )
}