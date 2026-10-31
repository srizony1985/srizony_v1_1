'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CirclePlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { listContent } from '@/lib/api/siteContent'
import { COMPONENTS, DEFAULT_CONTENT_PARENT, FIXED_CONTENT_PARENT, type ContentComponent, type ContentRecord } from '@/lib/cms/components'
import { buildContentRoute } from '@/lib/cms/routes'
import { AdminErrorState, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import { ContentEditor } from '../_components/ContentEditor'

const MANAGED: ContentComponent[] = ['project', 'news', 'enterprise', 'partner-agency', 'health-service', 'loan-product', 'notice', 'product', 'team', 'report', 'job', 'success-story', 'stat']

export default function SiteContentPage() {
  const params = useSearchParams()
  const requestedComponent = params.get('component') as ContentComponent | null
  const requestedPage = params.get('page') || undefined
  const initialComponent = requestedComponent && MANAGED.includes(requestedComponent) ? requestedComponent : 'project'
  const [component, setComponent] = useState<ContentComponent>(initialComponent)
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const { data, setData, loading, error, reload } = useAdminFetch<ContentRecord[]>(() => listContent(component), [component])
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null)

  useEffect(() => { setSelectedId(null) }, [component, requestedPage])
  const contentPage = FIXED_CONTENT_PARENT[component] || requestedPage
  const items = useMemo(() => (data ?? []).filter((r) => {
    const assignedToPage = !contentPage || String(FIXED_CONTENT_PARENT[r.component] || r.values.routeParent || DEFAULT_CONTENT_PARENT[r.component]) === contentPage
    const matchesSearch = !deferred.trim() || `${r.slug} ${r.values.title_en} ${r.values.title_bn}`.toLowerCase().includes(deferred.trim().toLowerCase())
    return assignedToPage && matchesSearch
  }), [data, deferred, contentPage])
  const selected = typeof selectedId === 'number' ? data?.find((r) => r.id === selectedId) ?? null : null

  function upsert(record: ContentRecord) { setData((cur) => { const list = cur ?? []; return list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list] }); setSelectedId(record.id) }

  return <>
    <SectionToolbar
      title="Site Content"
      description="Choose a content component, then add, modify or remove its entries through forms."
      search={search} onSearch={setSearch} searchPlaceholder="Search by title or slug…"
      count={data?.length ?? 0} onRefresh={() => void reload()} refreshing={loading}
      actions={<Button onClick={() => setSelectedId('new')}><CirclePlus size={15} /> Add {COMPONENTS[component].label.toLowerCase()}</Button>}
      filters={<select className="ui-select admin-filter-select" value={component} onChange={(e) => setComponent(e.target.value as ContentComponent)} aria-label="Content component">{MANAGED.map((c) => <option key={c} value={c}>{COMPONENTS[c].plural}</option>)}</select>}
    />
    {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : (
      <div className="cms-split">
        <aside className="cms-list" aria-label={`${COMPONENTS[component].plural} list`}>
          {items.map((r) => {
            const parent = FIXED_CONTENT_PARENT[r.component] || r.values.routeParent || DEFAULT_CONTENT_PARENT[r.component]
            const route = buildContentRoute(parent, r.slug)
            return <button key={r.id} type="button" className={`cms-list-item ${selectedId === r.id ? 'active' : ''}`} onClick={() => setSelectedId(r.id)}>
              <strong>{r.values.title_en || r.slug}</strong><small>{r.slug}</small><small className="cms-list-route">{route}</small><Badge variant={r.status === 'published' ? 'default' : 'outline'}>{r.status}</Badge>
            </button>
          })}
          {!items.length && <div className="admin-empty-state">No {COMPONENTS[component].plural.toLowerCase()} found.</div>}
        </aside>
        <section>
          {selectedId === 'new' ? <ContentEditor key={`new-${component}-${contentPage || ''}`} component={component} record={null} defaultRouteParent={contentPage} onSaved={upsert} onDeleted={() => undefined} onClose={() => setSelectedId(null)} />
            : selected ? <ContentEditor key={selected.id} component={component} record={selected} onSaved={upsert} onDeleted={(id) => { setData((cur) => (cur ?? []).filter((r) => r.id !== id)); setSelectedId(null) }} />
            : <div className="admin-empty-state">Select an entry to view or edit it, or add a new {COMPONENTS[component].label.toLowerCase()}.</div>}
        </section>
      </div>
    )}
  </>
}
