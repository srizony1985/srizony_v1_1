import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import AdminThemeShell, { type AdminMode } from './AdminThemeShell'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies()
  const mode: AdminMode = cookieStore.get('sf-admin-mode')?.value === 'dark' ? 'dark' : 'light'
  return <AdminThemeShell initialMode={mode}>{children}</AdminThemeShell>
}
