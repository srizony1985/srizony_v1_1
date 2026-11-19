import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import AdminThemeShell, { type AdminMode } from './AdminThemeShell'
import { normalizeSharedThemeMode, SHARED_THEME_MODE_COOKIE } from '@/lib/sharedThemeMode'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const mode: AdminMode = normalizeSharedThemeMode(
    cookieStore.get(SHARED_THEME_MODE_COOKIE)?.value,
  )

  return <AdminThemeShell initialMode={mode}>{children}</AdminThemeShell>
}
