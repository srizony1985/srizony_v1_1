'use client'

import { useEffect, type CSSProperties } from 'react'

import { Briefcase, Building2, Home, Users, BookOpen, CheckCircle2, Coins, Droplets, Heart, Leaf, Megaphone, Scale, ShieldCheck, Sun } from 'lucide-react'
import type { Bilingual, IconName, Lang } from '@/types/entityType'
import { localizeDigits } from '@/lib/utils'
import CmsCardIllustration from '@/components/home/CmsCardIllustration'
import type { IllustrationName, MediaItem } from '@/types/entityType'
import { useInView } from '@/components/hooks/useInView'

type StatIcon = IconName | 'home'
type StatItem = { id?: string; value: string | number; label: Bilingual; note?: Bilingual; icon?: StatIcon; illustration?: IllustrationName; image?: MediaItem }
const ICONS = { users: Users, briefcase: Briefcase, home: Home, building: Building2, heart: Heart, leaf: Leaf, book: BookOpen, scale: Scale, sun: Sun, droplets: Droplets, coins: Coins, megaphone: Megaphone, shield: ShieldCheck, play: CheckCircle2, arrow: CheckCircle2, check: CheckCircle2 } as const

function AnimatedValue({ value, lang }: { value: number; lang: Lang }) {
  const [viewRef, inView] = useInView<HTMLSpanElement>(0.4)

  // Animate the text node directly. Updating React state on every animation frame
  // re-rendered every stat tile at 60 FPS, even though only the number changes.
  useEffect(() => {
    const node = viewRef.current
    if (!node || !inView) return
    const format = (amount: number) => localizeDigits(amount.toLocaleString('en-US'), lang)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.textContent = format(value)
      return
    }

    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 1100, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      node.textContent = format(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, value, lang, viewRef])

  return <span ref={viewRef}>{localizeDigits('0', lang)}</span>
}

/** Consistent stats collection used for both the home story and CMS-managed pages. */
export default function Stats({ items, lang, animated = false, showIcons = false, className = '', style }: {
  items: readonly StatItem[]
  lang: Lang
  animated?: boolean
  showIcons?: boolean
  className?: string
  style?: CSSProperties
}) {
  const listClass = showIcons ? 'sf-tiles' : 'sf-stats-row'
  return (
    <ul className={`${listClass} ${className}`.trim()} style={style}>
      {items.map((item, index) => {
        const Icon = item.icon ? ICONS[item.icon] : null
        const numeric = typeof item.value === 'number' || (typeof item.value === 'string' && /^\d+$/.test(item.value))
        return (
          <li key={item.id ?? `${item.label.en}-${index}`} style={showIcons ? { '--i': index } as CSSProperties : undefined}>
            {showIcons && (item.illustration || item.image?.src)
              ? <span className="sf-tile-illustration"><CmsCardIllustration name={item.illustration ?? 'users'} imageSrc={item.image?.src} alt={item.image?.alt?.[lang] || item.label[lang]} compact /></span>
              : showIcons && Icon && <span className="sf-tile-icon" aria-hidden="true"><Icon size={22} /></span>}
            <strong>{animated && numeric ? <AnimatedValue value={Number(item.value)} lang={lang} /> : localizeDigits(String(item.value), lang)}</strong>
            <span>{item.label[lang]}</span>
            {item.note && <small>{item.note[lang]}</small>}
          </li>
        )
      })}
    </ul>
  )
}
