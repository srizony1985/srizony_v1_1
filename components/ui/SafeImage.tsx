'use client'

import Image, { type ImageProps } from 'next/image'
import { ImageOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { normalizeMediaSrc } from '@/lib/mediaUrl'

export type SafeImageProps = Omit<ImageProps, 'alt' | 'src'> & {
  src: string
  alt: string
  fallbackTitle?: string
  fallbackSrc?: string
}

export default function SafeImage({ alt, fallbackTitle, fallbackSrc, src, onError, ...props }: SafeImageProps) {
  const title = fallbackTitle || alt || 'Community image'
  const candidates = useMemo(() => [...new Set([normalizeMediaSrc(src), normalizeMediaSrc(fallbackSrc)].filter((value): value is string => Boolean(value?.trim())))], [src, fallbackSrc])
  const [candidateIndex, setCandidateIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  // Reset the fallback chain when a card is reused for new CMS content.
  useEffect(() => {
    setCandidateIndex(0)
    setFailed(false)
  }, [src, fallbackSrc])

  const currentSrc = candidates[Math.min(candidateIndex, Math.max(candidates.length - 1, 0))]

  if (failed || !currentSrc) {
    return <div className="image-fallback" role="img" aria-label={`${title} — image unavailable`}><div className="image-fallback-icon"><ImageOff size={24}/></div><strong>{title}</strong><span>Image unavailable</span></div>
  }

  const isRemote = /^https?:\/\//i.test(currentSrc)

  // CMS can contain images from storage/CDN hosts that are not statically
  // listed in next.config.ts. Serve external URLs directly so Next's image
  // optimizer cannot reject valid content from an unlisted host.
  return <Image {...props} src={currentSrc} alt={alt} unoptimized={isRemote} onError={(event) => {
    if (candidateIndex < candidates.length - 1) setCandidateIndex((i) => i + 1)
    else { setFailed(true); onError?.(event) }
  }}/>
}
