import { adminRequest } from './http'
import type { ExternalValue } from '@/types/json'
import type { FooterConfig } from '@/lib/footerConfig'
import type { NavGroupTree } from '@/lib/cms/navigation'

export const getAdminNavigationTree = () =>
  adminRequest<{ groups?: NavGroupTree[] }>('/api/admin/navigation', {}, 'Unable to load navigation.')

export const getAdminFooterConfig = () =>
  adminRequest<{ footer?: ExternalValue }>('/api/admin/footer', {}, 'Unable to load footer settings.')

export const saveAdminFooterConfig = (footer: FooterConfig) =>
  adminRequest<{ footer?: ExternalValue }>('/api/admin/footer', {
    method: 'PUT',
    json: { footer: footer as unknown as Record<string, unknown> },
  }, 'Unable to save footer settings.')
