import { request } from './http'

/** Public-site requests (forms, tracking, session, page snapshot). */
export const getSessionProfile = () => request<{ user?: any }>('/api/auth/me', { cache: 'no-store' })
export const getPageSnapshot = (slug: string, signal?: AbortSignal) => request<any>(`/api/site?slug=${encodeURIComponent(slug)}&view=page`, { cache: 'no-store', signal })

/** Full public snapshot used to hydrate the site shell after navigating out of the CMS. */
export const getSiteSnapshot = (slug: string, signal?: AbortSignal) => request<any>(`/api/site?slug=${encodeURIComponent(slug)}`, { cache: 'no-store', signal })

/** Live CMS navigation; this endpoint intentionally bypasses browser and CDN caches. */
export const getNavigationSnapshot = (signal?: AbortSignal) => request<{ primaryNav: any[]; navGroups: any[]; ui?: any }>('/api/navigation', { cache: 'no-store', signal })

export const startGoogleAuth = (payload: unknown) => request<any>('/api/auth/start', { method: 'POST', json: payload })
export const requestEmailCode = (email: string) => request<any>('/api/auth/email', { method: 'POST', json: { action: 'request', purpose: 'enquiry', email } })
export const verifyEmailCode = (payload: unknown) => request<any>('/api/auth/email', { method: 'POST', json: { action: 'verify', purpose: 'enquiry', ...(payload as object) } })
export const submitQuery = (payload: unknown) => request<any>('/api/queries', { method: 'POST', json: payload })


export const trackVisit = (visitorId: string, path: string, referrer?: string) =>
  request('/api/visitors', { method: 'POST', json: { visitorId, path, referrer }, keepalive: true }).catch(() => undefined)
export const initiateDonation = (payload: unknown) => request<any>('/api/donations/initiate', { method: 'POST', json: payload })

export const getNews = (limit = 30) => request<{ items: any[] }>(`/api/news?limit=${limit}`)
export const uploadJobResume = (file: File, website = '') => {
  const form = new FormData()
  form.append('resume', file)
  form.append('website', website)
  return request<{ ok?: boolean; resumeToken?: string; fileName?: string; sizeBytes?: number; expiresInMinutes?: number; error?: string }>('/api/jobs/resume', { method: 'POST', body: form, cache: 'no-store' })
}

export const applyForJob = (payload: { jobSlug: string; jobRouteParent: string; name: string; email: string; phone?: string; coverLetter?: string; resumeToken: string; website?: string }) => request<{ ok?: boolean; reference?: string; error?: string; fields?: Record<string, string> }>('/api/jobs/apply', { method: 'POST', json: payload, cache: 'no-store' })
