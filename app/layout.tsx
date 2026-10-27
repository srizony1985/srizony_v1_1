import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Bengali, Poppins } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import './site-components.css'
import './site-polish.css'
import ToastProvider from '@/components/ui/ToastProvider'
import { images, systemData } from '../data/data'
import Link from 'next/link'
import { cookies } from 'next/headers'
import AppShell from '@/components/containers/AppShell'
import { headers } from 'next/headers'
import { getPublicSiteSnapshot } from '@/lib/site'

const siteUrl = 'https://srizonyfoundation.org.bd'

const bodyFont = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const displayFont = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' })
const banglaFont = Noto_Sans_Bengali({ subsets: ['bengali'], variable: '--font-bengali', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Srizony Foundation | Community Development in Bangladesh', template: '%s | Srizony Foundation' },
  description: 'Srizony Foundation works with marginalized communities in Bangladesh through health, education, livelihoods, microfinance, loans, rights, climate resilience and social development.',
  keywords: ['Srizony Foundation','সৃজনী ফাউন্ডেশন','Bangladesh NGO','microfinance Bangladesh','community development Bangladesh','education','health','livelihood','social development','loans'],
  authors: [{ name: 'Srizony Foundation' }],
  creator: 'Srizony Foundation',
  publisher: 'Srizony Foundation',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: siteUrl, siteName: 'Srizony Foundation', title: 'Srizony Foundation | Community Development in Bangladesh', description: 'Community-centered health, education, livelihoods, microfinance, loans, rights and resilience programs in Bangladesh.', images: [{ url: images.hero.feature, width: 1200, height: 630, alt: 'Srizony Foundation community development' }] },
  twitter: { card: 'summary_large_image', title: 'Srizony Foundation', description: 'Community development, microfinance, loans and social programs in Bangladesh.', images: [images.hero.feature] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: { icon: images.logo, apple: images.logo },
}

export const viewport: Viewport = { themeColor: 'transparent', colorScheme: 'light dark', width: 'device-width', initialScale: 1 }

export default async function RootLayout({children}:{children:ReactNode}){
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-srizony-pathname') || '/'
  const publicPath = pathname.startsWith('/bn') ? (pathname.slice(3) || '/') : pathname
  const initialLang = (pathname === '/bn' || pathname.startsWith('/bn/')) ? 'bn' : (cookieStore.get('sf-lang')?.value === 'bn' ? 'bn' : 'en')
  const initialSite = pathname.startsWith('/admin') || pathname.startsWith('/api') ? null : await getPublicSiteSnapshot(publicPath)
  // Public design defaults: Midnight palette, dark mode, and soft geometry.
  // The dark-mode switch can persist an explicit light-mode preference.
  const rawMode = cookieStore.get('sf-mode')?.value
  const theme = 'midnight'
  const mode = rawMode === 'light' ? 'light' : 'dark'
  const shape = 'soft'
  const tokenOverrides: Record<string, string> = {}

  const organizationLd = {
    '@context':'https://schema.org', '@type':'Organization', name:'Srizony Foundation', alternateName:'সৃজনী ফাউন্ডেশন', url:siteUrl, logo:`${siteUrl}${images.logo}`, foundingDate:'1985', email:'info@srizonyfoundation.org.bd', telephone:systemData.contactInfo?.primaryPhone || '+8802477747270', sameAs:[systemData.contactInfo?.socials?.linkedin].filter(Boolean)
  }
  return <html lang={initialLang} className={`${bodyFont.variable} ${displayFont.variable} ${banglaFont.variable}`} data-scroll-behavior="smooth" data-theme={theme} data-mode={mode} data-shape={shape}><body><ToastProvider/><Link className="skip-link" href="#main-content">Skip to content</Link><AppShell initialPreferences={{theme: theme as any, mode: mode as any, shape: shape as any, tokens: tokenOverrides}} initialSite={initialSite} initialLang={initialLang}>{children}</AppShell><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(organizationLd)}}/></body></html>
}
