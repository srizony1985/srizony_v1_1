import { adminRequest } from './http'

export type ProviderHealth = {
  mode: 'neon-primary' | 'google-drive-read-only' | 'unavailable'
  note?: string
}

/** Read the authoritative CMS data-provider health from the authenticated admin API. */
export const getAdminProviderHealth = () =>
  adminRequest<ProviderHealth>(
    '/api/admin/data-provider',
    { headers: { Accept: 'application/json' } },
    'Unable to determine data provider health.',
  )
