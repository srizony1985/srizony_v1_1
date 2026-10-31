'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { localizeDigits } from '@/lib/utils'
import type { Lang, PageData } from '@/types/entityType'
import CmsCardIllustration from '@/components/home/CmsCardIllustration'
import type { IllustrationName } from '@/types/entityType'
import SectionActions from '@/components/ui/SectionActions'

type MissionSection = Extract<PageData['sections'][number], { type: 'cards' }>
const normalizeHeading = (value?: string) => (value ?? '').trim().toLocaleLowerCase().replace(/[\s_-]+/g, ' ')

export default function MissionVisionValues({ lang, page }: { lang: Lang; page: PageData }) {
  const source = page.sections.find((item): item is MissionSection => item.type === 'cards' && (item.homeComponent === 'missionVisionValues' || normalizeHeading(item.heading?.en) === 'mission, vision & values'))
  const sourceItems = Array.isArray(source?.items) ? source.items : []
  const steps = sourceItems.map((item, i) => ({
    id: item.illustration || 'area',
    stepKey: `cms-step-${i}`,
    illustration: item.illustration ?? (i === 0 ? 'mission' : i === 1 ? 'vision' : 'values'),
    image: item.image?.src,
    kicker: item.title,
    body: item.body ?? { en: '', bn: '' },
    chips: Array.isArray(item.chips) ? item.chips : item.tag ? [item.tag] : [],
  }))
  const intro = { eyebrow: source?.eyebrow, title: source?.heading }
  const wrapRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [index, setIndex] = useState(0)
  const [seen, setSeen] = useState(false)
  const count = Math.max(steps.length, 1)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = wrapRef.current
      const stage = stageRef.current
      if (!el || !stage) return
      const stick = parseFloat(getComputedStyle(stage).top) || 0
      const stageH = stage.offsetHeight || window.innerHeight - stick
      const r = el.getBoundingClientRect()
      const p = Math.min(Math.max((stick - r.top) / stageH, 0), count - 1)
      el.style.setProperty('--sp', p.toFixed(3))
      setIndex(Math.round(p))
      if (r.top < window.innerHeight * 0.6) setSeen(true)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [count])

  const jumpTo = useCallback((i: number) => {
    const el = wrapRef.current
    const stage = stageRef.current
    if (!el || !stage) return
    const stick = parseFloat(getComputedStyle(stage).top) || 0
    const stageH = stage.offsetHeight
    const top = window.scrollY + el.getBoundingClientRect().top - stick + i * stageH + 2
    window.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [])

  if (!source || source.visible === false || !intro.title || !intro.eyebrow || !steps.length) return null

  return (
    <section className="sf-story" ref={wrapRef} style={{ '--steps': count } as CSSProperties} aria-label={intro.title[lang]}>
      <div ref={stageRef} className={`sf-story-stage ${seen ? 'is-seen' : ''}`} data-step={index}>
        <div className="sf-story-bg" aria-hidden="true">
          <span className="sf-story-blob sf-story-blob--a" />
          <span className="sf-story-blob sf-story-blob--b" />
        </div>

        <div className="sf-container sf-story-inner">
          <header className="sf-story-head">
            <span className="sf-eyebrow">{intro.eyebrow[lang]}</span>
            <h2 className="sf-h2">{intro.title[lang]}</h2>
          </header>

          <div className="sf-story-grid">
            <div className="sf-story-art" aria-hidden="false">
              {steps.map((step, i) => {
                const state = i === index ? 'is-active' : i < index ? 'is-past' : 'is-next'
                return (
                  <div key={step.stepKey} className={`sf-story-panel ${state}`}>
                    <CmsCardIllustration name={step.illustration as IllustrationName} imageSrc={step.image} alt={step.kicker[lang]} />
                  </div>
                )
              })}
            </div>

            <div className="sf-story-copy" aria-live="polite">
              {steps.map((step, i) => {
                const state = i === index ? 'is-active' : i < index ? 'is-past' : 'is-next'
                return (
                  <div key={step.stepKey} className={`sf-story-text ${state} backdrop-blur-2xl rounded-lg`} aria-hidden={i !== index}>
                    <span className="sf-story-num">{localizeDigits(`0${i + 1}`, lang)}</span>
                    <h3 className="sf-h2 sf-story-title">{step.kicker[lang]}</h3>
                    <p className="sf-story-body">{step.body[lang]}</p>
                  </div>
                )
              })}
            </div>

            <nav className="sf-story-rail" aria-label={intro.title[lang]}>
              {steps.map((step, i) => (
                <button
                  key={step.stepKey}
                  type="button"
                  className={i === index ? 'is-on' : i < index ? 'is-done' : ''}
                  onClick={() => jumpTo(i)}
                  aria-label={step.kicker[lang]}
                  aria-current={i === index ? 'step' : undefined}
                >
                  <span className="sf-rail-dot" />
                  <span className="sf-rail-label">{step.kicker[lang]}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
      <SectionActions config={source?.buttonConfig} lang={lang} arrow className="sf-home-section-actions" />
    </section>
  )
}
