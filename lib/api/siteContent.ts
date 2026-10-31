import { adminRequest } from './http'
import type { ContentComponent, ContentRecord, ContentValues } from '@/lib/cms/components'

export type ContentStatus = ContentRecord['status']
const BASE = '/api/admin/site-content'

export const listContent = async (component: ContentComponent | 'all', q = '') => (await adminRequest<{ items: ContentRecord[] }>(`${BASE}?component=${component}&q=${encodeURIComponent(q)}`, {}, 'Unable to load content.')).items
export const isSlugTaken = async (component: ContentComponent, slug: string, excludeId?: number, routeParent?: string) =>
  (await adminRequest<{ taken: boolean }>(`${BASE}?component=${component}&checkSlug=${encodeURIComponent(slug)}${excludeId ? `&excludeId=${excludeId}` : ''}${routeParent ? `&routeParent=${encodeURIComponent(routeParent)}` : ''}`, {}, 'Unable to validate the slug.')).taken
export const createContent = async (component: ContentComponent, slug: string, values: ContentValues, status: ContentStatus = 'published') => (await adminRequest<{ item: ContentRecord }>(BASE, { method: 'POST', json: { component, slug, values, status } }, 'Unable to create the item.')).item
export const updateContent = async (id: number, slug: string, values: ContentValues, expectedUpdatedAt?: string) => (await adminRequest<{ item: ContentRecord }>(BASE, { method: 'PUT', json: { id, slug, values, expectedUpdatedAt } }, 'Unable to save the item.')).item
export const setContentVisibility = async (id: number, status: ContentStatus) => (await adminRequest<{ item: ContentRecord }>(BASE, { method: 'PATCH', json: { id, status } }, 'Unable to change visibility.')).item
export const deleteContent = (id: number) => adminRequest(`${BASE}?id=${id}`, { method: 'DELETE' }, 'Unable to delete the item.')

/** Bulk actions are deliberately limited to selected IDs from the current CMS view. */
export const hideContentItems = async (ids: number[]) =>
  adminRequest<{ ok: boolean; items: ContentRecord[]; ids: number[]; affected: number }>(BASE, { method: 'PATCH', json: { ids, status: 'hidden' } }, 'Unable to hide the selected items.')
export const deleteContentItems = async (ids: number[]) =>
  adminRequest<{ ok: boolean; ids: number[]; affected: number }>(BASE, { method: 'DELETE', json: { ids } }, 'Unable to delete the selected items.')
