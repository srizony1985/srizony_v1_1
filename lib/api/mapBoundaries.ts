import { request } from './http'
import type { ExternalValue } from '@/types/json'

export type MapBoundariesResponse = {
  districts?: ExternalValue
  country?: ExternalValue
}

/** Cached same-origin boundary data. Network details stay out of the UI component. */
export async function getMapBoundaries(signal?: AbortSignal): Promise<MapBoundariesResponse> {
  const result = await request<MapBoundariesResponse>('/api/map-boundaries', {
    signal,
    cache: 'force-cache',
  })
  if (!result.ok) throw new Error(`Boundary request failed: ${result.status}`)
  return result.data
}
