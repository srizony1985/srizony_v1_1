'use client'

import { websiteEssentialsRequest } from '@/lib/api/adminResources'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, ExternalLink, Eye, EyeOff, GripVertical, Plus, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MediaField } from '../_components/MediaField'
import { getEditablePage, getPageBuilderIndex, saveEditablePage, type PageIndexItem } from '@/lib/api/pageBuilder'
import { getPortfolioGlobal, savePortfolioGlobal } from '@/lib/api/portfolio'
import { normalizeWebsiteEssentials, type WebsiteEssentials } from '@/lib/websiteEssentials'
import { BRANCHES } from '@/lib/cms/fallback-gateway'
import type { Branch } from '@/types/branch'
import type { IllustrationName } from '@/types/entityType'
import CmsCardIllustration from '@/components/home/CmsCardIllustration'
import type { Bilingual, HeroData, PageData, PageSection, Section, SectionButtonConfig } from '@/types/entityType'
import { HOME_HERO_COPY_DEFAULTS } from '@/lib/cms/fallback-gateway'
import { LANDING_COMPONENT_OPTIONS, type LandingComponentKey } from '@/lib/cms/component-policy'
import { AdminErrorState, PageLoading, SectionToolbar } from '../_components/AdminCommon'
import LandingCollectionCardsEditor from '../_components/LandingCollectionCardsEditor'
import { ContentEditor } from '../_components/ContentEditor'
import { listContent } from '@/lib/api/siteContent'
import { COMPONENTS, FIXED_CONTENT_PARENT, type ContentComponent, type ContentRecord } from '@/lib/cms/components'
import { normalizeMediaSrc } from '@/lib/mediaUrl'
import { useAdminActions, useRegisterAdminActions } from '../_components/AdminActionContext'

const SECTION_TYPES: Section['type'][] = ['richText', 'stats', 'cards', 'gallery', 'timeline', 'diagram', 'table', 'video', 'cta', 'noticeList', 'contact', 'donation', 'carousel', 'contentFeed', 'reports']
const COLLECTION_SECTION_TYPES = new Set<Section['type']>(['richText', 'stats', 'cards', 'gallery', 'timeline', 'table', 'cta', 'noticeList', 'donation', 'carousel', 'contentFeed', 'reports'])

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
  let section: any
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
  section.contentCollection = { enabled: COLLECTION_SECTION_TYPES.has(type), component: defaultCollectionComponent(type), maxItems: type === 'cta' || type === 'donation' ? 1 : 12, layout: layoutsForSection(type)[0], columns: 3, gap: 24, viewportItems: 3 }
  section.buttonConfig = defaultButton(type === 'cta')
  return section as PageSection
}
function getBilingual(value: unknown): Bilingual | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && ('en' in value || 'bn' in value)) return { en: String((value as any).en ?? ''), bn: String((value as any).bn ?? '') }
  return null
}
function moveItem<T>(items: T[], from: number, to: number) { const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next }

function BilingualInputs({ label, value, onChange, multiline = false }: { label: string; value: Bilingual; onChange: (value: Bilingual) => void; multiline?: boolean }) {
  return <div className="pb-bilingual"><Label>{label} — English</Label>{multiline ? <textarea className="ui-textarea" rows={3} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} /> : <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />}<Label>{label} — বাংলা</Label>{multiline ? <textarea className="ui-textarea" rows={3} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} /> : <Input value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />}</div>
}

function emptyBranch(): Branch {
  return { id: `branch-${Date.now().toString(36)}`, kind: 'branch', name: blankBi(), district: blankBi(), division: blankBi(), address: blankBi(), lat: 0, lng: 0, manager: { name: blankBi(), title: blankBi(), phone: '', email: '' } }
}

function BranchDirectoryEditor({ value, onChange }: { value: Branch[]; onChange: (next: Branch[]) => void }) {
  const [expanded, setExpanded] = useState<number[]>(value.length ? [0] : [])
  useEffect(() => setExpanded(value.length ? [0] : []), [value.length])
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
  return <div className="portfolio-structured-list">
    <div className="portfolio-structured-list-top"><div><strong>Office and branch directory</strong><small>These locations power the animated Bangladesh map, portfolio branch directory and contact-page footprint. Coordinates control pin placement; manager details populate the map detail card.</small></div><Button size="sm" variant="outline" onClick={() => { onChange([...value, emptyBranch()]); setExpanded((current) => [...current, value.length]) }}><Plus size={14} /> Add location</Button></div>
    {value.map((branch, index) => {
      const open = expanded.includes(index)
      const name = branch.name ?? blankBi()
      const manager = branch.manager ?? {}
      return <div className="portfolio-structured-item" key={`${branch.id || 'branch'}-${index}`}>
        <div className="portfolio-structured-item-head"><button type="button" onClick={() => setExpanded((current) => open ? current.filter((n) => n !== index) : [...current, index])}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<strong>{name.en || name.bn || `Location ${index + 1}`}</strong><span>{branch.kind === 'head' ? 'Head office' : 'Branch'}</span></button><div><button type="button" className="cms-icon-button" aria-label="Move location up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button type="button" className="cms-icon-button" aria-label="Move location down" disabled={index === value.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button type="button" className="cms-icon-button danger" aria-label="Remove location" onClick={() => { if (!confirm(`Remove ${name.en || name.bn || `location ${index + 1}`} from the map?`)) return; onChange(value.filter((_, i) => i !== index)); setExpanded((current) => current.filter((n) => n !== index).map((n) => n > index ? n - 1 : n)) }}><Trash2 size={14} /></button></div></div>
        {open && <div className="portfolio-structured-fields">
          <div className="cms-form-grid"><label className="cms-field"><span>Location type</span><select className="ui-select" value={branch.kind === 'head' ? 'head' : 'branch'} onChange={(e) => update(index, { kind: e.target.value as Branch['kind'] })}><option value="head">Head office</option><option value="branch">Branch office</option></select></label><label className="cms-field"><span>Unique ID / map key</span><Input value={branch.id} onChange={(e) => update(index, { id: e.target.value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') })} /></label></div>
          <BilingualInputs label="Location name" value={name} onChange={(next) => update(index, { name: next })} />
          <BilingualInputs label="District" value={branch.district ?? blankBi()} onChange={(next) => update(index, { district: next })} />
          <BilingualInputs label="Division" value={branch.division ?? blankBi()} onChange={(next) => update(index, { division: next })} />
          <BilingualInputs label="Street address" value={branch.address ?? blankBi()} multiline onChange={(next) => update(index, { address: next })} />
          <div className="cms-form-grid"><label className="cms-field"><span>Latitude</span><Input type="number" step="any" value={String(branch.lat ?? '')} onChange={(e) => update(index, { lat: e.target.value === '' ? Number.NaN : Number(e.target.value) })} /></label><label className="cms-field"><span>Longitude</span><Input type="number" step="any" value={String(branch.lng ?? '')} onChange={(e) => update(index, { lng: e.target.value === '' ? Number.NaN : Number(e.target.value) })} /></label></div>
          <fieldset className="cms-array-fieldset"><legend>Branch manager details (optional)</legend><BilingualInputs label="Manager name" value={manager.name ?? blankBi()} onChange={(next) => updateManager(index, { name: next })} /><BilingualInputs label="Manager title" value={manager.title ?? blankBi()} onChange={(next) => updateManager(index, { title: next })} /><div className="cms-form-grid"><label className="cms-field"><span>Manager phone</span><Input value={String(manager.phone ?? '')} onChange={(e) => updateManager(index, { phone: e.target.value })} /></label><label className="cms-field"><span>Manager email</span><Input type="email" value={String(manager.email ?? '')} onChange={(e) => updateManager(index, { email: e.target.value })} /></label></div></fieldset>
        </div>}
      </div>
    })}
    {!value.length && <div className="admin-empty-state">No locations configured. Add the head office and verified branch coordinates before saving.</div>}
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
function getPath(obj: any, path: string): any { return path.split('.').reduce((v, k) => v?.[k], obj) }
function setPath(obj: any, path: string, value: any) {
  const keys = path.split('.'); const next = { ...(obj ?? {}) }; let cursor: any = next; let oldCursor: any = obj ?? {}
  for (const key of keys.slice(0, -1)) { cursor[key] = { ...(oldCursor?.[key] ?? {}) }; cursor = cursor[key]; oldCursor = oldCursor?.[key] }
  cursor[keys[keys.length - 1]] = value; return next
}
function blankFriendlyItem(fields: FriendlyField[]) {
  let item: any = {}
  for (const field of fields) item = setPath(item, field.key, field.bilingual ? { en: '', bn: '' } : field.kind === 'bilingualLines' ? [] : field.kind === 'select' ? (field.options?.[0]?.value ?? '') : '')
  return item
}
function linesToBilingual(value: unknown): Bilingual {
  const chips = Array.isArray(value) ? value : []
  return { en: chips.map((v: any) => String(v?.en ?? '')).join('\n'), bn: chips.map((v: any) => String(v?.bn ?? '')).join('\n') }
}
function bilingualToLines(value: Bilingual): Bilingual[] {
  const en = value.en.split('\n')
  const bn = value.bn.split('\n')
  return Array.from({ length: Math.max(en.length, bn.length) }, (_, index) => ({ en: en[index]?.trim() ?? '', bn: bn[index]?.trim() ?? '' })).filter((item) => item.en || item.bn)
}
function FriendlyListEditor({ section, onChange }: { section: PageSection; onChange: (section: PageSection) => void }) {
  const config = FRIENDLY_FIELDS[section.type]
  const items: any[] = Array.isArray((section as any).items) ? (section as any).items : []
  const [expanded, setExpanded] = useState<number[]>(items.length ? [0] : [])
  useEffect(() => setExpanded([0]), [section.type])
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
  function update(index: number, key: string, value: any) {
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
  return <fieldset className="cms-array-fieldset cms-friendly-list"><legend>{config.title}</legend>
    <p className="admin-small-note">Manage each item without JSON. Choose a reusable illustration preset or upload a custom image for each card/statistic; the selection is saved with this page in the database and reused by its renderer.</p>
    <div className="cms-repeat-list">
      {items.map((item, index) => {
        const itemTitle = getPath(item, 'title') ?? getPath(item, 'label') ?? getPath(item, 'value') ?? getPath(item, 'year') ?? getPath(item, 'date')
        const titleText = itemTitle && typeof itemTitle === 'object' ? (itemTitle.en || itemTitle.bn) : itemTitle
        const isOpen = expanded.includes(index)
        return <div className="cms-repeat-item" key={`${section.type}-${index}`}>
          <div className="cms-repeat-head">
            <button type="button" className="cms-repeat-toggle" onClick={() => setExpanded((current) => isOpen ? current.filter((n) => n !== index) : [...current, index])}>
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<strong>{index + 1}. {String(titleText || `${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${index + 1}`)}</strong>
            </button>
            <button type="button" className="cms-icon-button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${config.singular} up`}><ArrowUp size={14} /></button>
            <button type="button" className="cms-icon-button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={`Move ${config.singular} down`}><ArrowDown size={14} /></button>
            <button type="button" className="cms-icon-button danger" onClick={() => { if (!confirm(`Remove ${config.singular} ${index + 1}?`)) return; onChange({ ...section, items: items.filter((_, i) => i !== index) } as PageSection); setExpanded((current) => current.filter((n) => n !== index).map((n) => n > index ? n - 1 : n)) }} aria-label={`Remove ${config.singular}`}><Trash2 size={14} /></button>
          </div>
          {isOpen && <div className="cms-form-grid cms-friendly-fields">
            {activeFields.map((field) => field.kind === 'bilingualLines'
              ? <div key={field.key} className="cms-span-2"><BilingualInputs label={field.label} value={linesToBilingual(getPath(item, field.key))} multiline onChange={(value) => update(index, field.key, bilingualToLines(value))} /></div>
              : field.bilingual
                ? <div key={field.key} className={field.kind === 'textarea' ? 'cms-span-2' : ''}><BilingualInputs label={field.label} value={getPath(item, field.key) ?? blankBi()} multiline={field.kind === 'textarea'} onChange={(value) => update(index, field.key, value)} /></div>
                : field.kind === 'image' || field.kind === 'document'
                  ? <div key={field.key} className="cms-span-2"><MediaField label={field.label} value={getPath(item, field.key) ?? ''} onChange={(value) => update(index, field.key, value)} kind={field.kind === 'document' ? 'document' : 'image'} alt={String(getPath(item, 'title.en') ?? '')} /></div>
                  : field.kind === 'select'
                    ? field.key === 'illustration'
                      ? <div key={field.key} className="cms-illustration-editor cms-span-2"><label className="cms-field"><span>{field.label}</span><select className="ui-select" value={String(getPath(item, field.key) ?? '')} onChange={(e) => update(index, field.key, e.target.value)}>{(field.options ?? []).map((option) => <option key={option.value || 'automatic'} value={option.value}>{option.label}</option>)}</select></label><div className="cms-illustration-editor-preview"><CmsCardIllustration name={(String(getPath(item, field.key) || (section.homeComponent === 'missionVisionValues' ? (index === 0 ? 'mission' : index === 1 ? 'vision' : 'values') : 'users')) as IllustrationName)} imageSrc={String(getPath(item, 'image.src') || '') || undefined} alt={String(getPath(item, 'title.en') || getPath(item, 'label.en') || `${config.singular} ${index + 1}`)} compact /></div></div>
                      : <label key={field.key} className="cms-field"><span>{field.label}</span><select className="ui-select" value={String(getPath(item, field.key) ?? field.options?.[0]?.value ?? '')} onChange={(e) => update(index, field.key, e.target.value)}>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                    : <label key={field.key} className="cms-field"><span>{field.label}</span><Input type={field.kind === 'date' ? 'date' : 'text'} value={String(getPath(item, field.key) ?? '')} onChange={(e) => update(index, field.key, e.target.value)} placeholder={field.kind === 'url' ? '/projects/example or https://…' : undefined} /></label>)}
          </div>}
        </div>
      })}
      {!items.length && <div className="admin-empty-state">No items yet. Add the first {config.singular} below.</div>}
    </div>
    <button type="button" className="cms-add-row" onClick={add}><Plus size={14} /> Add {config.singular}</button>
  </fieldset>
}

function TableRowsEditor({ section, onChange }: { section: PageSection; onChange: (section: PageSection) => void }) {
  if (section.type !== 'table') return null
  const headers = Array.isArray(section.headers) ? section.headers : []
  const rows = Array.isArray(section.rows) ? section.rows : []
  const setHeaders = (next: Bilingual[]) => onChange({ ...section, headers: next, rows: rows.map((row) => Array.from({ length: next.length }, (_, i) => row[i] ?? blankBi())) })
  const setCell = (rowIndex: number, colIndex: number, value: Bilingual) => onChange({ ...section, rows: rows.map((row, r) => r === rowIndex ? row.map((cell, c) => c === colIndex ? value : cell) : row) })
  return <fieldset className="cms-array-fieldset cms-friendly-list"><legend>Table columns and rows</legend>
    <div className="cms-friendly-table-columns">{headers.map((header, i) => <div className="cms-repeat-item" key={`h-${i}`}><div className="cms-repeat-head"><strong>Column {i + 1}</strong><button type="button" className="cms-icon-button danger" onClick={() => setHeaders(headers.filter((_, j) => i !== j))} aria-label="Remove column"><Trash2 size={14} /></button></div><div className="cms-friendly-cell"><BilingualInputs label="Column heading" value={header} onChange={(value) => setHeaders(headers.map((h, j) => j === i ? value : h))} /></div></div>)}</div>
    <button type="button" className="cms-add-row" onClick={() => setHeaders([...headers, blankBi()])}><Plus size={14} /> Add column</button>
    <div className="cms-friendly-table-rows">{rows.map((row, ri) => <fieldset className="cms-array-fieldset" key={`row-${ri}`}><legend>Row {ri + 1}</legend><div className="cms-friendly-row-cells">{headers.map((header, ci) => <div key={`cell-${ri}-${ci}`}><BilingualInputs label={header.en || header.bn || `Column ${ci + 1}`} value={row[ci] ?? blankBi()} onChange={(value) => setCell(ri, ci, value)} /></div>)}</div><button type="button" className="cms-icon-button danger" onClick={() => onChange({ ...section, rows: rows.filter((_, i) => i !== ri) } as PageSection)}><Trash2 size={14} /> Remove row</button></fieldset>)}</div>
    <button type="button" className="cms-add-row" onClick={() => onChange({ ...section, rows: [...rows, headers.map(() => blankBi())] } as PageSection)}><Plus size={14} /> Add row</button>
  </fieldset>
}

function SectionExtrasEditor({ section, onChange }: { section: PageSection; onChange: (section: PageSection) => void }) {
  const set = (key: string, value: unknown) => onChange({ ...section, [key]: value } as PageSection)
  if (section.type === 'stats') return <fieldset className="cms-array-fieldset"><legend>Statistics section options</legend>
    <div className="cms-form-grid"><label className="cms-field"><span>Illustration year / label</span><Input value={section.illustrationYear ?? '1985'} onChange={(e) => set('illustrationYear', e.target.value)} placeholder="1985" /></label></div>
    <BilingualInputs label="Supporting text beside statistics" value={section.introBody ?? blankBi()} multiline onChange={(introBody) => set('introBody', introBody)} />
  </fieldset>
  if (section.type === 'cards') {
    const headingText = (section.heading?.en ?? '').trim().toLowerCase()
    const cardItems = Array.isArray(section.items) ? section.items : []
    const isEnterpriseFeed = headingText === 'srizony enterprises' || cardItems.some((item) => item.href?.startsWith('/enterprise-development/'))
    const isMissionStory = section.homeComponent === 'missionVisionValues' || headingText === 'mission, vision & values'
    const isDevelopmentAreas = section.homeComponent === 'developmentAreas' || headingText === 'integrated development areas'
    return <>
      {!isMissionStory && <fieldset className="cms-array-fieldset"><legend>Card layout</legend><div className="cms-form-grid">
        <label className="cms-field"><span>Columns (desktop)</span><select className="ui-select" value={String(section.columns ?? 3)} onChange={(e) => set('columns', Number(e.target.value) as 2 | 3 | 4)}><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option></select></label>
        {!isDevelopmentAreas && <label className="cms-field"><span>Visual style</span><select className="ui-select" value={section.variant ?? 'default'} onChange={(e) => set('variant', e.target.value as 'default' | 'impact')}><option value="default">Standard cards</option><option value="impact">Impact cards</option></select></label>}
      </div></fieldset>}
      {isEnterpriseFeed && <fieldset className="cms-array-fieldset"><legend>Enterprise card source</legend>
        <label className="cms-field"><span>Card data source</span><select className="ui-select" value={section.dataSource ?? 'published-feed'} onChange={(e) => set('dataSource', e.target.value as 'manual' | 'published-feed')}><option value="published-feed">Synchronize from published Enterprise Site Content</option><option value="manual">Use the cards edited above</option></select></label>
        <p className="admin-small-note">Manual mode preserves these titles, descriptions, images, illustration choices and routes. Published-feed mode synchronizes from Site Content → Enterprises.</p>
      </fieldset>}
      {isMissionStory && <fieldset className="cms-array-fieldset"><legend>Scroll sequence options</legend><BilingualInputs label="Scroll hint" value={(section as any).scrollHint ?? { en: 'Keep scrolling', bn: 'স্ক্রল করুন' }} onChange={(scrollHint) => set('scrollHint', scrollHint)} /></fieldset>}
    </>
  }
  if (section.type === 'gallery') return <fieldset className="cms-array-fieldset"><legend>Gallery layout</legend><label className="cms-field"><span>Columns (desktop)</span><select className="ui-select" value={String(section.columns ?? 3)} onChange={(e) => set('columns', Number(e.target.value) as 2 | 3 | 4)}><option value="2">2 columns</option><option value="3">3 columns</option><option value="4">4 columns</option></select></label></fieldset>
  if (section.type === 'timeline') return <fieldset className="cms-array-fieldset"><legend>Timeline layout</legend><label className="cms-field"><span>Presentation</span><select className="ui-select" value={section.variant ?? 'list'} onChange={(e) => set('variant', e.target.value as 'list' | 'journey')}><option value="list">Vertical timeline</option><option value="journey">Journey milestones</option></select></label><p className="admin-small-note">Journey presentation places milestones along a connected horizontal sequence on larger screens and stacks them for mobile.</p></fieldset>
  if (section.type === 'carousel') {
    const headingText = (section.heading?.en ?? '').trim().toLowerCase()
    const isNewsRail = section.homeComponent === 'news' || section.homeComponent === 'stories' || section.homeComponent === 'newsFeed' || headingText === 'news from the field' || headingText === 'latest news'
    const isSuccessGallery = section.homeComponent === 'successStories' || headingText === 'success stories of srizony' || headingText === 'success story of srizony'
    const isManagedLandingFeed = isNewsRail || isSuccessGallery
    const isHero = section.homeComponent === 'hero'
    return <fieldset className="cms-array-fieldset"><legend>{isNewsRail ? 'News rail settings' : isSuccessGallery ? 'Success stories gallery settings' : 'Carousel collection options'}</legend>
      {isHero && <p className="admin-small-note">This collection is rendered as the full-width animated homepage hero. Edit hero text, buttons and autoplay in the Homepage Hero Settings panel above; edit each slide image, alternative text, title, description and route here. Office map pins are managed in the “Our offices across Bangladesh” section.</p>}
      {isNewsRail && <><p className="admin-small-note">This is the animated News Rail. Add and manage its cards below; each card is a database-managed News record and links to /news/{'{news-slug}'}. Success Stories never appear here.</p><label className="cms-field"><span>Maximum cards displayed</span><Input type="number" min={2} max={12} value={String((section as any).maxItems ?? 8)} onChange={(e) => set('maxItems', Math.max(2, Math.min(12, Number(e.target.value) || 8)))} /></label><LandingCollectionCardsEditor component="news" /></>}
      {isSuccessGallery && <><p className="admin-small-note">This is the image-first Success Stories Gallery. Add and manage its cards below; published stories with an approved image appear here. Cards show only the image and title and link to /success-stories/{'{story-slug}'}.</p><label className="cms-field"><span>Maximum cards displayed</span><Input type="number" min={2} max={12} value={String((section as any).maxItems ?? 8)} onChange={(e) => set('maxItems', Math.max(2, Math.min(12, Number(e.target.value) || 8)))} /></label><LandingCollectionCardsEditor component="success-story" /></>}
      {!isManagedLandingFeed && !isHero && <label className="cms-field"><span>Presentation</span><select className="ui-select" value={section.presentation ?? 'collection'} onChange={(e) => set('presentation', e.target.value as 'collection' | 'scroller')}><option value="collection">Collection grid</option><option value="scroller">Animated horizontal scroller</option></select></label>}
    </fieldset>
  }
  if (section.type === 'richText') return <fieldset className="cms-array-fieldset"><legend>{section.homeComponent === 'locations' ? 'Map section options' : 'Text section options'}</legend>
    {section.homeComponent === 'locations'
      ? <p className="admin-small-note">This section renders the interactive branch map. Edit its heading and bilingual text above, then manage pin names, coordinates, addresses and manager details in the Office & Branch Locations editor below.</p>
      : <><div className="cms-form-grid"><label className="cms-field"><span>Image position</span><select className="ui-select" value={section.reverse ? 'reverse' : 'normal'} onChange={(e) => set('reverse', e.target.value === 'reverse')}><option value="normal">Image after text</option><option value="reverse">Image before text</option></select></label></div>
        <MediaField label="Supporting image" value={section.image?.src ?? ''} alt={section.image?.alt?.en ?? section.heading?.en ?? ''} onChange={(src) => set('image', src ? { ...(section.image ?? { alt: section.heading ?? blankBi() }), src, kind: 'image' } : undefined)} helper="Optional image for this text section." />
      </>}
  </fieldset>
  if (section.type === 'video') return <fieldset className="cms-array-fieldset"><legend>Video and poster</legend>
    <MediaField label="Poster / thumbnail image" value={section.poster ?? ''} onChange={(poster) => set('poster', poster)} />
    <div className="cms-form-grid"><label className="cms-field"><span>Video embed URL</span><Input value={section.embedUrl ?? ''} onChange={(e) => set('embedUrl', e.target.value)} placeholder="https://www.youtube.com/embed/…" /></label><label className="cms-field"><span>Original video URL (optional)</span><Input value={section.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.target.value)} placeholder="https://…" /></label></div>
  </fieldset>
  if (section.type === 'diagram') return <fieldset className="cms-array-fieldset"><legend>Diagram style</legend><label className="cms-field"><span>Visual type</span><select className="ui-select" value={section.variant} onChange={(e) => set('variant', e.target.value as typeof section.variant)}><option value="impact">Impact areas</option><option value="sdg">Sustainable Development Goals</option><option value="governance">Governance structure</option></select></label></fieldset>
  if (section.type === 'cta') return <fieldset className="cms-array-fieldset"><legend>{section.homeComponent === 'donate' ? 'Homepage call-to-action' : 'Call-to-action buttons'}</legend>
    <p className="admin-small-note">Use the shared “Buttons & destination routes” controls below to edit bilingual labels, visibility, internal routes, external URLs, anchor actions and secondary buttons. These controls are the single source of truth for the live section.</p>
  </fieldset>
  if (section.type === 'contact') {
    const lineList = (value: string[]) => (value ?? []).join('\n')
    const locations = section.locations ?? []
    return <fieldset className="cms-array-fieldset"><legend>Contact details and locations</legend>
      <BilingualInputs label="Address" value={section.address ?? blankBi()} multiline onChange={(address) => set('address', address)} />
      <div className="cms-form-grid"><label className="cms-field"><span>Phone numbers (one per line)</span><textarea className="ui-textarea" rows={3} value={lineList(section.phones ?? [])} onChange={(e) => set('phones', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></label><label className="cms-field"><span>Email addresses (one per line)</span><textarea className="ui-textarea" rows={3} value={lineList(section.emails ?? [])} onChange={(e) => set('emails', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean))} /></label></div>
      <BilingualInputs label="Map link label" value={(section as any).mapLabel ?? blankBi()} onChange={(mapLabel) => set('mapLabel', mapLabel)} />
      <div className="cms-friendly-list"><div className="portfolio-structured-list-top"><div><strong>Office and branch locations</strong><small>Provide verified branch details and the map search phrase for each location.</small></div><Button size="sm" variant="outline" onClick={() => set('locations', [...locations, { name: blankBi(), address: blankBi(), mapQuery: '', phone: '', email: '', kind: 'branch' }])}><Plus size={14} /> Add location</Button></div>
        {locations.map((location, index) => <div className="cms-repeat-item" key={`location-${index}`}><div className="cms-repeat-head"><strong>Location {index + 1}</strong><button type="button" className="cms-icon-button danger" onClick={() => set('locations', locations.filter((_, i) => i !== index))} aria-label="Remove location"><Trash2 size={14} /></button></div><div className="cms-friendly-fields"><BilingualInputs label="Location name" value={location.name ?? blankBi()} onChange={(name) => set('locations', locations.map((l, i) => i === index ? { ...l, name } : l))} /><BilingualInputs label="Location address" value={location.address ?? blankBi()} multiline onChange={(address) => set('locations', locations.map((l, i) => i === index ? { ...l, address } : l))} /><div className="cms-form-grid"><label className="cms-field"><span>Map search phrase</span><Input value={location.mapQuery ?? ''} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, mapQuery: e.target.value } : l))} /></label><label className="cms-field"><span>Location type</span><select className="ui-select" value={location.kind ?? 'branch'} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, kind: e.target.value as 'site' | 'branch' | 'footprint' } : l))}><option value="site">Head office</option><option value="branch">Branch office</option><option value="footprint">Project location</option></select></label><label className="cms-field"><span>Phone (optional)</span><Input value={location.phone ?? ''} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, phone: e.target.value } : l))} /></label><label className="cms-field"><span>Email (optional)</span><Input type="email" value={location.email ?? ''} onChange={(e) => set('locations', locations.map((l, i) => i === index ? { ...l, email: e.target.value } : l))} /></label></div></div></div>)}
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
  const [editorTab, setEditorTab] = useState<'content' | 'collection' | 'actions' | 'advanced'>('content')
  useEffect(() => { setRawJson(JSON.stringify(section, null, 2)); setJsonError('') }, [section])
  const type = section.type
  const isProjectsDatabaseSection = pageSlug === '/projects' && isProjectsCatalogSection
  const collectionManaged = Boolean(section.contentCollection?.enabled || isProjectsDatabaseSection || section.type === 'contentFeed')
  const commonChange = (key: string, value: unknown) => onChange({ ...section, [key]: value } as PageSection)
  const heading = getBilingual((section as any).heading)
  const eyebrow = getBilingual((section as any).eyebrow)
  const bodyRaw: any = (section as any).body
  const body = getBilingual(bodyRaw) ?? (Array.isArray(bodyRaw) ? { en: bodyRaw.map((p: any) => String(p?.en ?? '')).join('\n'), bn: bodyRaw.map((p: any) => String(p?.bn ?? '')).join('\n') } : null)
  const button = defaultSectionButton(section)
  const editorId = `pb-section-${index}-editor`
  const setButton = (next: Partial<SectionButtonConfig>) => commonChange('buttonConfig', { ...button, ...next })

  function setBodyBoth(value: Bilingual) {
    const existing: any = (section as any).body
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

  return <Card className={`pb-section-card ${section.visible === false ? 'pb-section-hidden' : ''}`}>
    <CardHeader><div className="pb-section-head">
      <div className="pb-section-title"><GripVertical size={16} /><div><CardTitle>{heading?.en || heading?.bn || `${type[0].toUpperCase()}${type.slice(1)} section ${index + 1}`}</CardTitle><CardDescription>Section {index + 1} of {total} · {type} · {section.visible === false ? 'Hidden' : 'Published'}</CardDescription></div></div>
      <div className="pb-section-actions">
        <Button size="sm" variant="outline" onClick={() => onMove(-1)} disabled={index === 0} title="Move section up"><ArrowUp size={14} /><span>Up</span></Button>
        <Button size="sm" variant="outline" onClick={() => onMove(1)} disabled={index === total - 1} title="Move section down"><ArrowDown size={14} /><span>Down</span></Button>
        <Button size="sm" variant="outline" onClick={() => commonChange('visible', section.visible === false)} title={section.visible === false ? 'Show section' : 'Hide section'} aria-label={section.visible === false ? 'Show section' : 'Hide section'}>{section.visible === false ? <Eye size={14} /> : <EyeOff size={14} />}<span>{section.visible === false ? 'Show' : 'Hide'}</span></Button>
        <Button size="sm" variant="outline" onClick={onDuplicate} title="Duplicate section" aria-label="Duplicate section"><Copy size={14} /><span>Duplicate</span></Button>
        <Button size="sm" variant="outline" className="cms-danger-outline" onClick={onRemove} title="Remove section" aria-label="Remove section"><Trash2 size={14} /><span>Remove</span></Button>
      </div>
    </div></CardHeader>
    <CardContent>
      <div className="pb-section-editor-tabs" role="tablist" aria-label={`Section ${index + 1} editor areas`}>
        <button type="button" id={`${editorId}-tab-content`} aria-controls={`${editorId}-panel-content`} role="tab" aria-selected={editorTab === 'content'} className={editorTab === 'content' ? 'active' : ''} onClick={() => setEditorTab('content')}>Content</button>
        {!section.homeComponent && (COLLECTION_SECTION_TYPES.has(section.type) || section.contentCollection?.enabled || section.type === 'contentFeed') && <button type="button" id={`${editorId}-tab-collection`} aria-controls={`${editorId}-panel-collection`} role="tab" aria-selected={editorTab === 'collection'} className={editorTab === 'collection' ? 'active' : ''} onClick={() => setEditorTab('collection')}>Collection</button>}
        {section.homeComponent !== 'hero' && <button type="button" id={`${editorId}-tab-actions`} aria-controls={`${editorId}-panel-actions`} role="tab" aria-selected={editorTab === 'actions'} className={editorTab === 'actions' ? 'active' : ''} onClick={() => setEditorTab('actions')}>Actions & routes</button>}
        <button type="button" id={`${editorId}-tab-advanced`} aria-controls={`${editorId}-panel-advanced`} role="tab" aria-selected={editorTab === 'advanced'} className={editorTab === 'advanced' ? 'active' : ''} onClick={() => setEditorTab('advanced')}>Advanced</button>
      </div>
      <div id={`${editorId}-panel-content`} className="pb-section-tab-panel" role="tabpanel" aria-labelledby={`${editorId}-tab-content`} hidden={editorTab !== 'content'}>
        <div className="cms-form-grid pb-section-grid">
          <label className="cms-field"><span>Section content type</span><select className="ui-select" value={type} disabled={Boolean(section.homeComponent)} onChange={(e) => { const nextType = e.target.value as Section['type']; const next = blankSection(nextType, heading ?? blankBi()); next.visible = section.visible !== false; next.buttonConfig = button; onChange(next) }}>{(section.homeComponent ? [type] : SECTION_TYPES).map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="cms-field"><span>Section visibility</span><select className="ui-select" value={section.visible === false ? 'hidden' : 'visible'} onChange={(e) => commonChange('visible', e.target.value === 'visible')}><option value="visible">Show on site</option><option value="hidden">Hide on site</option></select></label>
          {section.homeComponent !== 'hero' && heading && <div className="cms-span-2"><BilingualInputs label="Heading" value={heading} onChange={(v) => commonChange('heading', v)} /></div>}
          {section.homeComponent !== 'hero' && eyebrow && <div className="cms-span-2"><BilingualInputs label="Eyebrow / label" value={eyebrow} onChange={(v) => commonChange('eyebrow', v)} /></div>}
          {section.homeComponent !== 'hero' && body && !collectionManaged && section.type !== 'contentFeed' && <div className="cms-span-2"><BilingualInputs label="Body / description" value={body} multiline onChange={setBodyBoth} /></div>}
        </div>
        {(section.homeComponent !== 'news' && section.homeComponent !== 'stories' && section.homeComponent !== 'newsFeed' && section.homeComponent !== 'successStories' && !collectionManaged) && <FriendlyListEditor section={section} onChange={onChange} />}
        {!collectionManaged && <TableRowsEditor section={section} onChange={onChange} />}
        {isProjectsDatabaseSection && <p className="admin-small-note pb-projects-live-note">Project cards and uploaded images are loaded from published Project records in Site Content. The saved page layout intentionally does not duplicate those records in its manual items array; manage the live records in the Collection tab.</p>}
        <SectionExtrasEditor section={section} onChange={onChange} />
        {section.homeComponent === 'locations' && <LandingLocationsEditor key="landing-locations-editor" />}
      </div>
      {!section.homeComponent && (COLLECTION_SECTION_TYPES.has(section.type) || section.contentCollection?.enabled || section.type === 'contentFeed') && <div id={`${editorId}-panel-collection`} className="pb-section-tab-panel" role="tabpanel" aria-labelledby={`${editorId}-tab-collection`} hidden={editorTab !== 'collection'}>
        {COLLECTION_SECTION_TYPES.has(section.type) || section.type === 'contentFeed'
          ? <SectionCollectionEditor section={section} pageSlug={pageSlug} isProjectsCatalogSection={isProjectsCatalogSection} onChange={onChange} />
          : <div className="admin-empty-state">This section does not use a database collection.</div>}
      </div>}
      {section.homeComponent !== 'hero' && <div id={`${editorId}-panel-actions`} className="pb-section-tab-panel" role="tabpanel" aria-labelledby={`${editorId}-tab-actions`} hidden={editorTab !== 'actions'}>
        <fieldset className="pb-button-settings"><legend>Buttons and destination routes</legend>
          <div className="cms-form-grid">
            <label className="cms-field"><span>Show section button(s)</span><select className="ui-select" value={button.visible ? 'yes' : 'no'} onChange={(e) => setButton({ visible: e.target.value === 'yes' })}><option value="yes">Show</option><option value="no">Hide</option></select></label>
            <label className="cms-field"><span>Button type</span><select className="ui-select" value={button.mode} onChange={(e) => setButton({ mode: e.target.value as SectionButtonConfig['mode'] })}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="both">Primary + secondary</option></select></label>
            <div className="cms-span-2"><BilingualInputs label={button.mode === 'secondary' ? 'Button title' : 'Primary button title'} value={button.mode === 'secondary' ? (button.secondaryLabel ?? button.label) : button.label} onChange={(label) => setButton(button.mode === 'secondary' ? { secondaryLabel: label } : { label })} /></div>
            <label className="cms-field"><span>{button.mode === 'secondary' ? 'Button action' : 'Primary action'}</span><select className="ui-select" value={(button.mode === 'secondary' ? button.secondaryAction : button.action) || 'route'} onChange={(e) => setButton(button.mode === 'secondary' ? { secondaryAction: e.target.value as SectionButtonConfig['secondaryAction'] } : { action: e.target.value as SectionButtonConfig['action'] })}><option value="route">Internal route</option><option value="external">External URL</option><option value="anchor">Page anchor</option></select></label>
            <label className="cms-field"><span>{button.mode === 'secondary' ? 'Button destination / route' : 'Primary destination / route'}</span><Input value={button.mode === 'secondary' ? (button.secondaryHref ?? button.href) : button.href} onChange={(e) => setButton(button.mode === 'secondary' ? { secondaryHref: e.target.value } : { href: e.target.value })} placeholder="/contact or https://…" /></label>
            {button.mode === 'both' && <><div className="cms-span-2"><BilingualInputs label="Secondary button title" value={button.secondaryLabel ?? blankBi()} onChange={(secondaryLabel) => setButton({ secondaryLabel })} /></div><label className="cms-field"><span>Secondary action</span><select className="ui-select" value={button.secondaryAction || 'route'} onChange={(e) => setButton({ secondaryAction: e.target.value as SectionButtonConfig['secondaryAction'] })}><option value="route">Internal route</option><option value="external">External URL</option><option value="anchor">Page anchor</option></select></label><label className="cms-field"><span>Secondary destination / route</span><Input value={button.secondaryHref ?? ''} onChange={(e) => setButton({ secondaryHref: e.target.value })} placeholder="/projects or https://…" /></label></>}
          </div>
        </fieldset>
      </div>}
      <div id={`${editorId}-panel-advanced`} className="pb-section-tab-panel" role="tabpanel" aria-labelledby={`${editorId}-tab-advanced`} hidden={editorTab !== 'advanced'}>
        <fieldset className="pb-json-settings"><legend>Advanced technical data</legend><p className="admin-small-note">Use this only for properties not covered by the visual editor. Invalid JSON is rejected before applying changes.</p><textarea className="ui-textarea pb-json-area" rows={12} spellCheck={false} value={rawJson} onChange={(e) => setRawJson(e.target.value)} /><div className="pb-json-foot"><small className="cms-slug-taken">{jsonError}</small><Button variant="outline" size="sm" onClick={applyJson}>Apply JSON</Button></div></fieldset>
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
  const defaultConfig = { enabled: section.type === 'contentFeed' || isCanonicalProjectsCollection, component: ((section.type === 'contentFeed' ? section.components?.[0] : undefined) ?? 'project') as ContentComponent, maxItems: 12, layout: section.type === 'carousel' ? 'carousel' as const : section.type === 'gallery' ? 'masonry' as const : 'grid' as const, columns: 3 as const, gap: 24, viewportItems: 3 }
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
  const refresh = useCallback(async () => {
    if (!config.enabled) return
    setLoading(true)
    try {
      const all = await listContent(config.component)
      const contentPage = FIXED_CONTENT_PARENT[config.component] || pageSlug
      setItems(isCanonicalProjectsCollection
        ? all
        : all.filter((item) => String(FIXED_CONTENT_PARENT[item.component] || item.values.routeParent || '') === contentPage))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load this section collection.')
    } finally { setLoading(false) }
  }, [config.enabled, config.component, pageSlug, isCanonicalProjectsCollection])
  useEffect(() => { void refresh() }, [refresh])
  const setConfig = (patch: Partial<typeof config>) => onChange({ ...section, contentCollection: { ...config, ...patch } })
  const selectableComponents = Object.keys(COMPONENTS) as ContentComponent[]
  const contentPage = FIXED_CONTENT_PARENT[config.component] || pageSlug
  const layoutOptions = layoutsForSection(section.type)
  const selectedLayout = layoutOptions.includes(config.layout) ? config.layout : layoutOptions[0]
  const singleRecordSection = section.type === 'cta' || section.type === 'donation'
  const heading = (section as any).heading as Bilingual | undefined
  return <fieldset className="cms-array-fieldset">
    <legend>Site content collection</legend>
    <p className="admin-small-note">A section defines a database-backed collection. Records created here also appear in Site Content. Records created in Site Content appear here when their destination page and content type match.</p>
    <div className="cms-form-grid">
      {isCanonicalProjectsCollection
        ? <div className="cms-field"><span>Connect Site Content</span><p className="admin-small-note">Enabled automatically for the canonical Projects page. Published Project records supply this section's cards and uploaded images.</p></div>
        : <label className="cms-field"><span>Connect Site Content</span><select className="ui-select" value={config.enabled ? 'yes' : 'no'} onChange={(event) => setConfig({ enabled: event.target.value === 'yes' })}><option value="yes">Enabled — database collection</option><option value="no">Disabled — manually managed section</option></select></label>}
      {config.enabled && <>
        <label className="cms-field"><span>Content type</span><select className="ui-select" value={config.component} onChange={(event) => setConfig({ component: event.target.value as ContentComponent })}>{selectableComponents.map((component) => <option key={component} value={component}>{COMPONENTS[component].plural}</option>)}</select></label>
        <label className="cms-field"><span>Maximum records</span><Input type="number" min="1" max="100" value={String(singleRecordSection ? 1 : config.maxItems)} disabled={singleRecordSection} onChange={(event) => setConfig({ maxItems: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })} />{singleRecordSection && <small className="admin-small-note">This section uses one record as its call-to-action content.</small>}</label>
        <label className="cms-field"><span>Arrangement</span><select className="ui-select" value={selectedLayout} onChange={(event) => setConfig({ layout: event.target.value as typeof config.layout })}>{layoutOptions.map((layout) => <option key={layout} value={layout}>{layout === 'grid' ? 'Grid' : layout === 'carousel' ? 'Carousel / scroller' : layout === 'masonry' ? 'Masonry gallery' : 'List'}</option>)}</select></label>
        {(selectedLayout === 'grid' || selectedLayout === 'masonry') && <label className="cms-field"><span>Desktop columns</span><select className="ui-select" value={String(config.columns)} onChange={(event) => setConfig({ columns: Number(event.target.value) as 2 | 3 | 4 })}><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>}
        <label className="cms-field"><span>Gap (px)</span><Input type="number" min="0" max="64" value={String(config.gap)} onChange={(event) => setConfig({ gap: Math.max(0, Math.min(64, Number(event.target.value) || 0)) })} /></label>
        {selectedLayout === 'carousel' && <label className="cms-field"><span>Cards visible in viewport</span><Input type="number" min="1" max="12" value={String(config.viewportItems)} onChange={(event) => setConfig({ viewportItems: Math.max(1, Math.min(12, Number(event.target.value) || 1)) })} /></label>}
      </>}
    </div>
    {config.enabled && (config.component === 'job' || config.component === 'notice') && (
      <p className="admin-small-note">Notice and job feeds use two columns on medium and larger screens, and one column on smaller screens.</p>
    )}
    {config.enabled && <div className="cms-collection-manager">
      <div className="cms-collection-manager-head"><div><strong>{COMPONENTS[config.component].plural}</strong><small>{items.length} {isCanonicalProjectsCollection ? 'record(s) in the Projects catalogue' : <>record(s) assigned to <code>{contentPage}</code></>}{heading?.en ? ` · ${heading.en}` : ''}</small></div><Button size="sm" onClick={() => setEditing('new')}><Plus size={14} /> Add content</Button></div>
      {loading ? <p className="admin-small-note">Loading collection…</p> : items.length ? <div className="cms-collection-items">{items.map((item) => <div key={item.id} className="cms-collection-item">{item.values.image ? <img className="cms-collection-thumb" src={normalizeMediaSrc(item.values.image)} alt="" loading="lazy" /> : <span className="cms-collection-thumb cms-collection-thumb--empty" aria-hidden="true">No image</span>}<div><strong>{item.values.title_en || item.slug}</strong><small>{item.slug} · {item.status}{item.values.image ? ' · image attached' : ' · no image selected'}</small></div><Button size="sm" variant="outline" onClick={() => setEditing(item)}>Edit</Button></div>)}</div> : <p className="admin-small-note">{isCanonicalProjectsCollection ? 'No project records yet. Add one here or publish a Project from Site Content.' : `No records assigned yet. Add one here or create it in Site Content and set its “Publish under page” destination to ${contentPage}.`}</p>}
      <a className="ui-button ui-button-ghost ui-button-sm" href={`/admin/dashboard/site-content?component=${config.component}&page=${encodeURIComponent(contentPage)}`}>Open all Site Content ↗</a>
      {editing !== null && <ContentEditor key={`${config.component}-${editing === 'new' ? 'new' : editing.id}`} component={config.component} record={editing === 'new' ? null : editing} defaultRouteParent={contentPage} presentation="modal" onSaved={() => { setEditing(null); void refresh(); toast.success('Section content saved.') }} onDeleted={() => { setEditing(null); void refresh() }} onClose={() => setEditing(null)} />}
    </div>}
  </fieldset>
}

function normalizeHeroDraft(value: unknown): HeroData {
  const candidate = value && typeof value === 'object' ? value as Partial<HeroData> : {}
  const rawInterval = Number(candidate.autoplayInterval ?? HOME_HERO_COPY_DEFAULTS.autoplayInterval)
  const autoplayInterval = rawInterval < 100 ? Math.max(4.5, rawInterval) : Math.max(4500, rawInterval)
  return {
    ...HOME_HERO_COPY_DEFAULTS,
    ...candidate,
    eyebrow: { ...HOME_HERO_COPY_DEFAULTS.eyebrow, ...(candidate.eyebrow ?? {}) },
    headingLineOne: { ...HOME_HERO_COPY_DEFAULTS.headingLineOne, ...(candidate.headingLineOne ?? {}) },
    headingLineTwo: { ...HOME_HERO_COPY_DEFAULTS.headingLineTwo, ...(candidate.headingLineTwo ?? {}) },
    description: { ...HOME_HERO_COPY_DEFAULTS.description, ...(candidate.description ?? {}) },
    primaryAction: {
      ...HOME_HERO_COPY_DEFAULTS.primaryAction,
      ...(candidate.primaryAction ?? {}),
      label: { ...HOME_HERO_COPY_DEFAULTS.primaryAction.label, ...(candidate.primaryAction?.label ?? {}) },
    },
    secondaryAction: {
      ...HOME_HERO_COPY_DEFAULTS.secondaryAction,
      ...(candidate.secondaryAction ?? {}),
      label: { ...HOME_HERO_COPY_DEFAULTS.secondaryAction.label, ...(candidate.secondaryAction?.label ?? {}) },
    },
    slides: Array.isArray(candidate.slides) ? candidate.slides : [],
    stats: Array.isArray(candidate.stats) ? candidate.stats : [],
    autoplayInterval,
    copyRemoved: candidate.copyRemoved === true,
    copyVisible: candidate.copyRemoved === true ? false : candidate.copyVisible !== false,
  }
}

function LandingGlobalEditor() {
  const [globalDraft, setGlobalDraft] = useState<Record<string, any> | null>(null)
  const [hero, setHero] = useState<HeroData>(normalizeHeroDraft(HOME_HERO_COPY_DEFAULTS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getPortfolioGlobal()
      const data = result.global && typeof result.global === 'object' ? result.global : {}
      setGlobalDraft(data)
      setHero(normalizeHeroDraft(data.homeHero))
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load homepage hero settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useRegisterAdminActions('page-builder-landing-hero', { save: saveSettings, reload: load, dirty, saving, label: 'Homepage hero' })

  const updateHero = (path: string, value: unknown) => {
    setSaveError('')
    setHero((current) => setPath(current, path, value) as HeroData)
    setDirty(true)
  }

  async function saveSettings() {
    if (!globalDraft) return
    setSaving(true)
    setSaveError('')
    try {
      // Refresh the shared document immediately before saving so the hero editor
      // preserves any office-location changes saved by the separate section editor.
      const latestResult = await getPortfolioGlobal()
      const latestGlobal = latestResult.global && typeof latestResult.global === 'object' ? latestResult.global : {}
      const latestHero = latestGlobal.homeHero && typeof latestGlobal.homeHero === 'object' ? latestGlobal.homeHero : {}
      const nextGlobal = {
        ...latestGlobal,
        homeHero: {
          ...latestHero,
          eyebrow: hero.eyebrow,
          headingLineOne: hero.headingLineOne,
          headingLineTwo: hero.headingLineTwo,
          description: hero.description,
          primaryAction: { ...(latestHero.primaryAction ?? {}), ...hero.primaryAction },
          secondaryAction: { ...(latestHero.secondaryAction ?? {}), ...hero.secondaryAction },
          autoplay: hero.autoplay,
          autoplayInterval: hero.autoplayInterval,
          copyVisible: hero.copyRemoved === true ? false : hero.copyVisible !== false,
          copyRemoved: hero.copyRemoved === true,
        },
      }
      await savePortfolioGlobal(nextGlobal, latestResult.updatedAt)
      setGlobalDraft(nextGlobal)
      setDirty(false)
      toast.success('Homepage hero settings saved.')
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save homepage hero settings.'
      setSaveError(message)
      toast.error(message, { description: 'Your changes remain in the editor. Resolve the issue and save again.' })
    } finally {
      setSaving(false)
    }
  }

  const copyRemoved = hero.copyRemoved === true
  const copyVisible = !copyRemoved && hero.copyVisible !== false

  function removeHeroCopy() {
    if (!confirm('Remove the homepage hero copy from the live site? The saved text is retained so you can restore it later. Save hero settings to publish this change.')) return
    updateHero('copyRemoved', true)
    updateHero('copyVisible', false)
  }

  function restoreHeroCopy() {
    updateHero('copyRemoved', false)
    updateHero('copyVisible', true)
  }

  return <Card className="pb-landing-global-card">
    <CardHeader>
      <div className="pb-page-title-row">
        <div><CardTitle>Homepage hero settings</CardTitle><CardDescription>Edit the homepage hero copy, action buttons and slide autoplay. Hide or remove the copy independently from the image carousel. Hero slide images, captions and links remain editable in the Landing Page Hero section below. Office pins are managed inside the “Our offices across Bangladesh” section.</CardDescription></div>
        <div className="pb-section-actions">
          {copyRemoved ? <Button type="button" size="sm" variant="outline" onClick={restoreHeroCopy} disabled={loading || saving} title="Restore hero copy"><Plus size={14} />Restore copy</Button> : <>
            <Button type="button" size="sm" variant="outline" onClick={() => updateHero('copyVisible', !copyVisible)} disabled={loading || saving} title={copyVisible ? 'Hide hero copy on the public homepage' : 'Show hero copy on the public homepage'} aria-label={copyVisible ? 'Hide hero copy' : 'Show hero copy'}>{copyVisible ? <EyeOff size={14} /> : <Eye size={14} />}{copyVisible ? 'Hide copy' : 'Show copy'}</Button>
            <Button type="button" size="sm" variant="outline" className="cms-danger-outline" onClick={removeHeroCopy} disabled={loading || saving} title="Remove hero copy"><Trash2 size={14} />Remove copy</Button>
          </>}
          <Button onClick={() => void saveSettings()} disabled={loading || saving || !globalDraft}><Save size={15} />{saving ? 'Saving…' : 'Save hero settings'}</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      {loading && !globalDraft ? <PageLoading rows={4} /> : error && !globalDraft ? <AdminErrorState message={error} onRetry={() => void load()} /> : globalDraft && <>
        {copyRemoved ? <div className="admin-empty-state" role="status"><strong>Hero copy removed</strong><p>The heading, description and action buttons are hidden on the public homepage. Your saved copy is retained; select “Restore copy” to bring it back, then save hero settings.</p></div> : <fieldset className="cms-array-fieldset"><legend>Hero copy and buttons</legend>
          <div className="cms-form-grid">
            <div className="cms-span-2"><BilingualInputs label="Eyebrow" value={hero.eyebrow} onChange={(value) => updateHero('eyebrow', value)} /></div>
            <div className="cms-span-2"><BilingualInputs label="Heading — line one" value={hero.headingLineOne} onChange={(value) => updateHero('headingLineOne', value)} /></div>
            <div className="cms-span-2"><BilingualInputs label="Heading — line two" value={hero.headingLineTwo} onChange={(value) => updateHero('headingLineTwo', value)} /></div>
            <div className="cms-span-2"><BilingualInputs label="Description" value={hero.description} multiline onChange={(value) => updateHero('description', value)} /></div>
            <div className="cms-span-2"><BilingualInputs label="Primary button title" value={hero.primaryAction.label} onChange={(value) => updateHero('primaryAction.label', value)} /></div>
            <label className="cms-field"><span>Primary button route / URL</span><Input value={hero.primaryAction.href ?? ''} onChange={(e) => updateHero('primaryAction.href', e.target.value)} placeholder="/donate or https://…" /></label>
            <div className="cms-span-2"><BilingualInputs label="Secondary button title" value={hero.secondaryAction.label} onChange={(value) => updateHero('secondaryAction.label', value)} /></div>
            <label className="cms-field"><span>Secondary button route / URL</span><Input value={hero.secondaryAction.href ?? ''} onChange={(e) => updateHero('secondaryAction.href', e.target.value)} placeholder="/social-development or https://…" /></label>
            <label className="cms-field"><span>Auto-rotate hero slides</span><select className="ui-select" value={hero.autoplay === false ? 'off' : 'on'} onChange={(e) => updateHero('autoplay', e.target.value === 'on')}><option value="on">On</option><option value="off">Off</option></select></label>
            <label className="cms-field"><span>Slide interval (seconds)</span><Input type="number" min="4.5" max="120" step="0.5" value={String((hero.autoplayInterval ?? 6500) >= 100 ? (hero.autoplayInterval ?? 6500) / 1000 : hero.autoplayInterval ?? 6.5)} onChange={(e) => updateHero('autoplayInterval', Math.max(4500, Number(e.target.value) * 1000 || 6500))} /></label>
          </div>
        </fieldset>}
        {saveError && <div className="cms-save-error" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span></div>}
        <div className="pb-bottom-save"><Button onClick={() => void saveSettings()} disabled={loading || saving || !globalDraft}><Save size={15} />{saving ? 'Saving…' : 'Save hero settings'}</Button><Button variant="outline" onClick={() => void load()} disabled={loading || saving}>Reload saved settings</Button></div>
      </>}
    </CardContent>
  </Card>
}

function LandingLocationsEditor() {
  const [configured, setConfigured] = useState(false)
  const [branches, setBranches] = useState<Branch[]>(BRANCHES.map((branch) => ({ ...branch })))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await websiteEssentialsRequest()
      if (!response.ok) throw new Error('Unable to load website locations.')
      const value = normalizeWebsiteEssentials(await response.json())
      const isConfigured = response.headers.get('X-Website-Essentials-Configured') === 'true'
      setConfigured(isConfigured)
      // The legacy directory is used only until the first DB document is seeded.
      // Once configured, even an empty array is an intentional CMS value.
      setBranches(isConfigured ? value.locations : (value.locations.length ? value.locations : BRANCHES.map((branch) => ({ ...branch }))))
      setDirty(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load office locations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useRegisterAdminActions('page-builder-landing-locations', { save: saveSettings, reload: load, dirty, saving, label: 'Office locations' })

  async function saveSettings() {
    const seenIds = new Set<string>()
    let headOfficeCount = 0
    for (const branch of branches) {
      const id = String(branch.id ?? '').trim()
      const lat = Number(branch.lat)
      const lng = Number(branch.lng)
      const name = branch.name?.en || branch.name?.bn || id || 'unnamed location'
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        const message = `“${name}” needs a unique ID using lowercase letters, numbers, and single hyphens only.`
        setSaveError(message); toast.error(message); return
      }
      if (seenIds.has(id)) { const message = `The map location ID “${id}” is duplicated. Each location needs a unique ID.`; setSaveError(message); toast.error(message); return }
      seenIds.add(id)
      if (branch.kind === 'head') headOfficeCount += 1
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20.55 || lat > 26.7 || lng < 87.95 || lng > 92.8) {
        const message = `“${name}” needs verified coordinates inside the displayed Bangladesh map bounds (latitude 20.55–26.7, longitude 87.95–92.8).`
        setSaveError(message); toast.error(message); return
      }
    }
    if (headOfficeCount > 1) {
      const message = 'Only one location can be designated as the head office.'
      setSaveError(message); toast.error(message); return
    }

    setSaving(true)
    setSaveError('')
    try {
      // Read the current document first so this focused editor never overwrites
      // socials, staff or published PDF configuration owned by Website Essentials.
      const currentResponse = await websiteEssentialsRequest()
      if (!currentResponse.ok) throw new Error('Unable to refresh Website Essentials before saving locations.')
      const latest: WebsiteEssentials = normalizeWebsiteEssentials(await currentResponse.json())
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
      const response = await websiteEssentialsRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, locations: normalizedBranches }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 401) { window.location.assign('/admin/login'); return }
      if (!response.ok) throw new Error(payload.error || 'Unable to save office locations.')
      setConfigured(true)
      setBranches(normalizeWebsiteEssentials(payload.data).locations)
      setDirty(false)
      toast.success('Office locations saved to Website Essentials. The homepage map and location directory now use this database record.')
      await load()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save office locations.'
      setSaveError(message)
      toast.error(message, { description: 'Your changes remain in the editor. Resolve the issue and save again.' })
    } finally {
      setSaving(false)
    }
  }

  return <Card className="pb-landing-global-card pb-office-locations-card">
    <CardHeader>
      <div className="pb-page-title-row">
        <div><CardTitle>Office & branch locations</CardTitle><CardDescription>Manage the pins and office directory for “Our offices across Bangladesh”. This editor and Website Essentials share one database record, so edits remain consistent across the homepage, contact page and staff directory.</CardDescription></div>
        <Button onClick={() => void saveSettings()} disabled={loading || saving}><Save size={15} />{saving ? 'Saving…' : 'Save office locations'}</Button>
      </div>
    </CardHeader>
    <CardContent>
      {loading ? <PageLoading rows={4} /> : error ? <AdminErrorState message={error} onRetry={() => void load()} /> : <>
        {!configured && <p className="admin-small-note">Showing the legacy bootstrap directory until Website Essentials has been seeded. Saving here writes the locations to PostgreSQL.</p>}
        <fieldset className="cms-array-fieldset"><legend>Bangladesh map locations</legend>
          <BranchDirectoryEditor value={branches} onChange={(next) => { setSaveError(''); setBranches(next); setDirty(true) }} />
        </fieldset>
        {saveError && <div className="cms-save-error" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span></div>}
        <div className="pb-bottom-save"><Button onClick={() => void saveSettings()} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save office locations'}</Button><Button variant="outline" onClick={() => void load()} disabled={saving}>Reload saved locations</Button></div>
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
  const [saveError, setSaveError] = useState('')
  const [error, setError] = useState('')
  const [newSectionType, setNewSectionType] = useState<Section['type']>('richText')
  const [newLandingComponent, setNewLandingComponent] = useState<LandingComponentKey>('growth')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [pageQuery, setPageQuery] = useState('')
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const baselineRef = useRef('')

  const loadIndex = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await getPageBuilderIndex()
      const available = data.availablePages ?? []
      setPages(available)
      setSlug((current) => current || (available.some((page) => page.slug === '/') ? '/' : available[0]?.slug || ''))
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load pages.') }
    finally { setLoading(false) }
  }, [])

  const loadPage = useCallback(async (nextSlug: string) => {
    if (!nextSlug) return
    setSaveError(''); setPageLoading(true); setError('')
    try {
      const result = await getEditablePage(nextSlug)
      const data = result.override ?? result.fallback
      if (!data) throw new Error('No content is available for this page.')
      const normalizedDraft: PageData = { ...data, slug: nextSlug, status: nextSlug === '/' ? 'published' : data.status, title: data.title ?? { en: nextSlug, bn: nextSlug }, sections: Array.isArray(data.sections) ? data.sections.map((section: any, index: number) => ({ ...section, sectionId: section.sectionId || `section-${nextSlug.replace(/[^a-z0-9]+/gi, '-')}-${index + 1}`, visible: section.visible !== false })) : [] }
      baselineRef.current = JSON.stringify(normalizedDraft)
      setActiveSectionIndex(0)
      setDraft(normalizedDraft)
      setUpdatedAt(result.meta?.updatedAt)
    } catch (e) { baselineRef.current = ''; setDraft(null); setError(e instanceof Error ? e.message : 'Unable to load page.') }
    finally { setPageLoading(false) }
  }, [])

  useEffect(() => {
    // The dedicated Landing Page sidebar item selects the canonical root page without a slug form.
    const requestedSlug = new URLSearchParams(window.location.search).get('slug')
    if (requestedSlug === '/') setSlug('/')
  }, [])
  useEffect(() => { void loadIndex() }, [loadIndex])
  useEffect(() => { if (slug) void loadPage(slug) }, [slug, loadPage])

  const pagesSorted = useMemo(() => [...pages].sort((a, b) => a.slug.localeCompare(b.slug)).filter((p) => !pageQuery.trim() || `${p.slug} ${p.title.en} ${p.title.bn}`.toLowerCase().includes(pageQuery.trim().toLowerCase())), [pages, pageQuery])
  const updateTop = (key: keyof PageData, value: any) => { setSaveError(''); setDraft((cur) => cur ? ({ ...cur, [key]: value }) : cur) }
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
    toast.success('Section duplicated. Save the page to publish the copy.')
  }

  async function save() {
    if (!draft || !slug) return
    if (!draft.title.en.trim()) { const issue = 'Enter the page title in English.'; setSaveError(issue); return toast.error(issue) }
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
        if (b.mode === 'primary' || b.mode === 'both') { const issue = validateButton(b.href, b.action, 'Primary button'); if (issue) { setSaveError(issue); return toast.error(issue) } }
        if (b.mode === 'secondary' || b.mode === 'both') { const issue = validateButton(b.secondaryHref ?? (b.mode === 'secondary' ? b.href : undefined), b.secondaryAction, 'Secondary button'); if (issue) { setSaveError(issue); return toast.error(issue) } }
      }
    }
    setSaveError('')
    setSaving(true)
    try {
      const savedSnapshot = { ...draft, slug, ...(slug === '/' ? { status: 'published' as const } : {}) }
      await saveEditablePage(slug, savedSnapshot, updatedAt)
      baselineRef.current = JSON.stringify(savedSnapshot)
      toast.success('Page layout and content saved to the database.')
      await loadPage(slug)
      await loadIndex()
    } catch (e) { const message = e instanceof Error ? e.message : 'Unable to save page.'; setSaveError(message); toast.error(message, { description: 'Your edits are still in this form. Correct the issue and try saving again.' }) }
    finally { setSaving(false) }
  }

  const isDirty = Boolean(draft && JSON.stringify(draft) !== baselineRef.current)
  useRegisterAdminActions('page-builder-current-page', { save: async () => { await save() }, reload: async () => { await loadIndex(); if (slug) await loadPage(slug) }, dirty: isDirty, saving, label: 'Page content' })

  function changePage(nextSlug: string) {
    if (nextSlug === slug) return
    if (anyEditorDirty && !window.confirm('You have unsaved changes in this page or one of its editors. Discard them and open another page?')) return
    baselineRef.current = ''
    setActiveSectionIndex(0)
    setDraft(null)
    setSlug(nextSlug)
  }

  const sections = draft?.sections ?? []
  const markedProjectsSectionIndex = slug === '/projects' ? sections.findIndex(isProjectsCollectionMarker) : -1
  const projectsCatalogSectionIndex = slug === '/projects'
    ? markedProjectsSectionIndex >= 0 ? markedProjectsSectionIndex : sections.findIndex(isProjectsCollectionPresentation)
    : -1
  function jumpToSection(index: number) {
    setActiveSectionIndex(index)
    document.getElementById(`pb-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function addPageSection() {
    if (!draft) return
    const next = blankSection(newSectionType, { en: `New ${newSectionType} section`, bn: `নতুন ${newSectionType} অংশ` })
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
    setDraft((current) => current ? ({ ...current, sections: [...current.sections, next] }) : current)
  }
  return <>
    <SectionToolbar title="Page Builder" description="Edit pages and their sections in focused workspaces. Changes are tracked, and the global Save all action saves every open editor." count={pages.length} onRefresh={() => { void loadIndex(); if (slug) void loadPage(slug) }} refreshing={loading || pageLoading} actions={<span className={`pb-save-state ${isDirty || saveError ? 'is-dirty' : ''}`}>{saving ? 'Saving changes…' : saveError ? 'Save failed — retry' : isDirty ? 'Unsaved changes' : 'All changes saved'}</span>} />
    {loading && !pages.length ? <PageLoading rows={4} /> : error && !draft ? <AdminErrorState message={error} onRetry={() => { void loadIndex(); if (slug) void loadPage(slug) }} /> : <div className="pb-layout">
      <div className="pb-page-navigation">
        <div className="pb-page-navigation-head"><div><strong>Pages</strong><span>{pages.length} editable routes</span></div><input className="ui-input" aria-label="Filter pages" placeholder="Filter pages…" value={pageQuery} onChange={(e) => setPageQuery(e.target.value)} /></div>
        <nav className="pb-page-tabs" aria-label="Pages" role="tablist">
          {pagesSorted.map((page) => <button id={`pb-page-tab-${page.slug === '/' ? 'home' : page.slug.replace(/[^a-z0-9_-]+/gi, '-')}`} role="tab" aria-controls="pb-page-editor-panel" aria-selected={slug === page.slug} data-page-option={`${page.slug} ${page.title.en} ${page.title.bn}`.toLowerCase()} type="button" key={page.slug} className={`pb-page-tab ${slug === page.slug ? 'active' : ''}`} onClick={() => changePage(page.slug)}><strong>{page.slug === '/' ? 'Landing Page' : page.title.en || page.slug}</strong><small>{page.slug}</small><span className={`pb-page-status ${page.status}`}>{page.status}</span></button>)}
          {!pagesSorted.length && <span className="admin-small-note">No pages match this search.</span>}
        </nav>
        <label className="pb-mobile-page-picker"><span>Choose page</span><select className="ui-select" value={slug} onChange={(event) => changePage(event.target.value)}>{pagesSorted.map((page) => <option key={page.slug} value={page.slug}>{page.slug === '/' ? 'Landing Page' : page.title.en} · {page.slug}</option>)}</select></label>
      </div>
      <section id="pb-page-editor-panel" className="pb-editor" role="tabpanel" tabIndex={0} aria-label={`Editing ${slug === '/' ? 'Landing Page' : slug || 'page'}`}>
        {pageLoading || !draft ? <PageLoading rows={4} /> : <>
          <Card><CardHeader><div className="pb-page-title-row"><div><CardTitle>{slug === '/' ? 'Landing Page' : (draft.title.en || slug)}</CardTitle><CardDescription>{slug === '/' ? 'Homepage content document' : 'Database-backed page document'} · <code>{slug}</code></CardDescription></div><div className="pb-page-title-actions"><a className="ui-button ui-button-outline ui-button-default" href={slug === '/' ? '/' : slug} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> View site</a><Button onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save page'}</Button></div></div></CardHeader><CardContent><div className="cms-form-grid">
            <div className="cms-span-2"><BilingualInputs label={slug === '/' ? "Page title (browser/search metadata)" : "Page title"} value={draft.title} onChange={(title) => updateTop('title', title)} /></div>
            <div className="cms-span-2"><BilingualInputs label={slug === '/' ? "Page subtitle (metadata / internal summary)" : "Page subtitle"} value={draft.subtitle ?? blankBi()} onChange={(subtitle) => updateTop('subtitle', subtitle)} multiline /></div>
            <div className="cms-span-2"><MediaField label={slug === '/' ? "Social preview image (Open Graph)" : "Hero image"} value={draft.heroImage ?? ''} onChange={(value) => updateTop('heroImage', value || undefined)} alt={draft.title.en} helper={slug === '/' ? "Sets the homepage link-preview image. Edit the visible homepage carousel images in the Landing Page Hero section below." : "Upload an approved image or paste an existing HTTPS / CMS media URL."} /></div>
            <label className="cms-field"><span>Page layout</span><select className="ui-select" value={draft.layout ?? 'standard'} onChange={(e) => updateTop('layout', e.target.value as PageData['layout'])}><option value="standard">Standard width</option><option value="wide">Wide content</option><option value="narrow">Narrow reading</option><option value="editorial">Editorial panels</option></select></label>
            {slug !== '/' && <label className="cms-field"><span>Routed page content padding</span><select className="ui-select" value={draft.contentPadding ?? 'normal'} onChange={(e) => updateTop('contentPadding', e.target.value as NonNullable<PageData['contentPadding']>)}><option value="none">No outer vertical padding</option><option value="compact">Compact</option><option value="normal">Default</option><option value="spacious">Spacious</option></select><small className="admin-small-note">Controls the vertical spacing between the hero and routed page sections, as well as spacing between sections.</small></label>}
            <label className="cms-field"><span>Publication status</span><select className="ui-select" value={slug === '/' ? 'published' : (draft.status ?? 'published')} disabled={slug === '/'} onChange={(e) => updateTop('status', e.target.value as PageData['status'])}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select>{slug === '/' && <small className="admin-small-note">The landing page route stays published; hide individual sections when needed.</small>}</label>
            <label className="cms-field"><span>Page sort order</span><Input type="number" value={String(draft.sortOrder ?? 0)} onChange={(e) => updateTop('sortOrder', Math.max(0, Number(e.target.value) || 0))} /></label>
            <div className="cms-span-2"><BilingualInputs label="Search description" value={draft.metaDescription ?? blankBi()} onChange={(metaDescription) => updateTop('metaDescription', metaDescription)} multiline /></div>
          </div></CardContent></Card>
          {slug === '/' && <LandingGlobalEditor key="landing-global-editor" />}
          <div className="pb-sections-heading"><div><h2>{slug === '/' ? 'Landing compositions' : 'Page sections'}</h2><p>{sections.length} section{sections.length === 1 ? '' : 's'} · Drag sections to rearrange them. {slug === '/' ? 'Configure every landing composition here; use the News Rail and Success Stories card managers inside those sections to create and edit their database records.' : 'Use normal page sections or optionally add a reusable landing composition.'} Hidden sections remain editable but do not render publicly.</p></div><div className="pb-add-section">{slug === '/' ? <><select className="ui-select" aria-label="Landing composition" value={newLandingComponent} onChange={(e) => setNewLandingComponent(e.target.value as LandingComponentKey)}>{LANDING_COMPONENT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><Button variant="outline" onClick={() => addLandingSection(newLandingComponent)}><Plus size={14} /> Add landing composition</Button></> : <><select className="ui-select" aria-label="Page section type" value={newSectionType} onChange={(e) => setNewSectionType(e.target.value as Section['type'])}>{SECTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select><Button variant="outline" onClick={addPageSection}><Plus size={14} /> Add page section</Button><select className="ui-select" aria-label="Reusable landing composition" value={newLandingComponent} onChange={(e) => setNewLandingComponent(e.target.value as LandingComponentKey)}>{LANDING_COMPONENT_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><Button variant="outline" onClick={() => addLandingSection(newLandingComponent)}><Plus size={14} /> Add landing UI</Button></>}</div></div>
          {!!sections.length && <nav className="pb-section-navigation" aria-label="Page sections">
            <div className="pb-section-navigation-label">Jump to section</div>
            <div className="pb-section-tabs">
              {sections.map((section, index) => <button type="button" key={section.sectionId || `section-${index}`} aria-current={activeSectionIndex === index ? 'true' : undefined} onClick={() => jumpToSection(index)}><span>{index + 1}</span>{getBilingual((section as any).heading)?.en || section.homeComponent || section.type}</button>)}
            </div>
            <label className="pb-mobile-section-picker"><span>Choose section</span><select className="ui-select" value={String(Math.min(activeSectionIndex, Math.max(0, sections.length - 1)))} onChange={(event) => jumpToSection(Number(event.target.value))}>{sections.map((section, index) => <option key={section.sectionId || `mobile-section-${index}`} value={index}>{index + 1}. {getBilingual((section as any).heading)?.en || section.homeComponent || section.type}</option>)}</select></label>
          </nav>}
          <div className="pb-sections-list" onDragOver={(e) => e.preventDefault()} onDragStartCapture={(e) => { const target = e.target as HTMLElement; const card = target.closest('[data-section-index]'); if (card) setDragIndex(Number(card.getAttribute('data-section-index'))) }} onDropCapture={(e) => { const target = e.target as HTMLElement; const card = target.closest('[data-section-index]'); if (!card || dragIndex === null) return; const to = Number(card.getAttribute('data-section-index')); if (to !== dragIndex) setDraft((cur) => cur ? ({ ...cur, sections: moveItem(cur.sections, dragIndex, to) }) : cur); setDragIndex(null) }}>
            {sections.map((section, index) => <div id={`pb-section-${index}`} data-section-index={index} key={section.sectionId || `${slug}-section-${index}`} draggable onDragStart={(e) => { setDragIndex(index); e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move' }} onDragOver={(e) => e.preventDefault()}><SectionCard section={section} index={index} total={sections.length} pageSlug={slug} isProjectsCatalogSection={index === projectsCatalogSectionIndex} onChange={(value) => updateSection(index, value)} onMove={(delta) => setDraft((cur) => cur ? ({ ...cur, sections: moveItem(cur.sections, index, index + delta) }) : cur)} onDuplicate={() => duplicateSection(index)} onRemove={() => { if (confirm(`Remove section ${index + 1}?`)) setDraft((cur) => cur ? ({ ...cur, sections: cur.sections.filter((_, i) => i !== index) }) : cur) }} /></div>)}
            {!sections.length && <div className="admin-empty-state">This page has no sections. Add a section to build the page.</div>}
          </div>
          {saveError && <div className="cms-save-error" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span><small>Your edits are still in this form. You can correct the issue and retry without losing the draft.</small></div>}
          <div className="pb-bottom-save"><Button onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save all page changes'}</Button></div>
        </>}
      </section>
    </div>}
  </>
}
