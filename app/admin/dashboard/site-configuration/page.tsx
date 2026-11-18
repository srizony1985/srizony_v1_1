import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/adminAuth'
import SiteConfigurationClient from './SiteConfigurationClient'

export const dynamic = 'force-dynamic'

export default async function SiteConfigurationPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <SiteConfigurationClient role={session.role} />
}
