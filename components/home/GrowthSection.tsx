'use client'

import { useEffect, useRef } from 'react'
import Button from '@/components/ui/ActionButton'
import { ArrowRight } from 'lucide-react'
import type { Lang, PageData } from '@/types/entityType'
import Container from '@/components/containers/Container'
import Stats from '@/components/ui/Stats'
import GrowthTree from './GrowthTree'
import { COUNTERS, GROWTH_INTRO } from '@/data/homeContent'

export type GrowthSectionData = Extract<PageData['sections'][number], { type: 'stats' }>
export const normalizeHeading = (value?: string) => (value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')

export default function GrowthSection({ lang, page }: { lang: Lang; page: PageData }) {
  const section = page.sections.find((item): item is GrowthSectionData => item.type === 'stats' && (item.homeComponent === 'growth' || normalizeHeading(item.heading?.en) === 'growing together'))
  const starterCounters: GrowthSectionData['items'] = COUNTERS.map((counter) => ({ value: String(counter.value), label: counter.label, icon: counter.icon }))
  const sourceItems: GrowthSectionData['items'] = Array.isArray(section?.items)
    ? (section.items.length || section.dataSource === 'manual' ? section.items : starterCounters)
    : starterCounters
  const counters = sourceItems.map((item, index) => {
    const raw = String(item.value ?? '')
    const numeric = raw.replace(/[\s,]/g, '')
    return { id: `home-stat-${index}`, value: /^\d+$/.test(numeric) ? Number(numeric) : raw, label: item.label, note: item.note, icon: item.icon ?? 'users', illustration: item.illustration, image: item.image }
  })
  const eyebrow = section?.eyebrow ?? GROWTH_INTRO.eyebrow
  const heading = section?.heading ?? GROWTH_INTRO.title
  const button = section?.buttonConfig
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      node.classList.add('is-in', 'is-visible')
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) node.classList.add('is-in', 'is-visible')
      else if (node.classList.contains('is-in')) node.classList.remove('is-visible')
    }, { threshold: 0.15 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  if (!section || section.visible === false) return null
  const isSecondaryOnly = button?.mode === 'secondary'
  const aboutLabel = button?.visible ? (isSecondaryOnly ? (button.secondaryLabel ?? button.label) : button.label) : undefined
  const aboutHref = button?.visible ? (isSecondaryOnly ? (button.secondaryHref ?? button.href) : button.href) : undefined
  const aboutAction = button?.visible ? (isSecondaryOnly ? (button.secondaryAction ?? button.action) : button.action) : 'route'
  const showPrimary = button?.visible && (button.mode === 'primary' || button.mode === 'both')
  const showSecondary = Boolean(button?.visible && button.mode === 'both' && button.secondaryLabel && button.secondaryHref)
  return (
    <section ref={ref} className="sf-section sf-growth sf-anim" aria-labelledby="sf-growth-title">
      <Container className="sf-growth">
        <GrowthTree lang={lang} page={page}/>
        <div className="sf-growth-copy">
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
