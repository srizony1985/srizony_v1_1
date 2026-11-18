import type { JobApplicationCustomField } from '@/lib/jobApplicationForm'
import { MAX_RESUME_BYTES } from '@/lib/jobApplicationValidation'

export type FieldValue = string | boolean | undefined
export type FieldErrors = Record<string, string>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const fieldDomId = (jobSlug: string, fieldId: string) => `job-field-${jobSlug}-${fieldId}`

const labelOf = (field: JobApplicationCustomField, bn: boolean) =>
  (bn && field.labelBn ? field.labelBn : field.labelEn) || (bn ? 'এই ফিল্ড' : 'This field')

const num = (n: number, bn: boolean) => n.toLocaleString(bn ? 'bn-BD' : 'en-US')

export function validateField(field: JobApplicationCustomField, raw: FieldValue, bn: boolean): string | null {
  if (field.type === 'resume') return null
  const label = labelOf(field, bn)
  const t = (en: string, bnText: string) => (bn ? bnText : en)

  if (field.type === 'checkbox') {
    return field.required && raw !== true
      ? t(`${label} must be checked.`, `${label} নির্বাচন করা আবশ্যক।`)
      : null
  }

  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return field.required ? t(`${label} is required.`, `${label} আবশ্যক।`) : null

  switch (field.type) {
    case 'number': {
      const n = Number(value)
      if (!Number.isFinite(n)) return t('Enter a valid number.', 'একটি সঠিক সংখ্যা লিখুন।')
      if (field.min !== undefined && n < field.min)
        return t(`Must be at least ${field.min}.`, `সর্বনিম্ন মান ${num(field.min, bn)} হতে হবে।`)
      if (field.max !== undefined && n > field.max)
        return t(`Must be at most ${field.max}.`, `সর্বোচ্চ মান ${num(field.max, bn)} হতে পারবে।`)
      return null
    }
    case 'date': {
      const d = new Date(`${value}T00:00:00Z`)
      if (!DATE_RE.test(value) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value)
        return t('Enter a valid date.', 'একটি সঠিক তারিখ দিন।')
      return null
    }
    case 'select':
      return (field.options || []).includes(value)
        ? null
        : t('Choose one of the listed options.', 'তালিকা থেকে একটি বিকল্প নির্বাচন করুন।')
  }

  // Text-like inputs: text, email, tel, url, textarea
  if (field.minLength !== undefined && value.length < field.minLength)
    return t(`Enter at least ${field.minLength} characters.`, `কমপক্ষে ${num(field.minLength, bn)} অক্ষর লিখুন।`)
  if (field.maxLength !== undefined && value.length > field.maxLength)
    return t(`Use at most ${field.maxLength} characters.`, `সর্বোচ্চ ${num(field.maxLength, bn)} অক্ষর লেখা যাবে।`)

  if (field.type === 'email' && (value.length > 254 || !EMAIL_RE.test(value)))
    return t('Enter a valid email address.', 'একটি সঠিক ইমেইল ঠিকানা দিন।')

  if (field.type === 'tel') {
    const digits = value.replace(/\D/g, '')
    if (!/^\+?[\d\s\-().]+$/.test(value) || digits.length < 7 || digits.length > 15)
      return t('Enter a valid phone number.', 'একটি সঠিক ফোন নম্বর দিন।')
  }

  if (field.type === 'url') {
    try {
      const url = new URL(value)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol')
    } catch {
      return t('Enter a valid URL starting with http:// or https://.', 'http:// বা https:// দিয়ে শুরু হওয়া একটি সঠিক URL দিন।')
    }
  }
  return null
}

export function validateResume(field: JobApplicationCustomField | undefined, file: File | null, bn: boolean): string | null {
  if (!field) return null
  const t = (en: string, bnText: string) => (bn ? bnText : en)
  if (!file) return field.required ? t(`${field.labelEn} is required.`, 'জীবনবৃত্তান্ত সংযুক্ত করুন।') : null
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))
    return t('Only PDF files are accepted.', 'শুধু PDF ফাইল গ্রহণ করা হয়।')
  if (file.size <= 0) return t('The selected file is empty.', 'নির্বাচিত ফাইলটি খালি।')
  if (file.size > MAX_RESUME_BYTES) return t('The PDF must be 4 MB or smaller.', 'PDF ফাইলের আকার ৪ MB বা কম হতে হবে।')
  return null
}

export function validateForm(
  fields: JobApplicationCustomField[],
  values: Record<string, string | boolean>,
  file: File | null,
  bn: boolean,
): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of fields) {
    const message = field.type === 'resume' ? validateResume(field, file, bn) : validateField(field, values[field.id], bn)
    if (message) errors[field.id] = message
  }
  return errors
}