'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BRANCHES } from '@/lib/cms/fallback-gateway'
import type { Branch } from '@/types/branch'
import { DEFAULT_WEBSITE_ESSENTIALS, normalizeWebsiteEssentials, type ManagementStaffMember, type WebsiteEssentials } from '@/lib/websiteEssentials'
import { AdminErrorState, PageLoading, SectionToolbar } from '../_components/AdminCommon'
import { CirclePlus, FileUp, Save, Trash2, Users, MapPin, Share2, FileText } from 'lucide-react'

const initial = (): WebsiteEssentials => ({ ...DEFAULT_WEBSITE_ESSENTIALS, staff: [], locations: BRANCHES.map((branch) => ({ ...branch })) })
const randomId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="essentials-field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

function PublicPdfField({ title, value, onChange }: { title: string; value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function upload(file?: File) {
    if (!file) return
    setError(''); setNotice('')
    if (file.type !== 'application/pdf') { setError('Select a PDF document.'); return }
    if (!file.size || file.size > 4 * 1024 * 1024) { setError('The PDF must be between 1 byte and 4 MB.'); return }
    const form = new FormData()
    form.append('file', file)
    form.append('kind', 'document')
    form.append('visibility', 'public')
    setUploading(true)
    try {
      const response = await fetch('/api/admin/media/upload', { method: 'POST', body: form, cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.src) throw new Error(data?.error?.message || data?.error || 'PDF upload failed. Check the media storage configuration.')
      onChange(String(data.src))
      setNotice('PDF uploaded. Save the Website Essentials form to publish the link.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'PDF upload failed.') }
    finally { setUploading(false) }
  }
  return <div className="essentials-upload">
    <label className="essentials-field"><span>{title} PDF URL</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Upload a PDF or paste an HTTPS /api/media link" /></label>
    <div className="essentials-upload-actions">
      <label className={`ui-button ui-button-outline ui-button-sm ${uploading ? 'is-disabled' : ''}`}><FileUp size={14}/>{uploading ? 'Uploading…' : 'Upload public PDF'}<input type="file" accept="application/pdf,.pdf" hidden disabled={uploading} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
      {value && <a className="ui-button ui-button-outline ui-button-sm" href={value} target="_blank" rel="noreferrer">Preview PDF ↗</a>}
    </div>
    <p className="essentials-help">Public documents are served through a validated CMS media record. PDF limit: 4 MB.</p>
    {notice && <p className="essentials-success" role="status">{notice}</p>}
    {error && <p className="essentials-error" role="alert">{error}</p>}
  </div>
}

export default function WebsiteEssentialsPage() {
  const [data, setData] = useState<WebsiteEssentials>(initial)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/website-essentials', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Unable to load website settings.')
      const value = await response.json()
      return { value, configured: response.headers.get('X-Website-Essentials-Configured') === 'true' }
    }).then(({ value, configured }) => {
      if (cancelled) return
      const normalized = normalizeWebsiteEssentials(value)
      setData({ ...normalized, locations: configured ? normalized.locations : (normalized.locations.length ? normalized.locations : BRANCHES.map((branch) => ({ ...branch }))) })
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load website settings.') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  function patchStaff(id: string, patch: Partial<ManagementStaffMember>) {
    setData((current) => ({ ...current, staff: current.staff.map((person) => person.id === id ? { ...person, ...patch } : person) }))
  }
  function patchLocation(id: string, patch: Partial<Branch>) {
    setData((current) => ({ ...current, locations: current.locations.map((branch) => branch.id === id ? { ...branch, ...patch } : branch) }))
  }
  function patchBilingualLocation(id: string, field: 'name' | 'district' | 'division', lang: 'en' | 'bn', value: string) {
    setData((current) => ({ ...current, locations: current.locations.map((branch) => branch.id === id ? { ...branch, [field]: { ...branch[field], [lang]: value } } : branch) }))
  }

  async function save() {
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/website-essentials', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (response.status === 401) { window.location.assign('/admin/login'); return }
      if (!response.ok) throw new Error(payload.error || 'Could not save website essentials.')
      setData(normalizeWebsiteEssentials(payload.data ?? data))
      setNotice('Website essentials saved. Published social links, staff and location data now use the CMS record.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save website essentials.') }
    finally { setSaving(false) }
  }

  if (loading) return <PageLoading rows={5} />
  if (error && !data) return <AdminErrorState message={error} onRetry={() => window.location.reload()} />

  return <div className="essentials-page">
    <SectionToolbar title="Website Essentials" description="Manage official social accounts, public PDF downloads, management staff and working locations in one place." actions={<Button onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? 'Saving…' : 'Save changes'}</Button>} />
    {error && <div className="essentials-alert" role="alert">{error}</div>}
    {notice && <div className="essentials-success essentials-global-notice" role="status">{notice}</div>}

    <Card>
      <CardHeader><CardTitle className="essentials-card-title"><Share2 size={18}/> Official social links</CardTitle><CardDescription>Only enter official organization-owned accounts. Valid HTTPS URLs are required.</CardDescription></CardHeader>
      <CardContent><div className="essentials-grid essentials-grid-2">
        {(['facebook', 'instagram', 'youtube', 'linkedin'] as const).map((network) => <Field key={network} label={`${network[0].toUpperCase()}${network.slice(1)} URL`} value={data.socials[network]} placeholder={`https://${network}.com/…`} onChange={(value) => setData((current) => ({ ...current, socials: { ...current.socials, [network]: value } }))} />)}
      </div></CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="essentials-card-title"><FileText size={18}/> Public PDF downloads</CardTitle><CardDescription>Uploaded PDFs become public only when marked as public and saved to this configuration. Replace a file by uploading a new version.</CardDescription></CardHeader>
      <CardContent><div className="essentials-grid essentials-grid-2">
        <div className="essentials-document"><h3>Staff list</h3>
          <Field label="English title" value={data.documents.staffListPdf.titleEn} onChange={(value) => setData((cur) => ({ ...cur, documents: { ...cur.documents, staffListPdf: { ...cur.documents.staffListPdf, titleEn: value } } }))}/>
          <Field label="Bangla title" value={data.documents.staffListPdf.titleBn} onChange={(value) => setData((cur) => ({ ...cur, documents: { ...cur.documents, staffListPdf: { ...cur.documents.staffListPdf, titleBn: value } } }))}/>
          <PublicPdfField title="Staff list" value={data.documents.staffListPdf.url} onChange={(url) => setData((cur) => ({ ...cur, documents: { ...cur.documents, staffListPdf: { ...cur.documents.staffListPdf, url } } }))}/>
        </div>
        <div className="essentials-document"><h3>Working locations & branch offices</h3>
          <Field label="English title" value={data.documents.locationsPdf.titleEn} onChange={(value) => setData((cur) => ({ ...cur, documents: { ...cur.documents, locationsPdf: { ...cur.documents.locationsPdf, titleEn: value } } }))}/>
          <Field label="Bangla title" value={data.documents.locationsPdf.titleBn} onChange={(value) => setData((cur) => ({ ...cur, documents: { ...cur.documents, locationsPdf: { ...cur.documents.locationsPdf, titleBn: value } } }))}/>
          <PublicPdfField title="Working locations" value={data.documents.locationsPdf.url} onChange={(url) => setData((cur) => ({ ...cur, documents: { ...cur.documents, locationsPdf: { ...cur.documents.locationsPdf, url } } }))}/>
        </div>
      </div></CardContent>
    </Card>

    <Card>
      <CardHeader><div className="essentials-heading"><div><CardTitle className="essentials-card-title"><Users size={18}/> Management staff directory</CardTitle><CardDescription>Add approved staff details, publish/unpublish a profile and change display order.</CardDescription></div><Button variant="outline" onClick={() => setData((current) => ({ ...current, staff: [...current.staff, { id: randomId('staff'), nameEn: '', nameBn: '', designationEn: '', designationBn: '', bioEn: '', bioBn: '', photoUrl: '', published: false, sortOrder: current.staff.length }] }))}><CirclePlus size={14}/> Add staff</Button></div></CardHeader>
      <CardContent><div className="essentials-record-list">
        {data.staff.map((person, index) => <div className="essentials-record" key={person.id}>
          <div className="essentials-record-top"><strong>Staff member {index + 1}</strong><div className="essentials-record-actions"><Badge variant={person.published ? 'default' : 'outline'}>{person.published ? 'Published' : 'Draft'}</Badge><Button variant="outline" size="sm" onClick={() => patchStaff(person.id, { published: !person.published })}>{person.published ? 'Unpublish' : 'Publish'}</Button><Button variant="outline" size="sm" onClick={() => setData((current) => ({ ...current, staff: current.staff.filter((item) => item.id !== person.id) }))}><Trash2 size={14}/> Remove</Button></div></div>
          <div className="essentials-grid essentials-grid-2">
            <Field label="Name (English)" value={person.nameEn} onChange={(value) => patchStaff(person.id, { nameEn: value })}/>
            <Field label="Name (Bangla)" value={person.nameBn} onChange={(value) => patchStaff(person.id, { nameBn: value })}/>
            <Field label="Designation (English)" value={person.designationEn} onChange={(value) => patchStaff(person.id, { designationEn: value })}/>
            <Field label="Designation (Bangla)" value={person.designationBn} onChange={(value) => patchStaff(person.id, { designationBn: value })}/>
            <Field label="Portrait URL (optional)" value={person.photoUrl || ''} placeholder="/api/media/123 or HTTPS image URL" onChange={(value) => patchStaff(person.id, { photoUrl: value })}/>
            <Field label="Display order" type="number" value={person.sortOrder} onChange={(value) => patchStaff(person.id, { sortOrder: Math.max(0, Number(value) || 0) })}/>
            <label className="essentials-field"><span>Biography (English, optional)</span><textarea rows={3} value={person.bioEn || ''} onChange={(event) => patchStaff(person.id, { bioEn: event.target.value })}/></label>
            <label className="essentials-field"><span>Biography (Bangla, optional)</span><textarea rows={3} value={person.bioBn || ''} onChange={(event) => patchStaff(person.id, { bioBn: event.target.value })}/></label>
          </div>
        </div>)}
        {!data.staff.length && <div className="essentials-empty">No staff records yet. Use “Add staff” and publish profiles only after the information is approved.</div>}
      </div></CardContent>
    </Card>

    <Card>
      <CardHeader><div className="essentials-heading"><div><CardTitle className="essentials-card-title"><MapPin size={18}/> Working locations and branch map</CardTitle><CardDescription>Update map coordinates, addresses and branch-manager contact details. These records power the public location map and selected-branch contact panel.</CardDescription></div><Button variant="outline" onClick={() => setData((current) => ({ ...current, locations: [...current.locations, { id: randomId('branch'), kind: 'branch', name: { en: '', bn: '' }, district: { en: '', bn: '' }, division: { en: '', bn: '' }, lat: 23.8103, lng: 90.4125 }] }))}><CirclePlus size={14}/> Add location</Button></div></CardHeader>
      <CardContent><div className="essentials-record-list">
        {data.locations.map((branch, index) => <div className="essentials-record essentials-location" key={branch.id}>
          <div className="essentials-record-top"><strong>{branch.kind === 'head' ? 'Head office' : `Location ${index + 1}`}</strong><div className="essentials-record-actions"><Badge variant={branch.kind === 'head' ? 'default' : 'outline'}>{branch.kind === 'head' ? 'Head office' : 'Branch'}</Badge><Button variant="outline" size="sm" onClick={() => setData((current) => ({ ...current, locations: current.locations.filter((item) => item.id !== branch.id) }))}><Trash2 size={14}/> Remove</Button></div></div>
          <div className="essentials-grid essentials-grid-2">
            <Field label="Branch name (English)" value={branch.name.en} onChange={(value) => patchBilingualLocation(branch.id, 'name', 'en', value)}/><Field label="Branch name (Bangla)" value={branch.name.bn} onChange={(value) => patchBilingualLocation(branch.id, 'name', 'bn', value)}/>
            <Field label="District (English)" value={branch.district.en} onChange={(value) => patchBilingualLocation(branch.id, 'district', 'en', value)}/><Field label="District (Bangla)" value={branch.district.bn} onChange={(value) => patchBilingualLocation(branch.id, 'district', 'bn', value)}/>
            <Field label="Division (English)" value={branch.division.en} onChange={(value) => patchBilingualLocation(branch.id, 'division', 'en', value)}/><Field label="Division (Bangla)" value={branch.division.bn} onChange={(value) => patchBilingualLocation(branch.id, 'division', 'bn', value)}/>
            <Field label="Latitude" type="number" value={branch.lat} onChange={(value) => patchLocation(branch.id, { lat: Number(value) })}/><Field label="Longitude" type="number" value={branch.lng} onChange={(value) => patchLocation(branch.id, { lng: Number(value) })}/>
            <Field label="Address (English, optional)" value={branch.address?.en || ''} onChange={(value) => patchLocation(branch.id, { address: { en: value, bn: branch.address?.bn || '' } })}/><Field label="Address (Bangla, optional)" value={branch.address?.bn || ''} onChange={(value) => patchLocation(branch.id, { address: { en: branch.address?.en || '', bn: value } })}/>
            <Field label="Branch manager name (English)" value={branch.manager?.name?.en || ''} onChange={(value) => patchLocation(branch.id, { manager: { ...(branch.manager || {}), name: { en: value, bn: branch.manager?.name?.bn || '' } } })}/>
            <Field label="Branch manager name (Bangla)" value={branch.manager?.name?.bn || ''} onChange={(value) => patchLocation(branch.id, { manager: { ...(branch.manager || {}), name: { en: branch.manager?.name?.en || '', bn: value } } })}/>
            <Field label="Manager designation (English)" value={branch.manager?.title?.en || ''} onChange={(value) => patchLocation(branch.id, { manager: { ...(branch.manager || {}), title: { en: value, bn: branch.manager?.title?.bn || '' } } })}/>
            <Field label="Manager designation (Bangla)" value={branch.manager?.title?.bn || ''} onChange={(value) => patchLocation(branch.id, { manager: { ...(branch.manager || {}), title: { en: branch.manager?.title?.en || '', bn: value } } })}/>
            <Field label="Branch manager phone" value={branch.manager?.phone || ''} placeholder="+880…" onChange={(value) => patchLocation(branch.id, { manager: { ...(branch.manager || {}), phone: value } })}/>
            <Field label="Branch manager email" value={branch.manager?.email || ''} placeholder="manager@example.org" onChange={(value) => patchLocation(branch.id, { manager: { ...(branch.manager || {}), email: value } })}/>
            <label className="essentials-field"><span>Location type</span><select value={branch.kind} onChange={(event) => patchLocation(branch.id, { kind: event.target.value as Branch['kind'] })}><option value="branch">Branch</option><option value="head">Head office</option></select></label>
          </div>
        </div>)}
        {!data.locations.length && <div className="essentials-empty">No saved locations. The public map will use the bundled fallback until locations are added.</div>}
      </div></CardContent>
    </Card>
    <div className="essentials-bottom-save"><span>Changes remain drafts in this form until saved.</span><Button onClick={() => void save()} disabled={saving}><Save size={15}/>{saving ? 'Saving…' : 'Save all website essentials'}</Button></div>
  </div>
}
