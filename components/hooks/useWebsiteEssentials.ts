'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_WEBSITE_ESSENTIALS, normalizeWebsiteEssentials, type WebsiteEssentials } from '@/lib/websiteEssentials'

const TTL = 60_000
let cached: { at: number; request: Promise<WebsiteEssentials> } | null = null

/** One shared request for every public consumer (nav, footer, staff, documents, map); refreshed after a minute. */
const load = () => {
  if (!cached || Date.now() - cached.at > TTL) {
    const request = fetch('/api/website-essentials', { cache: 'no-store' })
      .then((response) => { if (!response.ok) throw new Error('website essentials unavailable'); return response.json() })
      .then(normalizeWebsiteEssentials)
    request.catch(() => { if (cached?.request === request) cached = null })
    cached = { at: Date.now(), request }
  }
  return cached.request
}

export function useWebsiteEssentials() {
  const [state, setState] = useState({ essentials: DEFAULT_WEBSITE_ESSENTIALS, loading: true, failed: false })
  useEffect(() => {
    let live = true
    load().then((essentials) => live && setState({ essentials, loading: false, failed: false }))
      .catch(() => live && setState((current) => ({ ...current, loading: false, failed: true })))
    return () => { live = false }
  }, [])
  return state
}
