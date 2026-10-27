'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Pencil, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { createContent, deleteContent, isSlugTaken, setContentVisibility, updateContent } from '@/lib/api/siteContent'
import { MediaField } from './MediaField'
import { COMPONENTS, SLUG_PATTERN, type ContentComponent, type ContentRecord, type ContentValues, type FieldDef } from '@/lib/cms/components'

type SlugState = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'
const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
const blank = (component: ContentComponent): ContentValues => ({ date: new Date().toISOString().slice(0, 10), ...(component === 'team' ? {} : {}) })

function Input({ field, name, value, disabled, onChange, label, error }: { field: FieldDef; name: string; value: string; disabled: boolean; onChange: (v: string) => void; label: string; error?: string }) {
  const common = { id: `f-${name}`, disabled, value, 'aria-label': label, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': error ? `f-${name}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value) }
  if (field.type === 'textarea') return <textarea className="ui-textarea" rows={field.key === 'body' ? 7 : 3} {...common} />
  if (field.type === 'select') return <select className="ui-select" {...common}><option value="">— Select —</option>{field.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  const type = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'
  return <input className="ui-input" type={type} placeholder={field.type === 'image' || field.type === 'url' ? '/path or https://…' : undefined} {...common} />
}

/** Slug-wise form container: header (title per slug + actions) and labelled attribute inputs. */
export function ContentEditor({ component, record, onSaved, onDeleted, onClose }: {
  component: ContentComponent
  record: ContentRecord | null
  onSaved: (record: ContentRecord) => void
  onDeleted: (id: number) => void
  onClose?: () => void
}) {
  const def = COMPONENTS[component]
  const isNew = !record
  const [editing, setEditing] = useState(true)
  const [values, setValues] = useState<ContentValues>(record?.values ?? blank(component))
  const [slug, setSlug] = useState(record?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [slugState, setSlugState] = useState<SlugState>('idle')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveFieldError, setSaveFieldError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const checkId = useRef(0)

  useEffect(() => { setValues(record?.values ?? blank(component)); setSlug(record?.slug ?? ''); setSlugTouched(!!record); setEditing(true); setSlugState('idle'); setSaveError(''); setSaveFieldError(''); setValidationErrors({}) }, [record, component])

  // Live slug validation (format + uniqueness) while editing.
  useEffect(() => {
    if (!editing) return
    if (!slug) return setSlugState('idle')
    if (!SLUG_PATTERN.test(slug)) return setSlugState('invalid')
    if (record && slug === record.slug) return setSlugState('ok')
    const id = ++checkId.current
    setSlugState('checking')
    const t = setTimeout(() => { isSlugTaken(component, slug, record?.id).then((taken) => { if (id === checkId.current) setSlugState(taken ? 'taken' : 'ok') }).catch(() => { if (id === checkId.current) setSlugState('idle') }) }, 350)
    return () => clearTimeout(t)
  }, [slug, editing, component, record])

  const set = (key: string, v: string) => { setSaveError(''); setSaveFieldError(''); setValidationErrors((current) => { const next = { ...current }; delete next[key]; return next }); setValues((cur) => {
    const next = { ...cur, [key]: v }
    if (isNew && !slugTouched && key === 'title_en') setSlug(slugify(v))
    return next
  }) }

  const title = values.title_en || (isNew ? `New ${def.label.toLowerCase()}` : slug)
  const status = record?.status ?? 'draft'

  function validateFields(): Record<string, string> {
    const next: Record<string, string> = {}
    for (const field of def.fields) {
      const fieldKeys = field.bilingual ? [`${field.key}_en`, `${field.key}_bn`] : [field.key]
      for (const key of fieldKeys) {
        const value = String(values[key] ?? '').trim()
        const requiredForThisLocale = Boolean(field.required && (!field.bilingual || key.endsWith('_en')))
        if (requiredForThisLocale && !value) { next[key] = `${field.label} is required.`; continue }
        if (!value) continue
        if (field.max && value.length > field.max) { next[key] = `${field.label} must be ${field.max} characters or fewer.`; continue }
        if (field.type === 'email' && (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))) { next[key] = 'Enter a valid email address.'; continue }
        if (field.type === 'url' && !value.startsWith('/') && (() => { try { const parsed = new URL(value); return parsed.protocol !== 'https:' && parsed.protocol !== 'http:' } catch { return true } })()) { next[key] = 'Enter a valid https:// URL or a site-relative path beginning with /.'}
        if (field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0)) { next[key] = 'Enter a non-negative number.'; continue }
        if (field.type === 'select' && field.options && !field.options.includes(value)) { next[key] = 'Choose one of the listed options.' }
      }
    }
    return next
  }

  async function save() {
    if (!SLUG_PATTERN.test(slug)) { setSaveError('Enter a valid slug using lowercase letters, numbers and hyphens.'); return }
    const nextValidationErrors = validateFields()
    setValidationErrors(nextValidationErrors)
    if (Object.keys(nextValidationErrors).length) { setSaveFieldError(''); setSaveError('Please correct the highlighted fields before saving.'); return }
    setBusy(true)
    setSaveError(''); setSaveFieldError(''); setValidationErrors({})
    try {
      // Slug validation is always re-run immediately before saving.
      if ((!record || slug !== record.slug) && (await isSlugTaken(component, slug, record?.id))) { setSlugState('taken'); throw new Error(`The slug “${slug}” is already in use.`) }
      const saved = record ? await updateContent(record.id, slug, values, record.updatedAt) : await createContent(component, slug, values)
      toast.success(record ? 'Changes saved.' : `${def.label} created.`)
      setEditing(false); onSaved(saved)
    } catch (e) {
      const err = e as Error & { field?: string; status?: number }
      const message = err.message || 'Unable to save.'
      setSaveError(message)
      setSaveFieldError(err.field || '')
      toast.error(message, { description: err.status === 409 ? 'Your draft is still here. Copy any important edits, reload the latest record if another editor changed it, then try again.' : undefined })
    } finally { setBusy(false) }
  }

  async function toggleVisibility() {
    if (!record) return
    setBusy(true)
    try { const next = await setContentVisibility(record.id, record.status === 'published' ? 'hidden' : 'published'); toast.success(next.status === 'published' ? 'Now visible on the site.' : 'Hidden from the site.'); onSaved(next) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to change visibility.') } finally { setBusy(false) }
  }

  async function remove() {
    if (!record) return
    setBusy(true)
    try { await deleteContent(record.id); toast.success('Deleted permanently.'); setConfirmDelete(false); onDeleted(record.id) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to delete.') } finally { setBusy(false) }
  }

  const slugHint = useMemo(() => ({ idle: '', checking: 'Checking availability…', ok: '✓ Slug is available', taken: '✗ Slug is already in use', invalid: '✗ Use lowercase letters, numbers and single hyphens' }[slugState]), [slugState])

  return (
    <Card className="cms-form-card">
      <CardHeader>
        <div className="cms-form-header">
          <div><h2>{title}</h2><small><code>{slug || 'no-slug-yet'}</code> · {def.label}{editing ? ' · Save to apply changes to the site' : ' · Read-only view'}</small></div>
          <div className="cms-form-actions">
            {record && <Badge variant={status === 'published' ? 'default' : 'outline'}>{status}</Badge>}
            {record && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}><Pencil size={14} /> Edit</Button>}
            {record && <Button variant="outline" size="sm" onClick={() => void toggleVisibility()} disabled={busy}>{record.status === 'published' ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Publish</>}</Button>}
            {record && <Button variant="outline" size="sm" className="cms-danger-outline" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={14} /> Delete</Button>}
            {onClose && <Button variant="outline" size="sm" onClick={onClose} aria-label="Close"><X size={14} /></Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="cms-form-grid">
          <label className="cms-field cms-span-2" htmlFor="f-slug"><span>Slug <b>*</b></span>
            <input id="f-slug" className="ui-input" value={slug} disabled={!editing} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); setSaveError(''); setSaveFieldError('') }} placeholder="unique-url-name" aria-invalid={slugState === 'invalid' || slugState === 'taken'} aria-describedby={editing && slugHint ? 'f-slug-help' : undefined} />
            {editing && slugHint && <small id="f-slug-help" className={`cms-slug cms-slug-${slugState}`} role="status">{slugHint}</small>}
          </label>
          {def.fields.map((field) => field.type === 'image'
            ? <div key={field.key} className="cms-span-2"><MediaField label={field.label} value={values[field.key] ?? ''} onChange={(v) => set(field.key, v)} disabled={!editing} alt={values.title_en ?? ''} helper={field.help} />{saveFieldError === field.key && <small className="cms-field-error">Please check this image field.</small>}</div>
            : field.bilingual
              ? (['en', 'bn'] as const).map((lng) => { const name = `${field.key}_${lng}`; const label = `${field.label} (${lng === 'en' ? 'English' : 'বাংলা'})`; return (
                  <label key={name} className={`cms-field ${field.type === 'textarea' ? 'cms-span-2' : ''}`} htmlFor={`f-${name}`}><span>{label}{field.required && lng === 'en' && <b> *</b>}</span><Input field={field} name={name} label={label} value={values[name] ?? ''} disabled={!editing} onChange={(v) => set(name, v)} error={validationErrors[name] || (saveFieldError === name ? 'Please check this value.' : undefined)} />{field.help && editing && <small className="admin-small-note">{field.help}</small>}{(validationErrors[name] || saveFieldError === name) && <small id={`f-${name}-error`} className="cms-field-error" role="alert">{validationErrors[name] || 'Please check this value.'}</small>}</label>) })
              : <label key={field.key} className={`cms-field ${field.type === 'textarea' ? 'cms-span-2' : ''}`} htmlFor={`f-${field.key}`}><span>{field.label}{field.required && <b> *</b>}</span><Input field={field} name={field.key} label={field.label} value={values[field.key] ?? ''} disabled={!editing} onChange={(v) => set(field.key, v)} error={validationErrors[field.key] || (saveFieldError === field.key ? 'Please check this value.' : undefined)} />{field.help && editing && <small className="admin-small-note">{field.help}</small>}{(validationErrors[field.key] || saveFieldError === field.key) && <small id={`f-${field.key}-error`} className="cms-field-error" role="alert">{validationErrors[field.key] || 'Please check this value.'}</small>}</label>)}
        </div>
        {saveError && <div className="cms-save-error" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span><small>Your edits are still in this form. Correct the highlighted field or retry after resolving the issue.</small></div>}
        {editing && <div className="cms-form-footer">
          <Button variant="outline" onClick={() => (record ? (setValues(record.values), setSlug(record.slug), setEditing(false)) : onClose?.())} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || slugState === 'taken' || slugState === 'invalid'}><Save size={15} /> {busy ? 'Saving…' : record ? 'Save changes' : `Create ${def.label.toLowerCase()}`}</Button>
        </div>}
      </CardContent>
      {confirmDelete && <div className="cms-modal" role="alertdialog" aria-modal="true"><div className="cms-modal-card">
        <h2>Delete “{title}”?</h2><p>The data will be lost forever and cannot be recovered. {component === 'job' ? 'All applications received for this job will be deleted too.' : 'Consider hiding it instead if you may need it again.'}</p>
        <div className="cms-modal-actions"><Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep it</Button><Button className="cms-danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</Button></div>
      </div></div>}
    </Card>
  )
}
