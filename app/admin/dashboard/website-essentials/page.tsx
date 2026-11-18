'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, CirclePlus, FileText, FileUp, MapPin, Save, Share2, Trash2, Users } from 'lucide-react'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClassName } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BRANCHES } from '@/lib/cms/fallback-gateway'
import type { Branch } from '@/types/branch'
import { DEFAULT_WEBSITE_ESSENTIALS, normalizeWebsiteEssentials, type ManagementStaffMember, type WebsiteEssentials } from '@/lib/websiteEssentials'
import { uploadAdminMedia, getWebsiteEssentials, saveWebsiteEssentials } from '@/lib/api/adminResources'
import {
  AdminDataContainer,
  AdminToolbar,
  AdminToolbarAction,
  AdminToolbarBadge,
} from '@/components/admin/cms'
import { AdminErrorState, AdminSectionTabs, PageLoading } from '../_components/AdminCommon'
import { useRegisterAdminActions } from '../_components/AdminActionContext'

/* -------------------------------------------------------------------------- */
/* Helpers & primitives                                                       */
/* -------------------------------------------------------------------------- */

const initial = (): WebsiteEssentials => ({ ...DEFAULT_WEBSITE_ESSENTIALS, staff: [], locations: BRANCHES.map((branch) => ({ ...branch })) })
const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`

const FORM_GRID = 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}</span>
      <Textarea rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

/** A titled block inside a tab. */
function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-4">
      <div className="grid gap-1 border-b border-border pb-3">
        <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-foreground">{icon}{title}</h3>
        <p className="m-0 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function Notice({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-sm',
        tone === 'error'
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-success/30 bg-success/10 text-success',
      )}
    >
      {children}
    </div>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** Collapsible record row: title/badge/actions in the header, fields in the body. */
function RecordItem({
  open,
  onToggle,
  title,
  subtitle,
  badge,
  actions,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 bg-background px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          onClick={onToggle}
          className="h-auto min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-none px-0 py-0 text-left text-foreground hover:bg-transparent"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <strong className="break-words text-sm">{title}</strong>
          {subtitle && <span className="break-words text-xs text-muted-foreground">{subtitle}</span>}
        </Button>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {badge}
          {actions}
        </div>
      </div>
      {open && <div className="grid min-w-0 gap-4 p-4">{children}</div>}
    </div>
  )
}

/** Tracks expanded records by id so add/remove never shifts the wrong row open. */
function useExpandedIds() {
  const [ids, setIds] = useState<string[]>([])
  return {
    isOpen: (id: string) => ids.includes(id),
    toggle: (id: string) => setIds((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id])),
    open: (id: string) => setIds((old) => (old.includes(id) ? old : [...old, id])),
  }
}

/* -------------------------------------------------------------------------- */
/* PDF upload                                                                 */
/* -------------------------------------------------------------------------- */

function PublicPdfField({ title, value, onChange }: { title: string; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function upload(file?: File) {
    if (!file) return Promise.resolve()
    setError(''); setNotice('')
    if (file.type !== 'application/pdf') { setError('Select a PDF document.'); return Promise.resolve() }
    if (!file.size || file.size > 4 * 1024 * 1024) { setError('The PDF must be between 1 byte and 4 MB.'); return Promise.resolve() }
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'document')
    form.append('visibility', 'public')
    setUploading(true)
    return uploadAdminMedia(form)
      .then((result) => {
        onChange(result.src)
        setNotice('PDF uploaded. Select “Save” in the footer to publish the link.')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'PDF upload failed.'))
      .finally(() => setUploading(false))
  }

  return (
    <div className="grid min-w-0 gap-2.5">
      <Field label={`${title} PDF URL`} value={value} onChange={onChange} placeholder="Upload a PDF or paste an HTTPS /api/media link" />
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(buttonClassName('outline', 'sm', uploading ? 'is-disabled' : undefined), 'cursor-pointer', uploading && 'pointer-events-none opacity-60')}>
          <FileUp size={14} />{uploading ? 'Uploading…' : 'Upload public PDF'}
          <input type="file" accept="application/pdf,.pdf" hidden disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
        </label>
        {value && <a className={buttonClassName('outline', 'sm')} href={value} target="_blank" rel="noreferrer">Preview PDF ↗</a>}
      </div>
      <p className="m-0 text-sm text-muted-foreground">Public documents are served through a validated CMS media record. PDF limit: 4 MB.</p>
      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type DocumentKey = 'staffListPdf' | 'locationsPdf'

export default function WebsiteEssentialsPage() {
  const [data, setData] = useState<WebsiteEssentials>(initial)
  const [activeTab, setActiveTab] = useState('social')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [baseline, setBaseline] = useState('')
  const expandedStaff = useExpandedIds()
  const expandedLocations = useExpandedIds()

  const load = useCallback(() => {
    setLoading(true); setError('')
    return getWebsiteEssentials()
      .then(({ data: value, configured }) => {
        const normalized = normalizeWebsiteEssentials(value)
        const next = { ...normalized, locations: configured ? normalized.locations : (normalized.locations.length ? normalized.locations : BRANCHES.map((branch) => ({ ...branch }))) }
        setData(next); setBaseline(JSON.stringify(next))
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load website settings.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let isActive = true
    const run = async () => {
      if (!isActive) return
      await load()
    }
    void run()
    return () => { isActive = false }
  }, [load])

  /* ----------------------------- state updaters ---------------------------- */

  const patchSocial = (network: keyof WebsiteEssentials['socials'], value: string) =>
    setData((current) => ({ ...current, socials: { ...current.socials, [network]: value } }))

  const patchDocument = (key: DocumentKey, patch: Partial<WebsiteEssentials['documents'][DocumentKey]>) =>
    setData((current) => ({ ...current, documents: { ...current.documents, [key]: { ...current.documents[key], ...patch } } }))

  function patchStaff(id: string, patch: Partial<ManagementStaffMember>) {
    setData((current) => ({ ...current, staff: current.staff.map((person) => (person.id === id ? { ...person, ...patch } : person)) }))
  }
  function addStaff() {
    const id = randomId('staff')
    setData((current) => ({ ...current, staff: [...current.staff, { id, nameEn: '', nameBn: '', designationEn: '', designationBn: '', bioEn: '', bioBn: '', photoUrl: '', published: false, sortOrder: current.staff.length }] }))
    expandedStaff.open(id)
  }
  function removeStaff(person: ManagementStaffMember, index: number) {
    if (!window.confirm(`Remove ${person.nameEn || person.nameBn || `staff member ${index + 1}`}? This applies after you save.`)) return
    setData((current) => ({ ...current, staff: current.staff.filter((item) => item.id !== person.id) }))
  }

  function patchLocation(id: string, patch: Partial<Branch>) {
    setData((current) => ({ ...current, locations: current.locations.map((branch) => (branch.id === id ? { ...branch, ...patch } : branch)) }))
  }
  function addLocation() {
    const id = randomId('branch')
    setData((current) => ({ ...current, locations: [...current.locations, { id, kind: 'branch', name: { en: '', bn: '' }, district: { en: '', bn: '' }, division: { en: '', bn: '' }, lat: 23.8103, lng: 90.4125 }] }))
    expandedLocations.open(id)
  }
  function removeLocation(branch: Branch, index: number) {
    if (!window.confirm(`Remove ${branch.name.en || branch.name.bn || `location ${index + 1}`}? This applies after you save.`)) return
    setData((current) => ({ ...current, locations: current.locations.filter((item) => item.id !== branch.id) }))
  }
  function patchBilingualLocation(id: string, field: 'name' | 'district' | 'division', lang: 'en' | 'bn', value: string) {
    setData((current) => ({ ...current, locations: current.locations.map((branch) => (branch.id === id ? { ...branch, [field]: { ...branch[field], [lang]: value } } : branch)) }))
  }
  function patchAddress(branch: Branch, lang: 'en' | 'bn', value: string) {
    patchLocation(branch.id, { address: { en: branch.address?.en || '', bn: branch.address?.bn || '', [lang]: value } })
  }
  function patchManager(branch: Branch, patch: NonNullable<Branch['manager']>) {
    patchLocation(branch.id, { manager: { ...(branch.manager || {}), ...patch } })
  }
  function patchManagerBi(branch: Branch, field: 'name' | 'title', lang: 'en' | 'bn', value: string) {
    patchManager(branch, { [field]: { en: branch.manager?.[field]?.en || '', bn: branch.manager?.[field]?.bn || '', [lang]: value } } as NonNullable<Branch['manager']>)
  }

  /* --------------------------------- save ---------------------------------- */

  function save() {
    setSaving(true); setError(''); setNotice('')
    return saveWebsiteEssentials(data)
      .then((payload) => {
        const saved = normalizeWebsiteEssentials(payload.data ?? data)
        setData(saved); setBaseline(JSON.stringify(saved))
        setNotice('Website essentials saved. Published social links, staff and location data now use the CMS record.')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not save website essentials.'))
      .finally(() => setSaving(false))
  }

  const dirty = useMemo(() => Boolean(baseline) && !loading && !error && baseline !== JSON.stringify(data), [loading, data, error, baseline])
  useRegisterAdminActions('website-essentials-editor', { save, reload: load, dirty, saving, label: 'Website essentials' })

  function reload() {
    if (dirty && !window.confirm('You have unsaved website-essentials changes. Reload and discard them?')) return
    void load()
  }

  /* --------------------------------- render -------------------------------- */

  const tabs = (
    <AdminSectionTabs
      label="Website essentials sections"
      value={activeTab}
      onChange={setActiveTab}
      items={[
        { value: 'social', label: 'Social links', icon: <Share2 size={15} /> },
        { value: 'documents', label: 'Public documents', icon: <FileText size={15} /> },
        { value: 'staff', label: 'Management staff', icon: <Users size={15} />, count: data.staff.length },
        { value: 'locations', label: 'Office locations', icon: <MapPin size={15} />, count: data.locations.length },
      ]}
    />
  )

  const toolbarActions =
    activeTab === 'staff' ? (
      <AdminToolbarAction variant="primary" icon={CirclePlus} onClick={addStaff}>Add staff</AdminToolbarAction>
    ) : activeTab === 'locations' ? (
      <AdminToolbarAction variant="primary" icon={CirclePlus} onClick={addLocation}>Add location</AdminToolbarAction>
    ) : undefined

  const showEditor = !loading && !(error && !baseline)

  return (
    <AdminDataContainer
      label="Website essentials editor"
      title="Website Essentials"
      description="Social links, public documents, management staff and office locations used across the public website."
      actions={
        <>
          {dirty && <AdminToolbarBadge tone="warning">Unsaved changes</AdminToolbarBadge>}
          <AdminToolbarAction onClick={reload} disabled={loading || saving}>
            {loading ? 'Loading…' : 'Reload'}
          </AdminToolbarAction>
        </>
      }
      status={{
        content: saving
          ? 'Saving website essentials…'
          : dirty
            ? 'Website essentials edits are not saved yet.'
            : 'Website essentials are up to date.',
      }}
      footerActions={
        dirty || saving ? (
          <>
            <AdminToolbarAction
              variant="quiet"
              disabled={loading || saving}
              onClick={() => {
                if (window.confirm('Discard all unsaved changes and reload the saved settings?')) void load()
              }}
            >
              Discard changes
            </AdminToolbarAction>
            <AdminToolbarAction variant="primary" icon={Save} disabled={loading || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save essentials'}
            </AdminToolbarAction>
          </>
        ) : null
      }
    >
      {loading ? (
        <div className="p-4"><PageLoading rows={5} /></div>
      ) : !showEditor ? (
        <div className="p-4"><AdminErrorState message={error} onRetry={() => void load()} /></div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4 p-4">
          <AdminToolbar title="Website essentials sections" tabs={tabs} actions={toolbarActions} />

          {error && <Notice tone="error">{error}</Notice>}
          {notice && <Notice tone="success">{notice}</Notice>}

          {/* Panels stay mounted (hidden) so in-progress uploads and expanded rows survive tab switches. */}
          <div hidden={activeTab !== 'social'} role="tabpanel" aria-label="Social links">
            <Section icon={<Share2 size={16} />} title="Official social links" description="Only enter official organization-owned accounts. Valid HTTPS URLs are required.">
              <div className={FORM_GRID}>
                {(['facebook', 'instagram', 'youtube', 'linkedin'] as const).map((network) => (
                  <Field
                    key={network}
                    label={`${network[0].toUpperCase()}${network.slice(1)} URL`}
                    value={data.socials[network]}
                    placeholder={`https://${network}.com/…`}
                    onChange={(value) => patchSocial(network, value)}
                  />
                ))}
              </div>
            </Section>
          </div>

          <div hidden={activeTab !== 'documents'} role="tabpanel" aria-label="Public documents">
            <Section icon={<FileText size={16} />} title="Public PDF downloads" description="Uploaded PDFs become public only when marked as public and saved to this configuration. Replace a file by uploading a new version.">
              <div className={FORM_GRID}>
                {([
                  { key: 'staffListPdf', heading: 'Staff list', uploadTitle: 'Staff list' },
                  { key: 'locationsPdf', heading: 'Working locations & branch offices', uploadTitle: 'Working locations' },
                ] as const).map(({ key, heading, uploadTitle }) => (
                  <div key={key} className="grid min-w-0 content-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                    <h4 className="m-0 text-base font-semibold">{heading}</h4>
                    <Field label="English title" value={data.documents[key].titleEn} onChange={(value) => patchDocument(key, { titleEn: value })} />
                    <Field label="Bangla title" value={data.documents[key].titleBn} onChange={(value) => patchDocument(key, { titleBn: value })} />
                    <PublicPdfField title={uploadTitle} value={data.documents[key].url} onChange={(url) => patchDocument(key, { url })} />
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div hidden={activeTab !== 'staff'} role="tabpanel" aria-label="Management staff">
            <Section icon={<Users size={16} />} title="Management staff directory" description="Add approved staff details, publish or unpublish a profile and change display order.">
              <div className="grid min-w-0 gap-3">
                {data.staff.map((person, index) => (
                  <RecordItem
                    key={person.id}
                    open={expandedStaff.isOpen(person.id)}
                    onToggle={() => expandedStaff.toggle(person.id)}
                    title={person.nameEn || person.nameBn || `Staff member ${index + 1}`}
                    subtitle={person.designationEn || person.designationBn}
                    badge={<Badge variant={person.published ? 'default' : 'outline'}>{person.published ? 'Published' : 'Draft'}</Badge>}
                    actions={
                      <>
                        <AdminToolbarAction onClick={() => patchStaff(person.id, { published: !person.published })}>
                          {person.published ? 'Unpublish' : 'Publish'}
                        </AdminToolbarAction>
                        <AdminToolbarAction icon={Trash2} onClick={() => removeStaff(person, index)}>Remove</AdminToolbarAction>
                      </>
                    }
                  >
                    <div className={FORM_GRID}>
                      <Field label="Name (English)" value={person.nameEn} onChange={(value) => patchStaff(person.id, { nameEn: value })} />
                      <Field label="Name (Bangla)" value={person.nameBn} onChange={(value) => patchStaff(person.id, { nameBn: value })} />
                      <Field label="Designation (English)" value={person.designationEn} onChange={(value) => patchStaff(person.id, { designationEn: value })} />
                      <Field label="Designation (Bangla)" value={person.designationBn} onChange={(value) => patchStaff(person.id, { designationBn: value })} />
                      <Field label="Portrait URL (optional)" value={person.photoUrl || ''} placeholder="/api/media/123 or HTTPS image URL" onChange={(value) => patchStaff(person.id, { photoUrl: value })} />
                      <Field label="Display order" type="number" value={person.sortOrder} onChange={(value) => patchStaff(person.id, { sortOrder: Math.max(0, Number(value) || 0) })} />
                      <TextAreaField label="Biography (English, optional)" value={person.bioEn || ''} onChange={(value) => patchStaff(person.id, { bioEn: value })} />
                      <TextAreaField label="Biography (Bangla, optional)" value={person.bioBn || ''} onChange={(value) => patchStaff(person.id, { bioBn: value })} />
                    </div>
                  </RecordItem>
                ))}
                {!data.staff.length && <EmptyState>No staff records yet. Use “Add staff” and publish profiles only after the information is approved.</EmptyState>}
              </div>
            </Section>
          </div>

          <div hidden={activeTab !== 'locations'} role="tabpanel" aria-label="Office locations">
            <Section icon={<MapPin size={16} />} title="Working locations and branch map" description="Update map coordinates, addresses and branch-manager contact details. These records power the public location map and selected-branch contact panel.">
              <div className="grid min-w-0 gap-3">
                {data.locations.map((branch, index) => (
                  <RecordItem
                    key={branch.id}
                    open={expandedLocations.isOpen(branch.id)}
                    onToggle={() => expandedLocations.toggle(branch.id)}
                    title={branch.name.en || branch.name.bn || (branch.kind === 'head' ? 'Head office' : `Location ${index + 1}`)}
                    subtitle={branch.district.en || branch.district.bn}
                    badge={<Badge variant={branch.kind === 'head' ? 'default' : 'outline'}>{branch.kind === 'head' ? 'Head office' : 'Branch'}</Badge>}
                    actions={<AdminToolbarAction icon={Trash2} onClick={() => removeLocation(branch, index)}>Remove</AdminToolbarAction>}
                  >
                    <div className={FORM_GRID}>
                      <Field label="Branch name (English)" value={branch.name.en} onChange={(value) => patchBilingualLocation(branch.id, 'name', 'en', value)} />
                      <Field label="Branch name (Bangla)" value={branch.name.bn} onChange={(value) => patchBilingualLocation(branch.id, 'name', 'bn', value)} />
                      <Field label="District (English)" value={branch.district.en} onChange={(value) => patchBilingualLocation(branch.id, 'district', 'en', value)} />
                      <Field label="District (Bangla)" value={branch.district.bn} onChange={(value) => patchBilingualLocation(branch.id, 'district', 'bn', value)} />
                      <Field label="Division (English)" value={branch.division.en} onChange={(value) => patchBilingualLocation(branch.id, 'division', 'en', value)} />
                      <Field label="Division (Bangla)" value={branch.division.bn} onChange={(value) => patchBilingualLocation(branch.id, 'division', 'bn', value)} />
                      <Field label="Latitude" type="number" value={branch.lat} onChange={(value) => patchLocation(branch.id, { lat: Number(value) })} />
                      <Field label="Longitude" type="number" value={branch.lng} onChange={(value) => patchLocation(branch.id, { lng: Number(value) })} />
                      <Field label="Address (English, optional)" value={branch.address?.en || ''} onChange={(value) => patchAddress(branch, 'en', value)} />
                      <Field label="Address (Bangla, optional)" value={branch.address?.bn || ''} onChange={(value) => patchAddress(branch, 'bn', value)} />
                      <Field label="Branch manager name (English)" value={branch.manager?.name?.en || ''} onChange={(value) => patchManagerBi(branch, 'name', 'en', value)} />
                      <Field label="Branch manager name (Bangla)" value={branch.manager?.name?.bn || ''} onChange={(value) => patchManagerBi(branch, 'name', 'bn', value)} />
                      <Field label="Manager designation (English)" value={branch.manager?.title?.en || ''} onChange={(value) => patchManagerBi(branch, 'title', 'en', value)} />
                      <Field label="Manager designation (Bangla)" value={branch.manager?.title?.bn || ''} onChange={(value) => patchManagerBi(branch, 'title', 'bn', value)} />
                      <Field label="Branch manager phone" value={branch.manager?.phone || ''} placeholder="+880…" onChange={(value) => patchManager(branch, { phone: value })} />
                      <Field label="Branch manager email" value={branch.manager?.email || ''} placeholder="manager@example.org" onChange={(value) => patchManager(branch, { email: value })} />
                      <label className="flex min-w-0 flex-col gap-1.5 text-sm">
                        <span className="font-semibold">Location type</span>
                        <NativeSelect value={branch.kind} onChange={(event) => patchLocation(branch.id, { kind: event.target.value as Branch['kind'] })}>
                          <option value="branch">Branch</option>
                          <option value="head">Head office</option>
                        </NativeSelect>
                      </label>
                    </div>
                  </RecordItem>
                ))}
                {!data.locations.length && <EmptyState>No saved locations. The public map will use the bundled fallback until locations are added.</EmptyState>}
              </div>
            </Section>
          </div>
        </div>
      )}
    </AdminDataContainer>
  )
}