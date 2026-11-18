import type { MetadataRoute } from 'next'
import { getActiveCmsSite } from '@/lib/cms/site-config'
import { getPublicSiteSnapshot } from '@/lib/site'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getActiveCmsSite().catch(() => null)
  const fallback = site?.siteKey === 'default' ? await getPublicSiteSnapshot('/').catch(() => null) : null
  const base = String(site?.baseUrl || site?.identity?.canonicalUrl || fallback?.global?.siteIdentity?.canonicalUrl || '').replace(/\/$/, '')
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    ...(base && /^https?:\/\//i.test(base) ? { sitemap: `${base}/sitemap.xml` } : {}),
  }
}
