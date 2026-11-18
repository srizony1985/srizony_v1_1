import type { ExternalValue, JsonObject } from '../types/json'

export type JobApplicationInputType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'url' | 'textarea' | 'select' | 'checkbox' | 'resume'
export type JobApplicationSystemField = 'name' | 'email' | 'phone' | 'coverLetter' | 'resume'
export type JobApplicationCustomField = {
  id: string
  labelEn: string
  labelBn: string
  type: JobApplicationInputType
  required: boolean
  systemField?: JobApplicationSystemField
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  placeholderEn?: string
  placeholderBn?: string
  selectPlaceholderEn?: string
  selectPlaceholderBn?: string
  options?: string[]
}
export type JobApplicationFormConfig = {
  version: 2
  headingEn: string
  headingBn: string
  descriptionEn: string
  descriptionBn: string
  submitLabelEn: string
  submitLabelBn: string
  fields: JobApplicationCustomField[]
}

export const MAX_JOB_APPLICATION_FIELDS = 40

/**
 * Initial editable CMS configuration. These are starter records, not separately
 * rendered controls: after saving, every public input (including name/email/CV)
 * is generated from the same document managed by the Job Management CMS.
 */
export const DEFAULT_JOB_APPLICATION_FORM: JobApplicationFormConfig = {
  version: 2,
  headingEn: 'Apply for this position',
  headingBn: 'এই পদে আবেদন করুন',
  descriptionEn: 'Complete the form below to submit your application.',
  descriptionBn: 'আবেদন জমা দিতে নিচের ফর্মটি পূরণ করুন।',
  submitLabelEn: 'Submit application',
  submitLabelBn: 'আবেদন জমা দিন',
  fields: [
    { id: 'custom_applicant_name', systemField: 'name', labelEn: 'Full name', labelBn: 'পূর্ণ নাম', type: 'text', required: true, minLength: 2, maxLength: 160, placeholderEn: 'Enter your full name', placeholderBn: 'আপনার পূর্ণ নাম লিখুন' },
    { id: 'custom_applicant_email', systemField: 'email', labelEn: 'Email address', labelBn: 'ইমেইল ঠিকানা', type: 'email', required: true, maxLength: 254, placeholderEn: 'name@example.com', placeholderBn: 'name@example.com' },
    { id: 'custom_applicant_phone', systemField: 'phone', labelEn: 'Phone number', labelBn: 'ফোন নম্বর', type: 'tel', required: false, maxLength: 40, placeholderEn: '+880 1XXX-XXXXXX', placeholderBn: '+৮৮০ ১XXX-XXXXXX' },
    { id: 'custom_cover_letter', systemField: 'coverLetter', labelEn: 'Cover letter', labelBn: 'আবেদনের বক্তব্য', type: 'textarea', required: false, maxLength: 5000, placeholderEn: 'Briefly describe your qualifications for this role…', placeholderBn: 'এই পদের জন্য আপনার যোগ্যতা সংক্ষেপে লিখুন…' },
    { id: 'custom_resume', systemField: 'resume', labelEn: 'Resume / CV (PDF)', labelBn: 'জীবনবৃত্তান্ত (PDF)', type: 'resume', required: true, placeholderEn: 'Choose your PDF resume · Maximum 4 MB', placeholderBn: 'PDF জীবনবৃত্তান্ত নির্বাচন করুন · সর্বোচ্চ ৪ MB' },
  ],
}


function isRecord(value: ExternalValue): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** Upgrade the former "custom questions only" document while preserving its fields. */
export function normalizeJobApplicationFormConfig(value: ExternalValue): JobApplicationFormConfig {
  if (!isRecord(value)) return DEFAULT_JOB_APPLICATION_FORM
  const rawFields = Array.isArray(value.fields) ? value.fields : []
  const fields = rawFields.filter((field): field is JobApplicationCustomField =>
    Boolean(field && typeof field === 'object' && !Array.isArray(field) && typeof (field as JsonObject).id === 'string' && typeof (field as JsonObject).labelEn === 'string' && typeof (field as JsonObject).type === 'string'),
  )

  // Version 1 had custom questions only; its core fields lived in React. Add
  // their editable CMS records once, then persist v2 from the admin builder.
  const isVersion2 = value.version === 2
  const migratedFields = isVersion2
    ? fields
    : [...fields, ...DEFAULT_JOB_APPLICATION_FORM.fields.filter((starter) => !fields.some((field) => field.systemField === starter.systemField))]
  // Older custom select fields did not store their empty-option copy. Move that
  // copy into the editable field record instead of hard-coding it in the UI.
  const normalizedFields = migratedFields.map((field) => field.type === 'select'
    ? {
        ...field,
        selectPlaceholderEn: field.selectPlaceholderEn || 'Select an option',
        selectPlaceholderBn: field.selectPlaceholderBn || 'একটি বিকল্প নির্বাচন করুন',
      }
    : field)

  // Applicant identity and email are system-required fields because all
  // recruitment updates and interview invitations are delivered by email.
  // Keep custom labels/IDs when present, but restore the required mapping,
  // field type and required flag if an older CMS document omitted or altered it.
  const requiredContactFields = DEFAULT_JOB_APPLICATION_FORM.fields
    .filter((field) => field.systemField === 'name' || field.systemField === 'email')
    .map((starter) => {
      const existing = normalizedFields.find((field) => field.systemField === starter.systemField)
      return existing
        ? { ...starter, ...existing, type: starter.type, systemField: starter.systemField, required: true, maxLength: starter.maxLength, ...(starter.minLength !== undefined ? { minLength: starter.minLength } : {}) }
        : starter
    })
  const contactSystemFields = new Set(['name', 'email'])
  const finalFields = [
    ...requiredContactFields,
    ...normalizedFields.filter((field) => !field.systemField || !contactSystemFields.has(field.systemField)),
  ]

  return {
    version: 2,
    headingEn: typeof value.headingEn === 'string' ? value.headingEn : DEFAULT_JOB_APPLICATION_FORM.headingEn,
    headingBn: typeof value.headingBn === 'string' ? value.headingBn : DEFAULT_JOB_APPLICATION_FORM.headingBn,
    descriptionEn: typeof value.descriptionEn === 'string' ? value.descriptionEn : DEFAULT_JOB_APPLICATION_FORM.descriptionEn,
    descriptionBn: typeof value.descriptionBn === 'string' ? value.descriptionBn : DEFAULT_JOB_APPLICATION_FORM.descriptionBn,
    submitLabelEn: typeof value.submitLabelEn === 'string' ? value.submitLabelEn : DEFAULT_JOB_APPLICATION_FORM.submitLabelEn,
    submitLabelBn: typeof value.submitLabelBn === 'string' ? value.submitLabelBn : DEFAULT_JOB_APPLICATION_FORM.submitLabelBn,
    fields: finalFields,
  }
}

export function validateCustomJobFields(config: JobApplicationFormConfig, values: ExternalValue, resumeToken = '') {
  const errors: Record<string, string> = {}
  const input = isRecord(values) ? values : {}
  for (const field of config.fields) {
    const label = field.labelEn || 'This field'
    if (field.type === 'resume') {
      if (field.required && !resumeToken) errors[field.id] = `${label} is required.`
      continue
    }

    const raw = input[field.id]
    const empty = raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim())
    if (empty) {
      if (field.required) errors[field.id] = `${label} is required.`
      continue
    }
    if (field.type === 'checkbox') {
      if (field.required && raw !== true) errors[field.id] = `${label} must be checked.`
      continue
    }
    if (field.type === 'number') {
      const number = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(number)) errors[field.id] = `${label} must be a valid number.`
      else if (field.min !== undefined && number < field.min) errors[field.id] = `${label} must be at least ${field.min}.`
      else if (field.max !== undefined && number > field.max) errors[field.id] = `${label} must be no greater than ${field.max}.`
      continue
    }
    if (typeof raw !== 'string') { errors[field.id] = `${label} must be text.`; continue }
    const text = raw.trim()
    if (field.minLength !== undefined && text.length < field.minLength) errors[field.id] = `${label} must contain at least ${field.minLength} characters.`
    if (field.maxLength !== undefined && text.length > field.maxLength) errors[field.id] = `${label} must contain no more than ${field.maxLength} characters.`
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) errors[field.id] = `${label} must be a valid email address.`
    if (field.type === 'url') {
      try { const url = new URL(text); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid') }
      catch { errors[field.id] = `${label} must be a valid HTTP or HTTPS URL.` }
    }
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) errors[field.id] = `${label} must be a valid date.`
    if (field.type === 'select' && !(field.options || []).includes(text)) errors[field.id] = `Choose a valid option for ${label}.`
  }
  const allowedIds = new Set(config.fields.filter((field) => field.type !== 'resume').map((field) => field.id))
  for (const key of Object.keys(input)) if (!allowedIds.has(key)) errors[key] = 'This field is not part of the current application form.'
  return errors
}

/** Keep the legacy inbox/export columns useful without making those fields mandatory. */
export function getMappedJobApplicationValues(config: JobApplicationFormConfig, values: ExternalValue) {
  const input = isRecord(values) ? values : {}
  const mapped: { name: string; email: string; phone: string; coverLetter: string } = { name: '', email: '', phone: '', coverLetter: '' }
  for (const field of config.fields) {
    if (!field.systemField || field.systemField === 'resume') continue
    const raw = input[field.id]
    if (raw === undefined || raw === null) continue
    const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
    if (field.systemField === 'name') mapped.name = value
    if (field.systemField === 'email') mapped.email = value
    if (field.systemField === 'phone') mapped.phone = value
    if (field.systemField === 'coverLetter') mapped.coverLetter = value
  }
  return mapped
}
