'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, Image as ImageIcon, Plus, RefreshCw, SquarePen } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContentEditor } from './ContentEditor'
import { listContent } from '@/lib/api/siteContent'
import { type ContentComponent, type ContentRecord } from '@/lib/cms/components'
import { useAdminFetch } from './AdminCommon'

type LandingCollection = Extract<ContentComponent, 'news' | 'success-story'>

const COPY: Record<LandingCollection, { title: string; add: string; empty: string; description: string; route: string; imageRequired: boolean }> = {
  news: {
    title: 'News Rail cards',
    add: 'Add news card',
    empty: 'No News cards yet. Add the first news item to populate the homepage rail.',
    description: 'Create, edit, publish, hide and delete the actual News records used by the homepage rail. The card image, bilingual title, article content and canonical URL are managed here.',
    route: '/news',
    imageRequired: false,
  },
  'success-story': {
    title: 'Success Stories gallery cards',
    add: 'Add success story card',
    empty: 'No Success Stories yet. Add the first story with an approved image to populate the homepage gallery.',
    description: 'Create, edit, publish, hide and delete the Success Story records used by the homepage gallery. Gallery cards show only the CMS image and bilingual title.',
    route: '/success-stories',
    imageRequired: true,
  },
}

function hasManagedImage(record: ContentRecord) {
  return Boolean(record.values.image && (String(record.values.imageManaged || '').toLowerCase() === 'true' || !record.values.seedSource))
}

function displayOrder(record: ContentRecord) {
  const raw = record.values.displayOrder?.trim()
  return raw && Number.isInteger(Number(raw)) && Number(raw) >= 0 ? Number(raw) : Number.MAX_SAFE_INTEGER
}

/** Inline CMS collection manager embedded in the Homepage Page Builder.
 * It reuses the canonical Site Content editor/API, so landing cards are never
 * stored as a second manual copy inside the page JSON. */
export default function LandingCollectionCardsEditor({ component }: { component: LandingCollection }) {
  const copy = COPY[component]
  const { data, setData, loading, error, reload } = useAdminFetch<ContentRecord[]>(() => listContent(component), [component])
  const [editingRecord, setEditingRecord] = useState<ContentRecord | null | undefined>(undefined)
  const records = useMemo(() => [...(data ?? [])].sort((a, b) => {
    const orderDiff = displayOrder(a) - displayOrder(b)
    if (orderDiff !== 0) return orderDiff
    return b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id
  }), [data])
  const publishedCount = records.filter((record) => record.status === 'published').length
  const cardReadyCount = records.filter((record) => record.status === 'published' && (!copy.imageRequired || hasManagedImage(record))).length

  function upsert(record: ContentRecord) {
    setData((current) => {
      const rows = current ?? []
      return rows.some((item) => item.id === record.id)
        ? rows.map((item) => item.id === record.id ? record : item)
        : [record, ...rows]
    })
    setEditingRecord(undefined)
    void reload()
  }

  function remove(id: number) {
    setData((current) => (current ?? []).filter((record) => record.id !== id))
    setEditingRecord(undefined)
  }

  return (
    <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)] cms-landing-collection-manager [display:grid] [gap:12px] [margin-top:14px] [min-width:0] [padding:14px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--card)_96%,var(--primary))] [&>legend]:[padding-inline:6px] [&>legend]:[font-size:0.875rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--foreground)]">
      <legend>{copy.title}</legend>
      <p className="admin-small-note">{copy.description}</p>
      <div className="cms-landing-collection-toolbar [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [flex-wrap:wrap] max-[560px]:[align-items:flex-start] max-[560px]:[flex-direction:column] max-[560px]:[width:100%]">
        <div className="cms-landing-collection-counts [display:flex] [align-items:center] [gap:8px] [flex-wrap:wrap] [&>span]:[font-size:0.75rem] [&>span]:[color:var(--muted-foreground)]" aria-live="polite">
          <Badge variant="default">{publishedCount} published</Badge>
          {copy.imageRequired && <Badge variant="outline">{cardReadyCount} ready for gallery</Badge>}
          <span>{records.length} total records</span>
        </div>
        <div className="cms-landing-collection-actions [display:flex] [align-items:center] [gap:8px] [flex-wrap:wrap] max-[560px]:[width:100%] max-[560px]:[&>[data-slot=button]]:[flex:1]">
          <Button type="button" size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => setEditingRecord(null)}>
            <Plus size={14} /> {copy.add}
          </Button>
        </div>
      </div>

      {loading && !data ? <p className="admin-small-note">Loading database records…</p>
        : error ? <div className="admin-error-state [padding:20px] [border:1px_solid_color-mix(in_srgb,var(--destructive)_25%,var(--border))] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--destructive)_5%,var(--card))] [color:var(--foreground)] [&_strong]:[display:block] [&_strong]:[font-size:0.875rem] [&_p]:[margin:5px_0_12px] [&_p]:[color:var(--muted-foreground)] [&_p]:[font-size:0.875rem] [display:grid] [gap:5px] [&_[data-slot=button]]:[width:max-content] [&_[data-slot=button]]:[margin-top:4px]" role="alert"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => void reload()}>Try again</Button></div>
          : <div className="cms-landing-collection-list [display:grid] [gap:8px] [min-width:0]">
            {records.map((record) => {
              const title = record.values.title_en || record.values.title_bn || record.slug
              const order = record.values.displayOrder?.trim()
              const isReady = !copy.imageRequired || hasManagedImage(record)
              return (
                <div className="cms-landing-collection-row [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [padding:10px_12px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [min-width:0] max-[560px]:[align-items:flex-start] max-[560px]:[flex-direction:column] max-[560px]:[&>[data-slot=button]]:[align-self:flex-end]" key={record.id}>
                  <div className="cms-landing-collection-record [display:grid] [gap:4px] [min-width:0] [flex:1] [&>strong]:[font-size:0.875rem] [&>strong]:[color:var(--foreground)] [&>strong]:[overflow-wrap:anywhere] [&>small]:[font-size:0.75rem] [&>small]:[color:var(--muted-foreground)] [&>small]:[overflow-wrap:anywhere]">
                    <strong>{title}</strong>
                    <small>{copy.route}/{record.slug}</small>
                    <span className="cms-landing-collection-meta [display:flex] [align-items:center] [gap:8px] [flex-wrap:wrap] [font-size:0.75rem] [color:var(--muted-foreground)] [&>span]:[display:inline-flex] [&>span]:[align-items:center] [&>span]:[gap:3px]">
                      <Badge variant={record.status === 'published' ? 'default' : 'outline'}>{record.status}</Badge>
                      {hasManagedImage(record) ? <span><ImageIcon size={12} /> Approved CMS image</span> : <span><ImageIcon size={12} /> No approved image</span>}
                      {order ? <span><ArrowUpDown size={12} /> Order {order}</span> : <span>Newest first</span>}
                      {copy.imageRequired && !isReady && <span className="cms-landing-collection-warning [color:var(--warning,var(--primary))] [border-left:3px_solid_var(--warning)] [background:color-mix(in_srgb,var(--warning)_8%,var(--card))] [padding:9px_11px] [border-radius:var(--radius,var(--radius))]">Hidden from gallery until an image is added</span>}
                    </span>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingRecord(record)}>
                    <SquarePen size={14} /> Edit
                  </Button>
                </div>
              )
            })}
            {!records.length && <div className="admin-empty-state [padding:22px] [color:var(--muted-foreground)] [text-align:center] [font-size:0.75rem] [min-height:110px] [display:grid] [place-items:center] [padding:20px] [font-size:0.875rem] [border:1px_dashed_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)]">{copy.empty}</div>}
          </div>}

      {editingRecord !== undefined && (
        <ContentEditor
          key={`${component}-${editingRecord?.id ?? 'new'}`}
          component={component}
          record={editingRecord}
          presentation="modal"
          onSaved={upsert}
          onDeleted={remove}
          onClose={() => setEditingRecord(undefined)}
        />
      )}
    </fieldset>
  )
}
