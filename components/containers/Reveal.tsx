'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

export default function Reveal({ children, delay = 0, from = 'up', className = '' }: {
  children: ReactNode
  delay?: number
  from?: 'up' | 'left' | 'right' | 'zoom'
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      node.classList.add('is-in', 'is-visible')
      return
    }
    // One observer handles both the one-time reveal and ongoing visibility.
    // This avoids a React re-render and pauses off-screen SVG animation loops.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) node.classList.add('is-in', 'is-visible')
      else if (node.classList.contains('is-in')) node.classList.remove('is-visible')
    }, { threshold: 0.15 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return <div ref={ref} className={`sf-reveal sf-reveal--${from} ${className}`.trim()} style={{ '--d': `${delay}ms` } as CSSProperties}>{children}</div>
}
