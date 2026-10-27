import './Admin.css'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import AdminThemeShell from './AdminThemeShell'
import { getThemeConfig } from '@/lib/site'
import { buildThemeCssVariables, type RuntimeShapeName, type RuntimeThemeMap } from '@/lib/themeRuntime'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const rawMode = cookieStore.get('sf-mode')?.value
  // Keep the CMS on the same default palette/shape as the public site. Only
  // the explicit light/dark preference survives older customization cookies.
  const shape: RuntimeShapeName = 'soft'
  const theme = 'midnight'
  const mode = rawMode === 'light' ? 'light' : 'dark'

  const themeConfig = await getThemeConfig()
  const runtimeThemes = themeConfig.themes as RuntimeThemeMap
  const themeVars = buildThemeCssVariables(runtimeThemes, theme, mode, {}, shape)

  return <AdminThemeShell themeVars={themeVars} themeConfig={runtimeThemes}>{children}</AdminThemeShell>
}
