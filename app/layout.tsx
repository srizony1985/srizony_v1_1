import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Bengali, Poppins } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import './site-components.css'
import './site-polish.css'
import ToastProvider from '@/components/ui/ToastProvider'
import { SITE_FALLBACKS } from '@/lib/cms/fallback-gateway'
import Link from 'next/link'
import { cookies } from 'next/headers'
import AppShell from '@/components/containers/AppShell'
import { headers } from 'next/headers'
import { getPublicSiteSnapshot } from '@/lib/site'

const defaultIdentity = SITE_FALLBACKS.systemData.siteIdentity

async function readSiteIdentity() {
  try { return (await getPublicSiteSnapshot('/')).global.siteIdentity ?? defaultIdentity }
  catch { return defaultIdentity }
}

const bodyFont = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const displayFont = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' })
const banglaFont = Noto_Sans_Bengali({ subsets: ['bengali'], variable: '--font-bengali', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const identity = await readSiteIdentity()
  const siteUrl = identity.canonicalUrl || defaultIdentity.canonicalUrl
  const logo = identity.logo || defaultIdentity.logo
  const ogImage = identity.ogImage || logo || defaultIdentity.ogImage
  return {
    metadataBase: new URL(siteUrl),
    title: { default: identity.title || identity.name, template: `%s | ${identity.name}` },
    description: identity.description,
    keywords: identity.keywords,
    authors: [{ name: identity.name }],
    creator: identity.name,
    publisher: identity.name,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', url: siteUrl, siteName: identity.name, title: identity.title, description: identity.description, images: [{ url: ogImage, width: 1200, height: 630, alt: identity.name }] },
    twitter: { card: 'summary_large_image', title: identity.name, description: identity.description, images: [ogImage] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    icons: { icon: logo, apple: logo },
  }
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

  const identity = initialSite?.global.siteIdentity ?? defaultIdentity
  const organizationLd = {
    '@context':'https://schema.org', '@type':'Organization', name: identity.name, alternateName: identity.alternateName, url: identity.canonicalUrl, logo: identity.logo, foundingDate: identity.foundingDate, email: initialSite?.global.contactInfo?.email || undefined, telephone: initialSite?.global.contactInfo?.primaryPhone || undefined, sameAs:[initialSite?.global.contactInfo?.socials?.linkedin].filter(Boolean)
  }
  return <html lang={initialLang} className={`${bodyFont.variable} ${displayFont.variable} ${banglaFont.variable}`} data-scroll-behavior="smooth" data-theme={theme} data-mode={mode} data-shape={shape}><body><ToastProvider/><Link className="skip-link" href="#main-content">Skip to content</Link><AppShell initialPreferences={{theme: theme as any, mode: mode as any, shape: shape as any, tokens: tokenOverrides}} initialSite={initialSite} initialLang={initialLang}>{children}</AppShell><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(organizationLd)}}/></body></html>
}
