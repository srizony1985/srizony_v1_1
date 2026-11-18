'use client'


import { useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckSquare, CirclePlus, Eye, EyeOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { deleteContent, deleteContentItems, hideContentItems, listContent, setContentVisibility } from '@/lib/api/siteContent'
import { COMPONENTS, DEFAULT_CONTENT_PARENT, FIXED_CONTENT_PARENT, type ContentComponent, type ContentRecord } from '@/lib/cms/components'
import { buildContentRoute } from '@/lib/cms/routes'
import { AdminErrorState, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import { ContentEditor } from '../_components/ContentEditor'
import { AdminDataContainer, AdminTable, AdminWorkspaceGrid, type AdminTableColumn } from '@/components/admin/cms'
import { Select } from '@/components/ui/select'

const MANAGED: ContentComponent[] = ['project', 'news', 'enterprise', 'partner-agency', 'health-service', 'loan-product', 'notice', 'product', 'team', 'report', 'job', 'success-story', 'stat']

const FOOTNOTE_CLASS = 'site-content-table-footnote flex items-start gap-1.5 border-t border-border px-3 py-2 text-[0.8125rem] leading-snug text-muted-foreground'

export default function SiteContentPage() {
  const params = useSearchParams()
  const requestedComponent = params.get('component') as ContentComponent | null
  const requestedPage = params.get('page') || undefined
  const initialComponent = requestedComponent && MANAGED.includes(requestedComponent) ? requestedComponent : 'project'
  const [component, setComponent] = useState<ContentComponent>(initialComponent)
  const effectiveComponent = requestedComponent && MANAGED.includes(requestedComponent) ? requestedComponent : component
  const [search, setSearch] = useState('')
  const deferred = useDeferredValue(search)
  const { data, setData, loading, error, reload } = useAdminFetch<ContentRecord[]>(() => listContent(effectiveComponent), [effectiveComponent])
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [editorDirty, setEditorDirty] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rowBusyId, setRowBusyId] = useState<number | null>(null)

  const contentPage = FIXED_CONTENT_PARENT[component] || requestedPage
  const items = useMemo(() => (data ?? []).filter((r) => {
    const assignedToPage = !contentPage || String(FIXED_CONTENT_PARENT[r.component] || r.values.routeParent || DEFAULT_CONTENT_PARENT[r.component]) === contentPage
    const matchesSearch = !deferred.trim() || `${r.slug} ${r.values.title_en} ${r.values.title_bn}`.toLowerCase().includes(deferred.trim().toLowerCase())
    return assignedToPage && matchesSearch
  }), [data, deferred, contentPage])

  const activeSelectedId = useMemo(() => {
    if (selectedId === 'new') return 'new'
    if (selectedId !== null && items.some((item) => item.id === selectedId)) return selectedId
    return null
  }, [items, selectedId])
  const selected = typeof activeSelectedId === 'number' ? data?.find((r) => r.id === activeSelectedId) ?? null : null
  const visibleIds = useMemo(() => items.map((item) => item.id), [items])
  const selectedVisibleIds = useMemo(() => visibleIds.filter((id) => selectedIds.has(id)), [visibleIds, selectedIds])

  function confirmDiscardEditor() {
    if (!editorDirty) return true
    return window.confirm('You have unsaved content changes. Discard them and continue?')
  }

  function selectRecord(id: number | 'new') {
    if (activeSelectedId === id) return
    if (!confirmDiscardEditor()) return
    setEditorDirty(false)
    setSelectedId(id)
  }

  function changeComponent(next: ContentComponent) {
    if (next === component || !confirmDiscardEditor()) return
    setEditorDirty(false)
    setSelectedId(null)
    setComponent(next)
  }

  function upsert(record: ContentRecord) {
    setData((cur) => {
      const list = cur ?? []
      return list.some((r) => r.id === record.id) ? list.map((r) => (r.id === record.id ? record : r)) : [record, ...list]
    })
    setSelectedId(record.id)
  }

  function changeVisibility(record: ContentRecord) {
    setRowBusyId(record.id)
    const nextStatus = record.status === 'hidden' ? 'published' : 'hidden'
    return setContentVisibility(record.id, nextStatus)
      .then((updated) => {
        setData((current) => (current ?? []).map((item) => item.id === updated.id ? updated : item))
        toast.success(updated.status === 'published' ? 'Content is visible on the site.' : 'Content hidden from the site.')
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to change content visibility.'))
      .finally(() => setRowBusyId(null))
  }

  function removeOne(record: ContentRecord) {
    const dependencyWarning = record.component === 'job' ? '\n\nAssociated job applications may also be removed.' : ''
    const editorWarning = activeSelectedId === record.id && editorDirty ? '\n\nUnsaved editor changes will also be discarded.' : ''
    if (!window.confirm(`Permanently delete “${record.values.title_en || record.slug}”? This cannot be undone.${dependencyWarning}${editorWarning}`)) return Promise.resolve()
    setRowBusyId(record.id)
    return deleteContent(record.id)
      .then(() => {
        setData((current) => (current ?? []).filter((item) => item.id !== record.id))
        setSelectedIds((current) => { const next = new Set(current); next.delete(record.id); return next })
        if (activeSelectedId === record.id) { setSelectedId(null); setEditorDirty(false) }
        toast.success('Content deleted permanently.')
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to delete content.'))
      .finally(() => setRowBusyId(null))
  }

  async function hideSelected() {
    const ids = selectedVisibleIds
    if (!ids.length) return
    const affectsDirtyEditor = typeof activeSelectedId === 'number' && ids.includes(activeSelectedId) && editorDirty
    if (affectsDirtyEditor && !window.confirm('The selected records include the content currently being edited. Hiding it will discard your unsaved changes. Continue?')) return
    setBulkBusy(true)
    try {
      const result = await hideContentItems(ids)
      if (affectsDirtyEditor) { setEditorDirty(false); setSelectedId(null) }
      const changed = new Map(result.items.map((item) => [item.id, item]))
      setData((current) => (current ?? []).map((item) => changed.get(item.id) ?? item))
      setSelectedIds((current) => { const next = new Set(current); ids.forEach((id) => next.delete(id)); return next })
      toast.success(`${result.affected} ${result.affected === 1 ? 'item' : 'items'} hidden.`)
    } catch (cause: unknown) {
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
    const editorWarning = typeof activeSelectedId === 'number' && ids.includes(activeSelectedId) && editorDirty ? '\n\nUnsaved editor changes will also be discarded.' : ''
    if (!window.confirm(`Permanently delete ${ids.length} selected ${ids.length === 1 ? 'item' : 'items'}? This cannot be undone.${warning}${editorWarning}`)) return
    setBulkBusy(true)
    try {
      const result = await deleteContentItems(ids)
      const deleted = new Set(result.ids)
      setData((current) => (current ?? []).filter((item) => !deleted.has(item.id)))
      setSelectedIds((current) => { const next = new Set(current); result.ids.forEach((id) => next.delete(id)); return next })
      if (typeof activeSelectedId === 'number' && deleted.has(activeSelectedId)) { setSelectedId(null); setEditorDirty(false) }
      toast.success(`${result.affected} ${result.affected === 1 ? 'item' : 'items'} deleted.`)
    } catch (cause: unknown) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to delete the selected items.')
    } finally {
      setBulkBusy(false)
    }
  }

  return <div className="admin-page-stack min-w-0">
    {loading && !data ? <PageLoading rows={3} /> : error ? <AdminErrorState message={error} onRetry={() => void reload()} /> : (
      <AdminWorkspaceGrid
        layout="split"
        columns="minmax(0, 1.2fr) minmax(0, 1fr)"
        // Table first, editor second. Below 1024px the two panels stack in one column
        // (!important is needed because `columns` may be applied as an inline style).
        className="site-content-workspace min-w-0 max-[1024px]:grid-cols-1! [&>.site-content-editor-panel]:order-2 [&>.site-content-table-panel]:order-1"
        ariaLabel="Site content editor and record list"
      >
        <section className="site-content-editor-panel min-w-0">
          <AdminDataContainer
            label={`${COMPONENTS[component].plural} management`}
            bodyScroll="auto"
            headerContent={
            <SectionToolbar
              title={`${COMPONENTS[component].label} editor`}
              actions={<Button size="sm" onClick={() => selectRecord('new')}><CirclePlus size={15} /> Add {COMPONENTS[component].label.toLowerCase()}</Button>}
            />}
            footer={<div className={FOOTNOTE_CLASS}><CheckSquare size={13} className="mt-0.5 shrink-0" /><span>Press <strong>ADD</strong> to create a new record.</span></div>}
          >
            {selectedId === 'new' ? <ContentEditor key={`new-${component}-${contentPage || ''}`} component={component} record={null} defaultRouteParent={contentPage} onSaved={upsert} onDeleted={() => { setEditorDirty(false); setSelectedId(null) }} onClose={() => { setEditorDirty(false); setSelectedId(null) }} onDirtyChange={setEditorDirty} startReadOnly />
            : selected ? <ContentEditor key={selected.id} component={component} record={selected} onSaved={upsert} onDeleted={(id) => { setData((cur) => (cur ?? []).filter((r) => r.id !== id)); setEditorDirty(false); setSelectedId(null) }} onClose={() => { setEditorDirty(false); setSelectedId(null) }} onDirtyChange={setEditorDirty} startReadOnly />
            : <div className="site-content-editor-empty grid min-h-45 place-content-center gap-1.5 p-6 text-center [&_strong]:text-sm [&_span]:max-w-85 [&_span]:text-xs [&_span]:leading-normal [&_span]:text-muted-foreground"><strong>Content editor</strong><span>Select a row title to edit its content.</span></div>}
          </AdminDataContainer>
        </section>
        <section className="site-content-table-panel min-w-0">
          <AdminDataContainer
            label={`${COMPONENTS[component].plural} management`}
            bodyScroll="auto"
            headerContent={
            <SectionToolbar
              title="Site Content"
              search={search} onSearch={setSearch} searchPlaceholder="Search by title or slug…"
              actions={<>
                <Button size="sm" variant="outline" onClick={() => void hideSelected()} disabled={bulkBusy || selectedVisibleIds.length === 0} title="Hide the selected records">
                  <EyeOff size={14} /><span>{bulkBusy ? 'Hiding…' : `Hide ${selectedVisibleIds.length > 0 ? ` (${selectedVisibleIds.length})` : ''}`}</span>
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void deleteSelected()} disabled={bulkBusy || selectedVisibleIds.length === 0} title="Permanently delete the selected records">
                  <Trash2 size={14} /><span>{bulkBusy ? 'Deleting…' : `Delete ${selectedVisibleIds.length > 0 ? ` (${selectedVisibleIds.length})` : ''}`}</span>
                </Button>
              </>}
              filters={<Select className="admin-filter-select w-full sm:w-auto" value={component} onChange={(e) => changeComponent(e.target.value as ContentComponent)} aria-label="Content component"> {MANAGED.map((c) => <option key={c} value={c}>{COMPONENTS[c].plural}</option>)}</Select>}
            />}
            footer={<div className={FOOTNOTE_CLASS}><CheckSquare size={13} className="mt-0.5 shrink-0" /><span>The header checkbox selects all records in the current filtered view.</span></div>}
          >
          <AdminTable
            rows={items}
            columns={[
              {
                key: 'title', label: 'Content title', accessor: (record) => record.values.title_en || record.values.title_bn || record.slug,
                render: (record) => {
                  const parent = FIXED_CONTENT_PARENT[record.component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[record.component]
                  const route = buildContentRoute(parent, record.slug)
                  const isActive = activeSelectedId === record.id
                  const label = record.values.title_en || record.values.title_bn || record.slug
                  return (
                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        aria-pressed={isActive}
                        aria-current={isActive ? 'true' : undefined}
                        className="h-auto max-w-full justify-start whitespace-normal py-1.5 text-left [overflow-wrap:anywhere]"
                        onClick={() => selectRecord(record.id)}
                      >
                        {label}
                      </Button>
                      <a
                        className="site-content-title-button max-w-full text-sm font-semibold leading-normal text-primary [overflow-wrap:anywhere] hover:text-primary hover:underline hover:underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        href={route}
                        title={route}
                      >
                        <code className="cms-list-route">{route}</code>
                      </a>
                    </div>
                  )
                },
              },
              {
                key: 'visibility', label: 'Visibility', accessor: (record) => record.status,
                render: (record) => <span className={`settings-status-badge min-h-5.5 [padding:2px_8px] [font-size:0.75rem] [font-weight:600] [&.is-active]:[color:var(--success)] [&.is-active]:[border-color:color-mix(in_srgb,var(--success)_35%,var(--border))] [&.is-active]:[background:var(--success-soft)] [&.is-disabled]:[color:var(--muted-foreground)] [&.is-disabled]:[border-color:var(--border)] [&.is-disabled]:[background:var(--muted)] ${record.status === 'hidden' ? 'is-disabled' : 'is-active'}`}>{record.status === 'hidden' ? 'Hidden' : 'Published'}</span>,
              },
              {
                key: 'actions', label: 'Actions', sortable: false, exportable: false, className: 'site-content-row-actions',
                render: (record) => {
                  const hidden = record.status === 'hidden'
                  const title = record.values.title_en || record.values.title_bn || record.slug
                  const busy = bulkBusy || rowBusyId === record.id
                  return <div className="site-content-row-actions__group flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => void changeVisibility(record)} disabled={busy || (activeSelectedId === record.id && editorDirty)} aria-label={`${hidden ? 'Publish' : 'Hide'} ${title}`} title={hidden ? 'Publish this content' : 'Hide this content'}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}</Button>
                    <Button size="sm" variant="outline" className="site-content-danger-button ![color:var(--error,_#c2413b)] ![border-color:color-mix(in_srgb,_var(--error,_#c2413b)_35%,_var(--border,_#dfe3ea))] [&:hover:not(:disabled)]:![background:color-mix(in_srgb,_var(--error,_#c2413b)_8%,_var(--card,_#fff))]" onClick={() => void removeOne(record)} disabled={busy} aria-label={`Delete ${title}`} title="Delete permanently"><Trash2 size={14} /></Button>
                  </div>
                },
              },
            ] as AdminTableColumn<ContentRecord>[]}
            getRowId={(record) => record.id}
            caption={`${COMPONENTS[component].plural} management`}
            emptyMessage={`No ${COMPONENTS[component].plural.toLowerCase()} found.`}
            sortable
            selectable
            selectedIds={[...selectedIds].map(String)}
            onSelectionChange={(ids) => setSelectedIds(new Set(ids.map(Number).filter(Number.isFinite)))}
            // Highlight the row that is open in the editor: tinted background plus a left accent bar.
            tableClassName="site-content-table [&_tr.is-active>td]:bg-primary/10 [&_tr.is-active>td:first-child]:shadow-[inset_3px_0_0_var(--primary)]"
            rowClassName={(record) => (activeSelectedId === record.id ? 'is-active' : '')}
          />
        </AdminDataContainer>
        </section>
      </AdminWorkspaceGrid>
    )}
  </div>
}