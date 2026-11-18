import { adminRequest } from './http'
import type { ThemeTypographyScopedSettings } from '@/lib/themeTypography'

export type ThemeTypographyApiResponse = {
  typography?: ThemeTypographyScopedSettings
  error?: string
  readOnly?: boolean
  dataSource?: string
}

export const getThemeTypography = () =>
  adminRequest<ThemeTypographyApiResponse>(
    '/api/admin/theme/typography',
    {},
    'Unable to load site typography settings.',
  )

export const saveThemeTypography = (typography: ThemeTypographyScopedSettings) =>
  adminRequest<ThemeTypographyApiResponse>(
    '/api/admin/theme/typography',
    { method: 'PUT', json: { typography } },
    'Unable to save site typography settings.',
  )
