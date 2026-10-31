'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertCircle, CheckCircle2, FileText, LoaderCircle, UploadCloud } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import { applyForJob, uploadJobResume } from '@/lib/api/public'
import { messageOf } from '@/lib/api/http'
import { MAX_RESUME_BYTES } from '@/lib/jobApplicationValidation'

export default function JobApplicationForm({ jobSlug, jobRouteParent }: { jobSlug: string; jobRouteParent: string }) {
  const { lang } = useSite()
  const bn = lang === 'bn'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [coverLetter, setCoverLetter] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [resumeToken, setResumeToken] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successRef, setSuccessRef] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccessRef('')
    if (!file) { setError(bn ? 'আবেদন করার আগে PDF জীবনবৃত্তান্ত সংযুক্ত করুন।' : 'Please attach your resume as a PDF before submitting.'); return }
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) { setError(bn ? 'শুধু PDF ফাইল গ্রহণ করা হয়।' : 'Only PDF files are accepted.'); return }
    if (file.size <= 0 || file.size > MAX_RESUME_BYTES) { setError(bn ? 'PDF ফাইলের আকার ৪ MB বা কম হতে হবে।' : 'The PDF must be 4 MB or smaller.'); return }

    setSubmitting(true)
    setUploading(true)
    try {
      let token = resumeToken
      if (!token) {
        const upload = await uploadJobResume(file, honeypot)
        if (!upload.ok || !upload.data?.resumeToken) throw new Error(messageOf(upload.data, bn ? 'জীবনবৃত্তান্ত আপলোড করা যায়নি।' : 'Unable to upload your resume.'))
        token = upload.data.resumeToken
        setResumeToken(token)
      }
      setUploading(false)
      const response = await applyForJob({ jobSlug, jobRouteParent, name, email, phone, coverLetter, resumeToken: token, website: honeypot })
      if (!response.ok || !response.data?.ok || !response.data?.reference) {
        const message = messageOf(response.data, bn ? 'আবেদন জমা দেওয়া যায়নি।' : 'Unable to submit the application.')
        if (response.status === 410 || /expired|already used/i.test(message)) setResumeToken('')
        throw new Error(message)
      }
      setSuccessRef(response.data.reference)
      setName(''); setEmail(''); setPhone(''); setCoverLetter(''); setFile(null); setResumeToken(''); setHoneypot('')
      const input = document.getElementById(`job-resume-${jobSlug}`) as HTMLInputElement | null
      if (input) input.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (bn ? 'আবেদন জমা দেওয়া যায়নি। আবার চেষ্টা করুন।' : 'Application could not be submitted. Please try again.'))
    } finally { setUploading(false); setSubmitting(false) }
  }

  return <section className="sf-block sf-job-application" aria-labelledby="sf-job-application-title">
    <div className="sf-sec-head">
      <p className="sf-eyebrow">{bn ? 'চাকরির আবেদন' : 'JOB APPLICATION'}</p>
      <h2 id="sf-job-application-title" className="sf-h2">{bn ? 'এই পদে আবেদন করুন' : 'Apply for this position'}</h2>
      <p className="sf-body">{bn ? 'আপনার তথ্য পূরণ করুন এবং PDF ফরম্যাটে জীবনবৃত্তান্ত সংযুক্ত করুন।' : 'Complete the form below and attach your resume in PDF format.'}</p>
    </div>

    {successRef ? <div className="sf-job-application-success" role="status" aria-live="polite">
      <CheckCircle2 size={24} aria-hidden="true" />
      <div><h3>{bn ? 'আপনার আবেদন জমা হয়েছে' : 'Application submitted successfully'}</h3><p>{bn ? 'আপনার রেফারেন্স নম্বর:' : 'Your reference number:'} <strong>{successRef}</strong></p><p>{bn ? 'এই নম্বরটি সংরক্ষণ করুন।' : 'Please keep this reference for your records.'}</p></div>
      <button className="sf-btn sf-btn--secondary" type="button" onClick={() => setSuccessRef('')}>{bn ? 'আরেকটি আবেদন' : 'Submit another application'}</button>
    </div> : <form className="sf-job-application-form" onSubmit={(event) => void submit(event)}>
      <label className="sf-job-field"><span>{bn ? 'পূর্ণ নাম' : 'Full name'} <b>*</b></span><input autoComplete="name" required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder={bn ? 'আপনার পূর্ণ নাম লিখুন' : 'Enter your full name'} /></label>
      <label className="sf-job-field"><span>{bn ? 'ইমেইল ঠিকানা' : 'Email address'} <b>*</b></span><input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
      <label className="sf-job-field"><span>{bn ? 'ফোন নম্বর' : 'Phone number'} <small>{bn ? '(ঐচ্ছিক)' : '(optional)'}</small></span><input type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={bn ? '+৮৮০ ১XXX-XXXXXX' : '+880 1XXX-XXXXXX'} /></label>
      <label className="sf-job-field sf-job-field--wide"><span>{bn ? 'আবেদনের বক্তব্য' : 'Cover letter'} <small>{bn ? '(ঐচ্ছিক)' : '(optional)'}</small></span><textarea rows={5} maxLength={5000} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder={bn ? 'এই পদের জন্য আপনার যোগ্যতা সংক্ষেপে লিখুন…' : 'Briefly describe your qualifications for this role…'} /><small className="sf-job-help">{coverLetter.length}/5000</small></label>
      <div className="sf-job-field sf-job-field--wide">
        <span className="sf-job-label">{bn ? 'জীবনবৃত্তান্ত (PDF)' : 'Resume / CV (PDF)'} <b>*</b></span>
        <label className="sf-job-file" htmlFor={`job-resume-${jobSlug}`}>
          <UploadCloud size={21} aria-hidden="true" />
          <span><strong>{file ? file.name : (bn ? 'PDF ফাইল নির্বাচন করুন' : 'Choose your PDF resume')}</strong><small>{file ? `${(file.size / 1024).toFixed(0)} KB` : (bn ? 'সর্বোচ্চ ৪ MB · PDF ফরম্যাট' : 'Maximum 4 MB · PDF format only')}</small></span>
          <input id={`job-resume-${jobSlug}`} type="file" accept="application/pdf,.pdf" required onChange={(event) => { setError(''); setFile(event.target.files?.[0] || null); setResumeToken('') }} />
        </label>
        {file && <p className="sf-job-help"><FileText size={14} aria-hidden="true" /> {bn ? 'ফাইল নির্বাচিত হয়েছে। এটি নিরাপদে আপলোড করা হবে।' : 'File selected. It will be uploaded privately during submission.'}</p>}
      </div>
      <label className="sf-job-honeypot" aria-hidden="true" tabIndex={-1}>Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} /></label>
      {error && <div className="sf-job-application-error sf-job-field--wide" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span></div>}
      <div className="sf-job-application-footer sf-job-field--wide"><p>{bn ? 'আপনার জীবনবৃত্তান্ত গোপনীয়ভাবে সংরক্ষণ করা হবে এবং নিয়োগ-প্রক্রিয়ার অনুমোদিত কর্মীদের জন্যই উপলব্ধ থাকবে।' : 'Your resume is stored privately and is available only to authorized recruitment administrators.'}</p>
        <button className="sf-btn sf-btn--primary" type="submit" disabled={submitting || uploading}>{submitting ? <><LoaderCircle size={16} className="sf-job-spinner" aria-hidden="true" /> {uploading ? (bn ? 'জীবনবৃত্তান্ত আপলোড হচ্ছে…' : 'Uploading resume…') : (bn ? 'আবেদন জমা হচ্ছে…' : 'Submitting application…')}</> : (bn ? 'আবেদন জমা দিন' : 'Submit application')}</button>
      </div>
    </form>}
  </section>
}
