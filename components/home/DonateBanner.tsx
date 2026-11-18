'use client'

import { Heart } from 'lucide-react'
import type { Lang, PageData } from '@/types/entityType'
import { useSite } from '@/components/containers/SiteProvider'
import Container from '@/components/containers/Container'
import Button from '@/components/ui/ActionButton'
import { plainSectionTitle } from '@/lib/sectionTitle'

type DonateSection = Extract<PageData['sections'][number], { type: 'cta' }>

export default function DonateBanner({ lang, section }: { lang: Lang; section?: DonateSection }) {
  const { site } = useSite()
  const ui = site?.global.ui[lang]
  if (section?.visible === false) return null
  const title = section?.heading?.[lang] || ui?.donateTitle
  const settings = section?.buttonConfig
  const showPrimary = settings ? settings.visible && (settings.mode === 'primary' || settings.mode === 'both') : true
  const showSecondary = settings ? settings.visible && (settings.mode === 'secondary' || settings.mode === 'both') : Boolean(section?.secondary)
  const label = settings?.label?.[lang] || section?.primary?.label?.[lang] || ui?.donate
  const href = settings?.href || section?.primary?.href || '/donate'
  const secondaryLabel = settings?.secondaryLabel?.[lang] || section?.secondary?.label?.[lang]
  const secondaryHref = settings?.secondaryHref || section?.secondary?.href
  const primaryAction = settings?.action
  const secondaryAction = settings?.secondaryAction
  if (!title) return null
  return (
    <section className="sf-donate">
      <Container className="sf-donate-in">
        <div className="sf-donate-copy"><h2 className="sf-h2">{plainSectionTitle(title)}</h2>{section?.body?.[lang] && <p>{section.body[lang]}</p>}</div>
        <div className="sf-cta-actions">
          {showPrimary && label && <Button href={href} action={primaryAction} variant="accent" animated className="sf-btn--lg sf-btn--pulse">
            <Heart size={18} aria-hidden="true" /> {label}
          </Button>}
          {showSecondary && secondaryLabel && secondaryHref && <Button href={secondaryHref} action={secondaryAction} variant="outline-light">{secondaryLabel}</Button>}
        </div>
      </Container>
    </section>
  )
}
