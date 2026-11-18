import type { JsonObject } from '@/types/json'
import { adminRequest } from './http'

export type PortfolioGlobalResponse = { global: JsonObject; updatedAt?: string }

export const getPortfolioGlobal = () => adminRequest<PortfolioGlobalResponse>('/api/admin/content?scope=global', {}, 'Unable to load the portfolio profile.')
export const savePortfolioGlobal = (data: JsonObject, expectedUpdatedAt?: string) => adminRequest<{ ok: boolean }>('/api/admin/content', {
  method: 'PUT',
  json: { scope: 'global', data, ...(expectedUpdatedAt ? { expectedUpdatedAt: new Date(expectedUpdatedAt).toISOString() } : {}) },
}, 'Unable to save the portfolio profile.')
