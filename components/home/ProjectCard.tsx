'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Lang } from '@/types/entityType'
import CmsCardIllustration from '@/components/home/CmsCardIllustration'
import type { IllustrationName } from '@/types/entityType'
import Reveal from '@/components/containers/Reveal'
import { useTilt } from '@/components/hooks/useTilt'

export type ProjectArea = {
  href: string
  icon: 'heart' | 'book' | 'users' | 'coins' | 'sprout' | 'store'
  title: { en: string; bn: string }
  body: { en: string; bn: string }
  image: string
  illustration?: IllustrationName
  imageAlt?: { en: string; bn: string }
  chips?: { en: string; bn: string }[]
}

/** Animated SVG development-area card from the original landing-page design. */
export default function ProjectCard({ area, lang, index = 0 }: { area: ProjectArea; lang: Lang; index?: number }) {
  const tilt = useTilt(6)
  return (
    <Reveal delay={index * 90} from="zoom">
      <Link href={area.href} className="sf-area" {...tilt}>
        <span className="sf-area-glow" aria-hidden="true" />
        <div className={`sf-area-art ${area.image ? 'sf-area-art--image' : ''}`}><CmsCardIllustration name={area.illustration ?? area.icon} imageSrc={area.image || undefined} alt={area.imageAlt?.[lang] || area.title[lang]} compact /></div>
        <h3 className="sf-h3">{area.title[lang]}</h3>
        <span className="sf-area-go" aria-hidden="true"><ArrowRight size={18} /></span>
        <p className="sf-area-hint">{area.body[lang]}</p>
        {area.chips?.length ? <ul className="sf-area-chips" aria-label={area.title[lang]}>{area.chips.map((chip, chipIndex) => <li key={chipIndex}>{chip[lang]}</li>)}</ul> : null}
      </Link>
    </Reveal>
  )
}
