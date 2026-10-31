'use client'

import Link from 'next/link'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lang, PageData } from '@/types/entityType'
import { useInView } from '@/components/hooks/useInView'
import Reveal from '@/components/containers/Reveal'
import Container from '@/components/containers/Container'
import SafeImage from '@/components/ui/SafeImage'
import Button from '@/components/ui/ActionButton'

type CarouselSection = Extract<PageData['sections'][number], { type: 'carousel' }>

export default function NewsRail({ page, lang }: { page: PageData; lang: Lang }) {
  const carousels = page.sections.filter((s): s is CarouselSection => s.type === 'carousel')
  // The landing News Rail is populated only from published News records. Success Stories have
  // their own CMS collection page and must never be rendered in this rail.
  const source = carousels.find((s) => (s.homeComponent === 'news' || s.homeComponent === 'stories' || s.homeComponent === 'newsFeed') && s.collectionKind === 'news')
  const maxItems = Math.max(2, Math.min(12, Number(source?.maxItems ?? 8) || 8))
  const items = Array.isArray(source?.items) ? source.items.slice(0, maxItems) : []
  const loop = items.length > 1
  const button = source?.buttonConfig
  const newsHref = '/news'
  const configuredNewsLabel = button?.label
  const newsLabel = configuredNewsLabel && /success|story|stories|সাফল্য|গল্প/i.test(`${configuredNewsLabel.en} ${configuredNewsLabel.bn}`)
    ? { en: 'View all news', bn: 'সব সংবাদ দেখুন' }
    : configuredNewsLabel ?? { en: 'View all news', bn: 'সব সংবাদ দেখুন' }
  const newsSecondaryHref = button?.secondaryHref?.startsWith('/news') ? button.secondaryHref : undefined
  const newsSecondaryLabel = newsSecondaryHref ? button?.secondaryLabel : undefined
  const showNewsButton = Boolean(button?.visible && (button.mode === 'primary' || button.mode === 'both'))
  const showNewsSecondaryButton = Boolean(button?.visible && (button.mode === 'secondary' || button.mode === 'both') && newsSecondaryLabel && newsSecondaryHref)
  const viewRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [sectionRef, inView] = useInView<HTMLElement>(0.05, false)

  // Motion state lives in refs so the animation loop never re-renders React.
  const st = useRef({ x: 0, v: 0, hold: 0, dragging: false, dragged: false, startX: 0, lastX: 0, lastT: 0, tween: null as null | { from: number; to: number; t0: number; dur: number } })

  const setWidth = () => {
    const kids = trackRef.current?.children
    if (!kids || kids.length < items.length * 2) return 0
    return (kids[items.length] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft
  }

  // One continuous loop: slow drift + swipe inertia + button tween, wrapped seamlessly.
  useEffect(() => {
    if (!loop || !inView) return
    const track = trackRef.current
    if (!track) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const SPEED = 38 // px per second
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const w = setWidth()
      const m = st.current
      if (w) {
        if (m.tween) {
          const p = Math.min((now - m.tween.t0) / m.tween.dur, 1)
          m.x = m.tween.from + (m.tween.to - m.tween.from) * (1 - Math.pow(1 - p, 3))
          if (p >= 1) m.tween = null
        } else if (!m.dragging) {
          if (Math.abs(m.v) > 8) {
            m.x += m.v * dt
            m.v *= Math.pow(0.04, dt)
          } else {
            m.v = 0
            if (!reduce && now > m.hold && !document.hidden) m.x += SPEED * dt
          }
        }
        m.x = ((m.x % w) + w) % w
        track.style.transform = `translate3d(${-m.x}px,0,0)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [loop, inView, items.length])

  const holdFor = (ms: number) => { st.current.hold = performance.now() + ms }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!loop || (e.pointerType === 'mouse' && e.button !== 0)) return
    const m = st.current
    m.dragging = true
    m.dragged = false
    m.tween = null
    m.v = 0
    m.startX = m.lastX = e.clientX
    m.lastT = performance.now()
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const m = st.current
    if (!m.dragging) return
    if (!m.dragged && Math.abs(e.clientX - m.startX) > 6) {
      m.dragged = true
      try { viewRef.current?.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    if (!m.dragged) return
    const now = performance.now()
    const dx = e.clientX - m.lastX
    m.x -= dx
    m.v = (-dx / Math.max(now - m.lastT, 1)) * 1000
    m.lastX = e.clientX
    m.lastT = now
  }
  const endDrag = () => {
    const m = st.current
    if (!m.dragging) return
    m.dragging = false
    if (performance.now() - m.lastT > 90) m.v = 0
    holdFor(2200)
  }

  const stepBy = (dir: 1 | -1) => {
    const kid = trackRef.current?.firstElementChild as HTMLElement | null
    if (!kid) return
    const gap = parseFloat(getComputedStyle(trackRef.current!).columnGap) || 16
    const m = st.current
    m.v = 0
    m.tween = { from: m.x, to: m.x + dir * (kid.offsetWidth + gap), t0: performance.now(), dur: 650 }
    holdFor(2800)
  }

  if (source?.visible === false || !source?.heading) return null
  const intro = { eyebrow: source.eyebrow, title: source.heading, body: source.body }
  const sets = loop ? [0, 1, 2] : [0]

  return (
    <section ref={sectionRef} className="sf-section sf-news-rail" aria-labelledby="sf-news-rail-title">
      <Container>
        <Reveal>
          <header className="sf-sec-head sf-sec-head--center">
            <span className="sf-eyebrow">{intro.eyebrow?.[lang]}</span>
            <h2 id="sf-news-rail-title" className="sf-h2">{intro.title[lang]}</h2>
            {intro.body?.[lang] && <p className="sf-lead sf-news-rail-lead">{intro.body[lang]}</p>}
          </header>
        </Reveal>
      </Container>
      {items.length > 0 ? <div className="sf-rail-wrap">
        <div
          ref={viewRef}
          className={`sf-rail ${loop ? 'is-loop' : ''}`}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') st.current.hold = Infinity }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') holdFor(300) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(e) => { if (st.current.dragged) { e.preventDefault(); e.stopPropagation(); st.current.dragged = false } }}
          onDragStart={(e) => e.preventDefault()}
          role="region"
          aria-label={intro.title[lang]}
        >
          <div ref={trackRef} className="sf-rail-track">
            {sets.map((setIndex) =>
              items.map((item, i) => {
                const image = item.image
                const hidden = loop && setIndex !== 0
                const inner = <>
                  {image?.src && <SafeImage src={image.src} alt={hidden ? '' : image.alt?.[lang] ?? ''} fill sizes="(max-width: 700px) 70vw, 300px" className="sf-cover" />}
                  <span className="sf-tile-shade" aria-hidden="true" />
                  <div className="sf-tile-text">
                    {item.tag && <span className="sf-chip sf-chip--float">{item.tag[lang]}</span>}
                    <h3>{item.title[lang]}</h3>
                    {item.body?.[lang] && <p className="sf-tile-desc">{item.body[lang]}</p>}
                  </div>
                </>
                const key = `${setIndex}-${i}`
                return item.href ? (
                  <Link key={key} href={item.href} draggable={false} className="sf-photo-tile" aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined} onFocus={() => { st.current.hold = Infinity }} onBlur={() => holdFor(600)}>{inner}</Link>
                ) : (
                  <article key={key} className="sf-photo-tile" aria-hidden={hidden || undefined}>{inner}</article>
                )
              }),
            )}
          </div>
        </div>
      </div> : <Container><div className="sf-news-rail-empty" role="status">{lang === 'en' ? 'News updates will appear here when published.' : 'সংবাদ প্রকাশিত হলে এখানে দেখা যাবে।'}</div></Container>}
      {items.length > 0 && <Container>
        <div className="sf-rail-actions sf-rail-actions--center">
          <button type="button" className="sf-round-btn" onClick={() => stepBy(-1)} aria-label={lang === 'en' ? 'Previous news' : 'আগের সংবাদ'}><ChevronLeft size={20} /></button>
          {showNewsButton && newsLabel?.[lang] && <Button href={newsHref} action="route" variant="ghost">
            {newsLabel[lang]} <ArrowRight size={16} aria-hidden="true" />
          </Button>}
          {showNewsSecondaryButton && newsSecondaryHref && newsSecondaryLabel?.[lang] && <Button href={newsSecondaryHref} action={button?.secondaryAction ?? button?.action} variant="outline">
            {newsSecondaryLabel[lang]} <ArrowRight size={16} aria-hidden="true" />
          </Button>}
          <button type="button" className="sf-round-btn" onClick={() => stepBy(1)} aria-label={lang === 'en' ? 'Next news' : 'পরের সংবাদ'}><ChevronRight size={20} /></button>
        </div>
      </Container>}
    </section>
  )
}
