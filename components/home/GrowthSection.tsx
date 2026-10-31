'use client'

import Button from '@/components/ui/ActionButton'
import { ArrowRight } from 'lucide-react'
import type { Lang, PageData } from '@/types/entityType'
import Illustration from '@/components/home/Illustration'
import { useInView } from '@/components/hooks/useInView'
import Container from '@/components/containers/Container'
import Stats from '@/components/ui/Stats'

type GrowthSectionData = Extract<PageData['sections'][number], { type: 'stats' }>
const normalizeHeading = (value?: string) => (value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')

export default function GrowthSection({ lang, page }: { lang: Lang; page: PageData }) {
  const section = page.sections.find((item): item is GrowthSectionData => item.type === 'stats' && (item.homeComponent === 'growth' || normalizeHeading(item.heading?.en) === 'growing together'))
  const counters = (Array.isArray(section?.items) ? section.items : []).map((item, index) => {
    const raw = String(item.value ?? '')
    const numeric = raw.replace(/[\s,]/g, '')
    return { id: `home-stat-${index}`, value: /^\d+$/.test(numeric) ? Number(numeric) : raw, label: item.label, note: item.note, icon: item.icon ?? 'users', illustration: item.illustration, image: item.image }
  })
  const eyebrow = section?.eyebrow
  const heading = section?.heading
  const button = section?.buttonConfig
  const [ref, inView] = useInView<HTMLElement>(0.25)
  if (!section || section.visible === false || !heading || !eyebrow) return null
  const isSecondaryOnly = button?.mode === 'secondary'
  const aboutLabel = button?.visible ? (isSecondaryOnly ? (button.secondaryLabel ?? button.label) : button.label) : undefined
  const aboutHref = button?.visible ? (isSecondaryOnly ? (button.secondaryHref ?? button.href) : button.href) : undefined
  const aboutAction = button?.visible ? (isSecondaryOnly ? (button.secondaryAction ?? button.action) : button.action) : 'route'
  const showPrimary = button?.visible && (button.mode === 'primary' || button.mode === 'both')
  const showSecondary = Boolean(button?.visible && button.mode === 'both' && button.secondaryLabel && button.secondaryHref)
  return (
    <section ref={ref} className={`sf-section sf-growth sf-anim ${inView ? 'is-in' : ''}`} aria-labelledby="sf-growth-title">
      <Container className="sf-growth-grid">
        <div className="sf-growth-art"><Illustration kind="growth" label={heading[lang]} year={section?.illustrationYear || '1985'} /></div>
        <div className="sf-growth-copy">
          <span className="sf-eyebrow">{eyebrow[lang]}</span>
          <h2 id="sf-growth-title" className="sf-h2">{heading[lang]}</h2>
          {section?.introBody?.[lang] && <p className="sf-growth-lead">{section.introBody[lang]}</p>}
          <Stats items={counters} lang={lang} animated showIcons className="sf-growth-stats" />
          {button?.visible && <div className="sf-cta-actions">
            {aboutLabel && aboutHref && (showPrimary || isSecondaryOnly) && <Button href={aboutHref} action={aboutAction} variant={button.mode === 'both' ? 'primary' : button.mode === 'secondary' ? 'outline' : 'ghost'}>
              {aboutLabel[lang]} <ArrowRight size={16} aria-hidden="true" />
            </Button>}
            {showSecondary && button?.secondaryLabel && button.secondaryHref && <Button href={button.secondaryHref} action={button.secondaryAction} variant="outline">
              {button.secondaryLabel[lang]}
            </Button>}
          </div>}
        </div>
      </Container>
    </section>
  )
}
