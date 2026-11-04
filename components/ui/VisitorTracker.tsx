'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { trackVisit } from '@/lib/api/public'

function visitorId() {
  const key = 'sf-visitor-id'
  try {
    const current = window.localStorage.getItem(key)
    if (current) return current
    const value = crypto.randomUUID()
    window.localStorage.setItem(key, value)
    return value
  } catch {
    return crypto.randomUUID()
  }
}

export default function VisitorTracker() {
  const pathname = usePathname() || '/'
  useEffect(() => {
    // Do not count internal admin navigation as public traffic.
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return
    const id = visitorId()
    // React Strict Mode mounts effects twice in development. A short session
    // guard prevents duplicate writes without suppressing genuine navigation.
    const guardKey = `sf-view:${id}:${pathname}`
    const now = Date.now()
    try {
      const previous = Number(window.sessionStorage.getItem(guardKey) || 0)
      if (previous && now - previous < 2500) return
      window.sessionStorage.setItem(guardKey, String(now))
    } catch {
      // Analytics is best-effort when browser storage is unavailable.
    }
    void trackVisit(id, pathname, document.referrer || undefined)
  }, [pathname])
  return null
}
