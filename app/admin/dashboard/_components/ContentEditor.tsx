'use client'
import { Textarea } from '@/components/ui/textarea'
import { Input as InputControl } from '@/components/ui/input'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, PencilIcon, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createContent, deleteContent, isSlugTaken, setContentVisibility, updateContent } from '@/lib/api/siteContent'
import { getPageBuilderIndex, type PageIndexItem } from '@/lib/api/pageBuilder'
import { MediaField } from './MediaField'
import { COMPONENTS, DEFAULT_CONTENT_PARENT, FIXED_CONTENT_PARENT, getDefaultContentParent, SLUG_PATTERN, type ContentComponent, type ContentRecord, type ContentValues, type FieldDef } from '@/lib/cms/components'
import { buildContentRoute } from '@/lib/cms/routes'
import { useRegisterAdminActions } from './AdminActionContext'
import CmsTypographyEditor from '@/components/admin/CmsTypographyEditor'
import { normalizeCmsTypography } from '@/lib/cms/typography'
import { AdminDataContainer, AdminToolbarAction } from '@/components/admin/cms'
import { SectionToolbar } from './AdminCommon'
import Select from '@/components/ui/select'
type SlugState = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid'
const FORM_FIELD_CLASS = 'cms-field flex min-w-0 flex-col gap-1.5 text-sm [&>span]:font-semibold [&_b]:text-destructive'
const FORM_GRID_CLASS = 'cms-form-grid grid grid-cols-2 gap-3.5 max-[760px]:grid-cols-1'
const FULL_WIDTH_CLASS = 'cms-span-2 col-span-2 max-[760px]:col-auto'
const FIELD_ERROR_CLASS = 'mt-1 block text-sm text-destructive'
const SLUG_HINT_CLASS = 'cms-slug mt-1 block min-h-[1em] text-sm break-words'

const FORM_CARD_CLASS = [
  'cms-form-card',
  'p-4',
  '[&_.cms-field_input:disabled]:cursor-default [&_.cms-field_input:disabled]:text-foreground [&_.cms-field_input:disabled]:bg-muted [&_.cms-field_input:disabled]:border-border [&_.cms-field_input:disabled]:opacity-100',
  '[&_.cms-field_textarea:disabled]:cursor-default [&_.cms-field_textarea:disabled]:text-foreground [&_.cms-field_textarea:disabled]:bg-muted [&_.cms-field_textarea:disabled]:border-border [&_.cms-field_textarea:disabled]:opacity-100',
  '[&_.cms-field_select:disabled]:cursor-default [&_.cms-field_select:disabled]:text-foreground [&_.cms-field_select:disabled]:bg-muted [&_.cms-field_select:disabled]:border-border [&_.cms-field_select:disabled]:opacity-100',
  '[&_.cms-field>span]:leading-snug [&_.cms-field>span]:break-words',
].join(' ')

const DELETE_DIALOG_CARD_CLASS = [
  'cms-modal-card relative z-10 max-h-[90vh] w-full max-w-[560px] overflow-auto rounded-[var(--radius)]',
  'bg-[var(--surface,var(--card))] p-5 text-[var(--text-primary,var(--foreground))] shadow-[var(--shadow-lg,var(--shadow-md))]',
  '[&_h2]:mb-1.5 [&_h2]:mt-0',
].join(' ')

const CONTENT_MODAL_CLASS = 'cms-modal fixed inset-0 z-[var(--sf-z-modal)] isolate grid place-items-center overflow-y-auto overscroll-contain bg-[var(--overlay)] p-4 cms-content-editor-modal max-[720px]:items-start max-[720px]:p-2'

const CONTENT_MODAL_CARD_CLASS = [
  'cms-modal-card cms-content-editor-modal-card relative z-10 max-h-[90vh] w-[min(560px,100%)] max-w-[65rem] overflow-auto overscroll-contain',
  'rounded-[var(--radius)] border-0 bg-[var(--surface,var(--card))] p-5 text-[var(--text-primary,var(--foreground))] shadow-[var(--shadow-lg,var(--shadow-md))] backdrop-blur-lg',
  '[&_h2]:mb-1.5 [&_h2]:mt-0',
  '[&>.cms-form-card]:m-0 [&>.cms-form-card]:overflow-visible [&>.cms-form-card]:rounded-[var(--radius)] [&>.cms-form-card]:border [&>.cms-form-card]:border-border [&>.cms-form-card]:bg-card [&>.cms-form-card]:shadow-sm',
  '[&_[data-slot=card-header]]:sticky [&_[data-slot=card-header]]:top-0 [&_[data-slot=card-header]]:z-30 [&_[data-slot=card-header]]:rounded-[inherit] [&_[data-slot=card-header]]:bg-card',
  '[&_.cms-form-header]:items-center [&_.cms-form-footer]:sticky [&_.cms-form-footer]:bottom-0 [&_.cms-form-footer]:z-20 [&_.cms-form-footer]:bg-card [&_.cms-form-footer]:py-2',
  'max-[720px]:w-[min(100%,680px)] max-[720px]:max-h-[calc(100dvh-16px)] max-[720px]:[&_.cms-form-grid]:grid-cols-1 max-[720px]:[&_.cms-span-2]:col-span-full',
  'max-[420px]:[&_[data-slot=card-header]]:p-3 max-[420px]:[&_[data-slot=card-content]]:p-[10px_12px_12px] max-[420px]:[&_.cms-form-header]:items-start',
].join(' ')
function getFieldClassName(fullWidth = false) {
  return fullWidth ? `${FORM_FIELD_CLASS} ${FULL_WIDTH_CLASS}` : FORM_FIELD_CLASS
}
const bodyScrollLocks = new Set<symbol>()
let bodyOverflowBeforeModal: string | null = null
const slugify = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
const blank = (component: ContentComponent, routeParent?: string): ContentValues => ({ date: new Date().toISOString().slice(0, 10), routeParent: FIXED_CONTENT_PARENT[component] || routeParent || getDefaultContentParent(component) })
function Input({ field, name, value, disabled, onChange, label, error }: { field: FieldDef; name: string; value: string; disabled: boolean; onChange: (v: string) => void; label: string; error?: string }) {
  const common = { id: `f-${name}`, disabled, value, 'aria-label': label, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': error ? `f-${name}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(e.target.value) }
  if (field.type === 'textarea') return <Textarea rows={field.key === 'body' ? 7 : 3} {...common} />
  if (field.type === 'select') return <Select {...common}><option value="">— Select —</option>{field.options!.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
  const type = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'
  return <InputControl type={type} min={field.key === 'displayOrder' ? 0 : undefined} step={field.key === 'displayOrder' ? 1 : undefined} placeholder={field.type === 'image' || field.type === 'url' ? '/path or https://…' : undefined} {...common} />
}
/** Slug-wise form container: header (title per slug + actions) and labelled attribute inputs. */
export function ContentEditor({ component, record, onSaved, onDeleted, onClose, onDirtyChange, startReadOnly = false, defaultRouteParent, presentation = 'inline' }: {
  component: ContentComponent
  record: ContentRecord | null
  onSaved: (record: ContentRecord) => void
  onDeleted: (id: number) => void
  onClose?: () => void
  onDirtyChange?: (dirty: boolean) => void
  startReadOnly?: boolean
  defaultRouteParent?: string
  presentation?: 'inline' | 'modal'
}) {
  const def = COMPONENTS[component]
  const isNew = !record
  const actionId = useId()
  const initialValues = record ? { ...record.values, routeParent: FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component] } : blank(component, defaultRouteParent)
  const initialSlug = record?.slug ?? ''
  const initialStatus = record?.status ?? 'published'
  const [editing, setEditing] = useState(startReadOnly ? !record : true)
  const [values, setValues] = useState<ContentValues>(initialValues)
  const [slug, setSlug] = useState(initialSlug)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [newStatus, setNewStatus] = useState<'published' | 'draft' | 'hidden'>(initialStatus)
  const [baseline, setBaseline] = useState(JSON.stringify({ values: initialValues, slug: initialSlug, newStatus: initialStatus }))
  const [availablePages, setAvailablePages] = useState<PageIndexItem[]>([])
  const [slugState, setSlugState] = useState<SlugState>('idle')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveFieldError, setSaveFieldError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isMounted] = useState(true)
  const modalRef = useRef<HTMLDivElement>(null)
  const dirtyRef = useRef(false)
  const onCloseRef = useRef(onClose)
  const checkId = useRef(0)
  const previousPropsRef = useRef({ record, component, defaultRouteParent, startReadOnly })
  useEffect(() => {
    const previousProps = previousPropsRef.current
    if (previousProps.record === record && previousProps.component === component && previousProps.defaultRouteParent === defaultRouteParent && previousProps.startReadOnly === startReadOnly) return
    previousPropsRef.current = { record, component, defaultRouteParent, startReadOnly }
    const nextValues = record ? { ...record.values, routeParent: FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component] } : blank(component, defaultRouteParent)
    const nextSlug = record?.slug ?? ''
    const nextStatus = record?.status ?? 'published'
    setValues(nextValues); setSlug(nextSlug); setSlugTouched(!!record); setNewStatus(nextStatus); setEditing(startReadOnly ? !record : true)
    setBaseline(JSON.stringify({ values: nextValues, slug: nextSlug, newStatus: nextStatus }))
    setSlugState('idle'); setSaveError(''); setSaveFieldError(''); setValidationErrors({})
  }, [record, component, defaultRouteParent, startReadOnly])
  useEffect(() => { let active = true; getPageBuilderIndex().then((result) => { if (active) setAvailablePages(result.availablePages.filter((page) => page.status !== 'archived')) }).catch(() => { if (active) setAvailablePages([]) }); return () => { active = false } }, [])
  // Live slug validation (format + uniqueness) while editing.
  useEffect(() => {
    if (!editing) return
    let nextState: 'idle' | 'invalid' | 'ok' | null = null
    if (!slug) nextState = 'idle'
    else if (!SLUG_PATTERN.test(slug)) nextState = 'invalid'
    const routeParentForCheck = FIXED_CONTENT_PARENT[component] || values.routeParent || DEFAULT_CONTENT_PARENT[component]
    if (!nextState && record && slug === record.slug && routeParentForCheck === (FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component])) nextState = 'ok'
    const id = ++checkId.current
    if (nextState) {
      const stateTimer = setTimeout(() => { if (id === checkId.current) setSlugState(nextState) }, 0)
      return () => clearTimeout(stateTimer)
    }
    const checkingTimer = setTimeout(() => { if (id === checkId.current) setSlugState('checking') }, 0)
    const validationTimer = setTimeout(() => { isSlugTaken(component, slug, record?.id, routeParentForCheck).then((taken) => { if (id === checkId.current) setSlugState(taken ? 'taken' : 'ok') }).catch(() => { if (id === checkId.current) setSlugState('idle') }) }, 350)
    return () => { clearTimeout(checkingTimer); clearTimeout(validationTimer) }
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
  function save() {
    if (!SLUG_PATTERN.test(slug)) { setSaveError('Enter a valid slug using lowercase letters, numbers and hyphens.'); return }
    const nextValidationErrors = validateFields()
    setValidationErrors(nextValidationErrors)
    if (Object.keys(nextValidationErrors).length) { setSaveFieldError(''); setSaveError('Please correct the highlighted fields before saving.'); return }
    setBusy(true)
    setSaveError(''); setSaveFieldError(''); setValidationErrors({})
    const needsSlugCheck = !record || slug !== record.slug || routeParent !== (FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component])
    void Promise.resolve()
      .then(() => needsSlugCheck ? isSlugTaken(component, slug, record?.id, routeParent) : false)
      .then((taken) => {
        if (taken) {
          setSlugState('taken')
          throw new Error(`The route “${previewPath}” is already in use. Choose a different slug or destination page.`)
        }
        return record ? updateContent(record.id, slug, values, record.updatedAt) : createContent(component, slug, values, newStatus)
      })
      .then((saved) => {
        toast.success(record ? 'Changes saved.' : `${def.label} created.`)
        setEditing(false); onSaved(saved)
      })
      .catch((cause: unknown) => {
        const err = cause as Error & { field?: string; status?: number }
        const message = err.message || 'Unable to save.'
        setSaveError(message)
        setSaveFieldError(err.field || '')
        toast.error(message, { description: err.status === 409 ? 'Your draft is still here. Copy any important edits, reload the latest record if another editor changed it, then try again.' : undefined })
      })
      .finally(() => setBusy(false))
  }
  function toggleVisibility() {
    if (!record) return
    setBusy(true)
    void setContentVisibility(record.id, record.status === 'published' ? 'hidden' : 'published')
      .then((next) => { toast.success(next.status === 'published' ? 'Now visible on the site.' : 'Hidden from the site.'); onSaved(next) })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to change visibility.'))
      .finally(() => setBusy(false))
  }
  function remove() {
    if (!record) return
    setBusy(true)
    void deleteContent(record.id)
      .then(() => { toast.success('Deleted permanently.'); setConfirmDelete(false); onDeleted(record.id) })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to delete.'))
      .finally(() => setBusy(false))
  }
  function reloadDraft() {
    const nextValues = record ? { ...record.values, routeParent: FIXED_CONTENT_PARENT[component] || record.values.routeParent || DEFAULT_CONTENT_PARENT[component] } : blank(component, defaultRouteParent)
    const nextSlug = record?.slug ?? ''
    const nextStatus = record?.status ?? 'published'
    setValues(nextValues); setSlug(nextSlug); setSlugTouched(!!record); setNewStatus(nextStatus); setEditing(true)
    setBaseline(JSON.stringify({ values: nextValues, slug: nextSlug, newStatus: nextStatus }))
    setSlugState('idle'); setSaveError(''); setSaveFieldError(''); setValidationErrors({})
  }
  const dirty = editing && baseline !== JSON.stringify({ values, slug, newStatus })
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    if (presentation !== 'modal' || !isMounted) return
    const scrollLock = Symbol('content-editor-modal')
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (bodyScrollLocks.size === 0) bodyOverflowBeforeModal = document.body.style.overflow
    bodyScrollLocks.add(scrollLock)
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
      bodyScrollLocks.delete(scrollLock)
      if (bodyScrollLocks.size === 0 && bodyOverflowBeforeModal !== null) {
        document.body.style.overflow = bodyOverflowBeforeModal
        bodyOverflowBeforeModal = null
      }
      previousFocus?.focus()
    }
  }, [presentation, isMounted])
  useRegisterAdminActions(`content-editor-${actionId}`, { save: () => dirty ? save() : undefined, reload: reloadDraft, dirty, saving: busy, label: `${def.label} editor` })
  const slugHint = useMemo(() => ({ idle: '', checking: 'Checking availability…', ok: '✓ Slug is available', taken: '✗ Slug is already in use', invalid: '✗ Use lowercase letters, numbers and single hyphens' }[slugState]), [slugState])
  const editorCard = (
    <AdminDataContainer
      label='Content Editor'
      headerContent={
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-2">
            <h2>{title}</h2>
            <small><code>{slug || 'no-slug-yet'}</code>{record && <> · <Badge variant={status === 'published' ? 'default' : 'outline'}>{status}</Badge></>}</small>
          </div>
          <div className="min-w-0 flex-1">
            <SectionToolbar
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <AdminToolbarAction
                    variant="primary"
                    title="Edit content"
                    disabled={!record || editing || busy}
                    onClick={() => setEditing(true)}
                  >
                    <PencilIcon size={12}/>
                  </AdminToolbarAction>
                  <AdminToolbarAction
                    variant="secondary"
                    title={status === 'published' ? 'Hide content' : 'Publish content'}
                    disabled={!record || busy}
                    onClick={toggleVisibility}
                  >
                    {status === 'published' ? <EyeOff size={12}/> : <Eye size={12}/>}
                  </AdminToolbarAction>
                  <AdminToolbarAction
                    variant="danger"
                    title="Delete content"
                    disabled={!record || busy}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 size={12}/>
                  </AdminToolbarAction>
                  {onClose && (
                    <AdminToolbarAction
                      variant="quiet"
                      title="Close"
                      onClick={() => { if (!dirty || window.confirm('Discard the unsaved changes in this editor?')) onClose() }}
                    >
                    <X size={12}/>
                    </AdminToolbarAction>
                  )}
                </div>
              }
            />
          </div>
        </div>
      }
      footer={
        <div>
          {saveError && 
          <div className="cms-save-error mt-3.5 grid gap-1 rounded-md border border-destructive/30 border-l-4 border-l-destructive bg-destructive/5 px-3.5 py-3 text-foreground [&_strong]:text-sm [&_span]:wrap-break-word [&_span]:text-sm [&_small]:text-xs [&_small]:text-muted-foreground" role="alert">
            <strong>Changes were not saved.</strong>
            <span>{saveError}</span><small>Your edits are still in this form. Correct the highlighted field or retry after resolving the issue.</small>
          </div>}
          {editing && 
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => { if (dirty && !window.confirm('Discard the unsaved changes in this editor?')) return; if (record) { reloadDraft(); setEditing(false); } else { onClose?.(); } }} disabled={busy}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy || slugState === 'taken' || slugState === 'invalid'}><Save size={15} /> {busy ? 'Saving…' : record ? 'Save changes' : `Create ${def.label.toLowerCase()}`}</Button>
          </div>}
          {slug &&
          <div>
            <span>Selected item <strong>{slug}.</strong> Choose <strong>Edit, Visibility or Delete</strong> from top right menu.</span>
          </div>}
        </div>
      }    
      height = 'min(70dvh, 760px)'
      minHeight = '280px'
    >
    <div className={FORM_CARD_CLASS}>
      <div>
        <div className={FORM_GRID_CLASS}>
          <label className={getFieldClassName(true)} htmlFor="f-slug"><span>Slug <b>*</b></span>
            <InputControl id="f-slug" value={slug} disabled={!editing} onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); setSaveError(''); setSaveFieldError('') }} placeholder="unique-url-name" aria-invalid={slugState === 'invalid' || slugState === 'taken'} aria-describedby={editing && slugHint ? 'f-slug-help' : undefined} />
            {editing && slugHint && <small id="f-slug-help" className={`${SLUG_HINT_CLASS} cms-slug-${slugState}`} role="status">{slugHint}</small>}
          </label>
          <label className={getFieldClassName(true)} htmlFor="f-route-parent"><span>Publish under page</span>
            {FIXED_CONTENT_PARENT[component] ? <InputControl id="f-route-parent" value={routeParent} readOnly disabled /> : <Select id="f-route-parent" value={routeParent} disabled={!editing} onChange={(e) => set('routeParent', e.target.value)}>
              {!availablePages.some((page) => page.slug === routeParent) && <option value={routeParent}>{routeParent} (current destination)</option>}
              {availablePages.map((page) => <option key={page.slug} value={page.slug}>{page.slug === '/' ? 'Home (landing page)' : `${page.title.en} — ${page.slug}`}{page.status !== 'published' ? ` · ${page.status}` : ''}</option>)}
            </Select>}
            <small className="admin-small-note">{FIXED_CONTENT_PARENT[component] ? (component === 'news' ? 'News articles always publish under the News collection.' : 'Success stories always publish under the Success Stories collection. This is intentionally fixed so the news rail and success-story listing remain separate.') : 'The selected page gets a one-type content section if it does not already have one. Menu items use /menu-slug/content-slug; submenu items use /menu-slug/submenu-slug/content-slug.'}</small>
            <small className="cms-route-preview mt-1 block wrap-break-word text-sm leading-normal text-muted-foreground">Public route preview: <code>{previewPath}</code>{status === 'published' && <a href={previewPath} target="_blank" rel="noreferrer">Open public page ↗</a>}</small>
          </label>
          {isNew && <label className={FORM_FIELD_CLASS} htmlFor="f-new-status"><span>Visibility</span>
            <Select id="f-new-status" value={newStatus} disabled={!editing} onChange={(e) => setNewStatus(e.target.value as 'published' | 'draft' | 'hidden')}>
              <option value="published">Visible — publish immediately</option><option value="draft">Draft — not public</option><option value="hidden">Hidden — saved but not public</option>
            </Select>
          </label>}
          <div className={FULL_WIDTH_CLASS}><CmsTypographyEditor value={normalizeCmsTypography(values.typography)} onChange={(typography) => set('typography', typography ? JSON.stringify(typography) : '')} title="Content detail typography" /></div>
          {def.fields.map((field) => field.type === 'image'
            ? <div key={field.key} className={FULL_WIDTH_CLASS}><MediaField label={`${field.label}${field.required ? ' *' : ''}`} value={values[field.key] ?? ''} onChange={(v) => set(field.key, v)} disabled={!editing} alt={values.title_en ?? ''} helper={field.help} />{saveFieldError === field.key && <small className={FIELD_ERROR_CLASS}>Please check this image field.</small>}</div>
            : field.bilingual
              ? (['en', 'bn'] as const).map((lng) => { const name = `${field.key}_${lng}`; const label = `${field.label} (${lng === 'en' ? 'English' : 'বাংলা'})`; return (
                  <label key={name} className={getFieldClassName(field.type === 'textarea')} htmlFor={`f-${name}`}><span>{label}{field.required && lng === 'en' && <b> *</b>}</span><Input field={field} name={name} label={label} value={values[name] ?? ''} disabled={!editing} onChange={(v) => set(name, v)} error={validationErrors[name] || (saveFieldError === name ? 'Please check this value.' : undefined)} />{field.help && editing && <small className="admin-small-note">{field.help}</small>}{(validationErrors[name] || saveFieldError === name) && <small id={`f-${name}-error`} className={FIELD_ERROR_CLASS} role="alert">{validationErrors[name] || 'Please check this value.'}</small>}</label>) })
              : <label key={field.key} className={getFieldClassName(field.type === 'textarea')} htmlFor={`f-${field.key}`}><span>{field.label}{field.required && <b> *</b>}</span><Input field={field} name={field.key} label={field.label} value={values[field.key] ?? ''} disabled={!editing} onChange={(v) => set(field.key, v)} error={validationErrors[field.key] || (saveFieldError === field.key ? 'Please check this value.' : undefined)} />{field.help && editing && <small className="admin-small-note">{field.help}</small>}{(validationErrors[field.key] || saveFieldError === field.key) && <small id={`f-${field.key}-error`} className={FIELD_ERROR_CLASS} role="alert">{validationErrors[field.key] || 'Please check this value.'}</small>}</label>)}
        </div>
      </div>
      {confirmDelete && 
      <div className="cms-modal fixed inset-0 z-(--sf-z-modal) isolate grid place-items-center bg-(--overlay) p-4" role="alertdialog" aria-modal="true">
        <div className={DELETE_DIALOG_CARD_CLASS}>
          <h2>Delete “{title}”?</h2>
          <p>The data will be lost forever and cannot be recovered. {component === 'job' ? 'All applications received for this job will be deleted too.' : 'Consider hiding it instead if you may need it again.'}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep it</Button>
            <Button className="cms-danger border-destructive! bg-destructive! text-primary-foreground!" onClick={() => void remove()} disabled={busy}>{busy ? 'Deleting…' : 'Delete permanently'}</Button>
          </div>
        </div>
      </div>}
    </div>
    </AdminDataContainer>
  )
  if (presentation === 'modal') {
    if (!isMounted) return null
    return createPortal(
      <div ref={modalRef} className={CONTENT_MODAL_CLASS} role="dialog" aria-modal="true" aria-label={`${record ? 'Edit' : 'Create'} ${def.label}`}>
        <div className={CONTENT_MODAL_CARD_CLASS}>{editorCard}</div>
      </div>,
      document.querySelector('.admin-theme-root') ?? document.body
    )
  }
  return editorCard
}
