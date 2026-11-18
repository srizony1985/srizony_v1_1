'use client'

import { Input } from '@/components/ui/input'

import Image from 'next/image'
import { normalizeMediaSrc } from '@/lib/mediaUrl'
import { uploadAdminMedia } from '@/lib/api/adminResources'
import { useRef, useState } from 'react'
import { LoaderCircle, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

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

  function upload(file?: File) {
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
    void uploadAdminMedia(form)
      .then((result) => {
        if (!result.src) throw new Error('The upload failed. Check the media storage setup and try again.')
        onChange(result.src)
        setNotice('Upload complete. Save the form to publish this change.')
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'The file could not be uploaded.'))
      .finally(() => {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      })
  }

  const isImage = kind === 'image' && !!value && !/\.pdf(?:$|\?)/i.test(value)
  return <div className="cms-media-control [display:grid] [gap:7px] [min-width:0] [&>.cms-field]:[min-width:0]">
    <label className="cms-field [display:flex] [flex-direction:column] [gap:6px] [font-size:0.875rem] [&_>_span]:[font-weight:600] [&_b]:[color:var(--destructive)] [&_input:disabled]:[opacity:1] [&_input:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_input:disabled]:[cursor:default] [&_textarea:disabled]:[opacity:1] [&_textarea:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_textarea:disabled]:[cursor:default] [&_select:disabled]:[opacity:1] [&_select:disabled]:[background:color-mix(in_srgb,_var(--card)_94%,_var(--muted-foreground))] [&_select:disabled]:[cursor:default]"><span>{label}</span><Input value={value} disabled={disabled || uploading} onChange={(e) => { onChange(e.target.value); setNotice(''); setError('') }} placeholder={kind === 'image' ? 'Upload an image or paste an /api/media/… or HTTPS URL' : 'Upload a PDF or paste its URL'} /></label>
    {isImage && <div className="cms-media-preview [display:grid] [grid-template-columns:minmax(80px,160px)_minmax(0,1fr)] [align-items:center] [gap:10px] [max-width:520px] [padding:8px] [border:1px_solid_var(--border)] [border-radius:var(--radius,_var(--radius))] [background:var(--muted)] [min-width:0] [&_img]:[display:block] [&_img]:[width:100%] [&_img]:[height:84px] [&_img]:[object-fit:contain] [&_img]:[border-radius:var(--radius-small,_var(--radius))] [&_img]:[background:var(--card)] [&_span]:[font-size:0.75rem] [&_span]:[color:var(--muted-foreground)] [&_span]:[overflow-wrap:anywhere] max-[700px]:[grid-template-columns:minmax(0,110px)_minmax(0,1fr)]" aria-label={`${label} preview`}>
      {/* CMS URLs may point to tenant-configured storage hosts. Use a native img here
          so the admin preview does not depend on the Next.js image optimizer allowlist. */}
      <Image src={normalizeMediaSrc(value)} alt={alt || label} width={200} height={200} loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      <span>{value.startsWith('/api/media/') ? 'Uploaded CMS media' : 'Image preview'}</span>
    </div>}
    <div className="cms-media-actions [display:flex] [align-items:center] [gap:7px] [flex-wrap:wrap] [&_small]:[font-size:0.75rem] [&_small]:[line-height:1.4] [&_small]:[color:var(--muted-foreground)]">
      <input ref={inputRef} type="file" hidden accept={kind === 'image' ? 'image/jpeg,image/png,image/webp,image/avif,image/gif' : 'application/pdf'} onChange={(e) => void upload(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>{uploading ? <><LoaderCircle size={14} className="cms-spin" /> Uploading…</> : <><Upload size={14} /> Upload {kind === 'image' ? 'image' : 'PDF'}</>}</Button>
      {value && <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => { onChange(''); setError(''); setNotice('') }}><Trash2 size={14} /> Remove</Button>}
      <small>Maximum 4 MB. Allowed: {kind === 'image' ? 'JPG, PNG, WebP, AVIF, GIF' : 'PDF'}.</small>
    </div>
    {helper && <small className="cms-media-help [font-size:0.75rem] [line-height:1.4] [color:var(--muted-foreground)]">{helper}</small>}
    {notice && <p className="cms-media-success [margin:0] [font-size:0.875rem] [line-height:1.5] [color:var(--success)]" role="status">{notice}</p>}
    {error && <p className="cms-media-error [margin:0] [font-size:0.875rem] [line-height:1.5] [color:var(--destructive)]" role="alert">{error}</p>}
  </div>
}
