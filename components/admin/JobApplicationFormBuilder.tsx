'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  AdminDataContainer,
  AdminToolbar,
  AdminToolbarAction,
  AdminToolbarBadge,
} from '@/components/admin/cms'
import {
  DEFAULT_JOB_APPLICATION_FORM,
  MAX_JOB_APPLICATION_FIELDS,
  type JobApplicationCustomField,
  type JobApplicationFormConfig,
  type JobApplicationInputType,
  type JobApplicationSystemField,
} from '@/lib/jobApplicationForm'
import { getJobApplicationFormConfig, saveJobApplicationFormConfig } from '@/lib/api/adminJobs'

/* -------------------------------------------------------------------------- */
/* Constants & helpers                                                        */
/* -------------------------------------------------------------------------- */

const inputTypes: JobApplicationInputType[] = ['text', 'email', 'tel', 'number', 'date', 'url', 'textarea', 'select', 'checkbox', 'resume']

const mappedTypes: Record<JobApplicationSystemField, JobApplicationInputType> = {
  name: 'text', email: 'email', phone: 'tel', coverLetter: 'textarea', resume: 'resume',
}

const systemFieldLabels: Record<JobApplicationSystemField, string> = {
  name: 'Applicant name', email: 'Applicant email', phone: 'Applicant phone', coverLetter: 'Cover letter', resume: 'Resume / CV upload',
}

const isLockedField = (field: JobApplicationCustomField) =>
  field.systemField === 'name' || field.systemField === 'email'

const newField = (): JobApplicationCustomField => ({
  id: `custom_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
  labelEn: '',
  labelBn: '',
  type: 'text',
  required: false,
  maxLength: 255,
})

const numberOrUndefined = (value: string) => (value === '' ? undefined : Number(value))

/** Labelled form control. Replaces the repeated `cms-field` class strings. */
function FormField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label
      className={cn(
        'flex min-w-0 flex-col gap-1.5 text-sm',
        '[&_:disabled]:cursor-default [&_:disabled]:opacity-100 [&_:disabled]:bg-muted',
        className,
      )}
    >
      <span className="font-semibold">{label}</span>
      {children}
    </label>
  )
}

/** Bordered group with a legend, used for both the form content and each field. */
function EditorGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      {children}
    </fieldset>
  )
}

const FIELD_GRID = 'grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2'

const CONTENT_TAB = 'content'

/** One tab in the section tab list. */
function SectionTab({
  active,
  onSelect,
  children,
  title,
}: {
  active: boolean
  onSelect: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      role="tab"
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      title={title}
      onClick={onSelect}
      className={cn(
        'h-auto inline-flex max-w-56 shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-(length:--cms-control-font-size,13px) font-medium shadow-none transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary hover:bg-primary/10'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </Button>
  )
}

/* -------------------------------------------------------------------------- */
/* Form content (headings, description, submit button)                        */
/* -------------------------------------------------------------------------- */

function FormContentEditor({
  config,
  onChange,
}: {
  config: JobApplicationFormConfig
  onChange: (patch: Partial<JobApplicationFormConfig>) => void
}) {
  return (
    <EditorGroup legend="Public form content">
      <div className={FIELD_GRID}>
        <FormField label="Heading (English)">
          <Input maxLength={140} value={config.headingEn} onChange={(e) => onChange({ headingEn: e.target.value })} />
        </FormField>
        <FormField label="Heading (বাংলা)">
          <Input maxLength={140} value={config.headingBn} onChange={(e) => onChange({ headingBn: e.target.value })} />
        </FormField>
        <FormField label="Description (English)">
          <Textarea rows={2} maxLength={300} value={config.descriptionEn} onChange={(e) => onChange({ descriptionEn: e.target.value })} />
        </FormField>
        <FormField label="Description (বাংলা)">
          <Textarea rows={2} maxLength={300} value={config.descriptionBn} onChange={(e) => onChange({ descriptionBn: e.target.value })} />
        </FormField>
        <FormField label="Submit button (English)">
          <Input maxLength={60} value={config.submitLabelEn} onChange={(e) => onChange({ submitLabelEn: e.target.value })} />
        </FormField>
        <FormField label="Submit button (বাংলা)">
          <Input maxLength={60} value={config.submitLabelBn} onChange={(e) => onChange({ submitLabelBn: e.target.value })} />
        </FormField>
      </div>
    </EditorGroup>
  )
}

/* -------------------------------------------------------------------------- */
/* Single field editor                                                        */
/* -------------------------------------------------------------------------- */

function FieldEditor({
  field,
  index,
  total,
  allFields,
  onUpdate,
  onMove,
  onRemove,
}: {
  field: JobApplicationCustomField
  index: number
  total: number
  allFields: JobApplicationCustomField[]
  onUpdate: (id: string, patch: Partial<JobApplicationCustomField>) => void
  onMove: (id: string, direction: -1 | 1) => void
  onRemove: (id: string) => void
}) {
  const locked = isLockedField(field)
  const others = allFields.filter((candidate) => candidate.id !== field.id)
  const patch = (changes: Partial<JobApplicationCustomField>) => onUpdate(field.id, changes)

  const handleTypeChange = (type: JobApplicationInputType) => {
    const compatibleMapping =
      type === 'resume' ? 'resume' : field.systemField && mappedTypes[field.systemField] === type ? field.systemField : undefined
    patch({
      type,
      systemField: compatibleMapping,
      ...(type === 'select'
        ? {
            options: field.options?.length ? field.options : ['Option 1'],
            selectPlaceholderEn: field.selectPlaceholderEn || 'Select an option',
            selectPlaceholderBn: field.selectPlaceholderBn || 'একটি বিকল্প নির্বাচন করুন',
          }
        : { options: undefined }),
    })
  }

  const handleMappingChange = (systemField: JobApplicationSystemField | '') => {
    patch({
      systemField: systemField || undefined,
      ...(systemField ? { type: mappedTypes[systemField] } : field.type === 'resume' ? { type: 'text' as const } : {}),
    })
  }

  const showLengthLimits = !['number', 'checkbox', 'date', 'resume'].includes(field.type)
  const showPlaceholders = ['text', 'email', 'tel', 'url', 'textarea', 'resume'].includes(field.type)

  return (
    <EditorGroup legend={`Field ${index + 1}`}>
      <div className={FIELD_GRID}>
        <FormField label="Label (English)">
          <Input maxLength={100} value={field.labelEn} onChange={(e) => patch({ labelEn: e.target.value })} />
        </FormField>
        <FormField label="Label (বাংলা)">
          <Input maxLength={100} value={field.labelBn} onChange={(e) => patch({ labelBn: e.target.value })} />
        </FormField>

        <FormField label="Input field type">
          <NativeSelect value={field.type} disabled={locked} onChange={(e) => handleTypeChange(e.target.value as JobApplicationInputType)}>
            {inputTypes.map((type) => (
              <option key={type} value={type} disabled={type === 'resume' && others.some((c) => c.type === 'resume')}>
                {type === 'resume' ? 'PDF resume upload' : type}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField label="Applicant data mapping">
          <NativeSelect
            value={field.systemField || ''}
            disabled={locked}
            onChange={(e) => handleMappingChange(e.target.value as JobApplicationSystemField | '')}
          >
            <option value="">Custom response (no mapping)</option>
            {(Object.keys(systemFieldLabels) as JobApplicationSystemField[]).map((key) => (
              <option key={key} value={key} disabled={others.some((c) => c.systemField === key)}>
                {systemFieldLabels[key]}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField label="Requirement">
          <NativeSelect
            value={field.required ? 'required' : 'optional'}
            disabled={locked}
            onChange={(e) => patch({ required: e.target.value === 'required' })}
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
          </NativeSelect>
        </FormField>

        {field.type === 'number' && (
          <>
            <FormField label="Minimum value">
              <Input type="number" value={field.min ?? ''} onChange={(e) => patch({ min: numberOrUndefined(e.target.value) })} />
            </FormField>
            <FormField label="Maximum value">
              <Input type="number" value={field.max ?? ''} onChange={(e) => patch({ max: numberOrUndefined(e.target.value) })} />
            </FormField>
          </>
        )}

        {showLengthLimits && (
          <>
            <FormField label="Minimum characters">
              <Input type="number" min="0" max="5000" value={field.minLength ?? ''} onChange={(e) => patch({ minLength: numberOrUndefined(e.target.value) })} />
            </FormField>
            <FormField label="Maximum characters">
              <Input type="number" min="1" max="5000" value={field.maxLength ?? ''} onChange={(e) => patch({ maxLength: numberOrUndefined(e.target.value) })} />
            </FormField>
          </>
        )}

        {showPlaceholders && (
          <>
            <FormField label="Helper / placeholder (English)">
              <Input maxLength={160} value={field.placeholderEn || ''} onChange={(e) => patch({ placeholderEn: e.target.value })} />
            </FormField>
            <FormField label="Helper / placeholder (বাংলা)">
              <Input maxLength={160} value={field.placeholderBn || ''} onChange={(e) => patch({ placeholderBn: e.target.value })} />
            </FormField>
          </>
        )}

        {field.type === 'select' && (
          <>
            <FormField label="Empty option label (English)">
              <Input maxLength={80} value={field.selectPlaceholderEn || ''} onChange={(e) => patch({ selectPlaceholderEn: e.target.value })} />
            </FormField>
            <FormField label="Empty option label (বাংলা)">
              <Input maxLength={80} value={field.selectPlaceholderBn || ''} onChange={(e) => patch({ selectPlaceholderBn: e.target.value })} />
            </FormField>
            <FormField label="Options (one per line)" className="md:col-span-2">
              <Textarea
                rows={3}
                value={(field.options || []).join('\n')}
                onChange={(e) => patch({ options: e.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })}
              />
            </FormField>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <code className="text-xs text-muted-foreground">{field.id}</code>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => onMove(field.id, -1)} disabled={index === 0} aria-label={`Move field ${index + 1} up`}>
            <ArrowUp size={13} />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onMove(field.id, 1)} disabled={index === total - 1} aria-label={`Move field ${index + 1} down`}>
            <ArrowDown size={13} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onRemove(field.id)}
            disabled={locked}
            title={locked ? 'Required for applicant communication' : 'Remove field'}
          >
            <Trash2 size={13} /> Remove field
          </Button>
        </div>
      </div>
    </EditorGroup>
  )
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export default function JobApplicationFormBuilder() {
  const [config, setConfig] = useState<JobApplicationFormConfig>(DEFAULT_JOB_APPLICATION_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<string>(CONTENT_TAB)
  const [baseline, setBaseline] = useState(JSON.stringify(DEFAULT_JOB_APPLICATION_FORM))
  const dirty = baseline !== JSON.stringify(config)
  const dirtyRef = useRef(false)

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  const reload = useCallback((force = false): Promise<void> => {
    if (!force && dirtyRef.current && !window.confirm('You have unsaved application-form changes. Reload and discard them?')) return Promise.resolve()
    setLoading(true)
    setError('')
    return getJobApplicationFormConfig()
      .then((payload) => {
        const next = { ...DEFAULT_JOB_APPLICATION_FORM, ...payload, fields: Array.isArray(payload.fields) ? payload.fields : [] }
        setBaseline(JSON.stringify(next))
        setConfig(next)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Unable to load the form configuration.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { void reload() }, 0)
    return () => clearTimeout(timer)
  }, [reload])

  /* ----------------------------- state updaters ---------------------------- */

  const updateField = (id: string, patch: Partial<JobApplicationCustomField>) => {
    setConfig((current) => ({
      ...current,
      fields: current.fields.map((field) => {
        if (field.id !== id) return field
        if (field.systemField === 'name' || field.systemField === 'email') {
          const safePatch = { ...patch }
          delete safePatch.systemField
          if (safePatch.type && safePatch.type !== mappedTypes[field.systemField]) delete safePatch.type
          if (safePatch.required === false) delete safePatch.required
          return { ...field, ...safePatch, type: mappedTypes[field.systemField], required: true }
        }
        return { ...field, ...patch }
      }),
    }))
  }

  const updateConfig = (patch: Partial<JobApplicationFormConfig>) => setConfig((current) => ({ ...current, ...patch }))

  const addField = () => {
    if (config.fields.length >= MAX_JOB_APPLICATION_FIELDS) return
    const field = newField()
    setConfig((current) => ({ ...current, fields: [...current.fields, field] }))
    setActiveTab(field.id) // jump straight to the new field's editor
  }

  const removeField = (id: string) => {
    const index = config.fields.findIndex((item) => item.id === id)
    const field = config.fields[index]
    if (field && isLockedField(field)) {
      toast.error('Applicant name and email are required for recruitment communication and cannot be removed.')
      return
    }
    if (!window.confirm(`Remove the field “${field?.labelEn || 'Untitled field'}”? This change will apply to the public application form after you save.`)) return
    setConfig((current) => ({ ...current, fields: current.fields.filter((item) => item.id !== id) }))
    if (activeTab === id) setActiveTab(config.fields[index - 1]?.id ?? CONTENT_TAB)
  }

  const moveField = (id: string, direction: -1 | 1) => setConfig((current) => {
    const from = current.fields.findIndex((field) => field.id === id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= current.fields.length) return current
    const fields = [...current.fields]
    ;[fields[from], fields[to]] = [fields[to], fields[from]]
    return { ...current, fields }
  })

  /* ------------------------------ validate/save ---------------------------- */

  function validateConfig(): string | null {
    if (config.fields.length < 1) return 'Add at least one application field before saving.'
    if (config.fields.length > MAX_JOB_APPLICATION_FIELDS) return `A maximum of ${MAX_JOB_APPLICATION_FIELDS} fields is allowed.`
    const ids = config.fields.map((field) => field.id)
    if (new Set(ids).size !== ids.length) return 'Every application field must have a unique ID.'
    const mapped = config.fields.flatMap((field) => (field.systemField ? [field.systemField] : []))
    if (new Set(mapped).size !== mapped.length) return 'Each applicant data mapping can only be used once.'
    const applicantName = config.fields.find((field) => field.systemField === 'name')
    const applicantEmail = config.fields.find((field) => field.systemField === 'email')
    if (!applicantName || applicantName.type !== 'text' || !applicantName.required) return 'Applicant name is a required system field and cannot be removed or made optional.'
    if (!applicantEmail || applicantEmail.type !== 'email' || !applicantEmail.required) return 'Applicant email is a required system field and cannot be removed or made optional.'
    if (config.fields.filter((field) => field.type === 'resume').length > 1) return 'Only one PDF resume upload field can be configured.'
    for (const [index, field] of config.fields.entries()) {
      if (!field.labelEn.trim()) return `Enter an English label for field ${index + 1}.`
      if (field.minLength !== undefined && field.maxLength !== undefined && field.minLength > field.maxLength) return `Field ${index + 1}: minimum characters cannot exceed maximum characters.`
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) return `Field ${index + 1}: minimum value cannot exceed maximum value.`
      if (field.type === 'select' && !field.options?.length) return `Field ${index + 1}: add at least one select option.`
      if (field.type === 'resume' && field.systemField !== 'resume') return `Field ${index + 1}: map the PDF upload to Resume / CV.`
      if (field.systemField && mappedTypes[field.systemField] !== field.type) return `Field ${index + 1}: the selected applicant data mapping requires the ${mappedTypes[field.systemField]} input type.`
    }
    if (!config.submitLabelEn.trim()) return 'Enter an English submit-button label.'
    return null
  }

  function save(): void {
    const validationError = validateConfig()
    if (validationError) {
      setError(validationError)
      toast.error(validationError)
      // Messages are scoped as "field N" or the submit label; open the tab that needs attention.
      const match = validationError.match(/field (\d+)/i)
      const target = match ? config.fields[Number(match[1]) - 1]?.id : undefined
      if (target) setActiveTab(target)
      else if (validationError.includes('submit-button')) setActiveTab(CONTENT_TAB)
      return
    }
    setSaving(true)
    setError('')
    void saveJobApplicationFormConfig(config)
      .then((payload) => {
        const saved = payload.config ?? config
        setBaseline(JSON.stringify(saved))
        setConfig(saved)
        toast.success('Job application form saved. The public application form now uses these CMS fields.')
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Unable to save the form configuration.'
        setError(message)
        toast.error(message)
      })
      .finally(() => setSaving(false))
  }

  /* --------------------------------- render -------------------------------- */

  const atFieldLimit = config.fields.length >= MAX_JOB_APPLICATION_FIELDS
  // Fall back to the content tab if the active field no longer exists (e.g. after a reload).
  const currentFieldIndex = config.fields.findIndex((field) => field.id === activeTab)
  const currentField = currentFieldIndex >= 0 ? config.fields[currentFieldIndex] : undefined
  const currentTab = currentField ? currentField.id : CONTENT_TAB

  return (
    <AdminDataContainer
      label="Job application form builder"
      title="Job application form builder"
      height="70vh"
      description="Configure the fields shown on public vacancy applications."
      bodyScroll="auto"
      actions={
        <>
          {dirty && <AdminToolbarBadge tone="warning">Unsaved changes</AdminToolbarBadge>}
          <AdminToolbarAction onClick={() => void reload()} disabled={loading || saving}>
            Reload
          </AdminToolbarAction>
        </>
      }
      footerActions={
        dirty ? (
          <>
            <AdminToolbarAction
              variant="quiet"
              onClick={() => {
                if (window.confirm('Discard all unsaved changes and reload the saved form?')) void reload(true)
              }}
              disabled={loading || saving}
            >
              Discard changes
            </AdminToolbarAction>
            <AdminToolbarAction variant="primary" icon={Save} onClick={save} disabled={loading || saving}>
              {saving ? 'Saving…' : 'Save form'}
            </AdminToolbarAction>
          </>
        ) : null
      }
      status={{
        content: dirty
          ? 'Unsaved changes are not public until saved.'
          : 'The public form is up to date.',
      }}
      footer={<span>{config.fields.length} of {MAX_JOB_APPLICATION_FIELDS} fields configured</span>}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {error && (
          <p className="m-0 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="m-0 text-sm text-muted-foreground">Loading form settings…</p>
        ) : (
          <>
            <AdminToolbar
              title="Form sections"
              tabs={
                <div
                  role="tablist"
                  aria-label="Form sections"
                  className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1"
                >
                  <SectionTab active={currentTab === CONTENT_TAB} onSelect={() => setActiveTab(CONTENT_TAB)}>
                    Form content
                  </SectionTab>
                  {config.fields.map((field, index) => (
                    <SectionTab
                      key={field.id}
                      active={currentTab === field.id}
                      onSelect={() => setActiveTab(field.id)}
                      title={field.labelEn || 'Untitled field'}
                    >
                      <span className="tabular-nums text-muted-foreground">{index + 1}</span>
                      <span className="truncate">{field.labelEn.trim() || 'Untitled field'}</span>
                      {field.required && <span className="text-destructive" aria-label="Required">*</span>}
                    </SectionTab>
                  ))}
                </div>
              }
              actions={
                <>
                  <AdminToolbarBadge tone={atFieldLimit ? 'warning' : 'neutral'}>
                    {config.fields.length}/{MAX_JOB_APPLICATION_FIELDS} fields
                  </AdminToolbarBadge>
                  <AdminToolbarAction
                    variant="primary"
                    icon={Plus}
                    onClick={addField}
                    disabled={atFieldLimit}
                    title={atFieldLimit ? `Maximum of ${MAX_JOB_APPLICATION_FIELDS} fields reached` : 'Create a new field'}
                  >
                    New field
                  </AdminToolbarAction>
                </>
              }
            />

            <div role="tabpanel" aria-label={currentTab === CONTENT_TAB ? 'Form content' : `Field ${currentFieldIndex + 1}`}>
              {currentTab === CONTENT_TAB || !currentField ? (
                <FormContentEditor config={config} onChange={updateConfig} />
              ) : (
                <FieldEditor
                  key={currentField.id}
                  field={currentField}
                  index={currentFieldIndex}
                  total={config.fields.length}
                  allFields={config.fields}
                  onUpdate={updateField}
                  onMove={moveField}
                  onRemove={removeField}
                />
              )}
            </div>

            {!config.fields.length && (
              <p className="m-0 text-sm text-muted-foreground">
                No fields are configured. Select “New field” to add your first one.
              </p>
            )}
          </>
        )}
      </div>
    </AdminDataContainer>
  )
}