'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, Pencil, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { createContent, deleteContent, isSlugTaken, setContentVisibility, updateContent } from '@/lib/api/siteContent'
import { getPageBuilderIndex, type PageIndexItem } from '@/lib/api/pageBuilder'
import { MediaField } from './MediaField'
import { COMPONENTS, DEFAULT_CONTENT_PARENT, FIXED_CONTENT_PARENT, getDefaultContentParent, SLUG_PATTERN, type ContentComponent, type ContentRecord, type ContentValues, type FieldDef } from '@/lib/cms/components'
import { buildContentRoute } from '@/lib/cms/routes'
import { useRegisterAdminActions } from './AdminActionContext'

type SlugState = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'
const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
const blank = (component: ContentComponent, routeParent?: string): ContentValues => ({ date: new Date().toISOString().slice(0, 10), routeParent: FIXED_CONTENT_PARENT[component] || routeParent || getDefaultContentParent(component) })

function Input({ field, name, value, disabled, onChange, label, error }: { field: FieldDef; name: string; value: string; disabled: boolean; onChange: (v: string) => void; label: string; error?: string }) {
  const common = { id: `f-${name}`, disabled, value, 'aria-label': label, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': error ? `f-${name}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value) }
  if (field.type === 'textarea') return <textarea className="ui-textarea" rows={field.key === 'body' ? 7 : 3} {...common} />
  if (field.type === 'select') return <select className="ui-select" {...common}><option value="">— Select —</option>{field.options!.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  const type = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'
  return <input className="ui-input" type={type} min={field.key === 'displayOrder' ? 0 : undefined} step={field.key === 'displayOrder' ? 1 : undefined} placeholder={field.type === 'image' || field.type === 'url' ? '/path or https://…' : undefined} {...common} />
}

/** Slug-wise form container: header (title per slug + actions) and labelled attribute inputs. */
export function ContentEditor({ component, record, onSaved, onDeleted, onClose, defaultRouteParent, presentation = 'inline' }: {
  component: ContentComponent
  record: ContentRecord | null
  onSaved: (record: ContentRecord) => void
  onDeleted: (id: number) => void
  onClose?: () => void
  defaultRouteParent?: string
  presentation?: 'inline' | 'modal'
}) {
  const def = COMPONENTS[component]
  const isNew = !record
  const actionId = useId()
  const initialValues = record ? { ...record.values, routeParent: FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component] } : blank(component, defaultRouteParent)
  const initialSlug = record?.slug ?? ''
  const initialStatus = record?.status ?? 'published'
  const [editing, setEditing] = useState(true)
  const [values, setValues] = useState<ContentValues>(initialValues)
  const [slug, setSlug] = useState(initialSlug)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [newStatus, setNewStatus] = useState<'published' | 'draft' | 'hidden'>(initialStatus)
  const baselineRef = useRef(JSON.stringify({ values: initialValues, slug: initialSlug, newStatus: initialStatus }))
  const [availablePages, setAvailablePages] = useState<PageIndexItem[]>([])
  const [slugState, setSlugState] = useState<SlugState>('idle')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveFieldError, setSaveFieldError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isMounted, setIsMounted] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const checkId = useRef(0)

  useEffect(() => { setIsMounted(true) }, [])

  useEffect(() => {
    const nextValues = record ? { ...record.values, routeParent: FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component] } : blank(component, defaultRouteParent)
    const nextSlug = record?.slug ?? ''
    const nextStatus = record?.status ?? 'published'
    setValues(nextValues); setSlug(nextSlug); setSlugTouched(!!record); setNewStatus(nextStatus); setEditing(true)
    baselineRef.current = JSON.stringify({ values: nextValues, slug: nextSlug, newStatus: nextStatus })
    setSlugState('idle'); setSaveError(''); setSaveFieldError(''); setValidationErrors({})
  }, [record, component, defaultRouteParent])

  useEffect(() => { let active = true; getPageBuilderIndex().then((result) => { if (active) setAvailablePages(result.availablePages.filter((page) => page.status !== 'archived')) }).catch(() => { if (active) setAvailablePages([]) }); return () => { active = false } }, [])

  // Live slug validation (format + uniqueness) while editing.
  useEffect(() => {
    if (!editing) return
    if (!slug) return setSlugState('idle')
    if (!SLUG_PATTERN.test(slug)) return setSlugState('invalid')
    const routeParentForCheck = FIXED_CONTENT_PARENT[component] || values.routeParent || DEFAULT_CONTENT_PARENT[component]
    if (record && slug === record.slug && routeParentForCheck === (FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component])) return setSlugState('ok')
    const id = ++checkId.current
    setSlugState('checking')
    const t = setTimeout(() => { isSlugTaken(component, slug, record?.id, routeParentForCheck).then((taken) => { if (id === checkId.current) setSlugState(taken ? 'taken' : 'ok') }).catch(() => { if (id === checkId.current) setSlugState('idle') }) }, 350)
    return () => clearTimeout(t)
  }, [slug, editing, component, record, values.routeParent])

  const set = (key: string, v: string) => { setSaveError(''); setSaveFieldError(''); setValidationErrors((current) => { const next = { ...current }; delete next[key]; return next }); setValues((cur) => {
    const next = { ...cur, [key]: v }
    if (isNew && !slugTouched && key === 'title_en') setSlug(slugify(v))
    return next
  }) }

  const title = values.title_en || (isNew ? `New ${def.label.toLowerCase()}` : slug)
  const status = record?.status ?? newStatus
  const routeParent = FIXED_CONTENT_PARENT[component] || values.routeParent || DEFAULT_CONTENT_PARENT[component]
  const previewPath = buildContentRoute(routeParent, slug || 'content-slug')

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
        if (field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0 || (field.key === 'displayOrder' && (!Number.isInteger(Number(value)) || Number(value) > 100000)))) { next[key] = field.key === 'displayOrder' ? 'Enter a whole number from 0 to 100000.' : 'Enter a non-negative number.'; continue }
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
      if ((!record || slug !== record.slug || routeParent !== (FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component])) && (await isSlugTaken(component, slug, record?.id, routeParent))) { setSlugState('taken'); throw new Error(`The route “${previewPath}” is already in use. Choose a different slug or destination page.`) }
      const saved = record ? await updateContent(record.id, slug, values, record.updatedAt) : await createContent(component, slug, values, newStatus)
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

  function reloadDraft() {
    const nextValues = record ? { ...record.values, routeParent: FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component] } : blank(component, defaultRouteParent)
    const nextSlug = record?.slug ?? ''
    const nextStatus = record?.status ?? 'published'
    setValues(nextValues); setSlug(nextSlug); setSlugTouched(!!record); setNewStatus(nextStatus); setEditing(true)
    baselineRef.current = JSON.stringify({ values: nextValues, slug: nextSlug, newStatus: nextStatus })
    setSlugState('idle'); setSaveError(''); setSaveFieldError(''); setValidationErrors({})
  }

  const dirty = editing && baselineRef.current !== JSON.stringify({ values, slug, newStatus })
  dirtyRef.current = dirty
  onCloseRef.current = onClose

  useEffect(() => {
    if (presentation !== 'modal' || !isMounted) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'

    const getFocusable = () => Array.from(modalRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.offsetParent !== null)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!onCloseRef.current) return
        if (dirtyRef.current && !window.confirm('Discard the unsaved changes in this editor?')) return
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', handleKeyDown)
    const firstFocusable = getFocusable()[0]
    firstFocusable?.focus()
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [presentation, isMounted])

  useRegisterAdminActions(`content-editor-${actionId}`, { save: () => dirty ? save() : undefined, reload: reloadDraft, dirty, saving: busy, label: `${def.label} editor` })

  const slugHint = useMemo(() => ({ idle: '', checking: 'Checking availability…', ok: '✓ Slug is available', taken: '✗ Slug is already in use', invalid: '✗ Use lowercase letters, numbers and single hyphens' }[slugState]), [slugState])

  const editorCard = (
    <Card className="cms-form-card">
      <CardHeader>
        <div className="cms-form-header">
          <div><h2>{title}</h2><small><code>{slug || 'no-slug-yet'}</code> · {def.label}{editing ? ' · Save to apply changes to the site' : ' · Read-only view'}</small></div>
          <div className="cms-form-actions">
            {record && <Badge variant={status === 'published' ? 'default' : 'outline'}>{status}</Badge>}
            {record && !editing && <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={busy}><Pencil size={14} /> Edit</Button>}
            {record && <Button variant="outline" size="sm" onClick={() => void toggleVisibility()} disabled={busy}>{record.status === 'published' ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Publish</>}</Button>}
            {record && <Button variant="outline" size="sm" className="cms-danger-outline" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={14} /> Delete</Button>}
            {onClose && <Button variant="outline" size="sm" onClick={() => { if (!dirty || window.confirm('Discard the unsaved changes in this editor?')) onClose() }} aria-label="Close"><X size={14} /></Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="cms-form-grid">
          <label className="cms-field cms-span-2" htmlFor="f-slug"><span>Slug <b>*</b></span>
            <input id="f-slug" className="ui-input" value={slug} disabled={!editing} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); setSaveError(''); setSaveFieldError('') }} placeholder="unique-url-name" aria-invalid={slugState === 'invalid' || slugState === 'taken'} aria-describedby={editing && slugHint ? 'f-slug-help' : undefined} />
            {editing && slugHint && <small id="f-slug-help" className={`cms-slug cms-slug-${slugState}`} role="status">{slugHint}</small>}
          </label>
          <label className="cms-field cms-span-2" htmlFor="f-route-parent"><span>Publish under page</span>
            {FIXED_CONTENT_PARENT[component] ? <input id="f-route-parent" className="ui-input" value={routeParent} readOnly disabled /> : <select id="f-route-parent" className="ui-select" value={routeParent} disabled={!editing} onChange={(e) => set('routeParent', e.target.value)}>
              {!availablePages.some((page) => page.slug === routeParent) && <option value={routeParent}>{routeParent} (current destination)</option>}
              {availablePages.map((page) => <option key={page.slug} value={page.slug}>{page.slug === '/' ? 'Home (landing page)' : `${page.title.en} — ${page.slug}`}{page.status !== 'published' ? ` · ${page.status}` : ''}</option>)}
            </select>}
            <small className="admin-small-note">{FIXED_CONTENT_PARENT[component] ? (component === 'news' ? 'News articles always publish under the News collection.' : 'Success stories always publish under the Success Stories collection. This is intentionally fixed so the news rail and success-story listing remain separate.') : 'The selected page gets a one-type content section if it does not already have one. Menu items use /menu-slug/content-slug; submenu items use /menu-slug/submenu-slug/content-slug.'}</small>
            <small className="cms-route-preview">Public route preview: <code>{previewPath}</code>{status === 'published' && <a href={previewPath} target="_blank" rel="noreferrer">Open public page ↗</a>}</small>
          </label>
          {isNew && <label className="cms-field" htmlFor="f-new-status"><span>Visibility</span>
            <select id="f-new-status" className="ui-select" value={newStatus} disabled={!editing} onChange={(e) => setNewStatus(e.target.value as 'published' | 'draft' | 'hidden')}>
              <option value="published">Visible — publish immediately</option><option value="draft">Draft — not public</option><option value="hidden">Hidden — saved but not public</option>
            </select>
          </label>}
          {def.fields.map((field) => field.type === 'image'
            ? <div key={field.key} className="cms-span-2"><MediaField label={`${field.label}${field.required ? ' *' : ''}`} value={values[field.key] ?? ''} onChange={(v) => set(field.key, v)} disabled={!editing} alt={values.title_en ?? ''} helper={field.help} />{saveFieldError === field.key && <small className="cms-field-error">Please check this image field.</small>}</div>
            : field.bilingual
              ? (['en', 'bn'] as const).map((lng) => { const name = `${field.key}_${lng}`; const label = `${field.label} (${lng === 'en' ? 'English' : 'বাংলা'})`; return (
                  <label key={name} className={`cms-field ${field.type === 'textarea' ? 'cms-span-2' : ''}`} htmlFor={`f-${name}`}><span>{label}{field.required && lng === 'en' && <b> *</b>}</span><Input field={field} name={name} label={label} value={values[name] ?? ''} disabled={!editing} onChange={(v) => set(name, v)} error={validationErrors[name] || (saveFieldError === name ? 'Please check this value.' : undefined)} />{field.help && editing && <small className="admin-small-note">{field.help}</small>}{(validationErrors[name] || saveFieldError === name) && <small id={`f-${name}-error`} className="cms-field-error" role="alert">{validationErrors[name] || 'Please check this value.'}</small>}</label>) })
              : <label key={field.key} className={`cms-field ${field.type === 'textarea' ? 'cms-span-2' : ''}`} htmlFor={`f-${field.key}`}><span>{field.label}{field.required && <b> *</b>}</span><Input field={field} name={field.key} label={field.label} value={values[field.key] ?? ''} disabled={!editing} onChange={(v) => set(field.key, v)} error={validationErrors[field.key] || (saveFieldError === field.key ? 'Please check this value.' : undefined)} />{field.help && editing && <small className="admin-small-note">{field.help}</small>}{(validationErrors[field.key] || saveFieldError === field.key) && <small id={`f-${field.key}-error`} className="cms-field-error" role="alert">{validationErrors[field.key] || 'Please check this value.'}</small>}</label>)}
        </div>
        {saveError && <div className="cms-save-error" role="alert"><strong>Changes were not saved.</strong><span>{saveError}</span><small>Your edits are still in this form. Correct the highlighted field or retry after resolving the issue.</small></div>}
        {editing && <div className="cms-form-footer">
          <Button variant="outline" onClick={() => { if (dirty && !window.confirm('Discard the unsaved changes in this editor?')) return; record ? (reloadDraft(), setEditing(false)) : onClose?.() }} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || slugState === 'taken' || slugState === 'invalid'}><Save size={15} /> {busy ? 'Saving…' : record ? 'Save changes' : `Create ${def.label.toLowerCase()}`}</Button>
        </div>}
      </CardContent>
      {confirmDelete && <div className="cms-modal" role="alertdialog" aria-modal="true"><div className="cms-modal-card">
        <h2>Delete “{title}”?</h2><p>The data will be lost forever and cannot be recovered. {component === 'job' ? 'All applications received for this job will be deleted too.' : 'Consider hiding it instead if you may need it again.'}</p>
        <div className="cms-modal-actions"><Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep it</Button><Button className="cms-danger" onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</Button></div>
      </div></div>}
    </Card>
  )

  if (presentation === 'modal') {
    if (!isMounted) return null
    return createPortal(
      <div ref={modalRef} className="cms-modal cms-content-editor-modal" role="dialog" aria-modal="true" aria-label={`${record ? 'Edit' : 'Create'} ${def.label}`}>
        <div className="cms-modal-card cms-content-editor-modal-card">{editorCard}</div>
      </div>,
      document.querySelector('.admin-theme-root') ?? document.body
    )
  }

  return editorCard
}
