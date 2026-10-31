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
    <fieldset className="cms-array-fieldset cms-landing-collection-manager">
      <legend>{copy.title}</legend>
      <p className="admin-small-note">{copy.description}</p>
      <div className="cms-landing-collection-toolbar">
        <div className="cms-landing-collection-counts" aria-live="polite">
          <Badge variant="default">{publishedCount} published</Badge>
          {copy.imageRequired && <Badge variant="outline">{cardReadyCount} ready for gallery</Badge>}
          <span>{records.length} total records</span>
        </div>
        <div className="cms-landing-collection-actions">
          <Button type="button" size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => setEditingRecord(null)}>
            <Plus size={14} /> {copy.add}
          </Button>
        </div>
      </div>

      {loading && !data ? <p className="admin-small-note">Loading database records…</p>
        : error ? <div className="admin-error-state" role="alert"><p>{error}</p><Button type="button" size="sm" variant="outline" onClick={() => void reload()}>Try again</Button></div>
          : <div className="cms-landing-collection-list">
            {records.map((record) => {
              const title = record.values.title_en || record.values.title_bn || record.slug
              const order = record.values.displayOrder?.trim()
              const isReady = !copy.imageRequired || hasManagedImage(record)
              return (
                <div className="cms-landing-collection-row" key={record.id}>
                  <div className="cms-landing-collection-record">
                    <strong>{title}</strong>
                    <small>{copy.route}/{record.slug}</small>
                    <span className="cms-landing-collection-meta">
                      <Badge variant={record.status === 'published' ? 'default' : 'outline'}>{record.status}</Badge>
                      {hasManagedImage(record) ? <span><ImageIcon size={12} /> Approved CMS image</span> : <span><ImageIcon size={12} /> No approved image</span>}
                      {order ? <span><ArrowUpDown size={12} /> Order {order}</span> : <span>Newest first</span>}
                      {copy.imageRequired && !isReady && <span className="cms-landing-collection-warning">Hidden from gallery until an image is added</span>}
                    </span>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingRecord(record)}>
                    <SquarePen size={14} /> Edit
                  </Button>
                </div>
              )
            })}
            {!records.length && <div className="admin-empty-state">{copy.empty}</div>}
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
