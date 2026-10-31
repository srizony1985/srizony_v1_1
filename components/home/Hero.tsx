'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type {
  HeroData,
  HeroSlide,
  Lang,
  PageData,
} from '@/types/entityType'
import SafeImage from '@/components/ui/SafeImage'
import ConfiguredLink from '@/components/ui/ConfiguredLink'
import Container from '@/components/containers/Container'

const MAX_VISIBLE_DOTS = 3
const DEFAULT_AUTOPLAY_INTERVAL = 6500
const MIN_AUTOPLAY_INTERVAL = 4500
const SWIPE_THRESHOLD = 50

type HeroProps = {
  hero: HeroData
  lang: Lang
  slidesOverride?: HeroSlide[]
  tone?: PageData['heroTone']
}

export default function Hero({
  hero,
  lang,
  slidesOverride,
  tone = 'green',
}: HeroProps) {
  // An explicitly empty CMS list is intentional.
  // Never restore bundled slides when the CMS provides [].
  const slideSource = slidesOverride !== undefined
    ? slidesOverride
    : (hero.slides ?? [])

  // Slides arrive already normalized by the database gateway. Images and slide
  // copy are CMS content, not client-side defaults from the data directory.
  const slides = useMemo(() => slideSource, [slideSource])

  const count = slides.length

  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  const heroRef = useRef<HTMLElement | null>(null)
  const touchX = useRef<number | null>(null)

  const tr = (en: string, bn: string) =>
    lang === 'en' ? en : bn

  // Keep the index valid when the CMS changes the slide list.
  const activeIndex = count > 0 ? index % count : 0
  const activeSlide = count > 0 ? slides[activeIndex] : undefined

  const go = useCallback(
    (nextIndex: number) => {
      if (!count) return

      setIndex(((nextIndex % count) + count) % count)
    },
    [count],
  )

  // Reset the active slide when the number of slides changes.
  useEffect(() => {
    setIndex((current) =>
      count > 0 ? current % count : 0,
    )
  }, [count])

  const actionFor = (href: string): 'route' | 'external' | 'anchor' => {
    if (/^https?:\/\//i.test(href)) return 'external'
    if (href.includes('#')) return 'anchor'
    return 'route'
  }

  // Autoplay respects user preference, reduced motion,
  // hover pause, and browser tab visibility.
  useEffect(() => {
    if (count < 2 || paused || hero.autoplay === false) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const raw = hero.autoplayInterval ?? DEFAULT_AUTOPLAY_INTERVAL
    const interval = Math.max(
      MIN_AUTOPLAY_INTERVAL,
      raw < 100 ? raw * 1000 : raw,
    )

    const timer = window.setInterval(() => {
      if (document.hidden) return
      setIndex((current) => (current + 1) % count)
    }, interval)

    return () => window.clearInterval(timer)
  }, [count, paused, hero.autoplay, hero.autoplayInterval])

  // Gentle background parallax, disabled for reduced motion.
  useEffect(() => {
    const element = heroRef.current

    if (
      !element ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    let frame = 0

    const onScroll = () => {
      if (frame) return

      frame = window.requestAnimationFrame(() => {
        frame = 0

        element.style.setProperty(
          '--py',
          `${Math.min(window.scrollY, 900) * 0.25}px`,
        )
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)

      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  // Display at most five pagination dots, centered around
  // the active slide whenever possible.
  const visibleDots = useMemo(() => {
    const dotCount = Math.min(count, MAX_VISIBLE_DOTS)

    if (dotCount === 0) return []

    const start = Math.max(
      0,
      Math.min(
        activeIndex - Math.floor(dotCount / 2),
        count - dotCount,
      ),
    )

    return Array.from(
      { length: dotCount },
      (_, offset) => start + offset,
    )
  }, [activeIndex, count])

  const handleTouchEnd = (
    event: React.TouchEvent<HTMLElement>,
  ) => {
    const startX = touchX.current
    touchX.current = null

    if (startX === null) return

    const endX = event.changedTouches[0]?.clientX
    if (endX === undefined) return

    const delta = endX - startX

    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      go(activeIndex + (delta < 0 ? 1 : -1))
    }
  }

  if (!count) return null

  const controls = count > 1 && (
    <div
      className="sf-hero-ctrl"
      role="group"
      aria-label={tr('Slide controls', 'স্লাইড নিয়ন্ত্রণ')}
    >
      <button
        type="button"
        onClick={() => go(activeIndex - 1)}
        aria-label={tr('Previous photo', 'আগের ছবি')}
      >
        <ChevronLeft size={20} />
      </button>

      <div className="sf-hero-dots">
        {visibleDots.map((slideIndex) => {
          const slide = slides[slideIndex]

          return (
            <button
              key={slide.id}
              type="button"
              className={slideIndex === activeIndex ? 'is-on' : ''}
              onClick={() => go(slideIndex)}
              aria-label={`${tr('Photo', 'ছবি')} ${slideIndex + 1}`}
              aria-current={
                slideIndex === activeIndex ? 'true' : undefined
              }
            />
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => go(activeIndex + 1)}
        aria-label={tr('Next photo', 'পরের ছবি')}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  )

  return (
    <section
      ref={heroRef}
      className={`sf-hero sf-hero--tone-${tone ?? 'green'}`}
      aria-roledescription="carousel"
      aria-label={tr('Photo gallery', 'ছবির গ্যালারি')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPaused(false)
        }
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={handleTouchEnd}
    >
      <div className="sf-hero-slides">
        {slides.map((slide, slideIndex) => {
          const isActive = slideIndex === activeIndex
          const isNear =
            isActive ||
            slideIndex === (activeIndex + 1) % count ||
            slideIndex === (activeIndex - 1 + count) % count

          return (
            <div
              key={slide.id}
              className={`sf-hero-slide ${isActive ? 'is-on' : ''}`}
              aria-hidden={!isActive}
            >
              {isNear && (
                <SafeImage
                  src={slide.image}
                  alt={
                    isActive
                      ? slide.alt?.[lang] ?? slide.title?.[lang] ?? ''
                      : ''
                  }
                  fill
                  sizes="100vw"
                  priority={slideIndex === 0}
                  className="sf-cover"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="sf-hero-shade" />

      {hero.copyVisible !== false && hero.copyRemoved !== true && (
        <div className="sf-hero-body">
          <Container className="sf-hero-content">
            {hero.eyebrow?.[lang] && (
              <span className="sf-hero-eyebrow">
                {hero.eyebrow[lang]}
              </span>
            )}

            {(hero.headingLineOne?.[lang] ||
              hero.headingLineTwo?.[lang]) && (
              <h1 className="sf-hero-title">
                {hero.headingLineOne?.[lang] && (
                  <span>{hero.headingLineOne[lang]}</span>
                )}
                {hero.headingLineTwo?.[lang] && (
                  <span>{hero.headingLineTwo[lang]}</span>
                )}
              </h1>
            )}

            {hero.description?.[lang] && (
              <p className="sf-hero-lead">
                {hero.description[lang]}
              </p>
            )}

            <div className="sf-hero-actions">
              {hero.primaryAction?.label?.[lang] &&
                hero.primaryAction.href && (
                  <ConfiguredLink
                    href={hero.primaryAction.href}
                    action={actionFor(hero.primaryAction.href)}
                    className="sf-btn sf-btn--primary"
                  >
                    {hero.primaryAction.label[lang]}
                  </ConfiguredLink>
                )}

              {hero.secondaryAction?.label?.[lang] &&
                hero.secondaryAction.href && (
                  <ConfiguredLink
                    href={hero.secondaryAction.href}
                    action={actionFor(hero.secondaryAction.href)}
                    className="sf-btn sf-btn--outline"
                  >
                    {hero.secondaryAction.label[lang]}
                  </ConfiguredLink>
                )}
            </div>
          </Container>
        </div>
      )}

      {activeSlide &&
        (activeSlide.title?.[lang] ||
          activeSlide.description?.[lang]) && (
          <div className="sf-hero-bar">
            <Container className="sf-hero-bar-in">
              {activeSlide.href ? (
                <ConfiguredLink
                  href={activeSlide.href}
                  action={actionFor(activeSlide.href)}
                  className="sf-hero-caption"
                >
                  {activeSlide.description?.[lang] && (
                    <small>{activeSlide.description[lang]}</small>
                  )}
                  {activeSlide.title?.[lang] && (
                    <strong>{activeSlide.title[lang]}</strong>
                  )}
                </ConfiguredLink>
              ) : (
                <div className="sf-hero-caption">
                  {activeSlide.description?.[lang] && (
                    <small>{activeSlide.description[lang]}</small>
                  )}
                  {activeSlide.title?.[lang] && (
                    <strong>{activeSlide.title[lang]}</strong>
                  )}
                </div>
              )}

              {controls}
            </Container>
          </div>
        )}

      {!(
        activeSlide?.title?.[lang] ||
        activeSlide?.description?.[lang]
      ) && controls}

      <span className="sf-hero-scroll" aria-hidden="true">
        <i />
      </span>
    </section>
  )
}