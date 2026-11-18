'use client'

import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import type { ExternalValue } from '@/types/json'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { getWebsiteEssentials, saveWebsiteEssentials } from '@/lib/api/adminResources'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { BRANCHES } from '@/lib/cms/fallback-gateway'
import { normalizeWebsiteEssentials, type WebsiteEssentials } from '@/lib/websiteEssentials'
import { useRegisterAdminActions } from './AdminActionContext'
import type { Branch } from '@/types/branch'

type Bi = { en: string; bn: string }
const blankBi = (): Bi => ({ en: '', bn: '' })
const asBi = (value: ExternalValue): Bi => typeof value === 'string'
  ? { en: value, bn: value }
  : value && typeof value === 'object'
    ? { en: String((value as Bi).en ?? ''), bn: String((value as Bi).bn ?? '') }
    : blankBi()
const newId = () => `branch-${Math.random().toString(36).slice(2, 9)}`

function BilingualFields({ label, value, onChange, multiline = false }: { label: string; value: Bi; onChange: (value: Bi) => void; multiline?: boolean }) {
  return <div className="portfolio-bi-fields">
    <label>{label} — English{multiline ? <Textarea rows={2} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} /> : <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />}</label>
    <label>{label} — বাংলা{multiline ? <Textarea rows={2} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} /> : <Input value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />}</label>
  </div>
}

function Field({ label, value, onChange, type = 'text', step }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; step?: string }) {
  return <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{label}</span><Input type={type} step={step} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>
}

export default function PortfolioBranchLocationsEditor() {
  const [locations, setLocations] = useState<Branch[]>([])
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [baseline, setBaseline] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return getWebsiteEssentials()
      .then(({ data, configured: isConfigured }) => {
        const essentials = normalizeWebsiteEssentials(data)
        setConfigured(isConfigured)
        const nextLocations = isConfigured ? essentials.locations : (essentials.locations.length ? essentials.locations : BRANCHES.map((branch) => ({ ...branch })))
        setLocations(nextLocations)
        setBaseline(JSON.stringify(nextLocations))
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load the location directory.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timeout)
  }, [load])

  function patch(index: number, change: Partial<Branch>) {
    setLocations((current) => current.map((location, i) => i === index ? { ...location, ...change } : location))
  }

  function patchManager(index: number, change: Partial<NonNullable<Branch['manager']>>) {
    const manager = locations[index]?.manager ?? {}
    patch(index, { manager: { ...manager, ...change } })
  }

  function save() {
    const ids = new Set<string>()
    let headOfficeCount = 0
    for (const location of locations) {
      const id = String(location.id ?? '').trim()
      const label = location.name?.en || location.name?.bn || id || 'Unnamed location'
      const lat = Number(location.lat), lng = Number(location.lng)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) { setError(`${label} needs a unique ID using lowercase letters, numbers and single hyphens.`); return Promise.resolve() }
      if (ids.has(id)) { setError(`Location ID “${id}” is duplicated.`); return Promise.resolve() }
      ids.add(id)
      for (const [field, value] of [['name', location.name], ['district', location.district], ['division', location.division]] as const) {
        if (!value?.en?.trim() || !value?.bn?.trim()) { setError(`${label} needs both English and Bangla ${field} values.`); return Promise.resolve() }
      }
      if (location.kind === 'head') headOfficeCount += 1
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20.55 || lat > 26.7 || lng < 87.95 || lng > 92.8) { setError(`${label} needs verified coordinates inside the displayed Bangladesh map bounds.`); return Promise.resolve() }
    }
    if (headOfficeCount > 1) { setError('Only one location can be designated as the head office.'); return Promise.resolve() }

    setSaving(true)
    setError('')
    return getWebsiteEssentials()
      .then(({ data }) => {
        const latest: WebsiteEssentials = normalizeWebsiteEssentials(data)
        const normalizedLocations: Branch[] = locations.map((location) => ({
          ...location,
          id: String(location.id).trim(),
          lat: Number(location.lat),
          lng: Number(location.lng),
          kind: location.kind === 'head' ? 'head' : 'branch',
          name: asBi(location.name),
          district: asBi(location.district),
          division: asBi(location.division),
          address: asBi(location.address),
        }))
        return saveWebsiteEssentials({ ...latest, locations: normalizedLocations }).then((payload) => ({ latest, normalizedLocations, payload }))
      })
      .then(({ latest, normalizedLocations, payload }) => {
        const saved = normalizeWebsiteEssentials(payload.data ?? { ...latest, locations: normalizedLocations })
        setLocations(saved.locations)
        setBaseline(JSON.stringify(saved.locations))
        setConfigured(true)
        toast.success('Portfolio locations saved. The public map and branch-manager contact panels now use these database records.')
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save location details.'
        setError(message)
        toast.error(message)
      })
      .finally(() => setSaving(false))
  }

  const dirty = !loading && Boolean(baseline) && baseline !== JSON.stringify(locations)
  useRegisterAdminActions('portfolio-branch-locations', { save, reload: load, dirty, saving, label: 'Branch locations' })

  return <Card className="cms-span-2 [grid-column:span_2] max-[700px]:[grid-column:auto]">
    <CardHeader>
      <CardTitle><MapPin size={18} /> Working locations, map & branch managers</CardTitle>
      <CardDescription>Edit branch names, districts, divisions, addresses, coordinates and bilingual branch-manager contacts. This editor writes to the same Website Essentials database record used by the homepage map and public branch details.</CardDescription>
    </CardHeader>
    <CardContent className="portfolio-structured-list [display:grid] [gap:10px] [min-width:0]">
      {loading ? <p className="admin-small-note">Loading database-managed locations…</p> : <>
        {!configured && <p className="admin-small-note">Showing the existing bootstrap branch directory. Saving will establish the database record as the authoritative source.</p>}
        {error && <div className="cms-save-error [display:grid] [gap:4px] [margin-top:14px] [padding:12px_14px] [border:1px_solid_color-mix(in_srgb,var(--destructive)_28%,var(--border))] [border-left:4px_solid_var(--destructive)] [border-radius:var(--radius,_var(--radius))] [background:color-mix(in_srgb,var(--destructive)_6%,var(--card))] [color:var(--foreground)] [&_strong]:[font-size:0.875rem] [&_span]:[font-size:0.875rem] [&_span]:[overflow-wrap:anywhere] [&_small]:[font-size:0.75rem] [&_small]:[color:var(--muted-foreground)]" role="alert">{error}</div>}
        <div className="portfolio-structured-list-top [display:flex] [align-items:center] [justify-content:space-between] [gap:12px] [flex-wrap:wrap] [padding-bottom:9px] [border-bottom:1px_solid_var(--border)] [&>div]:[display:grid] [&>div]:[gap:3px] [&>div]:[min-width:0] [&>div_strong]:[font-size:0.875rem] [&>div_small]:[font-size:0.75rem] [&>div_small]:[line-height:1.4] [&>div_small]:[color:var(--muted-foreground)]"><div><strong>Office and branch directory</strong><small>Each map pin and branch-manager contact is updated from this list.</small></div><Button size="sm" variant="outline" onClick={() => setLocations((current) => [...current, { id: newId(), kind: 'branch', name: blankBi(), district: blankBi(), division: blankBi(), address: blankBi(), lat: 23.8103, lng: 90.4125, manager: { name: blankBi(), title: blankBi(), phone: '', email: '' } }])}><Plus size={14} /> Add location</Button></div>
        {locations.map((location, index) => <details className="portfolio-structured-item [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [overflow:hidden] [min-width:0]" key={`${location.id}-${index}`}>
          <summary className="portfolio-structured-item-head [display:flex] [align-items:center] [justify-content:space-between] [gap:8px] [padding:7px_9px] [background:var(--background)] [min-width:0] [&>button:first-child]:[display:flex] [&>button:first-child]:[align-items:center] [&>button:first-child]:[gap:7px] [&>button:first-child]:[flex:1] [&>button:first-child]:[min-width:0] [&>button:first-child]:[border:0] [&>button:first-child]:[background:transparent] [&>button:first-child]:[color:var(--foreground)] [&>button:first-child]:[text-align:left] [&>button:first-child]:[cursor:pointer] [&>button:first-child_strong]:[font-size:0.875rem] [&>button:first-child_strong]:[overflow-wrap:anywhere] [&>button:first-child_span]:[font-size:0.75rem] [&>button:first-child_span]:[color:var(--muted-foreground)] [&>button:first-child_span]:[overflow-wrap:anywhere] [&>div]:[display:flex] [&>div]:[align-items:center] [&>div]:[gap:2px] [&>div]:[flex:0_0_auto] max-[700px]:[align-items:flex-start] max-[700px]:[&>button:first-child]:[align-items:flex-start] [gap:10px] [cursor:pointer] [list-style:none] [&::-webkit-details-marker]:[display:none] [&::after]:[content:'▾'] [&::after]:[color:var(--muted-foreground)] [&::after]:[margin-left:auto]"><strong>{location.name.en || location.name.bn || `Location ${index + 1}`}</strong><span>{location.kind === 'head' ? 'Head office' : 'Branch office'}</span></summary>
          <div className="portfolio-structured-fields [display:grid] [gap:14px] [padding:12px] [min-width:0] [&_.cms-media-control]:[min-width:0] max-[700px]:[padding:9px]">
            <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]">
              <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>Location type</span><NativeSelect value={location.kind} onChange={(e) => patch(index, { kind: e.target.value as Branch['kind'] })}><option value="head">Head office</option><option value="branch">Branch office</option></NativeSelect></label>
              <Field label="Unique map ID" value={location.id} onChange={(value) => patch(index, { id: value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') })} />
            </div>
            <BilingualFields label="Location name" value={asBi(location.name)} onChange={(value) => patch(index, { name: value })} />
            <BilingualFields label="District" value={asBi(location.district)} onChange={(value) => patch(index, { district: value })} />
            <BilingualFields label="Division" value={asBi(location.division)} onChange={(value) => patch(index, { division: value })} />
            <BilingualFields label="Street address" value={asBi(location.address)} multiline onChange={(value) => patch(index, { address: value })} />
            <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><Field label="Latitude" type="number" step="any" value={location.lat} onChange={(value) => patch(index, { lat: value === '' ? Number.NaN : Number(value) })} /><Field label="Longitude" type="number" step="any" value={location.lng} onChange={(value) => patch(index, { lng: value === '' ? Number.NaN : Number(value) })} /></div>
            <fieldset className="cms-array-fieldset [grid-column:1/-1] [background:var(--background)] [&>legend]:[display:flex] [&>legend]:[align-items:center] [&>legend]:[gap:5px] [&>legend_span]:[font-size:0.75rem] [&>legend_span]:[color:var(--muted-foreground)] [&>legend_span]:[background:var(--card)] [&>legend_span]:[border:1px_solid_var(--border)] [&>legend_span]:[border-radius:999px] [&>legend_span]:[padding:2px_6px] [min-width:0] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--card)] [padding:12px] [&>legend]:[padding:0_5px] [&>legend]:[font-size:0.75rem] [&>legend]:[font-weight:600] [&>legend]:[color:var(--muted-foreground)]"><legend>Branch manager contacts</legend>
              <BilingualFields label="Manager name" value={asBi(location.manager?.name)} onChange={(name) => patchManager(index, { name })} />
              <BilingualFields label="Manager designation" value={asBi(location.manager?.title)} onChange={(title) => patchManager(index, { title })} />
              <div className="cms-form-grid [display:grid] [grid-template-columns:repeat(2,minmax(0,1fr))] [gap:10px] max-[760px]:[grid-template-columns:1fr] [gap:8px] max-[720px]:[grid-template-columns:1fr] [grid-template-columns:repeat(2,_minmax(0,_1fr))] [gap:14px] max-[700px]:[grid-template-columns:1fr]"><Field label="Manager phone" value={location.manager?.phone ?? ''} onChange={(phone) => patchManager(index, { phone })} /><Field label="Manager email" value={location.manager?.email ?? ''} onChange={(email) => patchManager(index, { email })} /></div>
            </fieldset>
            <div className="portfolio-save-row"><span className="admin-small-note">Location {index + 1}</span><Button type="button" variant="outline" size="sm" onClick={() => { if (confirm(`Remove ${location.name.en || location.name.bn || `location ${index + 1}`} from the public map?`)) setLocations((current) => current.filter((_, i) => i !== index)) }}><Trash2 size={14} /> Remove location</Button></div>
          </div>
        </details>)}
        {!locations.length && <div className="admin-empty-state [padding:22px] [color:var(--muted-foreground)] [text-align:center] [font-size:0.75rem] [min-height:110px] [display:grid] [place-items:center] [padding:20px] [font-size:0.875rem] [border:1px_dashed_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--background)]">No locations configured. Add the head office and verified branch details.</div>}
        <div className="portfolio-save-row"><span className="admin-small-note">Changes here also appear in Website Essentials, Page Builder and the public map.</span><Button onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving locations…' : 'Save map & branch contacts'}</Button><Button variant="outline" onClick={() => void load()} disabled={saving}><RefreshCw size={15} /> Reload</Button></div>
      </>}
    </CardContent>
  </Card>
}
