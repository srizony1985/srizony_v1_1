'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Building2, FileJson, Image as ImageIcon, Save, Users, RefreshCw, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getPortfolioGlobal, savePortfolioGlobal } from '@/lib/api/portfolio'
import { AdminErrorState, PageLoading, SectionToolbar } from '../_components/AdminCommon'
import { MediaField } from '../_components/MediaField'
import PortfolioBranchLocationsEditor from '../_components/PortfolioBranchLocationsEditor'

type Bi = { en: string; bn: string }
type Portfolio = Record<string, any>
const emptyBi = (): Bi => ({ en: '', bn: '' })
const asBi = (value: unknown, fallback: Bi = emptyBi()): Bi => typeof value === 'string' ? { en: value, bn: value } : value && typeof value === 'object' ? { en: String((value as any).en ?? ''), bn: String((value as any).bn ?? '') } : fallback
const pretty = (value: unknown) => JSON.stringify(value ?? [], null, 2)

function BiFields({ title, value, onChange, multiline = false }: { title: string; value: Bi; onChange: (value: Bi) => void; multiline?: boolean }) {
  return <div className="portfolio-bi-fields"><Label>{title} — English</Label>{multiline ? <textarea className="ui-textarea" rows={3} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} /> : <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />}<Label>{title} — বাংলা</Label>{multiline ? <textarea className="ui-textarea" rows={3} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} /> : <Input value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />}</div>
}

function JsonEditor({ title, value, onChange, note }: { title: string; value: unknown; onChange: (value: unknown) => void; note?: string }) {
  const [text, setText] = useState(pretty(value))
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  useEffect(() => { setText(pretty(value)); setError('') }, [value])
  return <div className="portfolio-json-editor"><div className="portfolio-json-head"><Label>{title}</Label><Button size="sm" variant="outline" onClick={() => { try { const parsed = JSON.parse(text); if (!Array.isArray(parsed) && (parsed === null || typeof parsed !== 'object')) throw new Error('Enter a JSON object or array.'); onChange(parsed); setError(''); toast.success(`${title} applied to draft.`) } catch (e) { setError(e instanceof Error ? e.message : 'Invalid JSON.') } }}><FileJson size={14} /> Apply JSON</Button></div>{note && <p className="admin-small-note">{note}</p>}<textarea className="ui-textarea portfolio-json-area" rows={12} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} /><p role="status" className="portfolio-json-error">{error}</p></div>
}

function CustomPropertiesEditor({ value, onChange }: { value: Record<string, any>; onChange: (next: Record<string, any>) => void }) {
  const entries = Object.entries(value || {})
  function rename(oldKey: string, key: string) {
    const nextKey = key.trim()
    if (!nextKey || nextKey === oldKey || Object.prototype.hasOwnProperty.call(value, nextKey)) return
    const next: Record<string, any> = {}
    for (const [current, entryValue] of Object.entries(value)) next[current === oldKey ? nextKey : current] = entryValue
    onChange(next)
  }
  function update(key: string, nextValue: any) { onChange({ ...value, [key]: nextValue }) }
  return <div className="portfolio-structured-list">
    <div className="portfolio-structured-list-top"><div><strong>Additional properties</strong><small>Add simple text or bilingual key/value properties for future site modules. Common website settings already have dedicated controls above.</small></div><Button size="sm" variant="outline" onClick={() => { let key = 'new-property'; let i = 2; while (key in value) key = `new-property-${i++}`; onChange({ ...value, [key]: emptyBi() }) }}><Plus size={14} /> Add property</Button></div>
    {entries.map(([key, itemValue], index) => {
      const bilingual = itemValue && typeof itemValue === 'object' && !Array.isArray(itemValue) && ('en' in itemValue || 'bn' in itemValue)
      const nested = itemValue && typeof itemValue === 'object' && !bilingual
      return <div className="portfolio-structured-item" key={`${key}-${index}`}><div className="portfolio-structured-item-head"><strong>{key.replaceAll('-', ' ').replaceAll('_', ' ')}</strong><button type="button" className="cms-icon-button danger" aria-label={`Remove ${key}`} onClick={() => { if (!confirm(`Remove custom property “${key}”?`)) return; const next = { ...value }; delete next[key]; onChange(next) }}><Trash2 size={14} /></button></div><div className="portfolio-structured-fields">
        <label className="cms-field"><span>Property key</span><Input defaultValue={key} onBlur={(e) => rename(key, e.target.value)} /></label>
        {bilingual ? <BiFields title="Property value" value={asBi(itemValue)} onChange={(next) => update(key, next)} /> : nested ? <details className="pb-json-settings"><summary>Advanced nested value (JSON)</summary><JsonEditor title="Nested value" value={itemValue} onChange={(next) => update(key, next)} /></details> : <label className="cms-field"><span>Property value</span><Input value={String(itemValue ?? '')} onChange={(e) => update(key, e.target.value)} /></label>}
      </div></div>
    })}
    {!entries.length && <div className="admin-empty-state">No custom properties. Add one only when a new site module needs it.</div>}
  </div>
}

function BilingualValuesEditor({ value, onChange }: { value: any[]; onChange: (next: any[]) => void }) {
  const [expanded, setExpanded] = useState<number[]>(value.length ? [0] : [])
  return <div className="portfolio-structured-list">
    <div className="portfolio-structured-list-top"><div><strong>Organizational values</strong><small>Edit each value in English and Bengali. No JSON is needed.</small></div><Button size="sm" variant="outline" onClick={() => { onChange([...value, { title: emptyBi(), description: emptyBi() }]); setExpanded((old) => [...old, value.length]) }}><Plus size={14} /> Add value</Button></div>
    {value.map((entry, index) => {
      const title = asBi(entry?.title ?? entry?.name)
      const description = asBi(entry?.description ?? entry?.body)
      const open = expanded.includes(index)
      return <div className="portfolio-structured-item" key={`value-${index}`}><div className="portfolio-structured-item-head"><button type="button" onClick={() => setExpanded((old) => open ? old.filter((n) => n !== index) : [...old, index])}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<strong>{title.en || title.bn || `Value ${index + 1}`}</strong></button><div><button type="button" className="cms-icon-button" aria-label="Move value up" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); setExpanded((old) => old.map((i) => i === index ? index - 1 : i === index - 1 ? index : i)) }}><ArrowUp size={14} /></button><button type="button" className="cms-icon-button" aria-label="Move value down" disabled={index === value.length - 1} onClick={() => { const next = [...value]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); setExpanded((old) => old.map((i) => i === index ? index + 1 : i === index + 1 ? index : i)) }}><ArrowDown size={14} /></button><button type="button" className="cms-icon-button danger" aria-label="Remove value" onClick={() => { if (!confirm('Remove this value?')) return; onChange(value.filter((_, i) => i !== index)); setExpanded((old) => old.filter((i) => i !== index).map((i) => i > index ? i - 1 : i)) }}><Trash2 size={14} /></button></div></div>{open && <div className="portfolio-structured-fields"><BiFields title="Value title" value={title} onChange={(next) => onChange(value.map((v, i) => i === index ? { ...v, title: next } : v))} /><BiFields title="Description" value={description} multiline onChange={(next) => onChange(value.map((v, i) => i === index ? { ...v, description: next } : v))} /></div>}</div>
    })}
    {!value.length && <div className="admin-empty-state">No values added yet.</div>}
  </div>
}

function PeopleListEditor({ title, value, onChange }: { title: string; value: any[]; onChange: (next: any[]) => void }) {
  const [expanded, setExpanded] = useState<number[]>(value.length ? [0] : [])
  function update(index: number, patch: Record<string, any>) { onChange(value.map((person, i) => i === index ? { ...person, ...patch } : person)) }
  function add() { onChange([...value, { name: emptyBi(), role: emptyBi(), bio: emptyBi(), image: '', email: '', phone: '', order: value.length }]); setExpanded((old) => [...old, value.length]) }
  return <div className="portfolio-structured-list">
    <div className="portfolio-structured-list-top"><div><strong>{title}</strong><small>Name, role, biography and photo fields for each member.</small></div><Button size="sm" variant="outline" onClick={add}><Plus size={14} /> Add person</Button></div>
    {value.map((person, index) => {
      const name = asBi(person?.name ?? person?.title ?? person?.label)
      const role = asBi(person?.role ?? person?.designation ?? person?.position)
      const bio = asBi(person?.bio ?? person?.description ?? person?.summary)
      const image = typeof person?.image === 'string' ? person.image : typeof person?.photo === 'string' ? person.photo : String(person?.image?.src ?? person?.photo?.src ?? '')
      const open = expanded.includes(index)
      return <div className="portfolio-structured-item" key={`${title}-${person?.id ?? index}`}><div className="portfolio-structured-item-head"><button type="button" onClick={() => setExpanded((old) => open ? old.filter((n) => n !== index) : [...old, index])}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}<strong>{name.en || name.bn || `${title} ${index + 1}`}</strong><span>{role.en || role.bn}</span></button><div><button type="button" className="cms-icon-button" aria-label="Move person up" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); setExpanded((old) => old.map((n) => n === index ? index - 1 : n === index - 1 ? index : n)) }}><ArrowUp size={14} /></button><button type="button" className="cms-icon-button" aria-label="Move person down" disabled={index === value.length - 1} onClick={() => { const next = [...value]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); setExpanded((old) => old.map((n) => n === index ? index + 1 : n === index + 1 ? index : n)) }}><ArrowDown size={14} /></button><button type="button" className="cms-icon-button danger" aria-label="Remove person" onClick={() => { if (!confirm(`Remove ${name.en || name.bn || `person ${index + 1}`}?`)) return; onChange(value.filter((_, i) => i !== index)); setExpanded((old) => old.filter((n) => n !== index).map((n) => n > index ? n - 1 : n)) }}><Trash2 size={14} /></button></div></div>
        {open && <div className="portfolio-structured-fields">
          <BiFields title="Name" value={name} onChange={(next) => update(index, { name: next })} />
          <BiFields title="Role / designation" value={role} onChange={(next) => update(index, { role: next })} />
          <BiFields title="Biography" value={bio} multiline onChange={(next) => update(index, { bio: next })} />
          <MediaField label="Profile photo" value={image} alt={name.en || name.bn} onChange={(next) => update(index, { image: next })} helper="Use an approved member portrait. Avoid uploading personal photos without permission." />
          <div className="cms-form-grid"><label className="cms-field"><span>Email (optional)</span><Input type="email" value={String(person?.email ?? '')} onChange={(e) => update(index, { email: e.target.value })} /></label><label className="cms-field"><span>Phone (optional)</span><Input value={String(person?.phone ?? '')} onChange={(e) => update(index, { phone: e.target.value })} /></label><label className="cms-field"><span>Display order</span><Input type="number" value={String(person?.order ?? index)} onChange={(e) => update(index, { order: Number(e.target.value) || 0 })} /></label></div>
        </div>}
      </div>
    })}
    {!value.length && <div className="admin-empty-state">No profiles added yet. Use “Add person” to create the first profile.</div>}
  </div>
}


export default function PortfolioPage() {
  const [global, setGlobal] = useState<Record<string, any> | null>(null)
  const [portfolio, setPortfolio] = useState<Portfolio>({})
  const [contact, setContact] = useState<Record<string, any>>({})
  const [images, setImages] = useState<Record<string, any>>({})
  const [updatedAt, setUpdatedAt] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await getPortfolioGlobal()
      const data = result.global || {}
      const saved = data.portfolio && typeof data.portfolio === 'object' ? data.portfolio : {}
      const imageData = data.images && typeof data.images === 'object' ? data.images : {}
      const contactData = data.contactInfo && typeof data.contactInfo === 'object' ? data.contactInfo : {}
      const nextPortfolio: Portfolio = {
        ...saved,
        brandIdentity: {
          name: asBi(saved.brandIdentity?.name, { en: 'Srizony', bn: 'সৃজনী' }),
          descriptor: asBi(saved.brandIdentity?.descriptor, { en: 'Foundation', bn: 'ফাউন্ডেশন' }),
          tagline: asBi(saved.brandIdentity?.tagline, { en: 'Community. Dignity. Opportunity.', bn: 'কমিউনিটি • মর্যাদা • সুযোগ' }),
          summary: asBi(saved.brandIdentity?.summary),
          logo: String(saved.brandIdentity?.logo || imageData.logo || '/images/Logo-SF.png'),
        },
        about: asBi(saved.about), mission: asBi(saved.mission), vision: asBi(saved.vision),
        values: Array.isArray(saved.values) ? saved.values : [],
        teams: Array.isArray(saved.teams) ? saved.teams : [],
        governingBody: Array.isArray(saved.governingBody) ? saved.governingBody : [],
        executiveCommittee: Array.isArray(saved.executiveCommittee) ? saved.executiveCommittee : [],
        seniorManagement: Array.isArray(saved.seniorManagement) ? saved.seniorManagement : [],
        customProperties: saved.customProperties && typeof saved.customProperties === 'object' ? saved.customProperties : {},
      }
      setGlobal(data); setPortfolio(nextPortfolio); setImages(imageData); setContact(contactData); setUpdatedAt(result.updatedAt)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load the portfolio.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])
  const brand = portfolio.brandIdentity || {}

  function updatePortfolio(key: string, value: unknown) { setSaveError(''); setPortfolio((current) => ({ ...current, [key]: value })) }
  function updateBrand(key: string, value: unknown) { setSaveError(''); setPortfolio((current) => ({ ...current, brandIdentity: { ...(current.brandIdentity || {}), [key]: value } })) }
  function updateContact(key: string, value: unknown) { setSaveError(''); setContact((current) => ({ ...current, [key]: value })) }

  async function save() {
    if (!global) return
    const logo = String(portfolio.brandIdentity?.logo || images.logo || '/images/Logo-SF.png').trim()
    // Branch and office records have one canonical home: Website Essentials.
    // Strip the legacy portfolio.branches key so a save here cannot revive stale data.
    const updatedPortfolio: Portfolio = { ...portfolio, brandIdentity: { ...portfolio.brandIdentity, logo } }
    delete updatedPortfolio.branches
    const address = asBi(contact.address)
    const nextContact = { ...contact, address }
    const nextGlobal = {
      ...global,
      images: { ...images, logo },
      contactInfo: nextContact,
      portfolio: updatedPortfolio,
    }
    setSaveError('')
    setSaving(true)
    try {
      await savePortfolioGlobal(nextGlobal, updatedAt)
      setGlobal(nextGlobal); setPortfolio(updatedPortfolio); setImages(nextGlobal.images); setContact(nextContact)
      toast.success('Portfolio profile saved. Public branding, contact details and portfolio-driven pages will use the updated values.')
      await load()
    } catch (e) { const message = e instanceof Error ? e.message : 'Unable to save the portfolio.'; setSaveError(message); toast.error(message, { description: 'Your edits are still in the form. Fix the issue or check the database connection, then retry.' }) }
    finally { setSaving(false) }
  }

  return <>
    <SectionToolbar title="Portfolio" description="Manage the public identity, organizational profile, branch map details, branch-manager contacts, mission, vision and values through database-backed CMS records." onRefresh={() => void load()} refreshing={loading} actions={<Button onClick={() => void save()} disabled={loading || saving || !global}><Save size={15} />{saving ? 'Saving…' : 'Save portfolio'}</Button>} />
    {loading && !global ? <PageLoading rows={5} /> : error ? <AdminErrorState message={error} onRetry={() => void load()} /> : global && <div className="portfolio-page-grid">
      <Card><CardHeader><CardTitle><ImageIcon size={18} /> Brand identity</CardTitle><CardDescription>Logo, brand naming, tagline and identity statement used in shared site chrome.</CardDescription></CardHeader><CardContent><div className="cms-form-grid">
        <div className="cms-span-2"><MediaField label="Brand logo" value={String(brand.logo || '')} onChange={(value) => { updateBrand('logo', value); setImages((current) => ({ ...current, logo: value })) }} alt={String(brand.name?.en || 'Srizony Foundation logo')} helper="For best results, use a transparent PNG. You can upload JPG, PNG, WebP, AVIF or GIF, or paste an existing SVG/HTTPS URL." /></div>
        <div className="cms-span-2"><BiFields title="Brand name" value={asBi(brand.name)} onChange={(v) => updateBrand('name', v)} /></div>
        <div className="cms-span-2"><BiFields title="Brand descriptor" value={asBi(brand.descriptor)} onChange={(v) => updateBrand('descriptor', v)} /></div>
        <div className="cms-span-2"><BiFields title="Tagline" value={asBi(brand.tagline)} onChange={(v) => updateBrand('tagline', v)} /></div>
        <div className="cms-span-2"><BiFields title="Brand identity statement" value={asBi(brand.summary)} multiline onChange={(v) => updateBrand('summary', v)} /></div>
      </div></CardContent></Card>

      <Card><CardHeader><CardTitle><Building2 size={18} /> Location & contact information</CardTitle><CardDescription>Head office, phone numbers, email and contact routes used by the footer and location map.</CardDescription></CardHeader><CardContent><div className="cms-form-grid">
        <div className="cms-span-2"><BiFields title="Head-office address" value={asBi(contact.address)} onChange={(v) => updateContact('address', v)} multiline /></div>
        <label className="cms-field"><span>Primary phone</span><Input value={String(contact.primaryPhone || '')} onChange={(e) => updateContact('primaryPhone', e.target.value)} /></label>
        <label className="cms-field"><span>Email</span><Input type="email" value={String(contact.email || '')} onChange={(e) => updateContact('email', e.target.value)} /></label>
        <label className="cms-field"><span>Phone list (comma separated)</span><Input value={Array.isArray(contact.phones) ? contact.phones.join(', ') : ''} onChange={(e) => updateContact('phones', e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></label>
        <label className="cms-field"><span>LinkedIn URL</span><Input value={String(contact.socials?.linkedin || '')} onChange={(e) => updateContact('socials', { ...(contact.socials || {}), linkedin: e.target.value })} /></label>
        <label className="cms-field"><span>Head-office map URL</span><Input value={String(contact.maps?.headOffice || '')} onChange={(e) => updateContact('maps', { ...(contact.maps || {}), headOffice: e.target.value })} /></label>
      </div></CardContent></Card>

      <PortfolioBranchLocationsEditor />
      <Card><CardHeader><CardTitle>About, mission, vision & values</CardTitle><CardDescription>Bilingual organization statements; these values automatically populate the homepage and matching organizational pages.</CardDescription></CardHeader><CardContent><div className="cms-form-grid">
        <div className="cms-span-2"><BiFields title="About Srizony" value={asBi(portfolio.about)} multiline onChange={(v) => updatePortfolio('about', v)} /></div>
        <div className="cms-span-2"><BiFields title="Mission" value={asBi(portfolio.mission)} multiline onChange={(v) => updatePortfolio('mission', v)} /></div>
        <div className="cms-span-2"><BiFields title="Vision" value={asBi(portfolio.vision)} multiline onChange={(v) => updatePortfolio('vision', v)} /></div>
        <div className="cms-span-2"><BilingualValuesEditor value={portfolio.values || []} onChange={(v) => updatePortfolio('values', v)} /></div>
      </div></CardContent></Card>

      <Card><CardHeader><CardTitle><Users size={18} /> People & governance</CardTitle><CardDescription>Edit member profiles using forms. Upload portraits, enter bilingual names and roles, and reorder profiles without touching JSON.</CardDescription></CardHeader><CardContent><div className="portfolio-people-editor">
        <PeopleListEditor title="Teams" value={portfolio.teams || []} onChange={(v) => updatePortfolio('teams', v)} />
        <PeopleListEditor title="Governing body" value={portfolio.governingBody || []} onChange={(v) => updatePortfolio('governingBody', v)} />
        <PeopleListEditor title="Executive committee" value={portfolio.executiveCommittee || []} onChange={(v) => updatePortfolio('executiveCommittee', v)} />
        <PeopleListEditor title="Senior management" value={portfolio.seniorManagement || []} onChange={(v) => updatePortfolio('seniorManagement', v)} />
      </div></CardContent></Card>

      <Card><CardHeader><CardTitle><FileJson size={18} /> Additional portfolio properties</CardTitle><CardDescription>Add simple or bilingual key/value fields for future site modules. You do not need to edit a single JSON object.</CardDescription></CardHeader><CardContent><CustomPropertiesEditor value={portfolio.customProperties || {}} onChange={(v) => updatePortfolio('customProperties', v)} /></CardContent></Card>
      {saveError && <div className="cms-save-error" role="alert"><strong>Portfolio changes were not saved.</strong><span>{saveError}</span><small>Your edits are still in this form. Correct the issue and retry.</small></div>}
      <div className="portfolio-save-row"><span className="admin-small-note">Changes are saved to the site-global CMS document and invalidated for public rendering.</span><Button onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving…' : 'Save portfolio changes'}</Button><Button variant="outline" onClick={() => void load()} disabled={loading || saving}><RefreshCw size={15} /> Reload</Button></div>
    </div>}
  </>
}
