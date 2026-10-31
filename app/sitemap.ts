import type { MetadataRoute } from 'next'
import { getCmsMenuIndex } from '@/lib/site'
import { getPublishedFeed } from '@/lib/cms/content'

const base = 'https://srizonyfoundation.org.bd'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const index = await getCmsMenuIndex()
  const pages = index.availablePages.filter((page) => page.status !== 'draft' && page.status !== 'archived')
  const entries: MetadataRoute.Sitemap = []
  for (const page of pages) {
    const path = page.slug === '/' ? '' : page.slug
    const modified = page.updatedAt ? new Date(page.updatedAt) : undefined
    entries.push({ url: `${base}${path}`, lastModified: modified, changeFrequency: page.slug === '/' ? 'weekly' : 'monthly', priority: page.slug === '/' ? 1 : (page.slug === '/news' || page.slug.startsWith('/news/')) ? 0.8 : 0.6 })
    entries.push({ url: `${base}/bn${path}`, lastModified: modified, changeFrequency: page.slug === '/' ? 'weekly' : 'monthly', priority: page.slug === '/' ? 0.9 : 0.5 })
  }
  // Include database-published News and Success Story detail pages. Their canonical
  // Both collection pages and their detail URLs are canonical root-level routes.
  const routedContent = await getPublishedFeed(['news', 'success-story'], 500)
  for (const item of routedContent) {
    const path = item.href || (item.component === 'news' ? `/news/${item.slug}` : `/success-stories/${item.slug}`)
    const modified = item.date ? new Date(item.date) : undefined
    if (!entries.some((entry) => entry.url === `${base}${path}`)) {
      entries.push({ url: `${base}${path}`, lastModified: modified, changeFrequency: 'monthly', priority: item.component === 'news' ? 0.75 : 0.65 })
    }
    if (!entries.some((entry) => entry.url === `${base}/bn${path}`)) {
      entries.push({ url: `${base}/bn${path}`, lastModified: modified, changeFrequency: 'monthly', priority: 0.55 })
    }
  }
  for (const path of ['/management-staff', '/resources', '/carrer-job']) {
    if (!entries.some((entry) => entry.url === `${base}${path}`)) entries.push({ url: `${base}${path}`, changeFrequency: 'weekly', priority: path === '/carrer-job' ? 0.75 : 0.55 })
    if (!entries.some((entry) => entry.url === `${base}/bn${path}`)) entries.push({ url: `${base}/bn${path}`, changeFrequency: 'weekly', priority: 0.5 })
  }
  return entries
}
