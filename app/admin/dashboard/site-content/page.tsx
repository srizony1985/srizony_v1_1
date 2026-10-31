'use client'

import './site-content.css'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckSquare, CirclePlus, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { deleteContent, deleteContentItems, hideContentItems, listContent, setContentVisibility } from '@/lib/api/siteContent'
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<number | null>(null)
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSelectedId(null)
    setSelectedIds(new Set())
  }, [component, requestedPage, deferred])

  const contentPage = FIXED_CONTENT_PARENT[component] || requestedPage
  const items = useMemo(() => (data ?? []).filter((r) => {
    const assignedToPage = !contentPage || String(FIXED_CONTENT_PARENT[r.component] || r.values.routeParent || DEFAULT_CONTENT_PARENT[r.component]) === contentPage
    const matchesSearch = !deferred.trim() || `${r.slug} ${r.values.title_en} ${r.values.title_bn}`.toLowerCase().includes(deferred.trim().toLowerCase())
    return assignedToPage && matchesSearch
  }), [data, deferred, contentPage])
  const selected = typeof selectedId === 'number' ? data?.find((r) => r.id === selectedId) ?? null : null
  const visibleIds = useMemo(() => items.map((item) => item.id), [items])
  const selectedVisibleIds = useMemo(() => visibleIds.filter((id) => selectedIds.has(id)), [visibleIds, selectedIds])
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length
  const someVisibleSelected = selectedVisibleIds.length > 0 && !allVisibleSelected

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  function upsert(record: ContentRecord) {
    setData((cur) => {
      const list = cur ?? []
      return list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list]
    })
    setSelectedId(record.id)
  }

  function toggleRow(id: number, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const id of visibleIds) checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  async function changeVisibility(record: ContentRecord) {
    setRowBusyId(record.id)
    const nextStatus = record.status === 'hidden' ? 'published' : 'hidden'
    try {
      const updated = await setContentVisibility(record.id, nextStatus)
      setData((current) => (current ?? []).map((item) => item.id === updated.id ? updated : item))
      toast.success(updated.status === 'published' ? 'Content is visible on the site.' : 'Content hidden from the site.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to change content visibility.')
    } finally {
      setRowBusyId(null)
    }
  }

  async function removeOne(record: ContentRecord) {
    const dependencyWarning = record.component === 'job' ? '\n\nAssociated job applications may also be removed.' : ''
    if (!window.confirm(`Permanently delete “${record.values.title_en || record.slug}”? This cannot be undone.${dependencyWarning}`)) return
    setRowBusyId(record.id)
    try {
      await deleteContent(record.id)
      setData((current) => (current ?? []).filter((item) => item.id !== record.id))
      setSelectedIds((current) => { const next = new Set(current); next.delete(record.id); return next })
      if (selectedId === record.id) setSelectedId(null)
      toast.success('Content deleted permanently.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to delete content.')
    } finally {
      setRowBusyId(null)
    }
  }

  async function hideSelected() {
    const ids = selectedVisibleIds
    if (!ids.length) return
    setBulkBusy(true)
    try {
      const result = await hideContentItems(ids)
      const changed = new Map(result.items.map((item) => [item.id, item]))
      setData((current) => (current ?? []).map((item) => changed.get(item.id) ?? item))
      setSelectedIds((current) => { const next = new Set(current); ids.forEach((id) => next.delete(id)); return next })
      toast.success(`${result.affected} ${result.affected === 1 ? 'item' : 'items'} hidden.`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to hide the selected items.')
    } finally {
      setBulkBusy(false)
    }
  }

  async function deleteSelected() {
    const records = items.filter((item) => selectedIds.has(item.id))
    const ids = records.map((item) => item.id)
    if (!ids.length) return
    const includesJobs = records.some((item) => item.component === 'job')
    const warning = includesJobs ? '\n\nSelected job records may have associated applications that will also be removed.' : ''
    if (!window.confirm(`Permanently delete ${ids.length} selected ${ids.length === 1 ? 'item' : 'items'}? This cannot be undone.${warning}`)) return
    setBulkBusy(true)
    try {
      const result = await deleteContentItems(ids)
      const deleted = new Set(result.ids)
      setData((current) => (current ?? []).filter((item) => !deleted.has(item.id)))
      setSelectedIds((current) => { const next = new Set(current); result.ids.forEach((id) => next.delete(id)); return next })
      if (typeof selectedId === 'number' && deleted.has(selectedId)) setSelectedId(null)
      toast.success(`${result.affected} ${result.affected === 1 ? 'item' : 'items'} deleted.`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to delete the selected items.')
    } finally {
      setBulkBusy(false)
    }
  }

  return <>
    <SectionToolbar
      title="Site Content"
      description="Manage content records in a searchable table. Select individual records or use the header checkbox for bulk actions."
      search={search} onSearch={setSearch} searchPlaceholder="Search by title or slug…"
      count={data?.length ?? 0} onRefresh={() => void reload()} refreshing={loading || bulkBusy}
      actions={<Button onClick={() => setSelectedId('new')}><CirclePlus size={15} /> Add {COMPONENTS[component].label.toLowerCase()}</Button>}
      filters={<select className="ui-select admin-filter-select" value={component} onChange={(e) => setComponent(e.target.value as ContentComponent)} aria-label="Content component">{MANAGED.map((c) => <option key={c} value={c}>{COMPONENTS[c].plural}</option>)}</select>}
    />
    {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : (
      <div className={`site-content-workspace ${selectedId ? 'has-editor' : ''}`}>
        <section className="site-content-table-panel" aria-label={`${COMPONENTS[component].plural} management`}>
          <div className="site-content-table-toolbar">
            <div className="site-content-selection-copy">
              <strong>{items.length.toLocaleString()} {items.length === 1 ? 'record' : 'records'}</strong>
              <span>{selectedVisibleIds.length ? `${selectedVisibleIds.length} selected` : 'Select records to manage them together.'}</span>
            </div>
            {selectedVisibleIds.length > 0 && <div className="site-content-bulk-actions" role="group" aria-label="Bulk content actions">
              <Button size="sm" variant="outline" onClick={() => void hideSelected()} disabled={bulkBusy}><EyeOff size={14} /> Hide selected</Button>
              <Button size="sm" variant="outline" className="site-content-danger-button" onClick={() => void deleteSelected()} disabled={bulkBusy}><Trash2 size={14} /> Delete selected</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} disabled={bulkBusy}>Clear</Button>
            </div>}
          </div>
          <div className="site-content-table-scroll">
            <table className="site-content-table">
              <thead>
                <tr>
                  <th className="site-content-check-cell"><input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAll(event.target.checked)} aria-label="Select all visible content records" disabled={!visibleIds.length || bulkBusy} /></th>
                  <th scope="col">Content title</th>
                  <th scope="col">Slug</th>
                  <th scope="col" className="site-content-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((record) => {
                  const parent = FIXED_CONTENT_PARENT[record.component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[record.component]
                  const route = buildContentRoute(parent, record.slug)
                  const hidden = record.status === 'hidden'
                  const title = record.values.title_en || record.values.title_bn || record.slug
                  const busy = bulkBusy || rowBusyId === record.id
                  return <tr key={record.id} className={`${selectedId === record.id ? 'is-active' : ''} ${selectedIds.has(record.id) ? 'is-selected' : ''}`}>
                    <td className="site-content-check-cell"><input type="checkbox" checked={selectedIds.has(record.id)} onChange={(event) => toggleRow(record.id, event.target.checked)} aria-label={`Select ${title}`} disabled={busy} /></td>
                    <td className="site-content-title-cell">
                      <button type="button" className="site-content-title-button" onClick={() => setSelectedId(record.id)}>{title}</button>
                      <span className="site-content-record-meta"><Badge variant={record.status === 'published' ? 'default' : 'outline'}>{record.status}</Badge><span className="cms-list-route">{route}</span></span>
                    </td>
                    <td><code className="site-content-slug">{record.slug}</code></td>
                    <td className="site-content-row-actions">
                      <Button size="sm" variant="outline" onClick={() => void changeVisibility(record)} disabled={busy} aria-label={`${hidden ? 'Publish' : 'Hide'} ${title}`} title={hidden ? 'Publish this content' : 'Hide this content'}>{hidden ? <><Eye size={14} /><span>Unhide</span></> : <><EyeOff size={14} /><span>Hide</span></>}</Button>
                      <Button size="sm" variant="outline" className="site-content-danger-button" onClick={() => void removeOne(record)} disabled={busy} aria-label={`Delete ${title}`} title="Delete permanently"><Trash2 size={14} /><span>Delete</span></Button>
                    </td>
                  </tr>
                })}
                {!items.length && <tr><td colSpan={4}><div className="site-content-empty">No {COMPONENTS[component].plural.toLowerCase()} found.</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="site-content-table-footnote"><CheckSquare size={13} /> The header checkbox selects all records in the current filtered view. Bulk delete is permanent.</div>
        </section>
        <section className="site-content-editor-panel" aria-label="Content editor">
          {selectedId === 'new' ? <ContentEditor key={`new-${component}-${contentPage || ''}`} component={component} record={null} defaultRouteParent={contentPage} onSaved={upsert} onDeleted={() => undefined} onClose={() => setSelectedId(null)} />
            : selected ? <ContentEditor key={selected.id} component={component} record={selected} onSaved={upsert} onDeleted={(id) => { setData((cur) => (cur ?? []).filter((r) => r.id !== id)); setSelectedId(null) }} />
            : <div className="site-content-editor-empty"><strong>Content editor</strong><span>Select a row title to edit its content, or use Add to create a new record.</span></div>}
        </section>
      </div>
    )}
  </>
}
