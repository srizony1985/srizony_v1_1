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

export const getNewsletterStatus = (email: string, signal?: AbortSignal) => request<{ status: any; unsubscribeUrl?: string }>(`/api/newsletter?email=${encodeURIComponent(email)}`, { cache: 'no-store', signal })
export const requestNewsletterCode = (email: string) => request<any>('/api/newsletter', { method: 'POST', json: { action: 'request', email } })
export const confirmNewsletter = (email: string, code: string) => request<any>('/api/newsletter', { method: 'POST', json: { action: 'confirm', email, code, consent: true } })

export const trackVisit = (visitorId: string, path: string, referrer?: string) =>
  request('/api/visitors', { method: 'POST', json: { visitorId, path, referrer }, keepalive: true }).catch(() => undefined)
export const initiateDonation = (payload: unknown) => request<any>('/api/donations/initiate', { method: 'POST', json: payload })

export const getNews = (limit = 30) => request<{ items: any[] }>(`/api/news?limit=${limit}`)
export const applyForJob = (payload: { jobSlug: string; name: string; email: string; phone?: string; coverLetter?: string; resumeUrl?: string }) => request('/api/jobs/apply', { method: 'POST', json: payload })
