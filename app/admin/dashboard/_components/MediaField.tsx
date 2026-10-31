'use client'

import { normalizeMediaSrc } from '@/lib/mediaUrl'
import { adminMediaUpload } from '@/lib/api/adminResources'
import { useRef, useState } from 'react'
import { LoaderCircle, Trash2, Upload } from 'lucide-react'

type MediaKind = 'image' | 'document'

/** Friendly media control that stores the CMS media URL, never a base64 blob. */
export function MediaField({
  label,
  value,
  onChange,
  disabled = false,
  kind = 'image',
  alt = '',
  helper,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  kind?: MediaKind
  alt?: string
  helper?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function upload(file?: File) {
    if (!file) return
    setError(''); setNotice('')
    if (kind === 'image' && !['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(file.type)) {
      setError('Choose a JPG, PNG, WebP, AVIF or GIF image.'); return
    }
    if (kind === 'document' && file.type !== 'application/pdf') { setError('Choose a PDF file.'); return }
    if (file.size <= 0) { setError('This file is empty.'); return }
    if (file.size > 4 * 1024 * 1024) { setError('Files must be 4 MB or smaller.'); return }

    const form = new FormData()
    form.append('file', file)
    form.append('kind', kind)
    form.append('altEn', alt)
    setUploading(true)
    try {
      const response = await adminMediaUpload(form)
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        window.location.assign('/admin/login')
        throw new Error('Your session expired. Sign in and try again.')
      }
      if (!response.ok || !data?.src) {
        const message = data?.error?.message || data?.error || 'The upload failed. Check the media storage setup and try again.'
        throw new Error(typeof message === 'string' ? message : 'The upload failed.')
      }
      onChange(String(data.src))
      setNotice('Upload complete. Save the form to publish this change.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be uploaded.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const isImage = kind === 'image' && !!value && !/\.pdf(?:$|\?)/i.test(value)
  return <div className="cms-media-control">
    <label className="cms-field"><span>{label}</span><input className="ui-input" value={value} disabled={disabled || uploading} onChange={(e) => { onChange(e.target.value); setNotice(''); setError('') }} placeholder={kind === 'image' ? 'Upload an image or paste an /api/media/… or HTTPS URL' : 'Upload a PDF or paste its URL'} /></label>
    {isImage && <div className="cms-media-preview" aria-label={`${label} preview`}><img src={normalizeMediaSrc(value)} alt={alt || label} onError={(e) => { e.currentTarget.style.display = 'none' }} /><span>{value.startsWith('/api/media/') ? 'Uploaded CMS media' : 'Image preview'}</span></div>}
    <div className="cms-media-actions">
      <input ref={inputRef} type="file" hidden accept={kind === 'image' ? 'image/jpeg,image/png,image/webp,image/avif,image/gif' : 'application/pdf'} onChange={(e) => void upload(e.target.files?.[0])} />
      <button type="button" className="ui-button ui-button-outline ui-button-sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>{uploading ? <><LoaderCircle size={14} className="cms-spin" /> Uploading…</> : <><Upload size={14} /> Upload {kind === 'image' ? 'image' : 'PDF'}</>}</button>
      {value && <button type="button" className="ui-button ui-button-outline ui-button-sm" disabled={disabled || uploading} onClick={() => { onChange(''); setError(''); setNotice('') }}><Trash2 size={14} /> Remove</button>}
      <small>Maximum 4 MB. Allowed: {kind === 'image' ? 'JPG, PNG, WebP, AVIF, GIF' : 'PDF'}.</small>
    </div>
    {helper && <small className="cms-media-help">{helper}</small>}
    {notice && <p className="cms-media-success" role="status">{notice}</p>}
    {error && <p className="cms-media-error" role="alert">{error}</p>}
  </div>
}
