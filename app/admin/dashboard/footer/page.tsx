import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/adminAuth'
import FooterSettingsView from '../_components/FooterSettingsView'

export const dynamic = 'force-dynamic'

export default async function FooterNavigationPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <FooterSettingsView role={session.role} />
}
