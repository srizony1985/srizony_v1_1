'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, UploadCloud } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import { applyForJob, getPublicJobApplicationForm, uploadJobResume } from '@/lib/api/public'
import { messageOf } from '@/lib/api/http'
import { DEFAULT_JOB_APPLICATION_FORM, type JobApplicationCustomField, type JobApplicationFormConfig } from '@/lib/jobApplicationForm'
import { fieldDomId, validateField, validateForm, validateResume } from '@/lib/jobFieldValidation'

type FormValues = Record<string, string | boolean>
type SavedDraft = { values?: FormValues; customFieldValues?: FormValues; name?: string; email?: string; phone?: string; coverLetter?: string }

function restoreDraftValues(draft: SavedDraft | null, fields: JobApplicationCustomField[]): FormValues {
  if (!draft) return {}
  const values: FormValues = { ...(draft.values || draft.customFieldValues || {}) }
  const legacyValues: Record<string, string> = {
    name: draft.name || '', email: draft.email || '', phone: draft.phone || '', coverLetter: draft.coverLetter || '',
  }
  for (const field of fields) {
    if (field.systemField && field.systemField !== 'resume' && values[field.id] === undefined) {
      const legacy = legacyValues[field.systemField]
      if (legacy) values[field.id] = legacy
    }
  }
  return values
}

export default function JobApplicationForm({ jobSlug, jobRouteParent }: { jobSlug: string; jobRouteParent: string }) {
  const { lang } = useSite()
  const bn = lang === 'bn'
  const [formConfig, setFormConfig] = useState<JobApplicationFormConfig>(DEFAULT_JOB_APPLICATION_FORM)
  const [values, setValues] = useState<FormValues>({})
  const [file, setFile] = useState<File | null>(null)
  const [resumeToken, setResumeToken] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [successRef, setSuccessRef] = useState('')
  const [successEmailDelivery, setSuccessEmailDelivery] = useState<'sent' | 'queued' | 'already-sent' | 'not-configured' | 'queue-error'>('queued')
  const [applicantEmail, setApplicantEmail] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const draftKey = `sf-job-application-draft:${jobSlug}`
  const resumeField = formConfig.fields.find((field) => field.type === 'resume')

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let savedDraft: SavedDraft | null = null
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (raw) savedDraft = JSON.parse(raw) as SavedDraft
    } catch { /* Ignore an unavailable or invalid local draft. */ }

    getPublicJobApplicationForm(controller.signal)
      .then((response) => {
        if (!active) return
        if (response.ok && Array.isArray(response.data?.fields)) {
          const nextConfig = { ...DEFAULT_JOB_APPLICATION_FORM, ...response.data }
          setFormConfig(nextConfig)
          setValues(restoreDraftValues(savedDraft, nextConfig.fields))
        } else {
          setValues(restoreDraftValues(savedDraft, DEFAULT_JOB_APPLICATION_FORM.fields))
        }
      })
      .catch((cause: unknown) => {
        if (active && (cause as { name?: string })?.name !== 'AbortError') {
          console.warn('Job application form configuration could not be refreshed.')
          setValues(restoreDraftValues(savedDraft, DEFAULT_JOB_APPLICATION_FORM.fields))
        }
      })
      .finally(() => { if (active) setDraftReady(true) })
    return () => { active = false; controller.abort() }
  }, [draftKey])

  useEffect(() => {
    if (!draftReady || successRef) return
    try { sessionStorage.setItem(draftKey, JSON.stringify({ values })) } catch { /* Storage is optional. */ }
  }, [draftReady, draftKey, values, successRef])

  function updateValue(field: JobApplicationCustomField, value: string | boolean) {
    setValues((current) => ({ ...current, [field.id]: value }))
    setFieldErrors((current) => {
      // Re-validate live once the user has already visited the field; otherwise just clear stale errors.
      const message = touched[field.id] || current[field.id] ? validateField(field, value, bn) : null
      if (message) return { ...current, [field.id]: message }
      if (!current[field.id]) return current
      const next = { ...current }
      delete next[field.id]
      return next
    })
  }

  function blurField(field: JobApplicationCustomField) {
    setTouched((current) => ({ ...current, [field.id]: true }))
    const message = validateField(field, values[field.id], bn)
    setFieldErrors((current) => {
      if (!message) {
        if (!current[field.id]) return current
        const next = { ...current }
        delete next[field.id]
        return next
      }
      return { ...current, [field.id]: message }
    })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessRef('')

    const errors = validateForm(formConfig.fields, values, file, bn)
    if (Object.keys(errors).length) {
      setFieldErrors(errors)
      setTouched(Object.fromEntries(formConfig.fields.map((f) => [f.id, true])))
      const first = formConfig.fields.find((f) => errors[f.id])
      if (first) {
        const el = document.getElementById(first.type === 'resume' ? `job-resume-${jobSlug}` : fieldDomId(jobSlug, first.id))
        el?.focus()
      }
      return
    }
    setFieldErrors({})

    if (file && (!resumeField || resumeField.type !== 'resume')) {
      setError(bn ? 'এই ফর্মে জীবনবৃত্তান্ত আপলোডের ফিল্ড নেই।' : 'This form does not currently accept a resume upload.')
      return
    }

    setSubmitting(true)
    setUploading(Boolean(file))
    const resumeTokenPromise = file && !resumeToken
      ? uploadJobResume(file, honeypot).then((upload) => {
          if (!upload.ok || !upload.data?.resumeToken) {
            throw new Error(messageOf(upload.data, bn ? 'জীবনবৃত্তান্ত আপলোড করা যায়নি।' : 'Unable to upload your resume.'))
          }
          const token = upload.data.resumeToken
          setResumeToken(token)
          return token
        })
      : Promise.resolve(resumeToken)

    void resumeTokenPromise
      .then((token) => {
        setUploading(false)
        const customFieldEntries: Array<[string, string | number | boolean]> = formConfig.fields
          .filter((field) => field.type !== 'resume')
          .map((field) => {
            const raw = values[field.id]
            const clean = typeof raw === 'string' ? raw.trim() : raw
            if (field.type === 'number') return [field.id, clean === '' || clean === undefined ? '' : Number(clean)] as [string, string | number | boolean]
            return [field.id, clean ?? (field.type === 'checkbox' ? false : '')] as [string, string | number | boolean]
          })
          .filter(([, value]) => value !== '')
        const customFields = Object.fromEntries(customFieldEntries)
        const emailField = formConfig.fields.find((field) => field.systemField === 'email')
        setApplicantEmail(emailField ? String(values[emailField.id] || '').trim() : '')
        return applyForJob({
          jobSlug,
          jobRouteParent,
          customFields,
          ...(token ? { resumeToken: token } : {}),
          website: honeypot,
        })
      })
      .then((response) => {
        if (!response.ok || !response.data?.ok || !response.data?.reference) {
          const message = messageOf(response.data, bn ? 'আবেদন জমা দেওয়া যায়নি।' : 'Unable to submit the application.')
          if (response.status === 410 || /expired|already used/i.test(message)) setResumeToken('')
          if (response.data?.fields) setFieldErrors(response.data.fields)
          throw new Error(message)
        }
        setSuccessRef(response.data.reference)
        setSuccessEmailDelivery(response.data.emailDelivery || 'queued')
        try { sessionStorage.removeItem(draftKey) } catch { /* Storage is optional. */ }
        setValues({})
        setTouched({})
        setFile(null)
        setResumeToken('')
        setHoneypot('')
        const input = document.getElementById(`job-resume-${jobSlug}`) as HTMLInputElement | null
        if (input) input.value = ''
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : (bn ? 'আবেদন জমা দেওয়া যায়নি। আবার চেষ্টা করুন।' : 'Application could not be submitted. Please try again.'))
      })
      .finally(() => { setUploading(false); setSubmitting(false) })
  }

  const heading = bn && formConfig.headingBn ? formConfig.headingBn : formConfig.headingEn
  const description = bn && formConfig.descriptionBn ? formConfig.descriptionBn : formConfig.descriptionEn
  const submitLabel = bn && formConfig.submitLabelBn ? formConfig.submitLabelBn : formConfig.submitLabelEn

  return <section className="sf-block sf-job-application" aria-label={heading || (bn ? 'চাকরির আবেদন ফর্ম' : 'Job application form')}>
    <div className="sf-sec-head">
      <p className="sf-eyebrow">{bn ? 'চাকরির আবেদন' : 'JOB APPLICATION'}</p>
      {heading && <h2 id="sf-job-application-title" className="sf-h2">{heading}</h2>}
      {description && <p className="sf-body">{description}</p>}
    </div>

    {!successRef && <p className="sf-job-draft-status" role="status">{bn ? 'আপনার খসড়া এই সেশনে স্বয়ংক্রিয়ভাবে সংরক্ষিত হচ্ছে।' : 'Your draft is automatically saved in this browser session.'}</p>}
    {successRef ? <div className="sf-job-application-success" role="status" aria-live="polite">
      <CheckCircle2 size={24} aria-hidden="true" />
      <div><h3>{bn ? 'আপনার আবেদন সফলভাবে জমা হয়েছে' : 'Application successfully submitted'}</h3>
        <p>{bn ? 'আপনার আবেদনটি Srizony Foundation প্রশাসনের কাছে জমা হয়েছে। আবেদন পর্যালোচনা করা হলে আপনাকে ইমেইলে জানানো হবে।' : 'Your application has been successfully submitted to the Srizony Foundation administration. You will be notified once we review your application.'}</p>
        {successEmailDelivery === 'sent' || successEmailDelivery === 'already-sent'
          ? <p>{bn ? 'নিশ্চিতকরণ ইমেইল পাঠানো হয়েছে:' : 'A confirmation email has been sent to:'} <strong>{applicantEmail}</strong></p>
          : <p>{bn ? 'নিশ্চিতকরণ ইমেইলটি পাঠানোর জন্য অপেক্ষমাণ।' : 'Your confirmation email is queued and will be sent when mail delivery is available.'}</p>}
        <p>{bn ? 'রেফারেন্স নম্বর:' : 'Application reference:'} <strong>{successRef}</strong></p>
      </div>
      <button className="sf-btn sf-btn--secondary" type="button" onClick={() => { setSuccessRef(''); setApplicantEmail('') }}>{bn ? 'আরেকটি আবেদন' : 'Submit another application'}</button>
    </div> : <form className="sf-job-application-form" noValidate onSubmit={(event) => void submit(event)}>
      {formConfig.fields.map((field) => {
        const value = values[field.id]
        const label = bn && field.labelBn ? field.labelBn : field.labelEn
        const placeholder = bn && field.placeholderBn ? field.placeholderBn : field.placeholderEn
        const selectPlaceholder = bn && field.selectPlaceholderBn ? field.selectPlaceholderBn : field.selectPlaceholderEn
        const wide = field.type === 'textarea' || field.type === 'resume'
        const fieldError = fieldErrors[field.id]

        if (field.type === 'resume') {
          const resumeInputId = `job-resume-${jobSlug}`
          return <div key={field.id} className={`sf-job-field sf-job-field--wide ${fieldError ? 'has-error' : ''}`}>
            <span className="sf-job-label">{label} {field.required && <b>*</b>}</span>
            <label className="sf-job-file" htmlFor={resumeInputId}>
              <UploadCloud size={21} aria-hidden="true" />
              <span><strong>{file ? file.name : (placeholder || label)}</strong>{file && <small>{(file.size / 1024).toFixed(0)} KB</small>}</span>
              <input
                id={resumeInputId}
                type="file"
                accept="application/pdf,.pdf"
                aria-invalid={Boolean(fieldError)}
                aria-required={field.required}
                aria-describedby={fieldError ? `${resumeInputId}-error` : undefined}
                onChange={(event) => {
                  const next = event.target.files?.[0] || null
                  const message = validateResume(field, next, bn)
                  setError('')
                  setFile(next)
                  setResumeToken('')
                  setFieldErrors((current) => {
                    const copy = { ...current }
                    if (message) copy[field.id] = message
                    else delete copy[field.id]
                    return copy
                  })
                }}
              />
            </label>
            {fieldError && <small id={`${resumeInputId}-error`} className="sf-job-help" role="alert">{fieldError}</small>}
          </div>
        }

        const domId = fieldDomId(jobSlug, field.id)
        const a11y = {
          id: domId,
          'aria-invalid': Boolean(fieldError),
          'aria-required': field.required,
          'aria-describedby': fieldError ? `${domId}-error` : undefined,
          onBlur: () => blurField(field),
        }

        return <label key={field.id} className={`sf-job-field ${wide ? 'sf-job-field--wide' : ''} ${fieldError ? 'has-error' : ''}`} htmlFor={domId}>
          <span>{label} {field.required && <b>*</b>}</span>
          {field.type === 'textarea'
            ? <textarea {...a11y} rows={4} maxLength={field.maxLength} value={String(value ?? '')} placeholder={placeholder} onChange={(event) => updateValue(field, event.target.value)} />
            : field.type === 'select'
              ? <select {...a11y} className="ui-select" value={String(value ?? '')} onChange={(event) => updateValue(field, event.target.value)}>
                  <option value="">{selectPlaceholder || ''}</option>
                  {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              : field.type === 'checkbox'
                ? <input {...a11y} type="checkbox" checked={Boolean(value)} onChange={(event) => updateValue(field, event.target.checked)} />
                : <input
                    {...a11y}
                    type={field.type}
                    maxLength={field.type === 'number' || field.type === 'date' ? undefined : field.maxLength}
                    min={field.type === 'number' ? field.min : undefined}
                    max={field.type === 'number' ? field.max : undefined}
                    value={String(value ?? '')}
                    placeholder={placeholder}
                    onChange={(event) => updateValue(field, event.target.value)}
                  />}
          {field.maxLength && field.type !== 'number' && <small className="sf-job-help">{String(value ?? '').length}/{field.maxLength}</small>}
          {fieldError && <small id={`${domId}-error`} className="sf-job-help" role="alert">{fieldError}</small>}
        </label>
      })}
      <label className="sf-job-honeypot" aria-hidden="true" tabIndex={-1}>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></label>
      {error && <div className="sf-job-application-error sf-job-field--wide" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span></div>}
      <div className="sf-job-application-footer sf-job-field--wide">
        <p>{bn ? 'আপনার জমা দেওয়া তথ্য গোপনীয়ভাবে সংরক্ষণ করা হবে এবং নিয়োগ-প্রক্রিয়ার অনুমোদিত কর্মীদের জন্যই উপলব্ধ থাকবে।' : 'Your submitted information is stored privately and is available only to authorized recruitment administrators.'}</p>
        <button className="sf-btn sf-btn--primary" type="submit" disabled={submitting || uploading}>{submitting ? <><LoaderCircle size={16} className="sf-job-spinner" aria-hidden="true" /> {uploading ? (bn ? 'ফাইল আপলোড হচ্ছে…' : 'Uploading file…') : (bn ? 'আবেদন জমা হচ্ছে…' : 'Submitting application…')}</> : submitLabel}</button>
      </div>
    </form>}
  </section>
}