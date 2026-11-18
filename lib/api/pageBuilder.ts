import { adminRequest } from './http'
import type { PageData } from '@/types/entityType'

export type PageIndexItem = { slug: string; title: { en: string; bn: string }; subtitle?: { en: string; bn: string }; status: string; sortOrder: number; updatedAt?: string; navigationId?: number; navigationVisible?: boolean }
export type EditablePageResponse = { slug: string; fallback: PageData | null; override: PageData | null; meta?: { updatedAt?: string; status?: string; sortOrder?: number } | null }

export const getPageBuilderIndex = () => adminRequest<{ availablePages: PageIndexItem[] }>('/api/admin/content/index', {}, 'Unable to load the page list.')
export const getEditablePage = (slug: string) => adminRequest<EditablePageResponse>(`/api/admin/content?slug=${encodeURIComponent(slug)}`, {}, 'Unable to load this page.')
export const saveEditablePage = (slug: string, data: PageData, expectedUpdatedAt?: string) => adminRequest<{ ok: boolean }>('/api/admin/content', {
  method: 'PUT',
  json: { scope: 'page', slug, data, ...(expectedUpdatedAt ? { expectedUpdatedAt: new Date(expectedUpdatedAt).toISOString() } : {}) },
}, 'Unable to save this page.')

export const setEditablePageNavigationVisibility = (slug: string, visible: boolean) => adminRequest<{ ok: boolean; visible: boolean }>('/api/admin/content', {
  method: 'PATCH',
  json: { action: 'navigation-visibility', slug, visible },
}, 'Unable to update page visibility.')

export const deleteEditablePage = (slug: string) => adminRequest<{ ok: boolean; menus?: number; pages?: number }>('/api/admin/content', {
  method: 'DELETE',
  json: { slug },
}, 'Unable to delete this page.')
