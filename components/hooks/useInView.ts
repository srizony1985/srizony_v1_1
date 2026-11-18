'use client'

import { useEffect, useRef, useState } from 'react'

/** Returns a ref and whether the element has entered the viewport. */
export function useInView<T extends Element>(threshold = 0.25, once = true) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(() => {
    if (typeof window === 'undefined') return false

    const prefersReducedMotion = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

    return !('IntersectionObserver' in window) || prefersReducedMotion
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        if (once) io.disconnect()
      } else if (!once) setInView(false)
    }, { threshold })

    io.observe(el)
    return () => io.disconnect()
  }, [threshold, once])

  return [ref, inView] as const
}
