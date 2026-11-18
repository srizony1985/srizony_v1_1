'use client'

import { useEffect, useState } from 'react'
import { DEFAULT_WEBSITE_ESSENTIALS, normalizeWebsiteEssentials, type WebsiteEssentials } from '@/lib/websiteEssentials'
import { getWebsiteEssentials } from '@/lib/api/public'

const TTL = 60_000
let cached: { at: number; request: Promise<WebsiteEssentials> } | null = null

/** One shared request for every public consumer (nav, footer, staff, documents, map); refreshed after a minute. */
const load = () => {
  if (!cached || Date.now() - cached.at > TTL) {
    const request = getWebsiteEssentials().then((response) => {
      if (!response.ok) throw new Error('website essentials unavailable')
      return normalizeWebsiteEssentials(response.data)
    })
      .then((essentials) => {
        if (cached?.request === request) cached = { at: Date.now(), request: Promise.resolve(essentials) }
        return essentials
      })
    request.catch(() => { if (cached?.request === request) cached = null })
    // Keep the in-flight promise immediately so concurrent consumers coalesce;
    // move the TTL anchor to completion rather than penalizing slow responses.
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
