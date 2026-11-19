'use client'

import { useMemo, useState } from 'react'
import { Plus, Save, Trash2, TreePine } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AdminDataContainer,
  AdminTable,
  AdminToolbar,
  AdminToolbarAction,
  AdminToolbarBadge,
  AdminWorkspaceGrid,
  type AdminTableColumn,
} from '@/components/admin/cms'
import {
  DEFAULT_GROWTH_MILESTONES,
  normalizeGrowthMilestones,
  pick,
  type L,
  type Milestone,
} from '@/lib/GrowthMilestones'
import { getGrowthTreeAdmin, saveGrowthTreeAdmin } from '@/lib/api/growthTree'
import type { Role } from '@/lib/api/settings'
import { AdminErrorState, PageLoading, useAdminFetch } from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'

const TABLE_MIN_HEIGHT = '260px'
const FIELD = 'grid min-w-0 gap-1.5 text-sm [&>span]:font-semibold [&>span]:text-primary'
const INPUT_GRID = 'grid min-w-0 grid-cols-2 gap-3 max-[760px]:grid-cols-1'
const SECTION = 'grid min-w-0 gap-3 rounded-lg border border-border bg-background p-3'

function valueOf(value: L | undefined, locale: 'en' | 'bn') {
  return value?.[locale] ?? ''
}

export default function GrowthTreeView({ role }: { role: Role }) {
  const { data, loading, error, reload } = useAdminFetch(getGrowthTreeAdmin)
  const sourceMilestones = useMemo(
    () => data?.milestones ? normalizeGrowthMilestones(data.milestones) : DEFAULT_GROWTH_MILESTONES,
    [data],
  )
  const [editState, setEditState] = useState<{
    source: NonNullable<typeof data>['milestones']
    draft: Milestone[]
    baseline: string
  } | null>(null)
  const [selectedYear, setSelectedYear] = useState(1985)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const activeEdit = editState?.source === data?.milestones ? editState : null
  const draft = activeEdit?.draft ?? sourceMilestones
  const baseline = activeEdit?.baseline ?? JSON.stringify(sourceMilestones)

  function setDraft(update: Milestone[] | ((current: Milestone[]) => Milestone[])) {
    setEditState((current) => {
      const active = current?.source === data?.milestones ? current : null
      const currentDraft = active?.draft ?? sourceMilestones
      return {
        source: data?.milestones,
        draft: typeof update === 'function' ? update(currentDraft) : update,
        baseline: active?.baseline ?? JSON.stringify(sourceMilestones),
      }
    })
  }


  const dirty = baseline !== JSON.stringify(draft)
  const readOnly = role === 'analyst' || Boolean(data?.readOnly)
  const selected = draft.find((item) => item.year === selectedYear) ?? draft[0]

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return draft
    return draft.filter((item) => [
      item.year,
      pick(item.title, 'en'),
      pick(item.title, 'bn'),
      pick(item.summary, 'en'),
      pick(item.summary, 'bn'),
    ].join(' ').toLocaleLowerCase().includes(term))
  }, [draft, search])

  function patchSelected(patch: Partial<Milestone>) {
    setDraft((current) => current.map((item) => item.year === selectedYear ? { ...item, ...patch } : item))
  }

  function patchBilingual(field: 'title' | 'summary', locale: 'en' | 'bn', value: string) {
    const next = { ...(selected[field] ?? {}), [locale]: value }
    if (field === 'title') patchSelected({ title: next })
    else patchSelected({ summary: next })
  }

  function patchAchievement(index: number, locale: 'en' | 'bn', value: string) {
    const achievements = [...(selected.achievements ?? [])]
    achievements[index] = { ...(achievements[index] ?? {}), [locale]: value }
    patchSelected({ achievements })
  }

  function patchStat(index: number, patch: Partial<{ label: L; value: string }>) {
    const stats = [...(selected.stats ?? [])]
    const current = stats[index]
    stats[index] = {
      ...(current ?? { label: {} as L, value: '' }),
      ...patch,
    }
    patchSelected({ stats })
  }

  function patchPhoto(patch: Partial<NonNullable<Milestone['photo']>>) {
    patchSelected({ photo: { src: selected.photo?.src ?? '', alt: selected.photo?.alt ?? {}, ...patch } })
  }

  function save(): Promise<void> {
    if (readOnly || !dirty || saving) return Promise.resolve()
    setSaving(true)
    return saveGrowthTreeAdmin(draft)
      .then((payload) => {
        const saved = normalizeGrowthMilestones(payload.milestones ?? draft)
        setEditState({ source: data?.milestones, draft: saved, baseline: JSON.stringify(saved) })
        toast.success(payload.message || 'Growth-tree branch data saved.')
      })
      .finally(() => setSaving(false))
  }

  function refresh() {
    if (dirty && !window.confirm('Reload growth-tree data and discard your unsaved changes?')) return
    setEditState(null)
    void reload()
  }

  useRegisterAdminActions('homepage-growth-tree', {
    save,
    reload: () => {
      setEditState(null)
      setSearch('')
      return reload()
    },
    dirty,
    saving,
    label: 'Homepage growth tree',
  })

  if (loading && !data) return <PageLoading rows={3} />
  if (error || !data) return <AdminErrorState message={error || 'Growth-tree data is unavailable.'} onRetry={() => void reload()} />

  const columns: AdminTableColumn<Milestone>[] = [
    { key: 'year', label: 'Year', accessor: (item) => item.year, render: (item) => <strong>{item.year}</strong>, width: '84px' },
    { key: 'title', label: 'English title', accessor: (item) => pick(item.title, 'en') || '—' },
    { key: 'bn', label: 'বাংলা শিরোনাম', accessor: (item) => pick(item.title, 'bn') || '—' },
    { key: 'featured', label: 'Tree fruit', accessor: (item) => item.featured ? 'Featured' : 'Standard', render: (item) => item.featured ? <Badge variant="default">Featured</Badge> : <Badge variant="outline">Standard</Badge> },
    { key: 'actions', label: 'Edit', sortable: false, exportable: false, render: (item) => <Button size="sm" variant={item.year === selected.year ? 'default' : 'outline'} onClick={() => setSelectedYear(item.year)} aria-label={`Edit ${item.year} branch`}>{item.year === selected.year ? 'Selected' : 'Edit branch'}</Button> },
  ]

  return (
    <div className="admin-page-stack">
      <AdminWorkspaceGrid layout="split" columns="minmax(0, 0.75fr) minmax(0, 1.25fr)" ariaLabel="Homepage growth tree editor">
        <AdminDataContainer
          label="Growth-tree branch editor"
          title={<span className="flex items-center gap-2"><TreePine size={17} /> Homepage growth tree</span>}
          actions={
            <>
              {readOnly && <AdminToolbarBadge tone="warning">Read only</AdminToolbarBadge>}
              {dirty && <AdminToolbarBadge tone="warning">Unsaved changes</AdminToolbarBadge>}
              <AdminToolbarAction icon={Save} variant="primary" onClick={() => { void save().catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to save growth-tree records.')) }} disabled={readOnly || !dirty || saving}>{saving ? 'Saving…' : 'Save branches'}</AdminToolbarAction>
            </>
          }
          status={{ content: data.readOnly ? (data.warning || (data.dataSource === 'google-drive-snapshot' ? 'Showing the latest available Google Drive snapshot. Writes require the primary Neon database.' : 'Showing bootstrap content because the primary database is unavailable. Editing is disabled until Neon is restored.')) : saving ? 'Saving growth-tree content…' : dirty ? 'There are unsaved growth-tree edits.' : 'Growth-tree content is synchronized with the CMS database.' }}
          bodyScroll="auto"
          minHeight={TABLE_MIN_HEIGHT}
        >
          <div className="grid min-w-0 gap-3 p-3">
            <div className={SECTION}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="grid min-w-0 gap-1">
                  <h3 className="m-0 text-base font-semibold text-primary">Branch for {selected.year}</h3>
                  <p className="m-0 text-xs text-muted-foreground">The selected year is a fixed timeline node; update its content below.</p>
                </div>
                <Badge variant={selected.featured ? 'default' : 'outline'}>{selected.featured ? 'Featured branch' : 'Regular branch'}</Badge>
              </div>

              <div className={INPUT_GRID}>
                <label className={FIELD}><span>English title</span><Input value={valueOf(selected.title, 'en')} maxLength={240} onChange={(event) => patchBilingual('title', 'en', event.target.value)} disabled={readOnly || saving} placeholder={`Milestone in ${selected.year}`} /></label>
                <label className={FIELD}><span>বাংলা শিরোনাম</span><Input value={valueOf(selected.title, 'bn')} maxLength={240} onChange={(event) => patchBilingual('title', 'bn', event.target.value)} disabled={readOnly || saving} placeholder="এই বছরের শিরোনাম" /></label>
              </div>

              <div className={INPUT_GRID}>
                <label className={FIELD}><span>English summary</span><Textarea value={valueOf(selected.summary, 'en')} maxLength={1200} rows={3} onChange={(event) => patchBilingual('summary', 'en', event.target.value)} disabled={readOnly || saving} placeholder="Describe the foundation's work or progress for this year." /></label>
                <label className={FIELD}><span>বাংলা বিবরণ</span><Textarea value={valueOf(selected.summary, 'bn')} maxLength={1200} rows={3} onChange={(event) => patchBilingual('summary', 'bn', event.target.value)} disabled={readOnly || saving} placeholder="এই বছরের কাজ বা অগ্রগতির বিবরণ লিখুন।" /></label>
              </div>

              <label className="flex min-w-0 items-center gap-2 text-sm text-primary">
                <Checkbox checked={Boolean(selected.featured)} onChange={(event) => patchSelected({ featured: event.target.checked })} disabled={readOnly || saving} />
                Mark this branch as featured (adds fruit to the tree)
              </label>
            </div>

            <div className={SECTION}>
              <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold text-primary">Key achievements</h3><Button size="sm" variant="outline" disabled={readOnly || saving || (selected.achievements?.length ?? 0) >= 12} onClick={() => patchSelected({ achievements: [...(selected.achievements ?? []), {}] })}><Plus size={14} /> Add achievement</Button></div>
              {(selected.achievements ?? []).map((achievement, index) => (
                <div className="grid min-w-0 gap-2 rounded-md border border-border p-2.5" key={`${selected.year}-achievement-${index}`}>
                  <div className="flex items-center justify-between gap-2"><strong className="text-xs text-muted-foreground">Achievement {index + 1}</strong><Button size="icon" variant="ghost" className="text-destructive" disabled={readOnly || saving} aria-label={`Remove achievement ${index + 1}`} onClick={() => patchSelected({ achievements: (selected.achievements ?? []).filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></Button></div>
                  <div className={INPUT_GRID}>
                    <label className={FIELD}><span>English</span><Input value={valueOf(achievement, 'en')} maxLength={600} onChange={(event) => patchAchievement(index, 'en', event.target.value)} disabled={readOnly || saving} /></label>
                    <label className={FIELD}><span>বাংলা</span><Input value={valueOf(achievement, 'bn')} maxLength={600} onChange={(event) => patchAchievement(index, 'bn', event.target.value)} disabled={readOnly || saving} /></label>
                  </div>
                </div>
              ))}
              {!selected.achievements?.length && <p className="m-0 text-xs text-muted-foreground">No achievements have been added for this year.</p>}
            </div>

            <div className={SECTION}>
              <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold text-primary">Year statistics</h3><Button size="sm" variant="outline" disabled={readOnly || saving || (selected.stats?.length ?? 0) >= 8} onClick={() => patchSelected({ stats: [...(selected.stats ?? []), { label: {}, value: '' }] })}><Plus size={14} /> Add statistic</Button></div>
              {(selected.stats ?? []).map((stat, index) => (
                <div className="grid min-w-0 gap-2 rounded-md border border-border p-2.5" key={`${selected.year}-stat-${index}`}>
                  <div className="flex items-center justify-between gap-2"><strong className="text-xs text-muted-foreground">Statistic {index + 1}</strong><Button size="icon" variant="ghost" className="text-destructive" disabled={readOnly || saving} aria-label={`Remove statistic ${index + 1}`} onClick={() => patchSelected({ stats: (selected.stats ?? []).filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></Button></div>
                  <div className="grid min-w-0 grid-cols-3 gap-2 max-[760px]:grid-cols-1">
                    <label className={FIELD}><span>English label</span><Input value={valueOf(stat.label, 'en')} maxLength={120} onChange={(event) => patchStat(index, { label: { ...stat.label, en: event.target.value } })} disabled={readOnly || saving} /></label>
                    <label className={FIELD}><span>বাংলা লেবেল</span><Input value={valueOf(stat.label, 'bn')} maxLength={120} onChange={(event) => patchStat(index, { label: { ...stat.label, bn: event.target.value } })} disabled={readOnly || saving} /></label>
                    <label className={FIELD}><span>Value</span><Input value={stat.value} maxLength={60} onChange={(event) => patchStat(index, { value: event.target.value })} disabled={readOnly || saving} /></label>
                  </div>
                </div>
              ))}
              {!selected.stats?.length && <p className="m-0 text-xs text-muted-foreground">No statistics have been added for this year.</p>}
            </div>

            <div className={SECTION}>
              <div className="flex items-center justify-between gap-2"><h3 className="m-0 text-sm font-semibold text-primary">Optional photograph</h3>{selected.photo && <Button size="sm" variant="ghost" className="text-destructive" disabled={readOnly || saving} onClick={() => patchSelected({ photo: undefined })}><Trash2 size={14} /> Remove photo</Button>}</div>
              <label className={FIELD}><span>Image path or HTTPS URL</span><Input value={selected.photo?.src ?? ''} maxLength={1000} onChange={(event) => patchPhoto({ src: event.target.value })} disabled={readOnly || saving} placeholder="/images/journey/1985.jpg" /></label>
              <div className={INPUT_GRID}>
                <label className={FIELD}><span>English alternative text</span><Input value={valueOf(selected.photo?.alt, 'en')} maxLength={240} onChange={(event) => patchPhoto({ alt: { ...(selected.photo?.alt ?? {}), en: event.target.value } })} disabled={readOnly || saving} /></label>
                <label className={FIELD}><span>বাংলা বিকল্প টেক্সট</span><Input value={valueOf(selected.photo?.alt, 'bn')} maxLength={240} onChange={(event) => patchPhoto({ alt: { ...(selected.photo?.alt ?? {}), bn: event.target.value } })} disabled={readOnly || saving} /></label>
              </div>
            </div>
          </div>
        </AdminDataContainer>

        <AdminDataContainer
          label="Growth tree branches"
          title="All growth-tree branches"
          description="Select a year to edit its title, story, achievements, statistics and photograph."
          actions={<AdminToolbarBadge tone="info">{draft.length} years</AdminToolbarBadge>}
          bodyScroll="hidden"
          minHeight={TABLE_MIN_HEIGHT}
        >
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2">
            <AdminToolbar title="Growth-tree branches" search={search} onSearch={setSearch} searchPlaceholder="Search year or branch content…" onRefresh={refresh} refreshing={loading} />
            <AdminTable
              rows={filtered}
              columns={columns}
              getRowId={(item) => item.year}
              caption="Homepage growth-tree branch records"
              exportable={false}
              footerSummary={`${filtered.length.toLocaleString()} matching of ${draft.length.toLocaleString()} years`}
              tableClassName="settings-growth-tree-table"
            />
          </div>
        </AdminDataContainer>
      </AdminWorkspaceGrid>
    </div>
  )
}
