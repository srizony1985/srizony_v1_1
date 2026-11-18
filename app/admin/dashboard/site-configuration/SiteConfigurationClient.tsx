'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Database, FileJson, Globe, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  AdminDataContainer,
  AdminDataGroup,
  AdminWorkspaceGrid,
  AdminToolbar,
  AdminToolbarAction,
  AdminToolbarBadge,
} from '@/components/admin/cms'
import { AdminErrorState, AdminSectionTabs } from '../_components/AdminCommon'

type Site = {
  id: number; siteKey: string; name: string; primaryDomain: string | null; baseUrl: string | null
  defaultLocale: string; supportedLocales: string[]; identity: Record<string, unknown>; settings: Record<string, unknown>
}
type Registry = { contentTypes: Array<Record<string, unknown>>; fields: Array<Record<string, unknown>>; pipelines: Array<Record<string, unknown>> }

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

const FORM_GRID = 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm [&_:disabled]:cursor-not-allowed [&_:disabled]:opacity-70">
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
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

function InlineAlert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-success/30 bg-success/10 text-success',
      )}
    >
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function SiteConfigurationClient({ role }: { role: string }) {
  const [site, setSite] = useState<Site | null>(null)
  const [registry, setRegistry] = useState<Registry>({ contentTypes: [], fields: [], pipelines: [] })
  const [identityJson, setIdentityJson] = useState('{}')
  const [settingsJson, setSettingsJson] = useState('{}')
  const [locales, setLocales] = useState('en')
  const [activeTab, setActiveTab] = useState('identity')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [baseline, setBaseline] = useState('')
  const readOnly = !['admin'].includes(role)

  /** Applies a server site record to every piece of local form state and resets the baseline. */
  const applySite = useCallback((next: Site) => {
    const nextIdentity = JSON.stringify(next.identity || {}, null, 2)
    const nextSettings = JSON.stringify(next.settings || {}, null, 2)
    const nextLocales = (next.supportedLocales || []).join(', ')
    setSite(next)
    setIdentityJson(nextIdentity)
    setSettingsJson(nextSettings)
    setLocales(nextLocales)
    setBaseline(JSON.stringify({ site: next, identityJson: nextIdentity, settingsJson: nextSettings, locales: nextLocales }))
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/site-config', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to load site configuration.')
      setRegistry({ contentTypes: payload.contentTypes || [], fields: payload.fields || [], pipelines: payload.pipelines || [] })
      applySite(payload.site)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load site configuration.') }
    finally { setLoading(false) }
  }, [applySite])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const dirty = useMemo(
    () => Boolean(site) && Boolean(baseline) && baseline !== JSON.stringify({ site, identityJson, settingsJson, locales }),
    [site, baseline, identityJson, settingsJson, locales],
  )

  async function save() {
    if (!site) return
    setSaving(true); setError(''); setNotice('')
    try {
      const identity = JSON.parse(identityJson)
      const settings = JSON.parse(settingsJson)
      if (!identity || Array.isArray(identity) || typeof identity !== 'object') throw new Error('Identity JSON must be an object.')
      if (!settings || Array.isArray(settings) || typeof settings !== 'object') throw new Error('Settings JSON must be an object.')
      const response = await fetch('/api/admin/site-config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: site.name, primaryDomain: site.primaryDomain, baseUrl: site.baseUrl, defaultLocale: site.defaultLocale, supportedLocales: locales.split(',').map((value) => value.trim()).filter(Boolean), identity, settings }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Unable to save site configuration.')
      applySite(payload.site)
      setNotice('Website configuration saved.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save site configuration.'
      setError(message)
      // Point the person at the editor that contains the problem.
      if (/JSON/i.test(message)) setActiveTab('json')
    }
    finally { setSaving(false) }
  }

  function reload() {
    if (dirty && !window.confirm('You have unsaved configuration changes. Reload and discard them?')) return
    void load()
  }

  const patchSite = (patch: Partial<Site>) => setSite((current) => (current ? { ...current, ...patch } : current))

  const tabs = (
    <AdminSectionTabs
      label="Site configuration sections"
      value={activeTab}
      onChange={setActiveTab}
      items={[
        { value: 'identity', label: 'Website identity', icon: <Globe size={15} /> },
        { value: 'json', label: 'Identity & settings JSON', icon: <FileJson size={15} /> },
        { value: 'registry', label: 'CMS registry', icon: <Database size={15} />, count: registry.contentTypes.length },
      ]}
    />
  )

  return (
    <AdminWorkspaceGrid layout="single" ariaLabel="Website configuration">
    <AdminDataContainer
      label="Website configuration workspace"
      headerContent={
        <AdminToolbar
          title="Configuration sections"
          tabs={tabs}
        />}
      actions={
        <>
          {readOnly && <AdminToolbarBadge tone="info">Read-only</AdminToolbarBadge>}
          {dirty && <AdminToolbarBadge tone="warning">Unsaved changes</AdminToolbarBadge>}
          <AdminToolbarAction onClick={reload} disabled={loading || saving}>
            {loading ? 'Loading…' : 'Reload'}
          </AdminToolbarAction>
        </>
      }
      status={{
        content: readOnly
          ? 'Read-only for this account role'
          : saving
            ? 'Saving configuration…'
            : dirty
              ? 'Configuration edits are not saved yet.'
              : notice || 'Configuration loaded',
      }}
      instructions="Keep credentials and private keys out of website identity and settings JSON."
      footerActions={
        !readOnly && (dirty || saving) ? (
          <>
            <AdminToolbarAction
              variant="quiet"
              disabled={loading || saving}
              onClick={() => {
                if (window.confirm('Discard all unsaved changes and reload the saved configuration?')) void load()
              }}
            >
              Discard changes
            </AdminToolbarAction>
            <AdminToolbarAction variant="primary" icon={Save} disabled={loading || saving || !site} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save configuration'}
            </AdminToolbarAction>
          </>
        ) : null
      }
      bodyScroll="auto"
    >
      {loading && !site ? (
        <p className="m-0 p-4 text-sm text-muted-foreground">Loading website configuration…</p>
      ) : error && !site ? (
        <div className="p-4"><AdminErrorState message={error} onRetry={() => void load()} /></div>
      ) : (
        site && (
          <div className="flex min-w-0 flex-col gap-4 p-4">

            {error && <InlineAlert tone="error">{error}</InlineAlert>}
            {notice && <InlineAlert tone="success">{notice}</InlineAlert>}

            <div role="tabpanel" aria-label="Website identity" hidden={activeTab !== 'identity'}>
              <Section icon={<Globe size={16} />} title="Website identity" description="Set the deployment identity and the locales available to public pages.">
                <div className={FORM_GRID}>
                  <Field label="Site key"><Input value={site.siteKey} disabled readOnly /></Field>
                  <Field label="Website name"><Input value={site.name} onChange={(event) => patchSite({ name: event.target.value })} disabled={readOnly} /></Field>
                  <Field label="Primary domain"><Input value={site.primaryDomain || ''} onChange={(event) => patchSite({ primaryDomain: event.target.value || null })} placeholder="example.org" disabled={readOnly} /></Field>
                  <Field label="Base URL"><Input type="url" value={site.baseUrl || ''} onChange={(event) => patchSite({ baseUrl: event.target.value || null })} placeholder="https://example.org" disabled={readOnly} /></Field>
                  <Field label="Default locale"><Input value={site.defaultLocale} onChange={(event) => patchSite({ defaultLocale: event.target.value })} placeholder="en" disabled={readOnly} /></Field>
                  <Field label="Supported locales (comma separated)"><Input value={locales} onChange={(event) => setLocales(event.target.value)} placeholder="en, bn" disabled={readOnly} /></Field>
                </div>
              </Section>
            </div>

            <div role="tabpanel" aria-label="Website JSON configuration" hidden={activeTab !== 'json'}>
              <Section icon={<FileJson size={16} />} title="Identity & settings JSON" description="Advanced values for site modules. Both must be JSON objects, and neither should contain secrets.">
                <div className={FORM_GRID}>
                  <Field label="Website identity JSON">
                    <Textarea className="min-h-72 resize-y font-mono text-sm leading-snug" aria-label="Website identity JSON" spellCheck={false} value={identityJson} onChange={(event) => setIdentityJson(event.target.value)} disabled={readOnly} rows={14} />
                    <small className="text-xs font-normal text-muted-foreground">Logo, contact details, social links and other site-specific identity values.</small>
                  </Field>
                  <Field label="Website settings JSON">
                    <Textarea className="min-h-72 resize-y font-mono text-sm leading-snug" aria-label="Website settings JSON" spellCheck={false} value={settingsJson} onChange={(event) => setSettingsJson(event.target.value)} disabled={readOnly} rows={14} />
                    <small className="text-xs font-normal text-muted-foreground">Site-level options consumed by configured site modules.</small>
                  </Field>
                </div>
              </Section>
            </div>

            <div role="tabpanel" aria-label="Database-managed CMS registry" hidden={activeTab !== 'registry'}>
              <AdminDataGroup title="Database-managed CMS registry" description="Configurable content types, field definitions and data pipelines for this website." count={`${registry.contentTypes.length} content types`}>
                <div className="grid min-w-0 gap-6">
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { value: registry.contentTypes.length, label: 'Content types' },
                      { value: registry.fields.length, label: 'Field definitions' },
                      { value: registry.pipelines.length, label: 'Data pipelines' },
                    ].map((stat) => (
                      <div key={stat.label} className="grid gap-0.5 rounded-lg border border-border p-3.5">
                        <strong className="text-2xl tabular-nums">{stat.value}</strong>
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {registry.contentTypes.map((item, index) => (
                      <div key={String(item.component_key || index)} className="flex items-center justify-between gap-2.5 rounded-lg border border-border p-3">
                        <span className="grid min-w-0 gap-0.5">
                          <strong className="text-sm">{String(item.plural_label || item.label || item.component_key)}</strong>
                          <small className="break-words text-xs text-muted-foreground">{String(item.collection_path || 'No collection route configured')}</small>
                        </span>
                        <Badge variant="outline">{String(item.component_key)}</Badge>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2">
                    <h4 className="m-0 text-base font-semibold">Data pipelines</h4>
                    {registry.pipelines.map((item, index) => (
                      <div key={String(item.domain_key || index)} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-border px-3 py-2.5 md:grid-cols-[minmax(100px,.5fr)_minmax(110px,.8fr)_auto]">
                        <strong className="text-sm">{String(item.domain_key)}</strong>
                        <span className="col-span-2 text-sm md:col-span-1">{String(item.source_table)}</span>
                        <Badge variant={item.enabled ? 'default' : 'outline'}>{item.enabled ? 'Enabled' : 'Disabled'}</Badge>
                        <small className="col-span-full text-xs text-muted-foreground">{String(item.read_strategy)} read · {String(item.write_strategy)} write · {String(item.fallback_strategy)}</small>
                      </div>
                    ))}
                    {!registry.pipelines.length && <p className="m-0 text-sm text-muted-foreground">No data pipelines are configured.</p>}
                  </div>
                </div>
              </AdminDataGroup>
            </div>
          </div>
        )
      )}
    </AdminDataContainer>
    </AdminWorkspaceGrid>
  )
}