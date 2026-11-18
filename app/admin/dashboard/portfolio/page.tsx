'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Building2, ChevronDown, ChevronUp, FileJson, Image as ImageIcon, Plus, Save, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import type { ExternalValue, JsonObject, JsonValue } from '@/types/json'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getPortfolioGlobal, savePortfolioGlobal } from '@/lib/api/portfolio'
import {
  AdminDataContainer,
  AdminToolbar,
  AdminToolbarAction,
  AdminToolbarBadge,
} from '@/components/admin/cms'
import { AdminErrorState, AdminSectionTabs, PageLoading } from '../_components/AdminCommon'
import { MediaField } from '../_components/MediaField'
import PortfolioBranchLocationsEditor from '../_components/PortfolioBranchLocationsEditor'
import { useRegisterAdminActions } from '../_components/AdminActionContext'

/* -------------------------------------------------------------------------- */
/* Types & data helpers                                                       */
/* -------------------------------------------------------------------------- */

type Bi = JsonObject & { en: string; bn: string }
type PortfolioBrand = JsonObject & {
  name: Bi
  descriptor: Bi
  tagline: Bi
  summary: Bi
  logo: string
}
type Portfolio = JsonObject & {
  brandIdentity: PortfolioBrand
  about: Bi
  mission: Bi
  vision: Bi
  values: JsonObject[]
  teams: JsonObject[]
  governingBody: JsonObject[]
  executiveCommittee: JsonObject[]
  seniorManagement: JsonObject[]
  customProperties: JsonObject
}

const emptyBi = (): Bi => ({ en: '', bn: '' }) as Bi
const emptyPortfolio = (): Portfolio => ({
  brandIdentity: {
    name: emptyBi(), descriptor: emptyBi(), tagline: emptyBi(), summary: emptyBi(), logo: '',
  },
  about: emptyBi(), mission: emptyBi(), vision: emptyBi(),
  values: [], teams: [], governingBody: [], executiveCommittee: [], seniorManagement: [], customProperties: {},
})

function isJsonObject(value: ExternalValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function asJsonObject(value: ExternalValue): JsonObject {
  return isJsonObject(value) ? value : {}
}
function asJsonObjectArray(value: ExternalValue): JsonObject[] {
  return Array.isArray(value) ? value.filter(isJsonObject) : []
}
const asBi = (value: ExternalValue, fallback: Bi = emptyBi()): Bi => {
  if (typeof value === 'string') return { en: value, bn: value } as Bi
  if (!isJsonObject(value)) return fallback
  return { en: String(value.en ?? ''), bn: String(value.bn ?? '') } as Bi
}
const pretty = (value: JsonValue) => JSON.stringify(value ?? [], null, 2)

/** Returns a copy of `list` with items `a` and `b` swapped. */
function swapItems<T>(list: T[], a: number, b: number): T[] {
  const next = [...list]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

/* -------------------------------------------------------------------------- */
/* Layout primitives                                                          */
/* -------------------------------------------------------------------------- */

const FORM_GRID = 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'
const SPAN_2 = 'md:col-span-2'

/** Labelled form control. */
function FormField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5 text-sm [&_:disabled]:cursor-default [&_:disabled]:opacity-100 [&_:disabled]:bg-muted', className)}>
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

/** A titled block inside a tab. */
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

/** English + Bengali inputs side by side. */
function BiFields({ title, value, onChange, multiline = false }: { title: string; value: Bi; onChange: (value: Bi) => void; multiline?: boolean }) {
  const Control = multiline ? Textarea : Input
  const extra = multiline ? { rows: 3 } : {}
  return (
    <div className={FORM_GRID}>
      <FormField label={`${title} — English`}>
        <Control {...extra} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />
      </FormField>
      <FormField label={`${title} — বাংলা`}>
        <Control {...extra} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />
      </FormField>
    </div>
  )
}

/* ---- Collapsible list items shared by values, people and properties ------ */

function ListShell({
  title,
  description,
  addLabel,
  onAdd,
  empty,
  isEmpty,
  children,
}: {
  title: string
  description: string
  addLabel: string
  onAdd: () => void
  empty: string
  isEmpty: boolean
  children: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div className="grid min-w-0 gap-0.5">
          <strong className="text-sm">{title}</strong>
          <small className="text-xs leading-snug text-muted-foreground">{description}</small>
        </div>
        <AdminToolbarAction icon={Plus} onClick={onAdd}>{addLabel}</AdminToolbarAction>
      </div>
      {children}
      {isEmpty && (
        <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-border bg-background p-5 text-center text-sm text-muted-foreground">
          {empty}
        </div>
      )}
    </div>
  )
}

function IconAction({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn('size-8 p-0', danger && 'hover:bg-destructive/10 hover:text-destructive')}
    >
      {children}
    </Button>
  )
}

function ListItem({
  open,
  onToggle,
  title,
  subtitle,
  onMoveUp,
  onMoveDown,
  onRemove,
  itemLabel,
  children,
}: {
  open: boolean
  onToggle: () => void
  title: string
  subtitle?: string
  /** Omit both move handlers for items that cannot be reordered. */
  onMoveUp?: (() => void) | null
  onMoveDown?: (() => void) | null
  onRemove: () => void
  itemLabel: string
  children: ReactNode
}) {
  const reorderable = onMoveUp !== undefined || onMoveDown !== undefined
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-w-0 items-center justify-between gap-2 bg-background px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          onClick={onToggle}
          className="h-auto min-w-0 flex-1 justify-start gap-2 whitespace-normal rounded-none px-0 py-0 text-left text-primary hover:bg-transparent"
        >
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <strong className="break-words text-sm">{title}</strong>
          {subtitle && <span className="break-words text-xs text-muted-foreground">{subtitle}</span>}
        </Button>
        <div className="flex shrink-0 items-center gap-0.5">
          {reorderable && (
            <>
              <IconAction label={`Move ${itemLabel} up`} disabled={!onMoveUp} onClick={() => onMoveUp?.()}><ArrowUp size={14} /></IconAction>
              <IconAction label={`Move ${itemLabel} down`} disabled={!onMoveDown} onClick={() => onMoveDown?.()}><ArrowDown size={14} /></IconAction>
            </>
          )}
          <IconAction label={`Remove ${itemLabel}`} danger onClick={onRemove}><Trash2 size={14} /></IconAction>
        </div>
      </div>
      {open && <div className="grid min-w-0 gap-4 p-4">{children}</div>}
    </div>
  )
}

/** Tracks which list rows are expanded, keeping indexes right across add/move/remove. */
function useExpanded(initialOpen: boolean) {
  const [expanded, setExpanded] = useState<number[]>(initialOpen ? [0] : [])
  return {
    isOpen: (i: number) => expanded.includes(i),
    toggle: (i: number) => setExpanded((old) => (old.includes(i) ? old.filter((n) => n !== i) : [...old, i])),
    opened: (i: number) => setExpanded((old) => [...old, i]),
    swapped: (a: number, b: number) => setExpanded((old) => old.map((n) => (n === a ? b : n === b ? a : n))),
    removed: (i: number) => setExpanded((old) => old.filter((n) => n !== i).map((n) => (n > i ? n - 1 : n))),
  }
}

/* -------------------------------------------------------------------------- */
/* JSON editor (nested values)                                                */
/* -------------------------------------------------------------------------- */

function JsonEditor({ title, value, onChange, note }: { title: string; value: JsonValue; onChange: (value: JsonValue) => void; note?: string }) {
  const initialText = pretty(value)
  return <JsonEditorForm key={initialText} title={title} onChange={onChange} note={note} initialText={initialText} />
}

function JsonEditorForm({ title, onChange, note, initialText }: { title: string; onChange: (value: JsonValue) => void; note?: string; initialText: string }) {
  const [text, setText] = useState(initialText)
  const [error, setError] = useState('')

  function apply() {
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed === null || typeof parsed !== 'object') throw new Error('Enter a JSON object or array.')
      onChange(parsed as JsonValue)
      setError('')
      toast.success(`${title} applied to draft.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON.')
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{title}</Label>
        <AdminToolbarAction icon={FileJson} onClick={apply}>Apply JSON</AdminToolbarAction>
      </div>
      {note && <p className="m-0 text-xs text-muted-foreground">{note}</p>}
      <Textarea className="min-h-56 font-mono text-sm" rows={12} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      <p role="status" className="m-0 min-h-4 text-sm text-destructive">{error}</p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* List editors                                                               */
/* -------------------------------------------------------------------------- */

function CustomPropertiesEditor({ value, onChange }: { value: JsonObject; onChange: (next: JsonObject) => void }) {
  const entries = Object.entries(value || {})
  const expanded = useExpanded(entries.length > 0)

  function rename(oldKey: string, key: string) {
    const nextKey = key.trim()
    if (!nextKey || nextKey === oldKey || Object.prototype.hasOwnProperty.call(value, nextKey)) return
    const next: JsonObject = {}
    for (const [current, entryValue] of Object.entries(value)) next[current === oldKey ? nextKey : current] = entryValue
    onChange(next)
  }
  const update = (key: string, nextValue: JsonValue) => onChange({ ...value, [key]: nextValue })

  function add() {
    let key = 'new-property'
    let i = 2
    while (key in value) key = `new-property-${i++}`
    onChange({ ...value, [key]: emptyBi() })
    expanded.opened(entries.length)
  }

  return (
    <ListShell
      title="Additional properties"
      description="Add simple text or bilingual key/value properties for future site modules. Common website settings already have dedicated controls in the other tabs."
      addLabel="Add property"
      onAdd={add}
      isEmpty={!entries.length}
      empty="No custom properties. Add one only when a new site module needs it."
    >
      {entries.map(([key, itemValue], index) => {
        const bilingual = itemValue && typeof itemValue === 'object' && !Array.isArray(itemValue) && ('en' in itemValue || 'bn' in itemValue)
        const nested = itemValue && typeof itemValue === 'object' && !bilingual
        const label = key.replaceAll('-', ' ').replaceAll('_', ' ')
        return (
          <ListItem
            key={`${key}-${index}`}
            open={expanded.isOpen(index)}
            onToggle={() => expanded.toggle(index)}
            title={label}
            itemLabel={`property ${label}`}
            onRemove={() => {
              if (!confirm(`Remove custom property “${key}”?`)) return
              const next = { ...value }
              delete next[key]
              onChange(next)
              expanded.removed(index)
            }}
          >
            <FormField label="Property key">
              <Input defaultValue={key} onBlur={(e) => rename(key, e.target.value)} />
            </FormField>
            {bilingual ? (
              <BiFields title="Property value" value={asBi(itemValue)} onChange={(next) => update(key, next)} />
            ) : nested ? (
              <details className="border-t border-border pt-3 [&_summary]:cursor-pointer [&_summary]:pb-2 [&_summary]:text-sm [&_summary]:font-semibold">
                <summary>Advanced nested value (JSON)</summary>
                <JsonEditor title="Nested value" value={itemValue} onChange={(next) => update(key, next)} />
              </details>
            ) : (
              <FormField label="Property value">
                <Input value={String(itemValue ?? '')} onChange={(e) => update(key, e.target.value)} />
              </FormField>
            )}
          </ListItem>
        )
      })}
    </ListShell>
  )
}

function BilingualValuesEditor({ value, onChange }: { value: JsonObject[]; onChange: (next: JsonObject[]) => void }) {
  const expanded = useExpanded(value.length > 0)

  function add() {
    onChange([...value, { title: emptyBi(), description: emptyBi() }])
    expanded.opened(value.length)
  }
  function move(index: number, to: number) {
    onChange(swapItems(value, index, to))
    expanded.swapped(index, to)
  }

  return (
    <ListShell
      title="Organizational values"
      description="Edit each value in English and Bengali. No JSON is needed."
      addLabel="Add value"
      onAdd={add}
      isEmpty={!value.length}
      empty="No values added yet."
    >
      {value.map((entry, index) => {
        const title = asBi(entry?.title ?? entry?.name)
        const description = asBi(entry?.description ?? entry?.body)
        return (
          <ListItem
            key={`value-${index}`}
            open={expanded.isOpen(index)}
            onToggle={() => expanded.toggle(index)}
            title={title.en || title.bn || `Value ${index + 1}`}
            itemLabel="value"
            onMoveUp={index > 0 ? () => move(index, index - 1) : null}
            onMoveDown={index < value.length - 1 ? () => move(index, index + 1) : null}
            onRemove={() => {
              if (!confirm('Remove this value?')) return
              onChange(value.filter((_, i) => i !== index))
              expanded.removed(index)
            }}
          >
            <BiFields title="Value title" value={title} onChange={(next) => onChange(value.map((v, i) => (i === index ? { ...v, title: next } : v)))} />
            <BiFields title="Description" value={description} multiline onChange={(next) => onChange(value.map((v, i) => (i === index ? { ...v, description: next } : v)))} />
          </ListItem>
        )
      })}
    </ListShell>
  )
}

function PeopleListEditor({ title, value, onChange }: { title: string; value: JsonObject[]; onChange: (next: JsonObject[]) => void }) {
  const expanded = useExpanded(value.length > 0)
  const update = (index: number, patch: JsonObject) => onChange(value.map((person, i) => (i === index ? { ...person, ...patch } : person)))

  function add() {
    onChange([...value, { name: emptyBi(), role: emptyBi(), bio: emptyBi(), image: '', email: '', phone: '', order: value.length }])
    expanded.opened(value.length)
  }
  function move(index: number, to: number) {
    onChange(swapItems(value, index, to))
    expanded.swapped(index, to)
  }

  return (
    <ListShell
      title={title}
      description="Name, role, biography and photo fields for each member."
      addLabel="Add person"
      onAdd={add}
      isEmpty={!value.length}
      empty="No profiles added yet. Use “Add person” to create the first profile."
    >
      {value.map((person, index) => {
        const name = asBi(person?.name ?? person?.title ?? person?.label)
        const role = asBi(person?.role ?? person?.designation ?? person?.position)
        const bio = asBi(person?.bio ?? person?.description ?? person?.summary)
        const imageRecord = asJsonObject(person?.image)
        const photoRecord = asJsonObject(person?.photo)
        const image = typeof person?.image === 'string' ? person.image : typeof person?.photo === 'string' ? person.photo : String(imageRecord.src ?? photoRecord.src ?? '')
        const displayName = name.en || name.bn || `${title} ${index + 1}`
        return (
          <ListItem
            key={`${title}-${person?.id ?? index}`}
            open={expanded.isOpen(index)}
            onToggle={() => expanded.toggle(index)}
            title={displayName}
            subtitle={role.en || role.bn}
            itemLabel="person"
            onMoveUp={index > 0 ? () => move(index, index - 1) : null}
            onMoveDown={index < value.length - 1 ? () => move(index, index + 1) : null}
            onRemove={() => {
              if (!confirm(`Remove ${displayName}?`)) return
              onChange(value.filter((_, i) => i !== index))
              expanded.removed(index)
            }}
          >
            <BiFields title="Name" value={name} onChange={(next) => update(index, { name: next })} />
            <BiFields title="Role / designation" value={role} onChange={(next) => update(index, { role: next })} />
            <BiFields title="Biography" value={bio} multiline onChange={(next) => update(index, { bio: next })} />
            <MediaField label="Profile photo" value={image} alt={name.en || name.bn} onChange={(next) => update(index, { image: next })} helper="Use an approved member portrait. Avoid uploading personal photos without permission." />
            <div className={FORM_GRID}>
              <FormField label="Email (optional)">
                <Input type="email" value={String(person?.email ?? '')} onChange={(e) => update(index, { email: e.target.value })} />
              </FormField>
              <FormField label="Phone (optional)">
                <Input value={String(person?.phone ?? '')} onChange={(e) => update(index, { phone: e.target.value })} />
              </FormField>
              <FormField label="Display order">
                <Input type="number" value={String(person?.order ?? index)} onChange={(e) => update(index, { order: Number(e.target.value) || 0 })} />
              </FormField>
            </div>
          </ListItem>
        )
      })}
    </ListShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function PortfolioPage() {
  const [global, setGlobal] = useState<JsonObject | null>(null)
  const [activeTab, setActiveTab] = useState('brand')
  const [portfolio, setPortfolio] = useState<Portfolio>(emptyPortfolio)
  const [contact, setContact] = useState<JsonObject>({})
  const [images, setImages] = useState<JsonObject>({})
  const [updatedAt, setUpdatedAt] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [baseline, setBaseline] = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    return getPortfolioGlobal()
      .then((result) => {
        const data = asJsonObject(result.global)
        const saved = asJsonObject(data.portfolio)
        const savedBrand = asJsonObject(saved.brandIdentity)
        const imageData = asJsonObject(data.images)
        const contactData = asJsonObject(data.contactInfo)
        const nextPortfolio: Portfolio = {
          ...saved,
          brandIdentity: {
            name: asBi(savedBrand.name, { en: 'Srizony', bn: 'সৃজনী' } as Bi),
            descriptor: asBi(savedBrand.descriptor, { en: 'Foundation', bn: 'ফাউন্ডেশন' } as Bi),
            tagline: asBi(savedBrand.tagline, { en: 'Community. Dignity. Opportunity.', bn: 'কমিউনিটি • মর্যাদা • সুযোগ' } as Bi),
            summary: asBi(savedBrand.summary),
            logo: String(savedBrand.logo || imageData.logo || '/images/Logo-SF.png'),
          } as PortfolioBrand,
          about: asBi(saved.about), mission: asBi(saved.mission), vision: asBi(saved.vision),
          values: asJsonObjectArray(saved.values),
          teams: asJsonObjectArray(saved.teams),
          governingBody: asJsonObjectArray(saved.governingBody),
          executiveCommittee: asJsonObjectArray(saved.executiveCommittee),
          seniorManagement: asJsonObjectArray(saved.seniorManagement),
          customProperties: asJsonObject(saved.customProperties),
        }
        setGlobal(data); setPortfolio(nextPortfolio); setImages(imageData); setContact(contactData); setUpdatedAt(result.updatedAt)
        setBaseline(JSON.stringify({ global: data, portfolio: nextPortfolio, images: imageData, contact: contactData }))
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load the portfolio.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const brand = portfolio.brandIdentity

  function updatePortfolio(key: string, value: JsonValue) { setSaveError(''); setPortfolio((current) => ({ ...current, [key]: value })) }
  function updateBrand(key: string, value: JsonValue) { setSaveError(''); setPortfolio((current) => ({ ...current, brandIdentity: { ...(current.brandIdentity || {}), [key]: value } })) }
  function updateContact(key: string, value: JsonValue) { setSaveError(''); setContact((current) => ({ ...current, [key]: value })) }

  function save() {
    if (!global) return Promise.resolve()
    const logo = String(portfolio.brandIdentity?.logo || images.logo || '/images/Logo-SF.png').trim()
    // Branch and office records have one canonical home: Website Essentials.
    // Strip the legacy portfolio.branches key so a save here cannot revive stale data.
    const updatedPortfolio: Portfolio = { ...portfolio, brandIdentity: { ...portfolio.brandIdentity, logo } }
    delete updatedPortfolio.branches
    const address = asBi(contact.address)
    const nextContact = { ...contact, address }
    const nextGlobal = { ...global, images: { ...images, logo }, contactInfo: nextContact, portfolio: updatedPortfolio }
    setSaveError('')
    setSaving(true)
    return savePortfolioGlobal(nextGlobal, updatedAt)
      .then(() => {
        setGlobal(nextGlobal); setPortfolio(updatedPortfolio); setImages(nextGlobal.images); setContact(nextContact)
        setBaseline(JSON.stringify({ global: nextGlobal, portfolio: updatedPortfolio, images: nextGlobal.images, contact: nextContact }))
        toast.success('Portfolio profile saved. Public branding, contact details and portfolio-driven pages will use the updated values.')
        return load()
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save the portfolio.'
        setSaveError(message)
        toast.error(message, { description: 'Your edits are still in the form. Fix the issue or check the database connection, then retry.' })
      })
      .finally(() => setSaving(false))
  }

  const dirty = useMemo(() => Boolean(global) && baseline !== JSON.stringify({ global, portfolio, images, contact }), [baseline, global, portfolio, images, contact])
  useRegisterAdminActions('portfolio-editor', { save, reload: load, dirty, saving, label: 'Portfolio' })

  function reload() {
    if (dirty && !window.confirm('You have unsaved portfolio changes. Reload and discard them?')) return
    void load()
  }

  const tabs = (
    <AdminSectionTabs
      label="Portfolio sections"
      value={activeTab}
      onChange={setActiveTab}
      items={[
        { value: 'brand', label: 'Brand identity', icon: <ImageIcon size={15} /> },
        { value: 'contact', label: 'Contact & locations', icon: <Building2 size={15} /> },
        { value: 'about', label: 'About & values', icon: <FileJson size={15} /> },
        { value: 'people', label: 'People & governance', icon: <Users size={15} /> },
        { value: 'advanced', label: 'Additional fields', icon: <FileJson size={15} /> },
      ]}
    />
  )

  return (
    <AdminDataContainer
      label="Portfolio editor"
      headerContent={<AdminToolbar title="Portfolio sections" tabs={tabs} />}
      actions={
        <>
          {dirty && <AdminToolbarBadge tone="warning">Unsaved changes</AdminToolbarBadge>}
          <AdminToolbarAction onClick={reload} disabled={loading || saving}>
            {loading ? 'Loading…' : 'Reload'}
          </AdminToolbarAction>
        </>
      }
      status={{
        content: dirty
          ? 'Portfolio edits are not saved yet.'
          : 'All portfolio changes are saved and available to the public website.',
      }}
      footerActions={
        dirty ? (
          <>
            <AdminToolbarAction
              variant="quiet"
              disabled={loading || saving}
              onClick={() => {
                if (window.confirm('Discard all unsaved changes and reload the saved portfolio?')) void load()
              }}
            >
              Discard changes
            </AdminToolbarAction>
            <AdminToolbarAction variant="primary" icon={Save} disabled={loading || saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save portfolio'}
            </AdminToolbarAction>
          </>
        ) : null
      }
    >
      {loading && !global ? (
        <div className="p-4"><PageLoading rows={5} /></div>
      ) : error ? (
        <div className="p-4"><AdminErrorState message={error} onRetry={() => void load()} /></div>
      ) : (
        global && (
          <div className="flex min-w-0 flex-col gap-4 p-4">

            {saveError && (
              <div role="alert" className="grid gap-1 rounded-lg border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 px-4 py-3 text-primary">
                <strong className="text-sm">Portfolio changes were not saved.</strong>
                <span className="break-words text-sm">{saveError}</span>
                <small className="text-xs text-muted-foreground">Your edits are still in this form. Correct the issue and retry.</small>
              </div>
            )}

            <div role="tabpanel" aria-label={`${activeTab} editor`} className="min-w-0">
              {activeTab === 'brand' && (
                <Section icon={<ImageIcon size={16} />} title="Brand identity" description="Logo, brand naming, tagline and identity statement used in shared site chrome.">
                  <div className={FORM_GRID}>
                    <div className={SPAN_2}>
                      <MediaField
                        label="Brand logo"
                        value={String(brand.logo || '')}
                        onChange={(value) => { updateBrand('logo', value); setImages((current) => ({ ...current, logo: value })) }}
                        alt={String(brand.name?.en || 'Srizony Foundation logo')}
                        helper="For best results, use a transparent PNG. You can upload JPG, PNG, WebP, AVIF or GIF, or paste an existing SVG/HTTPS URL."
                      />
                    </div>
                    <div className={SPAN_2}><BiFields title="Brand name" value={asBi(brand.name)} onChange={(v) => updateBrand('name', v)} /></div>
                    <div className={SPAN_2}><BiFields title="Brand descriptor" value={asBi(brand.descriptor)} onChange={(v) => updateBrand('descriptor', v)} /></div>
                    <div className={SPAN_2}><BiFields title="Tagline" value={asBi(brand.tagline)} onChange={(v) => updateBrand('tagline', v)} /></div>
                    <div className={SPAN_2}><BiFields title="Brand identity statement" value={asBi(brand.summary)} multiline onChange={(v) => updateBrand('summary', v)} /></div>
                  </div>
                </Section>
              )}

              {activeTab === 'contact' && (
                <Section icon={<Building2 size={16} />} title="Location & contact information" description="Head office, phone numbers, email and contact routes used by the footer and location map.">
                  <div className={FORM_GRID}>
                    <div className={SPAN_2}><BiFields title="Head-office address" value={asBi(contact.address)} multiline onChange={(v) => updateContact('address', v)} /></div>
                    <FormField label="Primary phone">
                      <Input value={String(contact.primaryPhone || '')} onChange={(e) => updateContact('primaryPhone', e.target.value)} />
                    </FormField>
                    <FormField label="Email">
                      <Input type="email" value={String(contact.email || '')} onChange={(e) => updateContact('email', e.target.value)} />
                    </FormField>
                    <FormField label="Phone list (comma separated)">
                      <Input value={Array.isArray(contact.phones) ? contact.phones.join(', ') : ''} onChange={(e) => updateContact('phones', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
                    </FormField>
                    <FormField label="LinkedIn URL">
                      <Input value={String(asJsonObject(contact.socials).linkedin || '')} onChange={(e) => updateContact('socials', { ...asJsonObject(contact.socials), linkedin: e.target.value })} />
                    </FormField>
                    <FormField label="Head-office map URL">
                      <Input value={String(asJsonObject(contact.maps).headOffice || '')} onChange={(e) => updateContact('maps', { ...asJsonObject(contact.maps), headOffice: e.target.value })} />
                    </FormField>
                  </div>
                </Section>
              )}

              {/* Kept mounted (hidden) so the branch editor keeps its own state when switching tabs. */}
              <div hidden={activeTab !== 'contact'} className={cn(activeTab === 'contact' && 'mt-6')}>
                <PortfolioBranchLocationsEditor />
              </div>

              {activeTab === 'about' && (
                <Section title="About, mission, vision & values" description="Bilingual organization statements; these values automatically populate the homepage and matching organizational pages.">
                  <div className="grid min-w-0 gap-4">
                    <BiFields title="About Srizony" value={asBi(portfolio.about)} multiline onChange={(v) => updatePortfolio('about', v)} />
                    <BiFields title="Mission" value={asBi(portfolio.mission)} multiline onChange={(v) => updatePortfolio('mission', v)} />
                    <BiFields title="Vision" value={asBi(portfolio.vision)} multiline onChange={(v) => updatePortfolio('vision', v)} />
                    <BilingualValuesEditor value={portfolio.values || []} onChange={(v) => updatePortfolio('values', v)} />
                  </div>
                </Section>
              )}

              {activeTab === 'people' && (
                <Section icon={<Users size={16} />} title="People & governance" description="Edit member profiles using forms. Upload portraits, enter bilingual names and roles, and reorder profiles without touching JSON.">
                  <div className="grid min-w-0 gap-8">
                    <PeopleListEditor title="Teams" value={portfolio.teams || []} onChange={(v) => updatePortfolio('teams', v)} />
                    <PeopleListEditor title="Governing body" value={portfolio.governingBody || []} onChange={(v) => updatePortfolio('governingBody', v)} />
                    <PeopleListEditor title="Executive committee" value={portfolio.executiveCommittee || []} onChange={(v) => updatePortfolio('executiveCommittee', v)} />
                    <PeopleListEditor title="Senior management" value={portfolio.seniorManagement || []} onChange={(v) => updatePortfolio('seniorManagement', v)} />
                  </div>
                </Section>
              )}

              {activeTab === 'advanced' && (
                <Section icon={<FileJson size={16} />} title="Additional portfolio properties" description="Add simple or bilingual key/value fields for future site modules. You do not need to edit a single JSON object.">
                  <CustomPropertiesEditor value={portfolio.customProperties || {}} onChange={(v) => updatePortfolio('customProperties', v)} />
                </Section>
              )}
            </div>
          </div>
        )
      )}
    </AdminDataContainer>
  )
}