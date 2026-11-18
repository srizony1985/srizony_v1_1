import type { JsonValue } from '@/types/json'
import { NextResponse } from 'next/server'

// The response may be cached by the browser/CDN, but the district source must
// bypass Next.js Data Cache: the ADM2 GeoJSON is larger than its 2 MiB item cap.
// Keep the source URL pinned so a future upstream release cannot silently change
// the district geometry or its attribution metadata.
const DISTRICT_URL = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2_simplified.geojson'
const COUNTRY_URL = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/BGD/ADM0/geoBoundaries-BGD-ADM0_simplified.geojson'

type FetchPolicy =
  | { cache: 'no-store' }
  | { next: { revalidate: number } }

async function getGeoJson(url: string, policy: FetchPolicy): Promise<JsonValue | null> {
  try {
    const response = await fetch(url, policy)
    if (!response.ok) return null
    return await response.json()
  } catch {
    // The map UI has a built-in country-outline fallback when boundary data is
    // unavailable, so a failed upstream request should not break the page.
    return null
  }
}

export async function GET() {
  const [districts, country] = await Promise.all([
    // ADM2 is ~2.25 MB and exceeds the Next.js Data Cache's 2 MiB item limit.
    // no-store skips only Next's internal fetch cache; the API response below
    // still carries shared-cache headers for the browser/CDN.
    getGeoJson(DISTRICT_URL, { cache: 'no-store' }),
    // The smaller national outline remains safe to keep in Next's Data Cache.
    getGeoJson(COUNTRY_URL, { next: { revalidate: 86400 } }),
  ])

  return NextResponse.json(
    { districts, country },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  )
}
