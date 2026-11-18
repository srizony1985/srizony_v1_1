import { adminRequest } from './http'
import type { ExternalValue } from '@/types/json'
import type { SiteIdentity } from '@/types/site'
import type { WebsiteEssentials } from '@/lib/websiteEssentials'

export type WebsiteEssentialsResponse = {
  data: WebsiteEssentials
  configured: boolean
}

export type MediaUploadResult = {
  src: string
}

export type CmsPipelinePayload = {
  database: { provider: string; connected: boolean }
  fallback: { gateway: string; runtimeMode: string; identitySource: string }
  identity: SiteIdentity
  identityUpdatedAt: string | null
  domains: Array<{ id: string; label: string; table: string; records: number | null; state: string; href: string }>
}

export type DatabaseImportResult = {
  ok?: boolean
  error?: string
  imported?: Record<string, number | string | null | undefined>
}

export type DatabaseExportError = { error?: string }

/** Read normalized website essentials and its explicit configured-state response header. */
export function getWebsiteEssentials(): Promise<WebsiteEssentialsResponse> {
  return fetch('/api/website-essentials', { cache: 'no-store', credentials: 'same-origin' })
    .then((response) => {
      if (!response.ok) throw new Error('Unable to load website settings.')
      const configured = response.headers.get('X-Website-Essentials-Configured') === 'true'
      return response.json().then((data: WebsiteEssentials) => ({ data, configured }))
    })
}

/** Persist the full website essentials document through the authenticated admin route. */
export function saveWebsiteEssentials(value: ExternalValue): Promise<{ ok?: boolean; data?: WebsiteEssentials }> {
  return adminRequest<{ ok?: boolean; data?: WebsiteEssentials }>('/api/website-essentials', {
    method: 'PUT', json: value,
  }, 'Could not save website essentials.')
}

/** Upload media, parse the response and return only the validated media URL. */
export function uploadAdminMedia(form: FormData): Promise<MediaUploadResult> {
  return adminRequest<{ src?: string }>('/api/admin/media/upload', {
    method: 'POST', body: form,
  }, 'The media upload failed.').then((payload) => {
    if (typeof payload.src !== 'string' || !payload.src) throw new Error('The media upload response did not contain a media URL.')
    return { src: payload.src }
  })
}

export function getCmsPipeline(): Promise<CmsPipelinePayload> {
  return adminRequest<CmsPipelinePayload>('/api/admin/cms-pipeline', {}, 'Unable to inspect the CMS pipeline.')
}

export function saveCmsPipelineIdentity(siteIdentity: SiteIdentity): Promise<{ siteIdentity: SiteIdentity }> {
  return adminRequest<{ siteIdentity: SiteIdentity }>('/api/admin/cms-pipeline', {
    method: 'PUT', json: { siteIdentity: { ...siteIdentity, keywords: siteIdentity.keywords.map((item) => item.trim()).filter(Boolean) } },
  }, 'Unable to save site identity.')
}

export function exportDatabaseJson(): Promise<Blob> {
  return fetch('/api/admin/database/export', { credentials: 'same-origin', cache: 'no-store' })
    .then((response) => response.ok
      ? response.blob()
      : response.json().catch(() => ({})).then((payload: DatabaseExportError) => {
        if (response.status === 401 && typeof window !== 'undefined') window.location.assign('/admin/login')
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Unable to export database data.')
      }))
}

export function importDatabaseJson(rawJson: string): Promise<DatabaseImportResult> {
  return adminRequest<DatabaseImportResult>('/api/admin/database/import', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: rawJson, credentials: 'same-origin',
  }, 'Unable to import database data.')
}
