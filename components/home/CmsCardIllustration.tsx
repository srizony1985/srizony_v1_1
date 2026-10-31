import type { IllustrationName } from '@/types/entityType'
import Illustration from '@/components/home/Illustration'
import SafeImage from '@/components/ui/SafeImage'

/**
 * Shared CMS illustration surface for homepage compositions, standard page cards,
 * development-area cards and compact statistic tiles. A selected media asset takes
 * precedence; otherwise the named reusable SVG illustration is rendered.
 */
export default function CmsCardIllustration({
  name = 'users',
  imageSrc,
  alt,
  compact = false,
}: {
  name?: IllustrationName
  imageSrc?: string
  alt: string
  compact?: boolean
}) {
  return (
    <div className={`cms-card-illustration ${compact ? 'is-compact' : ''} cms-card-illustration--${name}`} role="img" aria-label={alt}>
      {imageSrc
        ? <SafeImage src={imageSrc} alt={alt} fill sizes={compact ? '80px' : '(max-width: 700px) 100vw, 440px'} className="cms-card-illustration-image" />
        : <Illustration name={name} label={alt} />}
    </div>
  )
}
