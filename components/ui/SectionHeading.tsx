import type { Bilingual, Lang } from '@/types/entityType'
import { plainSectionTitle } from '@/lib/sectionTitle'

/** Shared bilingual heading for CMS-driven content sections. */
export default function SectionHeading({ eyebrow, heading, lead, lang, className = '' }: { eyebrow?: Bilingual; heading?: Bilingual; lead?: Bilingual; lang: Lang; className?: string }) {
  const eyebrowText = plainSectionTitle(eyebrow?.[lang])
  const headingText = plainSectionTitle(heading?.[lang])
  if (!eyebrowText && !headingText && !lead?.[lang]) return null
  return <header className={`sf-sec-head ${className}`.trim()}>
    {eyebrowText && <span className="sf-eyebrow">{eyebrowText}</span>}
    {headingText && <h2 className="sf-h2">{headingText}</h2>}
    {lead?.[lang] && <p className="sf-lead">{lead[lang]}</p>}
  </header>
}
