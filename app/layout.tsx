import type { ColorMode, ShapeName, ThemeName } from '@/types/entityType'
import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_Bengali, Poppins } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import { SITE_FALLBACKS } from '@/lib/cms/fallback-gateway'
import Link from 'next/link'
import { cookies } from 'next/headers'
import AppShell from '@/components/containers/AppShell'
import { headers } from 'next/headers'
import { getPublicSiteSnapshot } from '@/lib/site'
import { getActiveCmsSite, resolveCmsSiteIdentity } from '@/lib/cms/site-config'
import { serializeJsonForHtmlScript } from '@/lib/securityPrimitives.mjs'
import type { SiteIdentity } from '@/types/site'
import { normalizeSharedThemeMode, SHARED_THEME_MODE_COOKIE } from '@/lib/sharedThemeMode'

// SITE_FALLBACKS is intentionally declared `as const`; copy its readonly
// keyword tuple into the mutable runtime SiteIdentity contract.
const defaultIdentity: SiteIdentity = {
  ...SITE_FALLBACKS.systemData.siteIdentity,
  keywords: [...SITE_FALLBACKS.systemData.siteIdentity.keywords],
}

async function readSiteIdentity() {
  let fallback = defaultIdentity
  try { fallback = (await getPublicSiteSnapshot('/')).global.siteIdentity ?? defaultIdentity } catch { /* Use compiled bootstrap identity if the database is unavailable. */ }
  try { return resolveCmsSiteIdentity(await getActiveCmsSite(), fallback) } catch { return fallback }
}

function normalizePublicSiteSnapshot(snapshot: Awaited<ReturnType<typeof getPublicSiteSnapshot>> | null | undefined): Parameters<typeof AppShell>[0]['initialSite'] {
  if (!snapshot) return snapshot
  const siteIdentity = snapshot.global?.siteIdentity
  if (!siteIdentity || !('keywords' in siteIdentity)) return snapshot as unknown as Parameters<typeof AppShell>[0]['initialSite']

  const keywords: string | string[] | null | undefined = siteIdentity.keywords == null
    ? siteIdentity.keywords
    : typeof siteIdentity.keywords === 'string'
      ? siteIdentity.keywords
      : [...siteIdentity.keywords]

  return {
    ...snapshot,
    global: {
      ...snapshot.global,
      siteIdentity: {
        ...siteIdentity,
        keywords,
      },
    },
  } as unknown as Parameters<typeof AppShell>[0]['initialSite']
}

const bodyFont = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const displayFont = Poppins({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' })
const banglaFont = Noto_Sans_Bengali({ subsets: ['bengali'], variable: '--font-bengali', display: 'swap' })

export async function generateMetadata(): Promise<Metadata> {
  const identity = await readSiteIdentity()
  const siteUrl = identity.canonicalUrl
  const logo = identity.logo || defaultIdentity.logo
  const ogImage = identity.ogImage || logo || defaultIdentity.ogImage
  const keywords = identity.keywords == null
    ? identity.keywords
    : typeof identity.keywords === 'string'
      ? identity.keywords
      : [...identity.keywords]
  return {
    ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
    title: { default: identity.title || identity.name, template: `%s | ${identity.name}` },
    description: identity.description,
    keywords,
    authors: [{ name: identity.name }],
    creator: identity.name,
    publisher: identity.name,
    ...(siteUrl ? { alternates: { canonical: '/' } } : {}),
    openGraph: { type: 'website', ...(siteUrl ? { url: siteUrl } : {}), siteName: identity.name, title: identity.title, description: identity.description, ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: identity.name }] } : {}) },
    twitter: { card: 'summary_large_image', title: identity.name, description: identity.description, ...(ogImage ? { images: [ogImage] } : {}) },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
    ...(logo ? { icons: { icon: logo, apple: logo } } : {}),
  }
}

// Browser chrome follows the saved mode (dark by default) using the --sf-bg tokens, instead of an invalid 'transparent' theme colour.
export async function generateViewport(): Promise<Viewport> {
  const mode: ColorMode = normalizeSharedThemeMode(
    (await cookies()).get(SHARED_THEME_MODE_COOKIE)?.value,
  )
  return { themeColor: mode === 'light' ? '#f4f7fa' : '#0b1117', colorScheme: mode, width: 'device-width', initialScale: 1 }
}

export default async function RootLayout({children}:{children:ReactNode}){
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const pathname = requestHeaders.get('x-srizony-pathname') || '/'
  const isBanglaRoute = pathname === '/bn' || pathname.startsWith('/bn/')
  const publicPath = isBanglaRoute ? (pathname.slice(3) || '/') : pathname
  // The saved user preference takes precedence over the optional `/bn` alias.
  // This lets the language switcher keep the current URL stable in both directions.
  const savedLang = cookieStore.get('sf-lang')?.value
  const initialLang = savedLang === 'bn' || savedLang === 'en'
    ? savedLang
    : isBanglaRoute ? 'bn' : 'en'
  let initialSite = pathname.startsWith('/admin') || pathname.startsWith('/api') ? null : normalizePublicSiteSnapshot(await getPublicSiteSnapshot(publicPath))
  if (initialSite) {
    try {
      const configuredSite = await getActiveCmsSite()
      const siteIdentity = resolveCmsSiteIdentity(configuredSite, initialSite.global.siteIdentity)
      initialSite = { ...initialSite, global: { ...initialSite.global, siteIdentity } }
    } catch { /* Public snapshot/fallback remains available during database outages. */ }
  }
  // Public design defaults: Midnight palette, dark mode, and soft geometry.
  // The dark-mode switch can persist an explicit light-mode preference.
  const theme = 'midnight'
  const mode: ColorMode = normalizeSharedThemeMode(
    cookieStore.get(SHARED_THEME_MODE_COOKIE)?.value,
  )
  const shape = 'soft'
  const tokenOverrides: Record<string, string> = {}

  const identity = initialSite?.global.siteIdentity ?? defaultIdentity
  const siteDetails = initialSite?.global.siteIdentity
  const siteSocials = siteDetails && typeof siteDetails === 'object' && 'socials' in siteDetails ? siteDetails.socials : undefined
  const sameAs = Array.from(new Set(
    typeof siteSocials === 'object' && siteSocials !== null
      ? Object.values(siteSocials as Record<string, unknown>)
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      : []
  ))
  const organizationLd = {
    '@context':'https://schema.org', '@type':'Organization', name: identity.name, alternateName: identity.alternateName, url: identity.canonicalUrl, logo: identity.logo, foundingDate: identity.foundingDate, email: siteDetails && 'email' in siteDetails ? siteDetails.email || undefined : undefined, telephone: siteDetails && 'phone' in siteDetails ? siteDetails.phone || undefined : undefined, sameAs
  }
  return <html lang={initialLang} className={`${bodyFont.variable} ${displayFont.variable} ${banglaFont.variable}`} data-scroll-behavior="smooth" data-theme={theme} data-mode={mode} data-shape={shape}><body><Link className="skip-link" href="#main-content">Skip to content</Link><AppShell initialPreferences={{theme: theme as ThemeName, mode, shape: shape as ShapeName, tokens: tokenOverrides}} initialSite={initialSite} initialLang={initialLang}>{children}</AppShell><script type="application/ld+json" dangerouslySetInnerHTML={{__html: serializeJsonForHtmlScript(organizationLd)}}/></body></html>
}
