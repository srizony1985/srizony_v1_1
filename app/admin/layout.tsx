import './Admin.css'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import AdminThemeShell from './AdminThemeShell'
import { getThemeConfig } from '@/lib/site'
import { buildThemeCssVariables, type RuntimeShapeName, type RuntimeThemeMap } from '@/lib/themeRuntime'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const rawMode = cookieStore.get('sf-admin-mode')?.value
  const mode = rawMode === 'dark' ? 'dark' : 'light'
  const shape: RuntimeShapeName = 'soft'
  const themeConfig = await getThemeConfig()
  const runtimeThemes = themeConfig.themes as RuntimeThemeMap
  const theme = runtimeThemes.midnight ? 'midnight' : Object.keys(runtimeThemes)[0] || 'forest'
  const themeVars = buildThemeCssVariables(runtimeThemes, theme, mode, {}, shape)

  return <AdminThemeShell themeVars={themeVars} themeConfig={runtimeThemes} initialMode={mode}>{children}</AdminThemeShell>
}
