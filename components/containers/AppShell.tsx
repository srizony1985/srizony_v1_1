'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import SiteProvider from '@/components/containers/SiteProvider'
import type { PublicSiteSnapshot } from '@/types/site'
import type { Lang } from '@/types/entityType'
import NavBar from '@/components/ui/NavBar'
import Footer from '@/components/ui/Footer'
import BackToTop from '@/components/ui/BackToTop'
import VisitorTracker from '@/components/ui/VisitorTracker'

export default function AppShell({ children, initialPreferences, initialSite, initialLang }: { children: ReactNode; initialPreferences?: { theme: any; mode: any; shape: any; tokens?: Record<string, string> }; initialSite?: PublicSiteSnapshot | null; initialLang?: Lang }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')

  if (isAdmin) {
    return <>{children}</>
  }

  return (
    <SiteProvider initialPreferences={initialPreferences} initialSite={initialSite} initialLang={initialLang}>
      <NavBar />
      <VisitorTracker />
      <BackToTop />
      <main id="main-content" className="sf-main">{children}</main>
      <Footer />
    </SiteProvider>
  )
}
