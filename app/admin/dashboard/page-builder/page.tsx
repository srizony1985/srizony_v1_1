'use client'

import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import type { ExternalValue, JsonObject, JsonValue } from '@/types/json'

import { getWebsiteEssentials, saveWebsiteEssentials } from '@/lib/api/adminResources'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, EyeOff, Plus, Trash2, ChevronDown, ChevronUp, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonClassName } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MediaField } from '../_components/MediaField'
import { deleteEditablePage, getEditablePage, getPageBuilderIndex, saveEditablePage, setEditablePageNavigationVisibility, type PageIndexItem } from '@/lib/api/pageBuilder'
import { normalizeWebsiteEssentials, type WebsiteEssentials } from '@/lib/websiteEssentials'
import { BRANCHES } from '@/lib/cms/fallback-gateway'
import type { Branch } from '@/types/branch'
import type { IllustrationName } from '@/types/entityType'
import CmsCardIllustration from '@/components/home/CmsCardIllustration'
import type { Bilingual, PageData, PageSection, Section, SectionButtonConfig } from '@/types/entityType'
import CmsTypographyEditor from '@/components/admin/CmsTypographyEditor'
import { LANDING_COMPONENT_OPTIONS, type LandingComponentKey } from '@/lib/cms/component-policy'
import { AdminErrorState, AdminSectionTabs, PageLoading, SectionToolbar } from '../_components/AdminCommon'
import LandingCollectionCardsEditor from '../_components/LandingCollectionCardsEditor'
import { ContentEditor } from '../_components/ContentEditor'
import { listContent } from '@/lib/api/siteContent'
import { COMPONENTS, FIXED_CONTENT_PARENT, type ContentComponent, type ContentRecord } from '@/lib/cms/components'
import { normalizeMediaSrc } from '@/lib/mediaUrl'
import { useAdminActions, useRegisterAdminActions } from '../_components/AdminActionContext'
import { AdminDataContainer, AdminWorkspaceGrid } from '@/components/admin/cms'
import Image from 'next/image'
import Select from '@/components/ui/select'
import { supportsLocationMap } from '@/lib/cms/locationMap'

const SECTION_TYPES: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']
const COLLECTION_SECTION_TYPES = new Set<Section['type']>(['richText', 'stats', 'cards', 'gallery', 'timeline', 'table', 'cta', 'noticeList', 'donation', 'carousel', 'contentFeed', 'reports'])

type PageEditorTab = 'seo' | 'typography' | 'configuration' | 'sections'

const PAGE_FIELD_CLASS = 'cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)]'

function layoutsForSection(type: Section['type']): Array<'grid' | 'carousel' | 'masonry' | 'list'> {
  if (type === 'gallery') return ['grid', 'masonry']
  if (type === 'cards' || type === 'contentFeed') return ['grid', 'carousel', 'masonry', 'list']
  if (type === 'carousel') return ['carousel', 'grid', 'list']
  if (type === 'stats') return ['grid', 'list']
  return ['list']
}

function isProjectsCollectionMarker(section: PageSection) {
  const candidate = section as PageSection & { collectionKind?: string; dataSource?: string; components?: string[]; heading?: Bilingual }
  const heading = `${candidate.heading?.en || ''} ${candidate.heading?.bn || ''}`.toLowerCase()
  return candidate.collectionKind === 'projects'
    || candidate.contentCollection?.component === 'project'
    || (candidate.type === 'contentFeed' && candidate.components?.[0] === 'project')
    || (candidate.dataSource !== 'manual' && /projects?|প্রকল্প/.test(heading)
      && ['cards', 'carousel', 'contentFeed', 'gallery'].includes(candidate.type))
}

function isProjectsCollectionPresentation(section: PageSection) {
  return ['cards', 'carousel', 'contentFeed', 'gallery'].includes(section.type)
    && (section as PageSection & { dataSource?: string }).dataSource !== 'manual'
    && !['news', 'stories', 'newsFeed', 'successStories'].includes(String(section.homeComponent || ''))
}

function defaultCollectionComponent(type: Section['type']): ContentComponent {
  if (type === 'stats') return 'stat'
  if (type === 'reports') return 'report'
  if (type === 'noticeList') return 'notice'
  if (type === 'carousel') return 'news'
  return 'project'
}
const blankBi = (): Bilingual => ({ en: '', bn: '' })
const defaultButton = (visible = false): SectionButtonConfig => ({ visible, mode: 'primary', label: { en: 'Learn more', bn: 'আরও জানুন' }, secondaryLabel: { en: 'Contact us', bn: 'যোগাযোগ করুন' }, href: '/contact', secondaryHref: '/contact', action: 'route', secondaryAction: 'route' })
function blankSection(type: Section['type'], title: Bilingual = blankBi()): PageSection {
  const bi = blankBi()
  let section: JsonObject
  switch (type) {
    case 'richText': section = { type, heading: { ...title }, body: [{ ...bi }] }; break
    case 'stats': section = { type, items: [] }; break
    case 'cards': section = { type, heading: { ...title }, items: [], columns: 3 }; break
    case 'gallery': section = { type, heading: { ...title }, items: [], columns: 3 }; break
    case 'timeline': section = { type, heading: { ...title }, variant: 'list', items: [] }; break
    case 'diagram': section = { type, heading: { ...title }, body: { ...bi }, variant: 'impact' }; break
    case 'table': section = { type, heading: { ...title }, headers: [], rows: [] }; break
    case 'video': section = { type, heading: { ...title }, body: { ...bi }, poster: '', embedUrl: '', sourceUrl: '' }; break
    case 'cta': section = { type, heading: { ...title }, body: { ...bi }, primary: { label: { en: 'Learn more', bn: 'আরও জানুন' }, href: '/contact' }, secondary: { label: { en: 'Contact us', bn: 'যোগাযোগ করুন' }, href: '/contact' } }; break
    case 'noticeList': section = { type, heading: { ...title }, items: [] }; break
    case 'contact': section = { type, heading: { ...title }, address: { ...bi }, phones: [], emails: [], locations: [] }; break
    case 'donation': section = { type, heading: { ...title }, body: { ...bi } }; break
    case 'carousel': section = { type, heading: { ...title }, body: { ...bi }, presentation: 'collection', items: [] }; break
    case 'contentFeed': section = { type, heading: { ...title }, components: ['project'], items: [], columns: 3 }; break
    case 'reports': section = { type, heading: { ...title }, items: [] }; break
    default: section = { type: 'richText', heading: { ...title }, body: [{ ...bi }] }
  }
  section.visible = true
  section.sectionId = `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  section.contentCollection = { enabled: COLLECTION_SECTION_TYPES.has(type), component: defaultCollectionComponent(type), maxItems: type === 'cta' || type === 'donation' ? 1 : 12, layout: layoutsForSection(type)[0], columns: 3, gap: 24, viewportItems: 3, ...(type === 'contentFeed' ? { showSearch: true, showCategoryFilter: true, showYearFilter: true } : {}) }
  section.buttonConfig = defaultButton(type === 'cta')
  return section as PageSection
}
function getBilingual(value: ExternalValue): Bilingual | null {
  if (typeof value === 'string') return { en: value, bn: value }
  if (value && typeof value === 'object' && !Array.isArray(value) && ('en' in value || 'bn' in value)) return { en: String((value as JsonObject).en ?? ''), bn: String((value as JsonObject).bn ?? '') }
  return null
}
function getStringPath(obj: JsonObject, path: string): string {
  const value = getPath(obj, path)
  return typeof value === 'string' ? value : ''
}
function moveItem<T>(items: T[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next }

function BilingualInputs({ label, value, onChange, multiline = false }: { label: string; value: Bilingual; onChange: (value: Bilingual) => void; multiline?: boolean }) {
  return <div className="pb-bilingual grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[7px_10px] [&>label]:text-[0.875rem] [&>label]:font-semibold"><Label>{label} — English</Label>{multiline ? <Textarea rows={3} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} /> : <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />}<Label>{label} — বাংলা</Label>{multiline ? <Textarea rows={3} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} /> : <Input value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />}</div>
}

function emptyBranch(): Branch {
  return { id: `branch-${Date.now().toString(36)}`, kind: 'branch', name: blankBi(), district: blankBi(), division: blankBi(), address: blankBi(), lat: 0, lng: 0, manager: { name: blankBi(), title: blankBi(), phone: '', email: '' } }
}

function BranchDirectoryEditor({ value, onChange }: { value: Branch[]; onChange: (next: Branch[]) => void }) {
  const [expanded, setExpanded] = useState<number[]>(value.length ? [0] : [])
  const update = (index: number, patch: Partial<Branch>) => onChange(value.map((branch, i) => i === index ? { ...branch, ...patch } : branch))
  const updateManager = (index: number, patch: Partial<NonNullable<Branch['manager']>>) => {
    const current = value[index]
    update(index, { manager: { ...(current.manager ?? {}), ...patch } })
  }
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
    setExpanded((current) => current.map((item) => item === index ? target : item === target ? index : item))
  }
  return <div className="portfolio-structured-list grid gap-2.5 min-w-0">
    <div className="portfolio-structured-list-top flex items-center justify-between gap-3 flex-wrap pb-2.25 [border-bottom:1px_solid_var(--border)] [&>div]:grid [&>div]:gap-0.75 [&>div]:min-w-0 [&>div_strong]:text-[0.875rem] [&>div_small]:text-[0.75rem] [&>div_small]:leading-[1.4] [&>div_small]:text-muted-foreground"><div><strong>Office and branch directory</strong><small>These locations power the animated Bangladesh map, portfolio branch directory and contact-page footprint. Coordinates control pin placement; manager details populate the map detail card.</small></div><Button size="sm" variant="outline" onClick={() => { onChange([...value, emptyBranch()]); setExpanded((current) => [...current, value.length]) }}><Plus size={14} /> Add location</Button></div>
    {value.map((branch, index) => {
      const open = expanded.includes(index)
      const name = branch.name ?? blankBi()
      const manager = branch.manager ?? {}
      return <div className="portfolio-structured-item [background:var(--card)] [overflow:hidden] [min-width:0]" key={`${branch.id || 'branch'}-${index}`}>
        <div className="portfolio-structured-item-head [display:flex] [align-items:center] [justify-content:space-between] [gap:8px] [padding:7px_9px] [background:var(--background)] [min-width:0] [&>button:first-child]:[display:flex] [&>button:first-child]:[align-items:center] [&>button:first-child]:[gap:7px] [&>button:first-child]:[flex:1] [&>button:first-child]:[min-width:0] [&>button:first-child]:[border:0] [&>button:first-child]:[background:transparent] [&>button:first-child]:[color:var(--foreground)] [&>button:first-child]:[text-align:left] [&>button:first-child]:[cursor:pointer] [&>button:first-child_strong]:[font-size:0.875rem] [&>button:first-child_strong]:[overflow-wrap:anywhere] [&>button:first-child_span]:[font-size:0.75rem] [&>button:first-child_span]:[color:var(--muted-foreground)] [&>button:first-child_span]:[overflow-wrap:anywhere] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:2px] [&>div]:[flex:0_0_auto] max-[700px]:[align-items:flex-start] max-[700px]:[&>button:first-child]:[align-items:flex-start] [gap:10px] [cursor:pointer] [list-style:none] [&::-webkit-details-marker]:[display:none] [&::after]:[content:'▾'] [&::after]:[color:var(--muted-foreground)] [&::after]:[margin-left:auto]"><Button type="button" onClick={() => setExpanded((current) => open ? current.filter((n) => n !== index) : [...current, index])}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<strong>{name.en || name.bn || `Location ${index + 1}`}</strong><span>{branch.kind === 'head' ? 'Head office' : 'Branch'}</span></Button><div><Button type="button" className="cms-icon-button grid place-items-center w-6.75 h-6.75 border border-border rounded-lg text-muted-foreground cursor-pointer [&:hover]:text-destructive [&:hover]:border-[currentColor] [&:hover]:[background:var(--muted)] [&.danger:hover]:text-destructive [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:min-w-11 [@media((pointer:coarse))]:min-h-11" aria-label="Move location up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></Button><Button type="button" className="cms-icon-button grid place-items-center w-6.75 h-6.75 rounded-lg bg-transparent text-muted-foreground cursor-pointer [&:hover]:text-destructive [&:hover]:border-[currentColor] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:min-w-11 [@media((pointer:coarse))]:min-h-11" aria-label="Move location down" disabled={index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></Button><Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px] danger" aria-label="Remove location" onClick={() => { if (!confirm(`Remove ${name.en || name.bn || `location ${index + 1}`} from the map?`)) return; onChange(value.filter((_, i) => i !== index)); setExpanded((current) => current.filter((n) => n !== index).map((n) => n > index ? n - 1 : n)) }}><Trash2 size={14} /></Button></div></div>
        {open && <div className="portfolio-structured-fields grid gap-3.5 [padding:12px] [min-width:0] [&_.cms-media-control]:[min-width:0] max-[700px]:[padding:9px]">
          <div className="cms-form-grid grid grid-cols-2 [gap:10px] max-[760px]:[grid-template-columns:1fr] max-[720px]:[grid-template-columns:1fr] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Location type</span><NativeSelect value={branch.kind === 'head' ? 'head' : 'branch'} onChange={(e) => update(index, { kind: e.target.value as Branch['kind'] })}><option value="head">Head office</option><option value="branch">Branch office</option></NativeSelect></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Unique ID / map key</span><Input value={branch.id} onChange={(e) => update(index, { id: e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') })} /></label></div>
          <BilingualInputs label="Location name" value={name} onChange={(next) => update(index, { name: next })} />
          <BilingualInputs label="District" value={branch.district ?? blankBi()} onChange={(next) => update(index, { district: next })} />
          <BilingualInputs label="Division" value={branch.division ?? blankBi()} onChange={(next) => update(index, { division: next })} />
          <BilingualInputs label="Street address" value={branch.address ?? blankBi()} multiline onChange={(next) => update(index, { address: next })} />
          <div className="cms-form-grid grid [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Latitude</span><Input type="number" step="any" value={String(branch.lat ?? '')} onChange={(e) => update(index, { lat: e.target.value === '' ? Number.NaN : Number(e.target.value) })} /></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Longitude</span><Input type="number" step="any" value={String(branch.lng ?? '')} onChange={(e) => update(index, { lng: e.target.value === '' ? Number.NaN : Number(e.target.value) })} /></label></div>
          <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Branch manager details (optional)</legend><BilingualInputs label="Manager name" value={manager.name ?? blankBi()} onChange={(next) => updateManager(index, { name: next })} /><BilingualInputs label="Manager title" value={manager.title ?? blankBi()} onChange={(next) => updateManager(index, { title: next })} /><div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Manager phone</span><Input value={String(manager.phone ?? '')} onChange={(e) => updateManager(index, { phone: e.target.value })} /></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Manager email</span><Input type="email" value={String(manager.email ?? '')} onChange={(e) => updateManager(index, { email: e.target.value })} /></label></div></fieldset>
        </div>}
      </div>
    })}
    {!value.length && <div className="admin-empty-state [padding:22px] [color:var(--muted-foreground)] [text-align:center] [font-size:0.75rem] [min-height:110px] [display:grid] [place-items:center] [padding:20px] [font-size:0.875rem] [border:1px_dashed_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)]">No locations configured. Add the head office and verified branch coordinates before saving.</div>}
  </div>
}

type FriendlyField = { key: string; label: string; kind: 'text' | 'textarea' | 'date' | 'url' | 'image' | 'document' | 'select' | 'bilingualLines'; bilingual?: boolean; options?: { value: string; label: string }[] }
const ILLUSTRATION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Automatic / component default' },
  { value: 'mission', label: 'Mission — progress journey' },
  { value: 'vision', label: 'Vision — shared horizon' },
  { value: 'values', label: 'Values — balance and integrity' },
  { value: 'heart', label: 'Heart — health and care' },
  { value: 'book', label: 'Book — education and learning' },
  { value: 'users', label: 'People — community' },
  { value: 'coins', label: 'Coins — finance and inclusion' },
  { value: 'sprout', label: 'Sprout — agriculture and growth' },
  { value: 'store', label: 'Store — enterprise' },
  { value: 'women-business', label: 'Women in business' },
  { value: 'small-enterprise', label: 'Small enterprise' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'migrant-household', label: 'Migrant household' },
  { value: 'rural-development', label: 'Rural development' },
  { value: 'career', label: 'Career and employment' },
  { value: 'education', label: 'Education' },
]
const FRIENDLY_FIELDS: Partial<Record<Section['type'], { title: string; singular: string; fields: FriendlyField[] }>> = {
  cards: { title: 'Cards', singular: 'card', fields: [
    { key: 'title', label: 'Card title', kind: 'text', bilingual: true }, { key: 'body', label: 'Card description', kind: 'textarea', bilingual: true },
    { key: 'tag', label: 'Tag / category', kind: 'text', bilingual: true }, { key: 'href', label: 'Link / destination', kind: 'url' },
    { key: 'icon', label: 'Card icon (standard cards)', kind: 'select', options: [{ value: 'heart', label: 'Heart' }, { value: 'leaf', label: 'Leaf' }, { value: 'book', label: 'Book' }, { value: 'scale', label: 'Scale / rights' }, { value: 'users', label: 'People' }, { value: 'sun', label: 'Sun / climate' }, { value: 'droplets', label: 'Water' }, { value: 'briefcase', label: 'Briefcase / work' }, { value: 'coins', label: 'Coins / finance' }, { value: 'building', label: 'Building' }, { value: 'megaphone', label: 'Megaphone' }, { value: 'shield', label: 'Shield / values' }, { value: 'check', label: 'Check' }] },
    { key: 'image.src', label: 'Custom illustration image (overrides the selected artwork)', kind: 'image' }, { key: 'image.alt', label: 'Illustration alternative text', kind: 'text', bilingual: true },
    { key: 'illustration', label: 'Reusable illustration', kind: 'select', options: ILLUSTRATION_OPTIONS },
    { key: 'chips', label: 'Highlights / chips (one per line in each language)', kind: 'bilingualLines' },
  ] },
  stats: { title: 'Statistics', singular: 'statistic', fields: [
    { key: 'value', label: 'Value (e.g. 25,000+)', kind: 'text' }, { key: 'label', label: 'Label', kind: 'text', bilingual: true }, { key: 'note', label: 'Supporting note', kind: 'text', bilingual: true }, { key: 'icon', label: 'Statistic icon', kind: 'select', options: [{ value: 'users', label: 'People' }, { value: 'briefcase', label: 'Briefcase' }, { value: 'home', label: 'Home / village' }, { value: 'building', label: 'Building' }, { value: 'heart', label: 'Heart' }, { value: 'leaf', label: 'Leaf' }, { value: 'coins', label: 'Coins' }, { value: 'shield', label: 'Shield' }] },
    { key: 'illustration', label: 'Optional reusable illustration', kind: 'select', options: ILLUSTRATION_OPTIONS }, { key: 'image.src', label: 'Custom statistic illustration image', kind: 'image' }, { key: 'image.alt', label: 'Illustration alternative text', kind: 'text', bilingual: true },
  ] },
  gallery: { title: 'Gallery images', singular: 'image', fields: [
    { key: 'src', label: 'Image', kind: 'image' }, { key: 'alt', label: 'Alternative text', kind: 'text', bilingual: true }, { key: 'caption', label: 'Caption', kind: 'text', bilingual: true },
  ] },
  timeline: { title: 'Timeline milestones', singular: 'milestone', fields: [
    { key: 'year', label: 'Year / date', kind: 'text' }, { key: 'title', label: 'Milestone title', kind: 'text', bilingual: true }, { key: 'body', label: 'Description', kind: 'textarea', bilingual: true }, { key: 'details', label: 'Highlights / details (one per line in each language)', kind: 'bilingualLines' },
  ] },
  noticeList: { title: 'Notices', singular: 'notice', fields: [
    { key: 'date', label: 'Notice date', kind: 'date' }, { key: 'title', label: 'Title', kind: 'text', bilingual: true }, { key: 'body', label: 'Description', kind: 'textarea', bilingual: true }, { key: 'href', label: 'Read more link', kind: 'url' },
  ] },
  carousel: { title: 'Carousel items', singular: 'item', fields: [
    { key: 'title', label: 'Title', kind: 'text', bilingual: true }, { key: 'body', label: 'Description', kind: 'textarea', bilingual: true }, { key: 'tag', label: 'Tag / category', kind: 'text', bilingual: true },
    { key: 'href', label: 'Destination link', kind: 'url' }, { key: 'image.src', label: 'Image', kind: 'image' }, { key: 'image.alt', label: 'Image alternative text', kind: 'text', bilingual: true }, 
  ] },
  reports: { title: 'Reports and downloads', singular: 'report', fields: [
    { key: 'title', label: 'Report title', kind: 'text', bilingual: true }, { key: 'description', label: 'Description', kind: 'textarea', bilingual: true }, { key: 'file', label: 'PDF attachment', kind: 'document' }, { key: 'publishedAt', label: 'Publication date', kind: 'date' }, { key: 'category', label: 'Category', kind: 'text', bilingual: true },
  ] },
}
function isJsonObject(value: ExternalValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function getPath(obj: JsonObject, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = obj
  for (const key of path.split('.')) {
    if (!isJsonObject(current)) return undefined
    current = current[key]
  }
  return current
}
function setPath(obj: JsonObject, path: string, value: JsonValue): JsonObject {
  const keys = path.split('.').filter(Boolean)
  if (!keys.length) return obj
  const next: JsonObject = { ...obj }
  let target = next
  let source: JsonObject = obj
  for (const key of keys.slice(0, -1)) {
    const previous = source[key]
    const child: JsonObject = isJsonObject(previous) ? { ...previous } : {}
    target[key] = child
    target = child
    source = isJsonObject(previous) ? previous : {}
  }
  target[keys[keys.length - 1]] = value
  return next
}
function blankFriendlyItem(fields: FriendlyField[]) {
  let item: JsonObject = {}
  for (const field of fields) item = setPath(item, field.key, field.bilingual ? { en: '', bn: '' } : field.kind === 'bilingualLines' ? [] : field.kind === 'select' ? (field.options?.[0]?.value ?? '') : '')
  return item
}
function linesToBilingual(value: ExternalValue): Bilingual {
  const chips: ExternalValue[] = Array.isArray(value) ? value : []
  return { en: chips.map((value) => String(isJsonObject(value) ? value.en ?? '' : '')).join('\n'), bn: chips.map((value) => String(isJsonObject(value) ? value.bn ?? '' : '')).join('\n') }
}
function bilingualToLines(value: Bilingual): Bilingual[] {
  const en = value.en.split('\n')
  const bn = value.bn.split('\n')
  return Array.from({ length: Math.max(en.length, bn.length) }, (_, index) => ({ en: en[index]?.trim() ?? '', bn: bn[index]?.trim() ?? '' })).filter((item) => item.en || item.bn)
}
function FriendlyListEditor({ section, onChange }: { section: PageSection; onChange: (section: PageSection) => void }) {
  const config = FRIENDLY_FIELDS[section.type]
  const rawItems = (section as JsonObject).items
  const items: JsonObject[] = Array.isArray(rawItems) ? rawItems.filter(isJsonObject) : []
  const [expanded, setExpanded] = useState<number[]>(items.length ? [0] : [])
  if (!config) return null
  // Capture the narrowed configuration for callbacks; TypeScript does not
  // preserve the outer guard's narrowing for mutable closure references.
  const fields = config.fields
  const activeFields = section.type === 'cards'
    ? section.homeComponent === 'missionVisionValues'
      ? fields.filter((field) => !['href', 'icon'].includes(field.key))
      : section.homeComponent === 'developmentAreas'
        ? fields.filter((field) => field.key !== 'icon')
        : fields
    : section.type === 'carousel' && section.homeComponent === 'hero'
      ? fields.filter((field) => field.key !== 'tag')
      : fields
  function update(index: number, key: string, value: JsonValue) {
    const next = items.map((item, i) => i === index ? setPath(item, key, value) : item)
    onChange({ ...section, items: next } as PageSection)
  }
  function add() {
    const next = [...items, blankFriendlyItem(activeFields)]
    onChange({ ...section, items: next } as PageSection); setExpanded((current) => [...current, next.length - 1])
  }
  function move(index: number, delta: number) {
    const next = [...items]; const target = index + delta
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1); next.splice(target, 0, item)
    onChange({ ...section, items: next } as PageSection); setExpanded((current) => current.map((n) => n === index ? target : n === target ? index : n))
  }
  return <fieldset className="cms-array-fieldset col-span-full [background:var(--background)] [&>legend]:flex [&>legend]:items-center [&>legend]:gap-1.25 [&>legend_span]:text-[0.75rem] [&>legend_span]:text-muted-foreground [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:rounded-[999px] [&>legend_span]:p-[2px_6px] min-w-0 [border:1px_solid_var(--border)] rounded-(--radius,var(--radius)) p-3 [&>legend]:p-[0_5px] [&>legend]:text-[0.75rem] [&>legend]:font-semibold [&>legend]:text-muted-foreground cms-friendly-list grid gap-2.5 mt-3.5 [&>legend]:px-1.5"><legend>{config.title}</legend>
    <p className="admin-small-note">Manage each item without JSON. Choose a reusable illustration preset or upload a custom image for each card/statistic; the selection is saved with this page in the database and reused by its renderer.</p>
    <div className="cms-repeat-list grid gap-1.75">
      {items.map((item, index) => {
        const itemTitle = getPath(item, 'title') ?? getPath(item, 'label') ?? getPath(item, 'value') ?? getPath(item, 'year') ?? getPath(item, 'date')
        const bilingualTitle = getBilingual(itemTitle)
        const titleText = bilingualTitle
          ? (bilingualTitle.en || bilingualTitle.bn)
          : typeof itemTitle === 'string' || typeof itemTitle === 'number'
            ? itemTitle
            : ''
        const isOpen = expanded.includes(index)
        return <div className="cms-repeat-item p-2.25 [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] max-[480px]:p-1.75 [content-visibility:auto] [contain-intrinsic-size:auto_44px] overflow-hidden" key={`${section.type}-${index}`}>
          <div className="cms-repeat-head flex items-center justify-between gap-2 mb-2 [&_strong]:text-[0.75rem] [&_strong]:text-muted-foreground p-0.75 [background:var(--background)] [&>strong]:p-[7px_8px] [&>strong]:[font-size:0.875rem] [&>strong]:[flex:1] [&_button:disabled]:[opacity:.3] [&_button:disabled]:[cursor:not-allowed] [flex-wrap:wrap] [&_.cms-icon-button]:[min-width:34px] [&_.cms-icon-button]:[min-height:34px] [&_.cms-icon-button]:[display:inline-grid] [&_.cms-icon-button]:[place-items:center] [&_button:focus-visible]:[outline-offset:1px]">
            <Button type="button" className="cms-repeat-toggle [display:flex] items-center [gap:6px] [min-width:0] [padding:0] [border:0] [background:none] [color:inherit] [text-align:left] [&_strong]:[overflow:hidden] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] [flex:1] [gap:5px] [background:transparent] [padding:7px] [color:var(--foreground)] [cursor:pointer] [&_strong]:[font-size:0.75rem] [min-height:38px]" onClick={() => setExpanded((current) => isOpen ? current.filter((n) => n !== index) : [...current, index])}>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<strong>{index + 1}. {String(titleText || `${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${index + 1}`)}</strong>
            </Button>
            <Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px]" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${config.singular} up`}><ArrowUp size={14} /></Button>
            <Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px]" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${config.singular} down`}><ArrowDown size={14} /></Button>
            <Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px] danger" onClick={() => { if (!confirm(`Remove ${config.singular} ${index + 1}?`)) return; onChange({ ...section, items: items.filter((_, i) => i !== index) } as PageSection); setExpanded((current) => current.filter((n) => n !== index).map((n) => n > index ? n - 1 : n)) }} aria-label={`Remove ${config.singular}`}><Trash2 size={14} /></Button>
          </div>
          {isOpen && <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr] cms-friendly-fields [padding:12px] [min-width:0] [&_.cms-media-control]:[grid-column:1/-1] [&_.pb-bilingual]:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] [&_.pb-bilingual_textarea]:[min-width:0] [&_.pb-bilingual_Input]:[min-width:0] max-[700px]:[&_.pb-bilingual]:[grid-template-columns:1fr]">
            {activeFields.map((field) => field.kind === 'bilingualLines'
              ? <div key={field.key} className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label={field.label} value={linesToBilingual(getPath(item, field.key))} multiline onChange={(value) => update(index, field.key, bilingualToLines(value))} /></div>
              : field.bilingual
                ? <div key={field.key} className={field.kind === 'textarea' ? 'cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]' : ''}><BilingualInputs label={field.label} value={getBilingual(getPath(item, field.key)) ?? blankBi()} multiline={field.kind === 'textarea'} onChange={(value) => update(index, field.key, value)} /></div>
                : field.kind === 'image' || field.kind === 'document'
                  ? <div key={field.key} className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><MediaField label={field.label} value={getStringPath(item, field.key)} onChange={(value) => update(index, field.key, value)} kind={field.kind === 'document' ? 'document' : 'image'} alt={String(getPath(item, 'title.en') ?? '')} /></div>
                  : field.kind === 'select'
                    ? field.key === 'illustration'
                      ? <div key={field.key} className="cms-illustration-editor [display:grid] [grid-template-columns:minmax(0,1fr)_104px] [gap:12px] [align-items:end] max-[600px]:[grid-template-columns:minmax(0,1fr)_84px] cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{field.label}</span><NativeSelect value={String(getPath(item, field.key) ?? '')} onChange={(e) => update(index, field.key, e.target.value)}>{(field.options ?? []).map((option) => <option key={option.value || 'automatic'} value={option.value}>{option.label}</option>)}</NativeSelect></label><div className="cms-illustration-editor-preview [width:104px] [height:88px] [overflow:hidden] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--muted)] [&_.cms-card-illustration]:[height:100%] [&_.cms-card-illustration]:[padding:3px] [&_.cms-card-illustration]:[border-radius:inherit] max-[600px]:[width:84px] max-[600px]:[height:78px]"><CmsCardIllustration name={(String(getPath(item, field.key) || (section.homeComponent === 'missionVisionValues' ? (index === 0 ? 'mission' : index === 1 ? 'vision' : 'values') : 'users')) as IllustrationName)} imageSrc={String(getPath(item, 'image.src') || '') || undefined} alt={String(getPath(item, 'title.en') || getPath(item, 'label.en') || `${config.singular} ${index + 1}`)} compact /></div></div>
                      : <label key={field.key} className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{field.label}</span><NativeSelect value={String(getPath(item, field.key) ?? field.options?.[0]?.value ?? '')} onChange={(e) => update(index, field.key, e.target.value)}>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</NativeSelect></label>
                    : <label key={field.key} className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{field.label}</span><Input type={field.kind === 'date' ? 'date' : 'text'} value={String(getPath(item, field.key) ?? '')} onChange={(e) => update(index, field.key, e.target.value)} placeholder={field.kind === 'url' ? '/projects/example or https://…' : undefined} /></label>)}
          </div>}
        </div>
      })}
      {!items.length && <div className="admin-empty-state [padding:22px] [color:var(--muted-foreground)] [text-align:center] [font-size:0.75rem] [min-height:110px] [display:grid] [place-items:center] [padding:20px] [font-size:0.875rem] [border:1px_dashed_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)]">No items yet. Add the first {config.singular} below.</div>}
    </div>
    <Button type="button" className="cms-add-row [display:inline-flex] [align-items:center] [gap:6px] [width:max-content] [border:1px_dashed_var(--border)] [border-radius:var(--radius)] [background:transparent] [padding:7px_9px] [color:var(--primary,var(--primary))] [font-size:0.75rem] [font-weight:600] [cursor:pointer] [&:hover]:[background:var(--muted)] [border-radius:var(--radius,_var(--radius))] [color:var(--primary)] [min-height:34px] [border:1px_dashed_color-mix(in_srgb,var(--primary)_45%,var(--border))]" onClick={add}><Plus size={14} /> Add {config.singular}</Button>
  </fieldset>
}

function TableRowsEditor({ section, onChange }: { section: PageSection; onChange: (section: PageSection) => void }) {
  if (section.type !== 'table') return null
  const headers = Array.isArray(section.headers) ? section.headers : []
  const rows = Array.isArray(section.rows) ? section.rows : []
  const setHeaders = (next: Bilingual[]) => onChange({ ...section, headers: next, rows: rows.map((row) => Array.from({ length: next.length }, (_, i) => row[i] ?? blankBi())) })
  const setCell = (rowIndex: number, colIndex: number, value: Bilingual) => onChange({ ...section, rows: rows.map((row, r) => r === rowIndex ? row.map((cell, c) => c === colIndex ? value : cell) : row) })
  return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)] cms-friendly-list [display:grid] [gap:10px] [margin-top:14px] [min-width:0] [&>legend]:[font-size:0.875rem] [&>legend]:[font-weight:600] [&>legend]:[padding-inline:6px]"><legend>Table columns and rows</legend>
    <div className="cms-friendly-table-columns [display:grid] [gap:10px] [margin-block:10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">{headers.map((header, i) => <div className="cms-repeat-item [padding:9px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] max-[480px]:[padding:7px] [padding:8px] [content-visibility:auto] [contain-intrinsic-size:auto_44px] [border-radius:var(--radius,_var(--radius))] [overflow:hidden]" key={`h-${i}`}><div className="cms-repeat-head [display:flex] [align-items:center] [justify-content:space-between] [gap:8px] [margin-bottom:8px] [&_strong]:[font-size:0.75rem] [&_strong]:[color:var(--muted-foreground)] [gap:5px] [padding:3px] [background:var(--background)] [&>strong]:[padding:7px_8px] [&>strong]:[font-size:0.875rem] [&>strong]:[flex:1] [&_button:disabled]:[opacity:.3] [&_button:disabled]:[cursor:not-allowed] [flex-wrap:wrap] [&_.cms-icon-button]:[min-width:34px] [&_.cms-icon-button]:[min-height:34px] [&_.cms-icon-button]:[display:inline-grid] [&_.cms-icon-button]:[place-items:center] [&_button:focus-visible]:[outline-offset:1px]"><strong>Column {i + 1}</strong><Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px] danger" onClick={() => setHeaders(headers.filter((_, j) => i !== j))} aria-label="Remove column"><Trash2 size={14} /></Button></div><div className="cms-friendly-cell [padding:10px]"><BilingualInputs label="Column heading" value={header} onChange={(value) => setHeaders(headers.map((h, j) => j === i ? value : h))} /></div></div>)}</div>
    <Button type="button" className="cms-add-row [display:inline-flex] [align-items:center] [gap:6px] [width:max-content] [border:1px_dashed_var(--border)] [border-radius:var(--radius)] [background:transparent] [padding:7px_9px] [color:var(--primary,var(--primary))] [font-size:0.75rem] [font-weight:600] [cursor:pointer] [&:hover]:[background:var(--muted)] [border-radius:var(--radius,_var(--radius))] [color:var(--primary)] [min-height:34px] [border:1px_dashed_color-mix(in_srgb,var(--primary)_45%,var(--border))]" onClick={() => setHeaders([...headers, blankBi()])}><Plus size={14} /> Add column</Button>
    <div className="cms-friendly-table-rows [display:grid] [gap:10px] [margin-block:10px]">{rows.map((row, ri) => <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]" key={`row-${ri}`}><legend>Row {ri + 1}</legend><div className="cms-friendly-row-cells [display:grid] [grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))] [gap:12px]">{headers.map((header, ci) => <div key={`cell-${ri}-${ci}`}><BilingualInputs label={header.en || header.bn || `Column ${ci + 1}`} value={row[ci] ?? blankBi()} onChange={(value) => setCell(ri, ci, value)} /></div>)}</div><Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px] danger" onClick={() => onChange({ ...section, rows: rows.filter((_, i) => i !== ri) } as PageSection)}><Trash2 size={14} /> Remove row</Button></fieldset>)}</div>
    <Button type="button" className="cms-add-row [display:inline-flex] [align-items:center] [gap:6px] [width:max-content] [border:1px_dashed_var(--border)] [border-radius:var(--radius)] [background:transparent] [padding:7px_9px] [color:var(--primary,var(--primary))] [font-size:0.75rem] [font-weight:600] [cursor:pointer] [&:hover]:[background:var(--muted)] [border-radius:var(--radius,_var(--radius))] [color:var(--primary)] [min-height:34px] [border:1px_dashed_color-mix(in_srgb,var(--primary)_45%,var(--border))]" onClick={() => onChange({ ...section, rows: [...rows, headers.map(() => blankBi())] } as PageSection)}><Plus size={14} /> Add row</Button>
  </fieldset>
}

function SectionExtrasEditor({ section, onChange }: { section: PageSection; onChange: (section: PageSection) => void }) {
  const set = (key: string, value: ExternalValue) => onChange({ ...section, [key]: value } as PageSection)
  if (section.type === 'stats') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Statistics section options</legend>
    <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Illustration year / label</span><Input value={section.illustrationYear ?? '1985'} onChange={(e) => set('illustrationYear', e.target.value)} placeholder="1985" /></label></div>
    <BilingualInputs label="Supporting text beside statistics" value={section.introBody ?? blankBi()} multiline onChange={(introBody) => set('introBody', introBody)} />
  </fieldset>
  if (section.type === 'cards') {
    const headingText = (section.heading?.en ?? '').trim().toLowerCase()
    const cardItems = Array.isArray(section.items) ? section.items : []
    const isEnterpriseFeed = headingText === 'srizony enterprises' || cardItems.some((item) => item.href?.startsWith('/enterprise-development/'))
    const isMissionStory = section.homeComponent === 'missionVisionValues' || headingText === 'mission, vision & values'
    const isDevelopmentAreas = section.homeComponent === 'developmentAreas' || headingText === 'integrated development areas'
    return <>
      {!isMissionStory && <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Card layout</legend><div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]">
        <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Columns (desktop)</span><NativeSelect value={String(section.columns ?? 3)} onChange={(e) => set('columns', Number(e.target.value) as 2 | 3 | 4)}><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option></NativeSelect></label>
        {!isDevelopmentAreas && <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Visual style</span><NativeSelect value={section.variant ?? 'default'} onChange={(e) => set('variant', e.target.value as 'default' | 'impact')}><option value="default">Standard cards</option><option value="impact">Impact cards</option></NativeSelect></label>}
      </div></fieldset>}
      {isEnterpriseFeed && <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Enterprise card source</legend>
        <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Card data source</span><NativeSelect value={section.dataSource ?? 'published-feed'} onChange={(e) => set('dataSource', e.target.value as 'manual' | 'published-feed')}><option value="published-feed">Synchronize from published Enterprise Site Content</option><option value="manual">Use the cards edited above</option></NativeSelect></label>
        <p className="admin-small-note">Manual mode preserves these titles, descriptions, images, illustration choices and routes. Published-feed mode synchronizes from Site Content → Enterprises.</p>
      </fieldset>}
      {isMissionStory && <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Scroll sequence options</legend><BilingualInputs label="Scroll hint" value={getBilingual((section as JsonObject).scrollHint) ?? { en: 'Keep scrolling', bn: 'স্ক্রল করুন' }} onChange={(scrollHint) => set('scrollHint', scrollHint)} /></fieldset>}
    </>
  }
  if (section.type === 'gallery') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Gallery layout</legend><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Columns (desktop)</span><NativeSelect value={String(section.columns ?? 3)} onChange={(e) => set('columns', Number(e.target.value) as 2 | 3 | 4)}><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option></NativeSelect></label></fieldset>
  if (section.type === 'timeline') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Timeline layout</legend><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Presentation</span><NativeSelect value={section.variant ?? 'list'} onChange={(e) => set('variant', e.target.value as 'list' | 'journey')}><option value="list">Vertical timeline</option><option value="journey">Journey milestones</option></NativeSelect></label><p className="admin-small-note">Journey presentation places milestones along a connected horizontal sequence on larger screens and stacks them for mobile.</p></fieldset>
  if (section.type === 'carousel') {
    const headingText = (section.heading?.en ?? '').trim().toLowerCase()
    const isNewsRail = section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed' || headingText === 'news from the field' || headingText === 'latest news'
    const isSuccessGallery = section.homeComponent === 'successStories' || headingText === 'success stories of srizony' || headingText === 'success story of srizony'
    const isManagedLandingFeed = isNewsRail || isSuccessGallery
    const isHero = section.homeComponent === 'hero'
    return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>{isNewsRail ? 'News rail settings' : isSuccessGallery ? 'Success stories gallery settings' : 'Carousel collection options'}</legend>
      {isHero && <p className="admin-small-note">This collection is rendered as the full-width animated homepage hero. Edit each slide image, alternative text, title, description and route here. The existing site-wide hero copy and autoplay configuration remain in effect. Office map pins are managed in the “Our offices across Bangladesh” section.</p>}
      {isNewsRail && <><p className="admin-small-note">This is the animated News Rail. Add and manage its cards below; each card is a database-managed News record and links to /news/{'{news-slug}'}. Success Stories never appear here.</p><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Maximum cards displayed</span><Input type="number" min={2} max={12} value={String((section as JsonObject).maxItems ?? 8)} onChange={(e) => set('maxItems', Math.max(2, Math.min(12, Number(e.target.value) || 8)))} /></label><LandingCollectionCardsEditor component="news" /></>}
      {isSuccessGallery && <><p className="admin-small-note">This is the image-first Success Stories Gallery. Add and manage its cards below; published stories with an approved image appear here. Cards show only the image and title and link to /success-stories/{'{story-slug}'}.</p><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Maximum cards displayed</span><Input type="number" min={2} max={12} value={String((section as JsonObject).maxItems ?? 8)} onChange={(e) => set('maxItems', Math.max(2, Math.min(12, Number(e.target.value) || 8)))} /></label><LandingCollectionCardsEditor component="success-story" /></>}
      {!isManagedLandingFeed && !isHero && <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Presentation</span><NativeSelect value={section.presentation ?? 'collection'} onChange={(e) => set('presentation', e.target.value as 'collection' | 'scroller')}><option value="collection">Collection grid</option><option value="scroller">Animated horizontal scroller</option></NativeSelect></label>}
    </fieldset>
  }
  if (section.type === 'richText') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>{section.homeComponent === 'locations' ? 'Map section options' : 'Text section options'}</legend>
    {section.homeComponent === 'locations'
      ? <p className="admin-small-note">This section renders the interactive branch map. Edit its heading and bilingual text above, then manage pin names, coordinates, addresses and manager details in the Office & Branch Locations editor below.</p>
      : <><div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Image position</span><NativeSelect value={section.reverse ? 'reverse' : 'normal'} onChange={(e) => set('reverse', e.target.value === 'reverse')}><option value="normal">Image after text</option><option value="reverse">Image before text</option></NativeSelect></label></div>
        <MediaField label="Supporting image" value={section.image?.src ?? ''} alt={section.image?.alt?.en ?? section.heading?.en ?? ''} onChange={(src) => set('image', src ? { ...(section.image ?? { alt: section.heading ?? blankBi() }), src, kind: 'image' } : undefined)} helper="Optional image for this text section." />
      </>}
  </fieldset>
  if (section.type === 'video') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Video and poster</legend>
    <MediaField label="Poster / thumbnail image" value={section.poster ?? ''} onChange={(poster) => set('poster', poster)} />
    <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Video embed URL</span><Input value={section.embedUrl ?? ''} onChange={(e) => set('embedUrl', e.target.value)} placeholder="https://www.youtube.com/embed/…" /></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Original video URL (optional)</span><Input value={section.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://…" /></label></div>
  </fieldset>
  if (section.type === 'diagram') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Diagram style</legend><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Visual type</span><NativeSelect value={section.variant} onChange={(e) => set('variant', e.target.value as typeof section.variant)}><option value="impact">Impact areas</option><option value="sdg">Sustainable Development Goals</option><option value="governance">Governance structure</option></NativeSelect></label></fieldset>
  if (section.type === 'cta') return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>{section.homeComponent === 'donate' ? 'Homepage call-to-action' : 'Call-to-action buttons'}</legend>
    <p className="admin-small-note">Use the shared “Buttons & destination routes” controls below to edit bilingual labels, visibility, internal routes, external URLs, anchor actions and secondary buttons. These controls are the single source of truth for the live section.</p>
  </fieldset>
  if (section.type === 'contact') {
    const lineList = (value: string[]) => (value ?? []).join('\n')
    const locations = section.locations ?? []
    return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Contact details and locations</legend>
      <BilingualInputs label="Address" value={section.address ?? blankBi()} multiline onChange={(address) => set('address', address)} />
      <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Phone numbers (one per line)</span><Textarea rows={3} value={lineList(section.phones ?? [])} onChange={(e) => set('phones', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Email addresses (one per line)</span><Textarea rows={3} value={lineList(section.emails ?? [])} onChange={(e) => set('emails', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></label></div>
      <BilingualInputs label="Map link label" value={getBilingual((section as JsonObject).mapLabel) ?? blankBi()} onChange={(mapLabel) => set('mapLabel', mapLabel)} />
      <div className="cms-friendly-list [display:grid] [gap:10px] [margin-top:14px] [min-width:0] [&>legend]:[font-size:0.875rem] [&>legend]:[font-weight:600] [&>legend]:[padding-inline:6px]"><div className="portfolio-structured-list-top [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [flex-wrap:wrap] [padding-bottom:9px] [border-bottom:1px_solid_var(--border)] [&>div]:[display:grid] [&>div]:[gap:3px] [&>div]:[min-width:0] [&>div_strong]:[font-size:0.875rem] [&>div_small]:[font-size:0.75rem] [&>div_small]:[line-height:1.4] [&>div_small]:[color:var(--muted-foreground)]"><div><strong>Office and branch locations</strong><small>Provide verified branch details and the map search phrase for each location.</small></div><Button size="sm" variant="outline" onClick={() => set('locations', [...locations, { name: blankBi(), address: blankBi(), mapQuery: '', phone: '', email: '', kind: 'branch' }])}><Plus size={14} /> Add location</Button></div>
        {locations.map((location, index) => <div className="cms-repeat-item [padding:9px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] max-[480px]:[padding:7px] [padding:8px] [content-visibility:auto] [contain-intrinsic-size:auto_44px] [border-radius:var(--radius,_var(--radius))] [overflow:hidden]" key={`location-${index}`}><div className="cms-repeat-head [display:flex] [align-items:center] [justify-content:space-between] [gap:8px] [margin-bottom:8px] [&_strong]:[font-size:0.75rem] [&_strong]:[color:var(--muted-foreground)] [gap:5px] [padding:3px] [background:var(--background)] [&>strong]:[padding:7px_8px] [&>strong]:[font-size:0.875rem] [&>strong]:[flex:1] [&_button:disabled]:[opacity:.3] [&_button:disabled]:[cursor:not-allowed] [flex-wrap:wrap] [&_.cms-icon-button]:[min-width:34px] [&_.cms-icon-button]:[min-height:34px] [&_.cms-icon-button]:[display:inline-grid] [&_.cms-icon-button]:[place-items:center] [&_button:focus-visible]:[outline-offset:1px]"><strong>Location {index + 1}</strong><Button type="button" className="cms-icon-button [display:grid] [place-items:center] [width:27px] [height:27px] [border:1px_solid_var(--border)] [border-radius:var(--radius)] [background:var(--card)] [color:var(--muted-foreground)] [cursor:pointer] [&:hover]:[color:var(--destructive)] [&:hover]:[border-color:currentColor] [border-radius:var(--radius,_var(--radius))] [width:30px] [height:30px] [border:0] [border-radius:var(--radius-small,_var(--radius))] [background:transparent] [&:hover]:[background:var(--muted)] [&.danger:hover]:[color:var(--destructive)] [&.danger:hover]:[background:color-mix(in_srgb,var(--destructive)_8%,var(--card))] [@media((pointer:coarse))]:[min-width:44px] [@media((pointer:coarse))]:[min-height:44px] danger" onClick={() => set('locations', locations.filter((_, i) => i !== index))} aria-label="Remove location"><Trash2 size={14} /></Button></div><div className="cms-friendly-fields [padding:12px] [min-width:0] [&_.cms-media-control]:[grid-column:1/-1] [&_.pb-bilingual]:[grid-template-columns:minmax(0,1fr)_minmax(0,1fr)] [&_.pb-bilingual_textarea]:[min-width:0] [&_.pb-bilingual_Input]:[min-width:0] max-[700px]:[&_.pb-bilingual]:[grid-template-columns:1fr]"><BilingualInputs label="Location name" value={location.name ?? blankBi()} onChange={(name) => set('locations', locations.map((l, i) => i === index ? { ...l, name } : l))} /><BilingualInputs label="Location address" value={location.address ?? blankBi()} multiline onChange={(address) => set('locations', locations.map((l, i) => i === index ? { ...l, address } : l))} /><div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Map search phrase</span><Input value={location.mapQuery ?? ''} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, mapQuery: e.target.value } : l))} /></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Location type</span><NativeSelect value={location.kind ?? 'branch'} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, kind: e.target.value as 'site' | 'branch' | 'footprint' } : l))}><option value="site">Head office</option><option value="branch">Branch office</option><option value="footprint">Project location</option></NativeSelect></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Phone (optional)</span><Input value={location.phone ?? ''} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, phone: e.target.value } : l))} /></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Email (optional)</span><Input type="email" value={location.email ?? ''} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, email: e.target.value } : l))} /></label></div></div></div>)}
      </div>
    </fieldset>
  }
  return null
}

function defaultSectionButton(section: PageSection): SectionButtonConfig {
  if (section.buttonConfig) return section.buttonConfig
  if (section.type === 'cta') {
    const primary = section.primary ?? { label: { en: 'Learn more', bn: 'আরও জানুন' }, href: section.homeComponent === 'donate' ? '/donate' : '/contact' }
    const secondary = section.secondary
    return {
      ...defaultButton(true),
      mode: secondary ? 'both' : 'primary',
      label: primary.label ?? { en: 'Learn more', bn: 'আরও জানুন' },
      href: primary.href ?? (section.homeComponent === 'donate' ? '/donate' : '/contact'),
      secondaryLabel: secondary?.label ?? { en: 'Contact us', bn: 'যোগাযোগ করুন' },
      secondaryHref: secondary?.href ?? '/contact',
    }
  }
  if (section.homeComponent === 'growth') return { ...defaultButton(true), label: { en: 'About us', bn: 'আমাদের সম্পর্কে' }, href: '/about-us' }
  if (section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed') return { ...defaultButton(true), label: { en: 'View all news', bn: 'সব সংবাদ দেখুন' }, href: '/news', action: 'route' }
  if (section.homeComponent === 'successStories') return { ...defaultButton(true), label: { en: 'View all success stories', bn: 'সব সাফল্যের গল্প দেখুন' }, href: '/success-stories', action: 'route' }
  return defaultButton(false)
}

function SectionCard({ section, index, total, pageSlug, isProjectsCatalogSection = false, onChange, onMove, onDuplicate, onRemove }: {
  section: PageSection; index: number; total: number; pageSlug: string; isProjectsCatalogSection?: boolean; onChange: (section: PageSection) => void; onMove: (delta: number) => void; onDuplicate: () => void; onRemove: () => void
}) {
  const [rawJson, setRawJson] = useState(JSON.stringify(section, null, 2))
  const [jsonError, setJsonError] = useState('')
  const [editorTab, setEditorTab] = useState<'content' | 'collection' | 'actions' | 'typography' | 'advanced'>('content')
  const type = section.type
  const isProjectsDatabaseSection = pageSlug === '/projects' && isProjectsCatalogSection
  const collectionManaged = Boolean(section.contentCollection?.enabled || isProjectsDatabaseSection || section.type === 'contentFeed')
  const commonChange = (key: string, value: ExternalValue) => onChange({ ...section, [key]: value } as PageSection)
  const heading = getBilingual((section as JsonObject).heading)
  const eyebrow = getBilingual((section as JsonObject).eyebrow)
  const bodyRaw = (section as JsonObject).body
  const body = getBilingual(bodyRaw) ?? (Array.isArray(bodyRaw) ? { en: bodyRaw.map((value: ExternalValue) => String(isJsonObject(value) ? value.en ?? '' : '')).join('\n'), bn: bodyRaw.map((value: ExternalValue) => String(isJsonObject(value) ? value.bn ?? '' : '')).join('\n') } : null)
  const button = defaultSectionButton(section)
  const editorId = `pb-section-${index}-editor`
  const setButton = (next: Partial<SectionButtonConfig>) => commonChange('buttonConfig', { ...button, ...next })

  function setBodyBoth(value: Bilingual) {
    const existing = (section as JsonObject).body
    if (Array.isArray(existing)) {
      const enLines = value.en.split('\n')
      const bnLines = value.bn.split('\n')
      const count = Math.max(enLines.length, bnLines.length)
      commonChange('body', Array.from({ length: count }, (_, i) => ({ en: enLines[i] ?? '', bn: bnLines[i] ?? '' })))
      return
    }
    commonChange('body', value)
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(rawJson)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !SECTION_TYPES.includes(parsed.type)) throw new Error('The section must be a JSON object with a valid type.')
      onChange({ ...parsed, visible: parsed.visible !== false } as PageSection)
      setJsonError('')
      toast.success('Section JSON applied.')
    } catch (e) { setJsonError(e instanceof Error ? e.message : 'Invalid JSON.') }
  }

  return <Card className={`pb-section-card [&_.pb-office-locations-card]:[margin:16px_0_6px] [border-left:3px_solid_rgb(var(--sidebar-border-rgb))] [overflow:visible] ${section.visible === false ? 'pb-section-hidden' : ''}`}>
    <CardHeader><div className="pb-section-head [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] max-[900px]:[align-items:flex-start] max-[900px]:[flex-direction:column] [align-items:flex-start] [flex-wrap:wrap] max-[720px]:[flex-direction:column]">
      <div className="pb-section-title [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [justify-content:flex-start] [min-width:0] [&>div]:[min-width:0] [&_svg]:[color:rgb(var(--sidebar-muted-rgb))] [&_svg]:[cursor:grab] [flex:1_1_190px] [&_svg]:[flex:0_0_auto] [&_[data-slot=card-title]]:[font-size:1rem] [&_[data-slot=card-title]]:[line-height:1.25] [&_[data-slot=card-description]]:[font-size:0.75rem] max-[720px]:[width:100%]"><div><CardTitle>{heading?.en || heading?.bn || `${type[0].toUpperCase()}${type.slice(1)} section ${index + 1}`}</CardTitle><CardDescription>Section {index + 1} of {total} · {type} · {section.visible === false ? 'Hidden' : 'Published'}</CardDescription></div></div>
      <div className="pb-section-actions [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [flex-wrap:wrap] [justify-content:flex-end] max-[900px]:[justify-content:flex-start] [flex:0_1_auto] [gap:5px] [&_[data-slot=button]]:[min-height:31px] [&_[data-slot=button]]:[padding-inline:8px] [&_[data-slot=button]]:[gap:5px] [&_[data-slot=button]]:[font-size:0.875rem] [&_[data-slot=button]_span]:[display:inline] max-[720px]:[width:100%] max-[720px]:[justify-content:flex-start] max-[720px]:[&_[data-slot=button]]:[flex:1_1_auto] max-[720px]:[&_[data-slot=button]_span]:[display:inline] max-[420px]:[&_[data-slot=button]]:[min-width:0] max-[420px]:[&_[data-slot=button]]:[padding-inline:6px] max-[720px]:[display:grid] max-[720px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[720px]:[&_[data-slot=button]]:[justify-content:center] max-[420px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[420px]:[&_[data-slot=button]]:[min-height:36px] max-[420px]:[&_[data-slot=button]]:[font-size:0.875rem]">
        <Button size="sm" variant="outline" onClick={() => onMove(-1)} disabled={index === 0} title="Move section up"><ArrowUp size={14} /><span>Up</span></Button>
        <Button size="sm" variant="outline" onClick={() => onMove(1)} disabled={index === total - 1} title="Move section down"><ArrowDown size={14} /><span>Down</span></Button>
        <Button size="sm" variant="outline" onClick={() => commonChange('visible', section.visible === false)} title={section.visible === false ? 'Show section' : 'Hide section'} aria-label={section.visible === false ? 'Show section' : 'Hide section'}>{section.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}<span>{section.visible === false ? 'Show' : 'Hide'}</span></Button>
        <Button size="sm" variant="outline" onClick={onDuplicate} title="Duplicate section" aria-label="Duplicate section"><Copy size={14} /><span>Duplicate</span></Button>
        <Button size="sm" variant="outline" className="cms-danger-outline [color:var(--destructive)] [border-color:color-mix(in_srgb,_var(--destructive)_28%,_var(--border))]" onClick={onRemove} title="Remove section" aria-label="Remove section"><Trash2 size={14} /><span>Remove</span></Button>
      </div>
    </div></CardHeader>
    <CardContent>
      <div className="pb-section-editor-tabs [display:flex] [align-items:center] [gap:5px] [overflow-x:auto] [margin:-3px_0_13px] [padding:0_0_8px] [border-bottom:1px_solid_var(--border)] [&_button]:[min-height:34px] [&_button]:[flex:0_0_auto] [&_button]:[padding:0_12px] [&_button]:[border:1px_solid_transparent] [&_button]:[border-radius:var(--radius,var(--radius))] [&_button]:[background:transparent] [&_button]:[color:var(--muted-foreground)] [&_button]:[font-size:0.875rem] [&_button]:[font-weight:600] [&_button]:[cursor:pointer] [&_button:hover]:[background:var(--muted)] [&_button:hover]:[color:var(--foreground)] [&_button.active]:[border-color:color-mix(in_srgb,var(--primary)_35%,var(--border))] [&_button.active]:[background:color-mix(in_srgb,var(--primary)_9%,var(--card))] [&_button.active]:[color:var(--primary)] max-[720px]:[margin-top:0] max-[720px]:[&_button]:[padding-inline:10px]" role="tablist" aria-label={`Section ${index + 1} editor areas`}>
        <Button type="button" id={`${editorId}-tab-content`} aria-controls={`${editorId}-panel-content`} role="tab" aria-selected={editorTab === 'content'} className={editorTab === 'content' ? 'active' : ''} onClick={() => setEditorTab('content')}>Content</Button>
        {!section.homeComponent && (COLLECTION_SECTION_TYPES.has(section.type) || section.contentCollection?.enabled || section.type === 'contentFeed') && <Button type="button" id={`${editorId}-tab-collection`} aria-controls={`${editorId}-panel-collection`} role="tab" aria-selected={editorTab === 'collection'} className={editorTab === 'collection' ? 'active' : ''} onClick={() => setEditorTab('collection')}>Collection</Button>}
        {section.homeComponent !== 'hero' && <Button type="button" id={`${editorId}-tab-actions`} aria-controls={`${editorId}-panel-actions`} role="tab" aria-selected={editorTab === 'actions'} className={editorTab === 'actions' ? 'active' : ''} onClick={() => setEditorTab('actions')}>Actions & routes</Button>}
        <Button type="button" id={`${editorId}-tab-typography`} aria-controls={`${editorId}-panel-typography`} role="tab" aria-selected={editorTab === 'typography'} className={editorTab === 'typography' ? 'active' : ''} onClick={() => setEditorTab('typography')}>Typography</Button>
        <Button type="button" id={`${editorId}-tab-advanced`} aria-controls={`${editorId}-panel-advanced`} role="tab" aria-selected={editorTab === 'advanced'} className={editorTab === 'advanced' ? 'active' : ''} onClick={() => setEditorTab('advanced')}>Advanced</Button>
      </div>
      <div id={`${editorId}-panel-content`} className="pb-section-tab-panel [display:grid] [gap:12px] [min-width:0] [&>.cms-array-fieldset:first-child]:[margin-top:0] [&_.pb-button-settings]:[margin-top:0] [&_.pb-button-settings]:[padding:14px] [&_.pb-button-settings]:[border:1px_solid_var(--border)] [&_.pb-button-settings]:[border-radius:var(--radius,var(--radius))] [&_.pb-button-settings>legend]:[padding-inline:6px] [&_.pb-button-settings>legend]:[font-size:0.875rem] [&_.pb-button-settings>legend]:[font-weight:600] [&[hidden]]:![display:none]" role="tabpanel" aria-labelledby={`${editorId}-tab-content`} hidden={editorTab !== 'content'}>
        <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr] pb-section-grid [margin-top:5px]">
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section content type</span><NativeSelect value={type} disabled={Boolean(section.homeComponent)} onChange={(e) => { const nextType = e.target.value as Section['type']; const next = blankSection(nextType, heading ?? blankBi()); next.visible = section.visible !== false; next.buttonConfig = button; onChange(next) }}>{(section.homeComponent ? [type] : SECTION_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}</NativeSelect></label>
          <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Section visibility</span><NativeSelect value={section.visible === false ? 'hidden' : 'visible'} onChange={(e) => commonChange('visible', e.target.value === 'visible')}><option value="visible">Show on site</option><option value="hidden">Hide on site</option></NativeSelect></label>
          {section.homeComponent !== 'hero' && heading && <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Heading" value={heading} onChange={(v) => commonChange('heading', v)} /></div>}
          {section.homeComponent !== 'hero' && eyebrow && <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Eyebrow / label" value={eyebrow} onChange={(v) => commonChange('eyebrow', v)} /></div>}
          {section.homeComponent !== 'hero' && body && !collectionManaged && section.type !== 'contentFeed' && <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Body / description" value={body} multiline onChange={setBodyBoth} /></div>}
        </div>
        {(section.homeComponent !== 'news' && section.homeComponent !== 'stories' && section.homeComponent !== 'newsFeed' && section.homeComponent !== 'successStories' && !collectionManaged) && <FriendlyListEditor section={section} onChange={onChange} />}
        {!collectionManaged && <TableRowsEditor section={section} onChange={onChange} />}
        {isProjectsDatabaseSection && <p className="admin-small-note pb-projects-live-note [margin:8px_0_12px] [padding:9px_11px] [border-left:3px_solid_var(--primary,_var(--primary))] [background:var(--muted)] [border-radius:var(--radius)]">Project cards and uploaded images are loaded from published Project records in Site Content. The saved page layout intentionally does not duplicate those records in its manual items array; manage the live records in the Collection tab.</p>}
        <SectionExtrasEditor section={section} onChange={onChange} />
        {section.homeComponent === 'locations' && <LandingLocationsEditor key="landing-locations-editor" />}
      </div>
      {!section.homeComponent && (COLLECTION_SECTION_TYPES.has(section.type) || section.contentCollection?.enabled || section.type === 'contentFeed') && <div id={`${editorId}-panel-collection`} className="pb-section-tab-panel [display:grid] [gap:12px] [min-width:0] [&>.cms-array-fieldset:first-child]:[margin-top:0] [&_.pb-button-settings]:[margin-top:0] [&_.pb-button-settings]:[padding:14px] [&_.pb-button-settings]:[border:1px_solid_var(--border)] [&_.pb-button-settings]:[border-radius:var(--radius,var(--radius))] [&_.pb-button-settings>legend]:[padding-inline:6px] [&_.pb-button-settings>legend]:[font-size:0.875rem] [&_.pb-button-settings>legend]:[font-weight:600] [&[hidden]]:![display:none]" role="tabpanel" aria-labelledby={`${editorId}-tab-collection`} hidden={editorTab !== 'collection'}>
        {COLLECTION_SECTION_TYPES.has(section.type) || section.type === 'contentFeed'
          ? <SectionCollectionEditor section={section} pageSlug={pageSlug} isProjectsCatalogSection={isProjectsCatalogSection} onChange={onChange} />
          : <div className="admin-empty-state [padding:22px] [color:var(--muted-foreground)] [text-align:center] [font-size:0.75rem] [min-height:110px] [display:grid] [place-items:center] [padding:20px] [font-size:0.875rem] [border:1px_dashed_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)]">This section does not use a database collection.</div>}
      </div>}
      {section.homeComponent !== 'hero' && <div id={`${editorId}-panel-actions`} className="pb-section-tab-panel [display:grid] [gap:12px] [min-width:0] [&>.cms-array-fieldset:first-child]:[margin-top:0] [&_.pb-button-settings]:[margin-top:0] [&_.pb-button-settings]:[padding:14px] [&_.pb-button-settings]:[border:1px_solid_var(--border)] [&_.pb-button-settings]:[border-radius:var(--radius,var(--radius))] [&_.pb-button-settings>legend]:[padding-inline:6px] [&_.pb-button-settings>legend]:[font-size:0.875rem] [&_.pb-button-settings>legend]:[font-weight:600] [&[hidden]]:![display:none]" role="tabpanel" aria-labelledby={`${editorId}-tab-actions`} hidden={editorTab !== 'actions'}>
        <fieldset className="pb-button-settings [margin-top:14px] [border-top:1px_solid_rgb(var(--sidebar-border-rgb))] [padding-top:12px] [&_summary]:[font-size:0.875rem] [&_summary]:[font-weight:600] [&_summary]:[cursor:pointer] [&_summary]:[padding:3px_0_10px]"><legend>Buttons and destination routes</legend>
          <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]">
            <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Show section button(s)</span><NativeSelect value={button.visible ? 'yes' : 'no'} onChange={(e) => setButton({ visible: e.target.value === 'yes' })}><option value="yes">Show</option><option value="no">Hide</option></NativeSelect></label>
            <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Button type</span><NativeSelect value={button.mode} onChange={(e) => setButton({ mode: e.target.value as SectionButtonConfig['mode'] })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="both">Primary + secondary</option></NativeSelect></label>
            <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label={button.mode === 'secondary' ? 'Button title' : 'Primary button title'} value={button.mode === 'secondary' ? (button.secondaryLabel ?? button.label) : button.label} onChange={(label) => setButton(button.mode === 'secondary' ? { secondaryLabel: label } : { label })} /></div>
            <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{button.mode === 'secondary' ? 'Button action' : 'Primary action'}</span><NativeSelect value={(button.mode === 'secondary' ? button.secondaryAction : button.action) || 'route'} onChange={(e) => setButton(button.mode === 'secondary' ? { secondaryAction: e.target.value as SectionButtonConfig['secondaryAction'] } : { action: e.target.value as SectionButtonConfig['action'] })}><option value="route">Internal route</option><option value="external">External URL</option><option value="anchor">Page anchor</option></NativeSelect></label>
            <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{button.mode === 'secondary' ? 'Button destination / route' : 'Primary destination / route'}</span><Input value={button.mode === 'secondary' ? (button.secondaryHref ?? button.href) : button.href} onChange={(e) => setButton(button.mode === 'secondary' ? { secondaryHref: e.target.value } : { href: e.target.value })} placeholder="/contact or https://…" /></label>
            {button.mode === 'both' && <><div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Secondary button title" value={button.secondaryLabel ?? blankBi()} onChange={(secondaryLabel) => setButton({ secondaryLabel })} /></div><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Secondary action</span><NativeSelect value={button.secondaryAction || 'route'} onChange={(e) => setButton({ secondaryAction: e.target.value as SectionButtonConfig['secondaryAction'] })}><option value="route">Internal route</option><option value="external">External URL</option><option value="anchor">Page anchor</option></NativeSelect></label><label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Secondary destination / route</span><Input value={button.secondaryHref ?? ''} onChange={(e) => setButton({ secondaryHref: e.target.value })} placeholder="/projects or https://…" /></label></>}
          </div>
        </fieldset>
      </div>}
      <div id={`${editorId}-panel-typography`} className="pb-section-tab-panel [display:grid] [gap:12px] [min-width:0] [&>.cms-array-fieldset:first-child]:[margin-top:0] [&_.pb-button-settings]:[margin-top:0] [&_.pb-button-settings]:[padding:14px] [&_.pb-button-settings]:[border:1px_solid_var(--border)] [&_.pb-button-settings]:[border-radius:var(--radius,var(--radius))] [&_.pb-button-settings>legend]:[padding-inline:6px] [&_.pb-button-settings>legend]:[font-size:0.875rem] [&_.pb-button-settings>legend]:[font-weight:600] [&[hidden]]:![display:none]" role="tabpanel" aria-labelledby={`${editorId}-tab-typography`} hidden={editorTab !== 'typography'}>
        <CmsTypographyEditor value={section.typography} onChange={(typography) => commonChange('typography', typography)} title="Section typography" />
        <p className="admin-small-note">The font family, weight, base text size, colour, letter spacing and line height apply to editable text in this section. Individual heading hierarchy remains intact.</p>
      </div>
      <div id={`${editorId}-panel-advanced`} className="pb-section-tab-panel [display:grid] [gap:12px] [min-width:0] [&>.cms-array-fieldset:first-child]:[margin-top:0] [&_.pb-button-settings]:[margin-top:0] [&_.pb-button-settings]:[padding:14px] [&_.pb-button-settings]:[border:1px_solid_var(--border)] [&_.pb-button-settings]:[border-radius:var(--radius,var(--radius))] [&_.pb-button-settings>legend]:[padding-inline:6px] [&_.pb-button-settings>legend]:[font-size:0.875rem] [&_.pb-button-settings>legend]:[font-weight:600] [&[hidden]]:![display:none]" role="tabpanel" aria-labelledby={`${editorId}-tab-advanced`} hidden={editorTab !== 'advanced'}>
        <fieldset className="pb-json-settings [margin-top:14px] [border-top:1px_solid_rgb(var(--sidebar-border-rgb))] [padding-top:12px] [&_summary]:[font-size:0.875rem] [&_summary]:[font-weight:600] [&_summary]:[cursor:pointer] [&_summary]:[padding:3px_0_10px]"><legend>Advanced technical data</legend><p className="admin-small-note">Use this only for properties not covered by the visual editor. Invalid JSON is rejected before applying changes.</p><Textarea className="pb-json-area [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] [font-size:0.875rem] [line-height:1.5] [white-space:pre] [overflow:auto]" rows={12} spellCheck={false} value={rawJson} onChange={(e) => setRawJson(e.target.value)} /><div className="pb-json-foot [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [margin-top:8px]"><small className="cms-slug-taken [color:var(--destructive)]">{jsonError}</small><Button variant="outline" size="sm" onClick={applyJson}>Apply JSON</Button></div></fieldset>
      </div>
    </CardContent>
  </Card>
}

function SectionCollectionEditor({ section, pageSlug, isProjectsCatalogSection = false, onChange }: { section: PageSection; pageSlug: string; isProjectsCatalogSection?: boolean; onChange: (section: PageSection) => void }) {
  const sectionData = section as PageSection & { collectionKind?: string; heading?: Bilingual; dataSource?: string }
  const headingText = `${sectionData.heading?.en || ''} ${sectionData.heading?.bn || ''}`.toLowerCase()
  const isCanonicalProjectsCollection = pageSlug === '/projects' && (
    isProjectsCatalogSection
    || isProjectsCollectionMarker(section)
    || (sectionData.dataSource !== 'manual' && /projects?|প্রকল্প/.test(headingText))
  )
  const defaultConfig = { enabled: section.type === 'contentFeed' || isCanonicalProjectsCollection, component: ((section.type === 'contentFeed' ? section.components?.[0] : undefined) ?? 'project') as ContentComponent, maxItems: 12, layout: section.type === 'carousel' ? 'carousel' as const : section.type === 'gallery' ? 'masonry' as const : 'grid' as const, columns: 3 as const, gap: 24, viewportItems: 3, showSearch: true, showCategoryFilter: true, showYearFilter: true }
  // The canonical Projects page always reads its published CMS catalogue. This
  // repairs older saved sections whose `contentCollection.enabled` flag remained
  // false and consequently left both the editor list and public `items` empty.
  const config = {
    ...defaultConfig,
    ...(section.contentCollection ?? {}),
    enabled: isCanonicalProjectsCollection ? true : section.contentCollection?.enabled ?? defaultConfig.enabled,
    component: isCanonicalProjectsCollection ? 'project' as ContentComponent : section.contentCollection?.component ?? defaultConfig.component,
  }
  const [items, setItems] = useState<ContentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<ContentRecord | null | 'new'>(null)
  const refresh = useCallback(() => {
    if (!config.enabled) return Promise.resolve()
    setLoading(true)
    return listContent(config.component)
      .then((all) => {
        const contentPage = FIXED_CONTENT_PARENT[config.component] || pageSlug
        setItems(isCanonicalProjectsCollection
          ? all
          : all.filter((item) => String(FIXED_CONTENT_PARENT[item.component] || item.values.routeParent || '') === contentPage))
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to load this section collection.'))
      .finally(() => setLoading(false))
  }, [config.enabled, config.component, pageSlug, isCanonicalProjectsCollection])
  const setConfig = (patch: Partial<typeof config>) => onChange({ ...section, contentCollection: { ...config, ...patch } })
  const selectableComponents = Object.keys(COMPONENTS) as ContentComponent[]
  const contentPage = FIXED_CONTENT_PARENT[config.component] || pageSlug
  const layoutOptions = layoutsForSection(section.type)
  const selectedLayout = layoutOptions.includes(config.layout) ? config.layout : layoutOptions[0]
  const singleRecordSection = section.type === 'cta' || section.type === 'donation'
  const heading = (section as JsonObject).heading as Bilingual | undefined
  return <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]">
    <legend>Site content collection</legend>
    <p className="admin-small-note">A section defines a database-backed collection. Records created here also appear in Site Content. Records created in Site Content appear here when their destination page and content type match.</p>
    <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]">
      {isCanonicalProjectsCollection
        ? <div className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Connect Site Content</span><p className="admin-small-note">Enabled automatically for the canonical Projects page. Published Project records supply this section&apos;s cards and uploaded images.</p></div>
        : <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Connect Site Content</span><NativeSelect value={config.enabled ? 'yes' : 'no'} onChange={(event) => setConfig({ enabled: event.target.value === 'yes' })}><option value="yes">Enabled — database collection</option><option value="no">Disabled — manually managed section</option></NativeSelect></label>}
      {config.enabled && <>
        <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Content type</span><NativeSelect value={config.component} onChange={(event) => setConfig({ component: event.target.value as ContentComponent })}>{selectableComponents.map((component) => <option key={component} value={component}>{COMPONENTS[component].plural}</option>)}</NativeSelect></label>
        <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Maximum records</span><Input type="number" min="1" max="100" value={String(singleRecordSection ? 1 : config.maxItems)} disabled={singleRecordSection} onChange={(event) => setConfig({ maxItems: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })} />{singleRecordSection && <small className="admin-small-note">This section uses one record as its call-to-action content.</small>}</label>
        <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Arrangement</span><NativeSelect value={selectedLayout} onChange={(event) => setConfig({ layout: event.target.value as typeof config.layout })}>{layoutOptions.map((layout) => <option key={layout} value={layout}>{layout === 'grid' ? 'Grid' : layout === 'carousel' ? 'Carousel / scroller' : layout === 'masonry' ? 'Masonry gallery' : 'List'}</option>)}</NativeSelect></label>
        {(selectedLayout === 'grid' || selectedLayout === 'masonry') && <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Desktop columns</span><NativeSelect value={String(config.columns)} onChange={(event) => setConfig({ columns: Number(event.target.value) as 2 | 3 | 4 })}><option value="2">2</option><option value="3">3</option><option value="4">4</option></NativeSelect></label>}
        <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Gap (px)</span><Input type="number" min="0" max="64" value={String(config.gap)} onChange={(event) => setConfig({ gap: Math.max(0, Math.min(64, Number(event.target.value) || 0)) })} /></label>
        {selectedLayout === 'carousel' && <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_Input:disabled]:[opacity:1] [&_Input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_Input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Cards visible in viewport</span><Input type="number" min="1" max="12" value={String(config.viewportItems)} onChange={(event) => setConfig({ viewportItems: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} /></label>}
      </>}
      {config.enabled && section.type === 'contentFeed' && <fieldset className="cms-array-fieldset col-span-full mt-2 grid gap-2"><legend>Public feed filters</legend><p className="admin-small-note">Choose which visitor controls appear above this content feed. Hiding a filter also disables that filter from affecting results.</p>{([['showSearch', 'Keyword search'], ['showCategoryFilter', 'Category / status filter'], ['showYearFilter', 'Year filter']] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm"><span>{label}</span><NativeSelect className="max-w-32" value={config[key] === false ? 'no' : 'yes'} onChange={(event) => setConfig({ [key]: event.target.value === 'yes' })}><option value="yes">Show</option><option value="no">Hide</option></NativeSelect></label>)}</fieldset>}
    </div>
    {config.enabled && (config.component === 'job' || config.component === 'notice') && (
      <p className="admin-small-note">Notice and job feeds use two columns on medium and larger screens, and one column on smaller screens.</p>
    )}
    {config.enabled && <div className="cms-collection-manager [display:grid] [gap:10px] [margin-top:12px] [padding:14px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--muted)] [&_code]:[font-size:0.75rem]">
      <div className="cms-collection-manager-head [display:flex] [justify-content:space-between] [align-items:center] [gap:12px] [flex-wrap:wrap] [&_>_div]:[display:grid] [&_>_div]:[gap:3px] [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] max-[600px]:[align-items:stretch] max-[600px]:[&_>_[data-slot=button]]:[width:100%]"><div><strong>{COMPONENTS[config.component].plural}</strong><small>{items.length} {isCanonicalProjectsCollection ? 'record(s) in the Projects catalogue' : <>record(s) assigned to <code>{contentPage}</code></>}{heading?.en ? ` · ${heading.en}` : ''}</small></div><Button size="sm" onClick={() => setEditing('new')}><Plus size={14} /> Add content</Button></div>
      {loading ? <p className="admin-small-note">Loading collection…</p> : items.length ? <div className="cms-collection-items [display:grid] [gap:7px]">{items.map((item) => <div key={item.id} className="cms-collection-item [&_small]:[color:var(--muted-foreground)] [&_small]:[font-size:0.75rem] [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [padding:9px_11px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [&_>_div]:[display:grid] [&_>_div]:[flex:1] [&_>_div]:[min-width:0] [&_>_div]:[gap:3px] [&_strong]:[overflow:hidden] [&_strong]:[text-overflow:ellipsis] [&_strong]:[white-space:nowrap] max-[600px]:[align-items:flex-start]">{item.values.image ? <Image className="cms-collection-thumb [display:block] [flex:0_0_58px] [width:58px] [height:42px] [object-fit:cover] [border-radius:var(--radius)] [border:1px_solid_var(--border)] [background:var(--muted)]" src={normalizeMediaSrc(item.values.image)} alt={item.values.title_en || item.slug} width={200} height={150} loading="lazy" /> : <span className="cms-collection-thumb [display:block] [flex:0_0_58px] [width:58px] [height:42px] [object-fit:cover] [border-radius:var(--radius)] [border:1px_solid_var(--border)] [background:var(--muted)] cms-collection-thumb--empty [display:grid] [place-items:center] [color:var(--muted-foreground)] [font-size:0.75rem]" aria-hidden="true">No image</span>}<div><strong>{item.values.title_en || item.slug}</strong><small>{item.slug} · {item.status}{item.values.image ? ' · image attached' : ' · no image selected'}</small></div><Button size="sm" variant="outline" onClick={() => setEditing(item)}>Edit</Button></div>)}</div> : <p className="admin-small-note">{isCanonicalProjectsCollection ? 'No project records yet. Add one here or publish a Project from Site Content.' : `No records assigned yet. Add one here or create it in Site Content and set its “Publish under page” destination to ${contentPage}.`}</p>}
      <a className={buttonClassName('ghost', 'sm')} href={`/admin/dashboard/site-content?component=${config.component}&page=${encodeURIComponent(contentPage)}`}>Open all Site Content ↗</a>
      {editing !== null && <ContentEditor key={`${config.component}-${editing === 'new' ? 'new' : editing.id}`} component={config.component} record={editing === 'new' ? null : editing} defaultRouteParent={contentPage} presentation="modal" onSaved={() => { setEditing(null); void refresh(); toast.success('Section content saved.') }} onDeleted={() => { setEditing(null); void refresh() }} onClose={() => setEditing(null)} />}
    </div>}
  </fieldset>
}

function LandingLocationsEditor() {
  const [configured, setConfigured] = useState(false)
  const [branches, setBranches] = useState<Branch[]>(BRANCHES.map((branch) => ({ ...branch })))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return getWebsiteEssentials()
      .then(({ data, configured: isConfigured }) => {
        const value = normalizeWebsiteEssentials(data)
        setConfigured(isConfigured)
        // The legacy directory is used only until the first DB document is seeded.
        // Once configured, even an empty array is an intentional CMS value.
        setBranches(isConfigured ? value.locations : (value.locations.length ? value.locations : BRANCHES.map((branch) => ({ ...branch }))))
        setDirty(false)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load office locations.'))
      .finally(() => setLoading(false))
  }, [])

  useRegisterAdminActions('page-builder-landing-locations', { save: saveSettings, reload: load, dirty, saving, label: 'Office locations' })

  function saveSettings() {
    const seenIds = new Set<string>()
    let headOfficeCount = 0
    for (const branch of branches) {
      const id = String(branch.id ?? '').trim()
      const lat = Number(branch.lat)
      const lng = Number(branch.lng)
      const name = branch.name?.en || branch.name?.bn || id || 'unnamed location'
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        const message = `“${name}” needs a unique ID using lowercase letters, numbers, and single hyphens only.`
        setSaveError(message); toast.error(message); return Promise.resolve()
      }
      if (seenIds.has(id)) { const message = `The map location ID “${id}” is duplicated. Each location needs a unique ID.`; setSaveError(message); toast.error(message); return Promise.resolve() }
      seenIds.add(id)
      if (branch.kind === 'head') headOfficeCount += 1
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20.55 || lat > 26.7 || lng < 87.95 || lng > 92.8) {
        const message = `“${name}” needs verified coordinates inside the displayed Bangladesh map bounds (latitude 20.55–26.7, longitude 87.95–92.8).`
        setSaveError(message); toast.error(message); return Promise.resolve()
      }
    }
    if (headOfficeCount > 1) {
      const message = 'Only one location can be designated as the head office.'
      setSaveError(message); toast.error(message); return Promise.resolve()
    }

    setSaving(true)
    setSaveError('')
    return getWebsiteEssentials()
      .then(({ data }) => {
        // Read the current document first so this focused editor never overwrites other settings.
        const latest: WebsiteEssentials = normalizeWebsiteEssentials(data)
        const normalizedBranches = branches.map((branch) => ({
          ...branch,
          id: String(branch.id).trim(),
          lat: Number(branch.lat),
          lng: Number(branch.lng),
          kind: branch.kind === 'head' ? 'head' as const : 'branch' as const,
          name: branch.name ?? blankBi(),
          district: branch.district ?? blankBi(),
          division: branch.division ?? blankBi(),
          address: branch.address ?? blankBi(),
        }))
        return saveWebsiteEssentials({ ...latest, locations: normalizedBranches }).then((payload) => ({ latest, normalizedBranches, payload }))
      })
      .then(({ latest, normalizedBranches, payload }) => {
        setConfigured(true)
        setBranches(normalizeWebsiteEssentials(payload.data ?? { ...latest, locations: normalizedBranches }).locations)
        setDirty(false)
        toast.success('Office locations saved to Website Essentials. The homepage map and location directory now use this database record.')
        return load()
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save office locations.'
        setSaveError(message)
        toast.error(message, { description: 'Your changes remain in the editor. Resolve the issue and save again.' })
      })
      .finally(() => setSaving(false))
  }

  return <Card className="pb-landing-global-card [margin-block:20px_28px] pb-office-locations-card">
    <CardHeader>
      <div className="pb-page-title-row [display:flex] [align-items:center] [justify-content:space-between] [gap:10px] [align-items:flex-start] [&>div]:[min-width:0] [&_code]:[overflow-wrap:anywhere] max-[900px]:[align-items:flex-start] max-[700px]:[align-items:flex-start] max-[700px]:[flex-direction:column]">
        <div><CardTitle>Office & branch locations</CardTitle><CardDescription>Manage the pins and office directory for “Our offices across Bangladesh”. This editor and Website Essentials share one database record, so edits remain consistent across the homepage, contact page and staff directory.</CardDescription></div>
        <span className={`pb-save-state [display:inline-flex] [align-items:center] [min-height:30px] [padding:0_10px] [border:1px_solid_var(--border)] [border-radius:999px] [color:var(--success)] [font-size:0.75rem] [font-weight:600] [white-space:nowrap] [&.is-dirty]:[color:var(--warning)] [&.is-dirty]:[border-color:color-mix(in_srgb,var(--warning)_38%,var(--border))] [&.is-dirty]:[background:color-mix(in_srgb,var(--warning)_8%,var(--card))] ${dirty ? 'is-dirty' : ''}`} role="status">{saving ? 'Saving…' : dirty ? 'Unsaved · use Save all above' : 'Saved'}</span>
      </div>
    </CardHeader>
    <CardContent>
      {loading ? <PageLoading rows={4} /> : error ? <AdminErrorState message={error} onRetry={() => void load()} /> : <>
        {!configured && <p className="admin-small-note">Showing the legacy bootstrap directory until Website Essentials has been seeded. Saving here writes the locations to PostgreSQL.</p>}
        <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Bangladesh map locations</legend>
          <BranchDirectoryEditor value={branches} onChange={(next) => { setSaveError(''); setBranches(next); setDirty(true) }} />
        </fieldset>
        {saveError && <div className="cms-save-error [display:grid] [gap:4px] [margin-top:14px] [padding:12px_14px] [border:1px_solid_color-mix(in_srgb,var(--destructive)_28%,var(--border))] [border-left:4px_solid_var(--destructive)] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--destructive)_6%,var(--card))] [color:var(--foreground)] [&_strong]:[font-size:0.875rem] [&_span]:[font-size:0.875rem] [&_span]:[overflow-wrap:anywhere] [&_small]:[font-size:0.75rem] [&_small]:[color:var(--muted-foreground)]" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span></div>}
      </>}
    </CardContent>
  </Card>
}

export default function PageBuilderPage() {
  const { dirty: anyEditorDirty } = useAdminActions()
  const [pages, setPages] = useState<PageIndexItem[]>([])
  const [slug, setSlug] = useState('')
  const [draft, setDraft] = useState<PageData | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [error, setError] = useState('')
  const [newSectionType, setNewSectionType] = useState<Section['type']>('richText')
  const [newLandingComponent, setNewLandingComponent] = useState<LandingComponentKey>('growth')
  const [pageQuery, setPageQuery] = useState('')
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [activePageTab, setActivePageTab] = useState<PageEditorTab>('seo')
  const [baseline, setBaseline] = useState('')

  const loadIndex = useCallback(() => {
    setLoading(true); setError('')
    return getPageBuilderIndex()
      .then((data) => {
        const available = data.availablePages ?? []
        setPages(available)
        setSlug((current) => available.some((page) => page.slug === current) ? current : (available.some((page) => page.slug === '/') ? '/' : available[0]?.slug || ''))
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load pages.'))
      .finally(() => setLoading(false))
  }, [])

  const loadPage = useCallback((nextSlug: string) => {
    if (!nextSlug) return Promise.resolve()
    setSaveError(''); setPageLoading(true); setError('')
    return getEditablePage(nextSlug)
      .then((result) => {
        const data = result.override ?? result.fallback
        if (!data) throw new Error('No content is available for this page.')
        const normalizedDraft: PageData = { ...data, slug: nextSlug, status: nextSlug === '/' ? 'published' : data.status, showContactMap: supportsLocationMap(nextSlug) && data.showContactMap === true, title: data.title ?? { en: nextSlug, bn: nextSlug }, sections: Array.isArray(data.sections) ? data.sections.map((section, index) => ({ ...section, sectionId: section.sectionId || `section-${nextSlug.replace(/[^a-z0-9]+/gi, '-')}-${index + 1}`, visible: section.homeComponent === 'locations' ? section.visible === true : section.visible !== false })) : [] }
        setBaseline(JSON.stringify(normalizedDraft))
        setActiveSectionIndex(0)
        setDraft(normalizedDraft)
        setUpdatedAt(result.meta?.updatedAt)
      })
      .catch((cause: unknown) => { setBaseline(''); setDraft(null); setError(cause instanceof Error ? cause.message : 'Unable to load page.') })
      .finally(() => setPageLoading(false))
  }, [])

  // Browser-only URL access belongs in an effect, never in render/SSR.
  // Load the page index on mount and honor an optional ?slug= query parameter.
  useEffect(() => {
    const requestedSlug = new URLSearchParams(window.location.search).get('slug')?.trim()
    if (requestedSlug) {
      const nextSlug = requestedSlug === '/' || requestedSlug.startsWith('/')
        ? requestedSlug
        : `/${requestedSlug}`
      // Defer state updates so the effect itself stays side-effect-light.
      void Promise.resolve().then(() => setSlug(nextSlug))
    }

    void Promise.resolve().then(() => loadIndex())
  }, [loadIndex])

  // Load the selected page whenever the selected route changes.
  useEffect(() => {
    if (!slug) return
    void Promise.resolve().then(() => loadPage(slug))
  }, [slug, loadPage])

  const pagesSorted = useMemo(() => [...pages].sort((a, b) => a.slug.localeCompare(b.slug)).filter((p) => !pageQuery.trim() || `${p.slug} ${p.title.en} ${p.title.bn}`.toLowerCase().includes(pageQuery.trim().toLowerCase())), [pages, pageQuery])
  const updateTop = <K extends keyof PageData>(key: K, value: PageData[K]) => { setSaveError(''); setDraft((cur) => cur ? ({ ...cur, [key]: value }) : cur) }
  const updateSection = (index: number, value: PageSection) => { setSaveError(''); setDraft((cur) => cur ? ({ ...cur, sections: cur.sections.map((s, i) => i === index ? value : s) }) : cur) }
  const duplicateSection = (index: number) => {
    setSaveError('')
    setDraft((cur) => {
      if (!cur || index < 0 || index >= cur.sections.length) return cur
      const duplicate = JSON.parse(JSON.stringify(cur.sections[index])) as PageSection
      duplicate.sectionId = `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const nextSections = [...cur.sections]
      nextSections.splice(index + 1, 0, duplicate)
      return { ...cur, sections: nextSections }
    })
    setActiveSectionIndex(index + 1)
    setActivePageTab('sections')
    toast.success('Section duplicated. Use Save all in the workspace header to publish the copy.')
  }

  function save() {
    if (!draft || !slug) return Promise.resolve()
    if (!draft.title.en.trim()) { const issue = 'Enter the page title in English.'; setSaveError(issue); toast.error(issue); return Promise.resolve() }
    for (const section of draft.sections) {
      const b = section.buttonConfig
      if (b?.visible) {
        const validateButton = (routeValue: string | undefined, action: SectionButtonConfig['action'] | SectionButtonConfig['secondaryAction'], label: string) => {
          const route = routeValue?.trim()
          if (!route) return `${label} needs a destination route or URL.`
          if (action === 'external' && !/^https?:\/\//i.test(route)) return `${label} external URLs must begin with http:// or https://.`
          if (action === 'anchor' && !route.startsWith('#') && !route.includes('#')) return `${label} anchor actions need a #anchor or a route with #anchor.`
          if (action !== 'external' && /^https?:\/\//i.test(route)) return `${label} uses an external URL; choose External URL as the action.`
          return ''
        }
        if (b.mode === 'primary' || b.mode === 'both') { const issue = validateButton(b.href, b.action, 'Primary button'); if (issue) { setSaveError(issue); toast.error(issue); return Promise.resolve() } }
        if (b.mode === 'secondary' || b.mode === 'both') { const issue = validateButton(b.secondaryHref ?? (b.mode === 'secondary' ? b.href : undefined), b.secondaryAction, 'Secondary button'); if (issue) { setSaveError(issue); toast.error(issue); return Promise.resolve() } }
      }
    }
    setSaveError('')
    setSaving(true)
    const savedSnapshot = { ...draft, slug, ...(slug === '/' ? { status: 'published' as const } : {}) }
    return saveEditablePage(slug, savedSnapshot, updatedAt)
      .then(() => {
        setBaseline(JSON.stringify(savedSnapshot))
        toast.success('Page layout and content saved to the database.')
        return loadPage(slug)
      })
      .then(() => loadIndex())
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save page.'
        setSaveError(message)
        toast.error(message, { description: 'Your edits are still in this form. Correct the issue and try saving again.' })
      })
      .finally(() => setSaving(false))
  }

  const activePageIndex = pages.find((page) => page.slug === slug)

  async function changeNavigationVisibility(visible: boolean) {
    if (!slug || slug === '/' || !activePageIndex?.navigationId || visibilitySaving) return
    setVisibilitySaving(true)
    try {
      const result = await setEditablePageNavigationVisibility(slug, visible)
      setPages((current) => current.map((page) => page.slug === slug ? { ...page, navigationVisible: result.visible } : page))
      toast.success(result.visible ? 'Page is now listed in public navigation.' : 'Page is hidden from public navigation; published links to its URL can still open it.')
      await loadIndex()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to change page visibility.')
    } finally {
      setVisibilitySaving(false)
    }
  }

  async function removeCurrentPage() {
    if (!slug || slug === '/' || deleting) return
    const page = activePageIndex
    const confirmMessage = page?.navigationId
      ? `Delete “${draft?.title.en || slug}” and its navigation branch? Any nested pages under this menu will also be removed. This cannot be undone.`
      : `Delete the saved page document “${slug}”? This cannot be undone.`
    if (anyEditorDirty && !window.confirm('There are unsaved edits. Discard them and continue with deletion?')) return
    if (!window.confirm(confirmMessage)) return
    setDeleting(true)
    try {
      await deleteEditablePage(slug)
      toast.success('Page and associated navigation records deleted.')
      setDraft(null)
      setBaseline('')
      setUpdatedAt(undefined)
      setActiveSectionIndex(0)
      setActivePageTab('seo')
      setSlug('')
      await loadIndex()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Unable to delete this page.')
    } finally {
      setDeleting(false)
    }
  }

  const pageDirty = Boolean(draft && baseline !== JSON.stringify(draft))
  useRegisterAdminActions('page-builder-current-page', {
    save,
    reload: () => slug ? loadPage(slug) : loadIndex(),
    dirty: pageDirty,
    saving,
    label: 'Page layout',
  })

  function changePage(nextSlug: string) {
    if (nextSlug === slug) return
    if (anyEditorDirty && !window.confirm('You have unsaved changes in this page or one of its editors. Discard them and open another page?')) return
    setBaseline('')
    setActiveSectionIndex(0)
    setActivePageTab('seo')
    setDraft(null)
    setSlug(nextSlug)
  }

  const sections = draft?.sections ?? []
  const markedProjectsSectionIndex = slug === '/projects' ? sections.findIndex(isProjectsCollectionMarker) : -1
  const projectsCatalogSectionIndex = slug === '/projects'
    ? markedProjectsSectionIndex >= 0 ? markedProjectsSectionIndex : sections.findIndex(isProjectsCollectionPresentation)
    : -1
  function addPageSection() {
    if (!draft) return
    const next = blankSection(newSectionType, { en: `New ${newSectionType} section`, bn: `নতুন ${newSectionType} অংশ` })
    setActiveSectionIndex(draft.sections.length)
    setActivePageTab('sections')
    setDraft((current) => current ? ({ ...current, sections: [...current.sections, next] }) : current)
  }
  function addLandingSection(key: LandingComponentKey) {
    if (!draft) return
    const option = LANDING_COMPONENT_OPTIONS.find((item) => item.key === key)
    if (!option) return
    if (draft.sections.some((section) => section.homeComponent === key)) {
      toast.error('This landing composition already exists on the page.')
      return
    }
    const next = blankSection(option.type, { en: option.label, bn: option.labelBn })
    next.contentCollection = { enabled: false, component: 'project', maxItems: 8, layout: 'grid', columns: 3, gap: 24, viewportItems: 3 }
    next.homeComponent = key
    if (key === 'impactCards' && next.type === 'cards') {
      next.variant = 'impact'
      next.eyebrow = { en: 'Our impact', bn: 'আমাদের প্রভাব' }
      next.heading = { en: 'What We Do', bn: 'আমরা যা করি' }
    }
    if (next.type === 'carousel' && (key === 'news' || key === 'stories')) {
      next.collectionKind = 'news'
      next.dataSource = 'published-news'
      next.presentation = 'scroller'
      next.heading = { en: 'Latest News', bn: 'সর্বশেষ সংবাদ' }
      next.buttonConfig = { ...defaultButton(true), label: { en: 'View all news', bn: 'সব সংবাদ দেখুন' }, href: '/news', action: 'route' }
    } else if (next.type === 'carousel' && key === 'successStories') {
      next.collectionKind = 'success-stories'
      next.dataSource = 'published-success-stories'
      next.presentation = 'collection'
      next.heading = { en: 'Success Stories of Srizony', bn: 'সৃজনীর সাফল্যের গল্পসমূহ' }
      next.buttonConfig = { ...defaultButton(true), label: { en: 'View all success stories', bn: 'সব সাফল্যের গল্প দেখুন' }, href: '/success-stories', action: 'route' }
    }
    setActiveSectionIndex(draft.sections.length)
    setActivePageTab('sections')
    setDraft((current) => current ? ({ ...current, sections: [...current.sections, next] }) : current)
  }
  return <div className="admin-page-stack scrollbar-none">
    <AdminWorkspaceGrid
      layout="split"
      columns="minmax(180px, 0.28fr) minmax(0, 0.72fr)"
      className="pb-workspace"
      ariaLabel="Page selector and page editor"
    >
    <AdminDataContainer
      label="Page selection"
      headerContent={
        <SectionToolbar
          title="Pages"
          search={pageQuery}
          onSearch={setPageQuery}
          searchPlaceholder="Filter pages…"
        />
      }
      footer={
        <div className="pb-container-footer grid" role="status">
          <span>Showing {pagesSorted.length} of {pages.length} pages</span>
          <span>Select a page to edit its settings and sections.</span>
        </div>
      }
    >
        <div className="flex flex-col p-2 gap-2 overflow-wrap">
          {pagesSorted.map((page) => 
          <Button 
            id={`pb-page-tab-${page.slug === '/' ? 'home' : page.slug.replace(/[^a-z0-9_-]+/gi, '-')}`}
            variant={page.slug === slug ? "default" : "outline"} 
            aria-controls="pb-page-editor-panel" 
            aria-selected={slug === page.slug} 
            data-page-option={`${page.slug} ${page.title.en} ${page.title.bn}`.toLowerCase()} 
            type="button" key={page.slug} 
            className={`flex flex-col h-auto items-start p-2'}`} 
            onClick={() => changePage(page.slug)}
          >
            <strong><span>{page.slug === '/' ? 'Landing Page' : page.title.en || page.slug}</span></strong>
            <small><code>{page.slug}</code></small>
          </Button>)}
          {!pagesSorted.length && <span className="admin-small-note">No pages match this search.</span>}
        </div>
    </AdminDataContainer>



    <AdminDataContainer
      label="Selected page editor"
      bodyScroll="auto"
      headerContent={
        <div className="flex w-full">
          <div className="flex w-full flex-col">
            <strong className="[font-size:0.875rem]">{slug === '/' ? 'Homepage' : activePageIndex?.title.en }</strong>
            <span className="[font-size:0.75rem] [color:var(--muted-foreground)] [overflow-wrap:anywhere]">Editing route <code>{slug}</code></span>
          </div>
          <SectionToolbar
            title="Page editor"
            actions={
              <div className="flex gap-2">
                {draft && slug !== '/' && activePageIndex?.navigationId && <Button size="sm" variant="outline" onClick={() => void changeNavigationVisibility(activePageIndex.navigationVisible === false)} disabled={visibilitySaving || deleting || pageLoading} title="Controls the public navigation listing; publication status controls direct route access.">{activePageIndex.navigationVisible === false ? <Eye size={14} /> : <EyeOff size={14} />}Hide</Button>}
                {draft && slug !== '/' && <Button size="sm" variant="destructive" onClick={() => void removeCurrentPage()} disabled={deleting || saving || pageLoading} title="Delete this page and its navigation branch"><Trash2 size={14} />Delete</Button>}
                <Button size="sm" onClick={() => void save()} disabled={!draft || !pageDirty || saving || pageLoading} title="Save all page builder changes"><Save size={14} />Save</Button>
                {draft && <a className="flex items-center gap-2 p-2 rounded-lg border border-border" href={slug === '/' ? '/' : slug} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Open</a>}
              </div>
            }
          />
        </div>
      }
      footer={
        <div className="pb-container-footer [display:flex] [align-items:center] [justify-content:space-between] [gap:8px] [flex-wrap:wrap] [font-size:0.75rem] [color:var(--muted-foreground)]" role="status" aria-live="polite">
          <span className={`pb-save-state [font-weight:600] ${saving ? 'is-saving' : pageDirty ? 'is-dirty' : 'is-saved'}`}>{saving ? 'Saving changes…' : pageDirty ? 'Unsaved changes' : draft ? 'All changes saved' : 'No page selected'}</span>
          <span>{slug ? `Route: ${slug}` : 'Choose a page from the list.'}</span>
        </div>
      }
    >
    {loading && !pages.length ? <PageLoading rows={4} /> : error && !draft ? <AdminErrorState message={error} onRetry={() => { void loadIndex(); if (slug) void loadPage(slug) }} /> : <div className="pb-layout [display:grid] [grid-template-columns:minmax(0,1fr)] [gap:14px] [align-items:start]">
      <section id="pb-page-editor-panel" className="pb-editor [min-width:0] [display:flex] [flex-direction:column] [gap:18px] [gap:14px]" role="tabpanel" tabIndex={0} aria-label={`Editing ${slug === '/' ? 'Landing Page' : slug || 'page'}`}>
        {pageLoading || !draft ? <PageLoading rows={4} /> : <>
          <nav
            className="pb-page-editor-tabs [position:sticky] [top:0] [z-index:40] [display:flex] [align-items:center] [gap:6px] [min-width:0] [overflow-x:auto] [padding:7px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [box-shadow:0_8px_20px_rgb(0_0_0_/_0.06)] [scrollbar-width:thin] [overscroll-behavior-x:contain]"
            role="tablist"
            aria-label="Selected page editor"
          >
            {([
              { value: 'seo', label: 'SEO' },
              { value: 'typography', label: 'Typography' },
              { value: 'configuration', label: 'Page configuration' },
              { value: 'sections', label: 'Sections' },
            ] as const).map((tab) => (
              <Button
                key={tab.value}
                id={`pb-primary-tab-${tab.value}`}
                type="button"
                role="tab"
                aria-selected={activePageTab === tab.value}
                aria-controls={`pb-primary-panel-${tab.value}`}
                tabIndex={activePageTab === tab.value ? 0 : -1}
                size="sm"
                variant={activePageTab === tab.value ? 'default' : 'outline'}
                className="pb-page-editor-tab [flex:0_0_auto] [min-width:104px] [justify-content:center]"
                onClick={() => setActivePageTab(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </nav>

          <section
            id="pb-primary-panel-seo"
            role="tabpanel"
            aria-labelledby="pb-primary-tab-seo"
            tabIndex={0}
            hidden={activePageTab !== 'seo'}
            className="pb-page-editor-panel [min-width:0]"
          >
            <Card>
              <CardHeader>
                <CardTitle>SEO and social metadata</CardTitle>
                <CardDescription>Manage the page title, search snippets, social preview, and crawler directives for this route.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [gap:14px] max-[700px]:[grid-template-columns:1fr]">
                  <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Page title" value={draft.title} onChange={(title) => updateTop('title', title)} /></div>
                  <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Page subtitle / metadata summary" value={draft.subtitle ?? blankBi()} onChange={(subtitle) => updateTop('subtitle', subtitle)} multiline /></div>
                  <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><MediaField label={slug === '/' ? 'Social preview image (Open Graph)' : 'Hero / social preview image'} value={draft.heroImage ?? ''} onChange={(value) => updateTop('heroImage', value || undefined)} alt={draft.title.en} helper={slug === '/' ? 'Sets the homepage link-preview image. Edit the visible homepage carousel images in the Landing Page Hero section below.' : 'Upload an approved image or paste an existing HTTPS / CMS media URL.'} /></div>
                  <div className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]"><BilingualInputs label="Search description" value={draft.metaDescription ?? blankBi()} onChange={(metaDescription) => updateTop('metaDescription', metaDescription)} multiline /></div>
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Search engine indexing</span>
                    <NativeSelect value={draft.noIndex ? 'noindex' : 'index'} onChange={(e) => updateTop('noIndex', e.target.value === 'noindex')}>
                      <option value="index">Allow indexing</option>
                      <option value="noindex">Hide from search engines</option>
                    </NativeSelect>
                    <small className="admin-small-note">Controls the page-level robots index directive. Draft and archived pages are not publicly rendered.</small>
                  </label>
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Search crawler links</span>
                    <NativeSelect value={draft.noFollow ? 'nofollow' : 'follow'} onChange={(e) => updateTop('noFollow', e.target.value === 'nofollow')}>
                      <option value="follow">Allow link following</option>
                      <option value="nofollow">Do not follow links</option>
                    </NativeSelect>
                  </label>
                </div>
              </CardContent>
            </Card>
          </section>

          <section
            id="pb-primary-panel-typography"
            role="tabpanel"
            aria-labelledby="pb-primary-tab-typography"
            tabIndex={0}
            hidden={activePageTab !== 'typography'}
            className="pb-page-editor-panel [min-width:0]"
          >
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
                <CardDescription>Customize the typography used by this page without changing the global site theme.</CardDescription>
              </CardHeader>
              <CardContent>
                <CmsTypographyEditor value={draft.typography} onChange={(typography) => updateTop('typography', typography)} title="Page typography" />
              </CardContent>
            </Card>
          </section>

          <section
            id="pb-primary-panel-configuration"
            role="tabpanel"
            aria-labelledby="pb-primary-tab-configuration"
            tabIndex={0}
            hidden={activePageTab !== 'configuration'}
            className="pb-page-editor-panel [min-width:0]"
          >
            <Card>
              <CardHeader>
                <CardTitle>Page configuration</CardTitle>
                <CardDescription>Control the page layout, reusable template, publication state, and other page-level display settings.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="cms-form-grid [display:grid] grid-cols-2 max-[760px]:[grid-template-columns:1fr] gap-2 max-[720px]:[grid-template-columns:1fr] gap-3.5 max-[700px]:[grid-template-columns:1fr]">
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Page layout</span>
                    <NativeSelect value={draft.layout ?? 'standard'} onChange={(e) => updateTop('layout', e.target.value as PageData['layout'])}>
                      <option value="standard">Standard width</option><option value="wide">Wide content</option><option value="narrow">Narrow reading</option><option value="editorial">Editorial panels</option>
                    </NativeSelect>
                  </label>
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Page template</span>
                    <NativeSelect value={draft.pageView ?? 'default'} onChange={(e) => updateTop('pageView', e.target.value as NonNullable<PageData['pageView']>)}>
                      <option value="default">Standard sections</option><option value="staff-directory">Staff directory</option><option value="resource-library">Resource library</option>
                    </NativeSelect>
                    <small className="admin-small-note">Selects a reusable component composition; the page URL does not determine its template.</small>
                  </label>
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Content card style</span>
                    <NativeSelect value={draft.cardStyle ?? 'default'} onChange={(e) => updateTop('cardStyle', e.target.value as NonNullable<PageData['cardStyle']>)}>
                      <option value="default">Theme default</option><option value="social">Social development cards</option><option value="enterprise">Enterprise catalogue cards</option>
                    </NativeSelect>
                  </label>
                  <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:col-span-2">
                    <div className="grid gap-1"><strong className="text-sm">Page elements</strong><p className="admin-small-note">Manage every section on this page. Hide keeps content for later; Delete removes it from the page.</p></div>
                    <div className="grid min-w-0 gap-2">
                      {sections.map((section, index) => {
                        const heading = getBilingual((section as JsonObject).heading)
                        const label = heading?.en || heading?.bn || section.homeComponent || `${section.type} ${index + 1}`
                        return <div key={section.sectionId || `${section.type}-${index}`} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-card p-2">
                          <Button type="button" variant="ghost" className="h-auto min-w-0 flex-1 justify-start truncate px-2 py-1 text-left text-sm font-medium hover:text-primary" onClick={() => { setActiveSectionIndex(index); setActivePageTab('sections') }}>{label}<span className="ml-2 text-xs text-muted-foreground">{section.type}</span></Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => updateSection(index, { ...section, visible: section.visible === false })} aria-label={`${section.visible === false ? 'Show' : 'Hide'} ${label}`}><Eye size={13} />{section.visible === false ? 'Show' : 'Hide'}</Button>
                          <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => { if (!window.confirm(`Delete ${label} from this page?`)) return; setDraft((current) => current ? { ...current, sections: current.sections.filter((_, i) => i !== index) } : current); setActiveSectionIndex((current) => Math.max(0, Math.min(current > index ? current - 1 : current, sections.length - 2))) }} aria-label={`Delete ${label}`}><Trash2 size={14} /></Button>
                        </div>
                      })}
                      {!sections.length && <p className="admin-small-note">This page has no sections yet. Open the Sections tab to add its first section.</p>}
                    </div>
                    {slug !== '/' && supportsLocationMap(slug) && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3"><div className="grid gap-0.5"><strong className="text-sm">Location map</strong><small className="admin-small-note">Available only on the Contact page. Hidden by default.</small></div><Button type="button" size="sm" variant="outline" onClick={() => updateTop('showContactMap', draft.showContactMap !== true)}>{draft.showContactMap ? <EyeOff size={13} /> : <Eye size={13} />}{draft.showContactMap ? 'Hide map' : 'Show map'}</Button></div>}
                  </div>
                  {slug !== '/' && <label className={PAGE_FIELD_CLASS}>
                    <span>Routed page content padding</span>
                    <NativeSelect value={draft.contentPadding ?? 'normal'} onChange={(e) => updateTop('contentPadding', e.target.value as NonNullable<PageData['contentPadding']>)}>
                      <option value="none">No outer vertical padding</option><option value="compact">Compact</option><option value="normal">Default</option><option value="spacious">Spacious</option>
                    </NativeSelect>
                    <small className="admin-small-note">Controls the vertical spacing between the hero and routed page sections, as well as spacing between sections.</small>
                  </label>}
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Publication status</span>
                    <NativeSelect value={slug === '/' ? 'published' : (draft.status ?? 'published')} disabled={slug === '/'} onChange={(e) => updateTop('status', e.target.value as PageData['status'])}>
                      <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                    </NativeSelect>
                    {slug === '/' && <small className="admin-small-note">The landing page route stays published; hide individual sections when needed.</small>}
                  </label>
                  <label className={PAGE_FIELD_CLASS}>
                    <span>Page sort order</span>
                    <Input type="number" value={String(draft.sortOrder ?? 0)} onChange={(e) => updateTop('sortOrder', Math.max(0, Number(e.target.value) || 0))} />
                  </label>
                </div>
              </CardContent>
            </Card>
          </section>

          <section
            id="pb-primary-panel-sections"
            role="tabpanel"
            aria-labelledby="pb-primary-tab-sections"
            tabIndex={0}
            hidden={activePageTab !== 'sections'}
            className="pb-page-editor-panel [display:grid] [gap:14px] [min-width:0]"
          >
            <div className="pb-sections-toolbar [display:grid] [gap:10px] [min-width:0]">
              <div>
                <SectionToolbar
                  tabs={sections.length > 0 ? (
                    <AdminSectionTabs
                      label="Page section editors"
                      value={String(Math.min(activeSectionIndex, sections.length - 1))}
                      onChange={(next) => setActiveSectionIndex(Number(next))}
                      items={sections.map((section, index) => ({
                        value: String(index),
                        label: getBilingual((section as JsonObject).heading)?.en || section.homeComponent || `${section.type} ${index + 1}`,
                        count: undefined,
                      }))}
                    />
                  ) : undefined}
                  actions={
                    <div className="flex flex-col w-full">
                      {slug === '/' ? 
                      <div className="grid grid-cols-2 gap-4">
                        <Select height="36px" optionDisplay="dropdown" aria-label="Landing composition" value={newLandingComponent} onChange={(e) => setNewLandingComponent(e.target.value as LandingComponentKey)}>
                          {LANDING_COMPONENT_OPTIONS.map((option) => 
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>)}
                        </Select>
                        <Button variant="outline" onClick={() => addLandingSection(newLandingComponent)}>
                          <Plus size={14} /> Add landing composition
                        </Button>
                      </div> : 
                      <div className="grid grid-cols-4 gap-4">
                        <Select height="36px" optionDisplay="dropdown" aria-label="Page section type" value={newSectionType} onChange={(e) => setNewSectionType(e.target.value as Section['type'])}>
                          {SECTION_TYPES.map((type) => 
                          <option key={type} value={type}>
                            {type}
                          </option>)}
                        </Select>
                        <Button variant="outline" onClick={addPageSection}>
                          <Plus size={14} /> Add section
                        </Button>
                        <Select height="36px" optionDisplay="dropdown" aria-label="Reusable landing composition" value={newLandingComponent} onChange={(e) => setNewLandingComponent(e.target.value as LandingComponentKey)}>
                          {LANDING_COMPONENT_OPTIONS.map((option) => 
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>)}
                        </Select>
                        <Button variant="outline" onClick={() => addLandingSection(newLandingComponent)}>
                          <Plus size={14} /> Add landing UI
                        </Button>
                      </div>}
                    </div>
                  }
                />
              </div>
            </div>
            <div className="pb-sections-list [display:flex] [flex-direction:column] [gap:12px] [min-width:0] [&>div[data-section-index]]:[scroll-margin-top:112px]">
              {sections.length > 0 ? sections.map((section, index) => (
              <div
                id={`pb-section-${index}`}
                data-section-index={index}
                key={section.sectionId || `${slug}-section-${index}`}
                hidden={index !== Math.min(activeSectionIndex, sections.length - 1)}
                role={index === Math.min(activeSectionIndex, sections.length - 1) ? 'tabpanel' : undefined}
                aria-label={index === Math.min(activeSectionIndex, sections.length - 1) ? `Editing section ${index + 1}` : undefined}
              >
                <SectionCard
                  section={section}
                  index={index}
                  total={sections.length}
                  pageSlug={slug}
                  isProjectsCatalogSection={index === projectsCatalogSectionIndex}
                  onChange={(value) => updateSection(index, value)}
                  onMove={(delta) => {
                    const nextIndex = Math.max(0, Math.min(index + delta, sections.length - 1))
                    setDraft((cur) => cur ? ({ ...cur, sections: moveItem(cur.sections, index, nextIndex) }) : cur)
                    setActiveSectionIndex(nextIndex)
                  }}
                  onDuplicate={() => duplicateSection(index)}
                  onRemove={() => {
                    if (!confirm(`Remove section ${index + 1}?`)) return
                    setDraft((cur) => cur ? ({ ...cur, sections: cur.sections.filter((_, i) => i !== index) }) : cur)
                    setActiveSectionIndex(Math.max(0, Math.min(index, sections.length - 2)))
                  }}
                />
              </div>
            )) : null}
          </div>
          </section>
          {saveError && <div className="cms-save-error [display:grid] [gap:4px] [margin-top:14px] [padding:12px_14px] [border:1px_solid_color-mix(in_srgb,var(--destructive)_28%,var(--border))] [border-left:4px_solid_var(--destructive)] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--destructive)_6%,var(--card))] [color:var(--foreground)] [&_strong]:[font-size:0.875rem] [&_span]:[font-size:0.875rem] [&_span]:[overflow-wrap:anywhere] [&_small]:[font-size:0.75rem] [&_small]:[color:var(--muted-foreground)]" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span><small>Your edits are still in this form. You can correct the issue and retry without losing the draft.</small></div>}
        </>}
      </section>
    </div>}
    </AdminDataContainer>
    </AdminWorkspaceGrid>
  </div>
}
