import { adminRequest } from './http'
import type { Section } from '@/types/entityType'

export type MenuType = 'page' | 'external' | 'folder'
export type SectionButtonType = 'none' | 'primary' | 'secondary' | 'both'
export type NavNode = { id: number; parentId?: number | null; labelEn: string; labelBn: string; slug: string; isLandingPage?: boolean; renderedComponents: Section['type'][]; menuType: MenuType; visible: boolean; sectionCount: number; sectionContentType: Section['type']; sectionButtonType: SectionButtonType; children: NavNode[] }
export type NavGroup = { id: number; key: string; labelEn: string; labelBn: string; landingId: number; items: NavNode[] }
export type MenuInput = { labelEn: string; labelBn: string; slug: string; renderedComponents: Section['type'][]; menuType: MenuType; sectionCount: number; sectionContentType: Section['type']; sectionButtonType: SectionButtonType }
export type MoveNode = { id: number; children?: MoveNode[] }

export const getNavigation = async () => (await adminRequest<{ groups: NavGroup[] }>('/api/admin/navigation', {}, 'Unable to load navigation.')).groups
export const addMenu = (groupKey: string, parentId: number, input: MenuInput) => adminRequest('/api/admin/navigation', { method: 'POST', json: { groupKey, parentId, ...input } }, 'Unable to add the menu.')
export const modifyMenu = (id: number, input: MenuInput) => adminRequest('/api/admin/navigation', { method: 'PUT', json: { id, ...input } }, 'Unable to modify the menu.')
export const removeMenu = (id: number) => adminRequest<{ menus: number; pages: number }>(`/api/admin/navigation?id=${id}`, { method: 'DELETE' }, 'Unable to remove the menu.')
export const saveMenuOrder = (groupKey: string, tree: MoveNode[]) => adminRequest('/api/admin/navigation', { method: 'PATCH', json: { groupKey, tree } }, 'Unable to save the new order.')

export const setNavigationVisibility = (id: number, visible: boolean) => adminRequest('/api/admin/navigation', { method: 'PATCH', json: { action: 'visibility', id, visible } }, 'Unable to change menu visibility.')
