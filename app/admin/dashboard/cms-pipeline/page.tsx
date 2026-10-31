'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Save, Server, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageLoading, SectionToolbar } from '../_components/AdminCommon'
import type { SiteIdentity } from '@/types/site'

type DomainStatus = { id: string; label: string; table: string; records: number | null; state: string; href: string }
type PipelineData = {
  database: { provider: string; connected: boolean }
  fallback: { gateway: string; runtimeMode: string; identitySource: string }
  identity: SiteIdentity
  identityUpdatedAt: string | null
  domains: DomainStatus[]
}

const emptyIdentity: SiteIdentity = { name: '', alternateName: '', canonicalUrl: '', title: '', description: '', keywords: [], foundingDate: '', logo: '', ogImage: '' }

export default function CmsPipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null)
  const [identity, setIdentity] = useState<SiteIdentity>(emptyIdentity)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/admin/cms-pipeline', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to inspect the CMS pipeline.')
      setData(payload)
      setIdentity({ ...emptyIdentity, ...payload.identity })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load CMS pipeline.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  function patch<K extends keyof SiteIdentity>(key: K, value: SiteIdentity[K]) {
    setIdentity((current) => ({ ...current, [key]: value }))
  }

  async function saveIdentity() {
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/admin/cms-pipeline', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteIdentity: { ...identity, keywords: identity.keywords.map((item) => item.trim()).filter(Boolean) } }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to save site identity.')
      setIdentity(payload.siteIdentity)
      setNotice('Site identity saved to Neon PostgreSQL. Metadata and structured data have been revalidated.')
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save site identity.') }
    finally { setSaving(false) }
  }

  return <>
    <SectionToolbar title="CMS Data Pipeline" description="Monitor the database-backed content domains, manage global site identity, and use the existing editors to change every published part of the website." onRefresh={() => void load()} refreshing={loading} />
    {loading && !data ? <PageLoading rows={6} /> : error && !data ? <div className="admin-error-state" role="alert">{error}<Button variant="outline" onClick={() => void load()}>Retry</Button></div> : data && <div className="cms-pipeline-layout">
      <div className="cms-pipeline-status-grid">
        <Card><CardContent className="cms-pipeline-status"><Database size={20}/><div><strong>{data.database.provider}</strong><span>{data.database.connected ? 'Connected · authoritative content store' : 'Not connected'}</span></div><CheckCircle2 className="cms-pipeline-good" size={19}/></CardContent></Card>
        <Card><CardContent className="cms-pipeline-status"><Server size={20}/><div><strong>Unified fallback gateway</strong><span>{data.fallback.gateway}</span></div><CheckCircle2 className="cms-pipeline-good" size={19}/></CardContent></Card>
        <Card><CardContent className="cms-pipeline-status"><Activity size={20}/><div><strong>Runtime fallback</strong><span>{data.fallback.runtimeMode === 'enabled' ? 'Enabled — check production configuration' : 'Disabled — database-first runtime'}</span></div>{data.fallback.runtimeMode === 'enabled' ? <AlertTriangle className="cms-pipeline-warn" size={19}/> : <CheckCircle2 className="cms-pipeline-good" size={19}/>}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Database-managed domains</CardTitle><CardDescription>Record counts are read directly from PostgreSQL. Use each domain editor to change its content; the public website reads the saved database records through the unified gateway.</CardDescription></CardHeader>
        <CardContent><div className="cms-pipeline-domains">
          {data.domains.map((domain) => <Link href={domain.href} key={domain.id} className="cms-pipeline-domain">
            <div><strong>{domain.label}</strong><small>{domain.table}</small></div>
            <span className={domain.state === 'empty' || domain.state === 'unavailable' || domain.state === 'fallback' ? 'is-warning' : 'is-ready'}>{domain.records === null ? 'Unavailable' : `${domain.records.toLocaleString()} records`}</span>
          </Link>)}
        </div></CardContent>
      </Card>

      <Card>
        <CardHeader><div className="cms-pipeline-editor-head"><div><CardTitle>Site identity editor</CardTitle><CardDescription>These fields control the organization identity used by SEO metadata and structured data. The logo is synchronized with the shared header and favicon; the visible brand name and descriptor can also be edited in Portfolio.</CardDescription></div><Button onClick={() => void saveIdentity()} disabled={saving || loading}><Save size={15}/>{saving ? 'Saving…' : 'Save identity'}</Button></div></CardHeader>
        <CardContent><div className="cms-pipeline-form">
          <label><span>Organization / SEO name</span><Input value={identity.name} onChange={(event) => patch('name', event.target.value)} /></label>
          <label><span>Alternate name / বাংলা নাম</span><Input value={identity.alternateName} onChange={(event) => patch('alternateName', event.target.value)} /></label>
          <label className="cms-pipeline-span"><span>Canonical website URL</span><Input type="url" value={identity.canonicalUrl} onChange={(event) => patch('canonicalUrl', event.target.value)} /></label>
          <label className="cms-pipeline-span"><span>Default SEO title</span><Input value={identity.title} onChange={(event) => patch('title', event.target.value)} /></label>
          <label className="cms-pipeline-span"><span>Default meta description</span><textarea className="ui-textarea" rows={3} value={identity.description} onChange={(event) => patch('description', event.target.value)} /></label>
          <label className="cms-pipeline-span"><span>SEO keywords (one per line)</span><textarea className="ui-textarea" rows={3} value={identity.keywords.join('\n')} onChange={(event) => patch('keywords', event.target.value.split('\n'))} /></label>
          <label><span>Founding date / year</span><Input value={identity.foundingDate} onChange={(event) => patch('foundingDate', event.target.value)} /></label>
          <label><span>Logo URL</span><Input value={identity.logo} onChange={(event) => patch('logo', event.target.value)} /></label>
          <label className="cms-pipeline-span"><span>Open Graph image URL</span><Input value={identity.ogImage} onChange={(event) => patch('ogImage', event.target.value)} /></label>
        </div>
        {data.fallback.identitySource === 'fallback' && <p className="cms-pipeline-note"><AlertTriangle size={15}/> Site identity is currently displayed from bootstrap defaults because the database does not yet contain `siteIdentity`. Save this form to create the database-managed identity record.</p>}
        {notice && <p className="cms-pipeline-success" role="status">{notice}</p>}
        {error && <p className="cms-pipeline-error" role="alert">{error}</p>}
        <p className="cms-pipeline-meta">{data.identityUpdatedAt ? `Global settings last updated: ${new Date(data.identityUpdatedAt).toLocaleString()}` : 'Global settings have not been seeded yet.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Content editing pipeline</CardTitle><CardDescription>Each CMS domain has a dedicated editor. These are the control points for updating live website data without code changes.</CardDescription></CardHeader>
        <CardContent><div className="cms-pipeline-links">
          <Link href="/admin/dashboard/page-builder?slug=%2F">Landing page sections</Link>
          <Link href="/admin/dashboard/page-builder">Slug pages and sectional layouts</Link>
          <Link href="/admin/dashboard/navigation">Navigation and submenu management</Link>
          <Link href="/admin/dashboard/site-content">Projects, news, notices, reports and content collections</Link>
          <Link href="/admin/dashboard/website-essentials">Staff, locations, documents and contact essentials</Link>
          <Link href="/admin/dashboard/jobs">Job postings and application workflows</Link>
        </div></CardContent>
      </Card>

      <p className="cms-pipeline-footnote"><Workflow size={15}/> All editable content should be stored in PostgreSQL. The bundled `data/` catalogue is reserved for repeatable bootstrap, build preview and controlled recovery through the fallback gateway; it is not an independent runtime content provider.</p>
    </div>}
  </>
}
