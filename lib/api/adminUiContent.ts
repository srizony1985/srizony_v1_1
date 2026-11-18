import { adminRequest } from './http'

export type UIContentItem = {
  key: string
  valueEn: string
  valueBn: string
  updatedAt?: string
}

export const listUIContent = () =>
  adminRequest<{ items: UIContentItem[] }>('/api/admin/ui-content', {}, 'Unable to load UI content.')

export const saveUIContent = (item: UIContentItem) =>
  adminRequest<{ ok?: boolean; item?: UIContentItem }>('/api/admin/ui-content', {
    method: 'PUT',
    json: item,
  }, 'Unable to save this UI label.')
