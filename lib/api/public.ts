import type { ExternalValue, JsonObject } from '@/types/json'
import type { NavGroup, NavItem, UIContent } from '@/types/entityType'
import type { PublicSiteSnapshot } from '@/types/site'
import type { WebsiteEssentials } from '@/lib/websiteEssentials'
import type { JobApplicationFormConfig } from '@/lib/jobApplicationForm'
import type { JobApplicationProcessConfig } from '@/lib/jobApplicationProcess'
import { request } from './http'

/** Public-site requests (forms, tracking, session, page snapshot). */
export const getSessionProfile = () => request<{ user?: JsonObject }>('/api/auth/me', { cache: 'no-store' })
export const getPageSnapshot = (slug: string, signal?: AbortSignal) => request<{ canonicalSlug: string; page: PublicSiteSnapshot['page']; notFound: boolean; jobApplicationProcess?: JobApplicationProcessConfig }>(`/api/site?slug=${encodeURIComponent(slug)}&view=page`, { cache: 'no-store', signal })

/** Full public snapshot used to hydrate the site shell after navigating out of the CMS. */
export const getSiteSnapshot = (slug: string, signal?: AbortSignal) => request<PublicSiteSnapshot>(`/api/site?slug=${encodeURIComponent(slug)}`, { cache: 'no-store', signal })

/** Live CMS navigation; this endpoint intentionally bypasses browser and CDN caches. */
export const getNavigationSnapshot = (signal?: AbortSignal) => request<{ primaryNav: NavItem[]; navGroups: NavGroup[]; ui?: UIContent }>('/api/navigation', { cache: 'no-store', signal })
export const getWebsiteEssentials = (signal?: AbortSignal) => request<WebsiteEssentials>('/api/website-essentials', { cache: 'no-store', signal })
export const getPublicJobApplicationForm = (signal?: AbortSignal) => request<JobApplicationFormConfig>('/api/jobs/application-form', { cache: 'default', signal })

export const startGoogleAuth = (payload: ExternalValue) => request<JsonObject>('/api/auth/start', { method: 'POST', json: payload })
export const requestEmailCode = (email: string) => request<JsonObject>('/api/auth/email', { method: 'POST', json: { action: 'request', purpose: 'enquiry', email } })
export const verifyEmailCode = (payload: ExternalValue) => request<JsonObject>('/api/auth/email', { method: 'POST', json: { action: 'verify', purpose: 'enquiry', ...(payload as object) } })
export const submitQuery = (payload: ExternalValue) => request<JsonObject>('/api/queries', { method: 'POST', json: payload })


export const trackVisit = (visitorId: string, path: string, referrer?: string) =>
  request('/api/visitors', { method: 'POST', json: { visitorId, path, referrer }, keepalive: true }).catch(() => undefined)
export const initiateDonation = (payload: ExternalValue, idempotencyKey: string) => request<JsonObject>('/api/donations/initiate', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, json: payload })
export const uploadJobResume = (file: File, website = '') => {
  const form = new FormData()
  form.append('resume', file)
  form.append('website', website)
  return request<{ ok?: boolean; resumeToken?: string; fileName?: string; sizeBytes?: number; expiresInMinutes?: number; error?: string }>('/api/jobs/resume', { method: 'POST', body: form, cache: 'no-store' })
}

export const applyForJob = (payload: { jobSlug: string; jobRouteParent: string; resumeToken?: string; website?: string; customFields?: Record<string, string | number | boolean> }) => request<{ ok?: boolean; reference?: string; error?: string; fields?: Record<string, string>; emailDelivery?: 'sent' | 'queued' | 'already-sent' | 'not-configured' | 'queue-error' }>('/api/jobs/apply', { method: 'POST', json: payload, cache: 'no-store' })
