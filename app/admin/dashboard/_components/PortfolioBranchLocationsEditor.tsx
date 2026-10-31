'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapPin, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { websiteEssentialsRequest } from '@/lib/api/adminResources'
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
const asBi = (value: unknown): Bi => typeof value === 'string'
  ? { en: value, bn: value }
  : value && typeof value === 'object'
    ? { en: String((value as Bi).en ?? ''), bn: String((value as Bi).bn ?? '') }
    : blankBi()
const newId = () => `branch-${Math.random().toString(36).slice(2, 9)}`

function BilingualFields({ label, value, onChange, multiline = false }: { label: string; value: Bi; onChange: (value: Bi) => void; multiline?: boolean }) {
  return <div className="portfolio-bi-fields">
    <label>{label} — English{multiline ? <textarea className="ui-textarea" rows={2} value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} /> : <Input value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />}</label>
    <label>{label} — বাংলা{multiline ? <textarea className="ui-textarea" rows={2} value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} /> : <Input value={value.bn} onChange={(e) => onChange({ ...value, bn: e.target.value })} />}</label>
  </div>
}

function Field({ label, value, onChange, type = 'text', step }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; step?: string }) {
  return <label className="cms-field"><span>{label}</span><Input type={type} step={step} value={String(value ?? '')} onChange={(event) => onChange(event.target.value)} /></label>
}

export default function PortfolioBranchLocationsEditor() {
  const [locations, setLocations] = useState<Branch[]>([])
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const baselineRef = useRef('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await websiteEssentialsRequest()
      if (!response.ok) throw new Error('Unable to load the location directory.')
      const essentials = normalizeWebsiteEssentials(await response.json())
      const isConfigured = response.headers.get('X-Website-Essentials-Configured') === 'true'
      setConfigured(isConfigured)
      const nextLocations = isConfigured ? essentials.locations : (essentials.locations.length ? essentials.locations : BRANCHES.map((branch) => ({ ...branch })))
      setLocations(nextLocations)
      baselineRef.current = JSON.stringify(nextLocations)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the location directory.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function patch(index: number, change: Partial<Branch>) {
    setLocations((current) => current.map((location, i) => i === index ? { ...location, ...change } : location))
  }

  function patchManager(index: number, change: Partial<NonNullable<Branch['manager']>>) {
    const manager = locations[index]?.manager ?? {}
    patch(index, { manager: { ...manager, ...change } })
  }

  async function save() {
    const ids = new Set<string>()
    let headOfficeCount = 0
    for (const location of locations) {
      const id = String(location.id ?? '').trim()
      const label = location.name?.en || location.name?.bn || id || 'Unnamed location'
      const lat = Number(location.lat), lng = Number(location.lng)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) { setError(`${label} needs a unique ID using lowercase letters, numbers and single hyphens.`); return }
      if (ids.has(id)) { setError(`Location ID “${id}” is duplicated.`); return }
      ids.add(id)
      for (const [field, value] of [['name', location.name], ['district', location.district], ['division', location.division]] as const) {
        if (!value?.en?.trim() || !value?.bn?.trim()) { setError(`${label} needs both English and Bangla ${field} values.`); return }
      }
      if (location.kind === 'head') headOfficeCount += 1
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 20.55 || lat > 26.7 || lng < 87.95 || lng > 92.8) { setError(`${label} needs verified coordinates inside the displayed Bangladesh map bounds.`); return }
    }
    if (headOfficeCount > 1) { setError('Only one location can be designated as the head office.'); return }

    setSaving(true)
    setError('')
    try {
      // Read the latest full settings document first. This editor owns only locations;
      // social URLs, staff and PDF records remain untouched.
      const currentResponse = await websiteEssentialsRequest()
      if (!currentResponse.ok) throw new Error('Unable to refresh Website Essentials before saving locations.')
      const latest: WebsiteEssentials = normalizeWebsiteEssentials(await currentResponse.json())
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
      const response = await websiteEssentialsRequest({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...latest, locations: normalizedLocations }),
      })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 401) { window.location.assign('/admin/login'); return }
      if (!response.ok) throw new Error(payload.error || 'Unable to save location details.')
      const saved = normalizeWebsiteEssentials(payload.data ?? { ...latest, locations: normalizedLocations })
      setLocations(saved.locations)
      baselineRef.current = JSON.stringify(saved.locations)
      setConfigured(true)
      toast.success('Portfolio locations saved. The public map and branch-manager contact panels now use these database records.')
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save location details.'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const dirty = useMemo(() => Boolean(baselineRef.current) && !loading && baselineRef.current !== JSON.stringify(locations), [loading, locations])
  useRegisterAdminActions('portfolio-branch-locations', { save, reload: load, dirty, saving, label: 'Branch locations' })

  return <Card className="cms-span-2">
    <CardHeader>
      <CardTitle><MapPin size={18} /> Working locations, map & branch managers</CardTitle>
      <CardDescription>Edit branch names, districts, divisions, addresses, coordinates and bilingual branch-manager contacts. This editor writes to the same Website Essentials database record used by the homepage map and public branch details.</CardDescription>
    </CardHeader>
    <CardContent className="portfolio-structured-list">
      {loading ? <p className="admin-small-note">Loading database-managed locations…</p> : <>
        {!configured && <p className="admin-small-note">Showing the existing bootstrap branch directory. Saving will establish the database record as the authoritative source.</p>}
        {error && <div className="cms-save-error" role="alert">{error}</div>}
        <div className="portfolio-structured-list-top"><div><strong>Office and branch directory</strong><small>Each map pin and branch-manager contact is updated from this list.</small></div><Button size="sm" variant="outline" onClick={() => setLocations((current) => [...current, { id: newId(), kind: 'branch', name: blankBi(), district: blankBi(), division: blankBi(), address: blankBi(), lat: 23.8103, lng: 90.4125, manager: { name: blankBi(), title: blankBi(), phone: '', email: '' } }])}><Plus size={14} /> Add location</Button></div>
        {locations.map((location, index) => <details className="portfolio-structured-item" key={`${location.id}-${index}`}>
          <summary className="portfolio-structured-item-head"><strong>{location.name.en || location.name.bn || `Location ${index + 1}`}</strong><span>{location.kind === 'head' ? 'Head office' : 'Branch office'}</span></summary>
          <div className="portfolio-structured-fields">
            <div className="cms-form-grid">
              <label className="cms-field"><span>Location type</span><select className="ui-select" value={location.kind} onChange={(e) => patch(index, { kind: e.target.value as Branch['kind'] })}><option value="head">Head office</option><option value="branch">Branch office</option></select></label>
              <Field label="Unique map ID" value={location.id} onChange={(value) => patch(index, { id: value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') })} />
            </div>
            <BilingualFields label="Location name" value={asBi(location.name)} onChange={(value) => patch(index, { name: value })} />
            <BilingualFields label="District" value={asBi(location.district)} onChange={(value) => patch(index, { district: value })} />
            <BilingualFields label="Division" value={asBi(location.division)} onChange={(value) => patch(index, { division: value })} />
            <BilingualFields label="Street address" value={asBi(location.address)} multiline onChange={(value) => patch(index, { address: value })} />
            <div className="cms-form-grid"><Field label="Latitude" type="number" step="any" value={location.lat} onChange={(value) => patch(index, { lat: value === '' ? Number.NaN : Number(value) })} /><Field label="Longitude" type="number" step="any" value={location.lng} onChange={(value) => patch(index, { lng: value === '' ? Number.NaN : Number(value) })} /></div>
            <fieldset className="cms-array-fieldset"><legend>Branch manager contacts</legend>
              <BilingualFields label="Manager name" value={asBi(location.manager?.name)} onChange={(name) => patchManager(index, { name })} />
              <BilingualFields label="Manager designation" value={asBi(location.manager?.title)} onChange={(title) => patchManager(index, { title })} />
              <div className="cms-form-grid"><Field label="Manager phone" value={location.manager?.phone ?? ''} onChange={(phone) => patchManager(index, { phone })} /><Field label="Manager email" value={location.manager?.email ?? ''} onChange={(email) => patchManager(index, { email })} /></div>
            </fieldset>
            <div className="portfolio-save-row"><span className="admin-small-note">Location {index + 1}</span><Button type="button" variant="outline" size="sm" onClick={() => { if (confirm(`Remove ${location.name.en || location.name.bn || `location ${index + 1}`} from the public map?`)) setLocations((current) => current.filter((_, i) => i !== index)) }}><Trash2 size={14} /> Remove location</Button></div>
          </div>
        </details>)}
        {!locations.length && <div className="admin-empty-state">No locations configured. Add the head office and verified branch details.</div>}
        <div className="portfolio-save-row"><span className="admin-small-note">Changes here also appear in Website Essentials, Page Builder and the public map.</span><Button onClick={() => void save()} disabled={saving}><Save size={15} />{saving ? 'Saving locations…' : 'Save map & branch contacts'}</Button><Button variant="outline" onClick={() => void load()} disabled={saving}><RefreshCw size={15} /> Reload</Button></div>
      </>}
    </CardContent>
  </Card>
}
