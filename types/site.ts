import type { JsonObject, JsonValue } from '@/types/json'
import type { PortfolioGlobal } from '@/types/portfolio'
import type { Bilingual, ContactInfo, HeroData, NavGroup, NavItem, PageData, ThemeDefinition, UIContent } from '@/types/entityType'
import type { FooterConfig } from '@/lib/footerConfig'
import type { JobApplicationProcessConfig } from '@/lib/jobApplicationProcess'

export type PublicPaymentInfo = { id: string; en: string; bn: string; noteEn: string; noteBn: string; icon: string }
export type SiteIdentity = {
  name: string
  alternateName: string
  canonicalUrl: string
  title: string
  description: string
  keywords: string[]
  foundingDate: string
  logo: string
  ogImage: string
}

export type ImageRegistry = { logo?: string; [key: string]: JsonValue | undefined }

export type CmsPageIndexEntry = { slug: string; title: Bilingual; subtitle?: Bilingual; status: string; sortOrder: number; updatedAt?: string; navigationId?: number; navigationVisible?: boolean }

export type PublicGlobal = {
  siteIdentity: SiteIdentity
  images: ImageRegistry
  themes: Record<string, ThemeDefinition>
  media: JsonObject
  portfolio?: PortfolioGlobal
  homeHero: HeroData
  ui: UIContent
  contactInfo: ContactInfo
  primaryNav: NavItem[]
  navGroups: NavGroup[]
  footer: FooterConfig
  donationInfo: PublicPaymentInfo[]
  SDGsteps: Array<{ n: string; en: string; bn: string; enText: string; bnText: string }>
}

export type PublicSiteSnapshot = {
  global: PublicGlobal
  page: PageData | null
  canonicalSlug: string
  notFound: boolean
  updatedAt?: string | null
  jobApplicationProcess?: JobApplicationProcessConfig
}
