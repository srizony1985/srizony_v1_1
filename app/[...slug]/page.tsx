import { notFound, redirect } from 'next/navigation'
import ContentPage from '@/components/pages/ContentPage'
import type { Metadata } from 'next'
import { getCmsMenuIndex, getPublicSiteSnapshot, resolvePagePath } from '@/lib/site'
import { isNavigationPagePath } from '@/lib/cms/routes'

export const dynamic = 'force-dynamic'

const siteUrl = 'https://srizonyfoundation.org.bd'

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const path = '/' + slug.join('/')
  const canonical = resolvePagePath(path)
  const snapshot = await getPublicSiteSnapshot(canonical)
  const page = snapshot.page
  if (!page) return {}
  const description = page.metaDescription?.en || page.subtitle?.en || `${page.title.en} — Srizony Foundation.`
  return {
    title: page.title.en,
    description,
    alternates: { canonical: `${siteUrl}${canonical === '/' ? '' : canonical}`, languages: { en: `${siteUrl}${canonical === '/' ? '' : canonical}`, bn: `${siteUrl}/bn${canonical === '/' ? '' : canonical}` } },
    openGraph: { title: page.title.en, description, url: `${siteUrl}${canonical === '/' ? '' : canonical}`, type: 'article', images: page.heroImage ? [{ url: page.heroImage }] : undefined },
    twitter: { card: 'summary_large_image', title: page.title.en, description, images: page.heroImage ? [page.heroImage] : undefined },
  }
}

export async function generateStaticParams() {
  const index = await getCmsMenuIndex()
  return index.availablePages.filter((page) => page.slug !== '/' && page.status !== 'draft' && page.status !== 'archived').map((page) => ({ slug: page.slug.slice(1).split('/') }))
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const path = '/' + slug.join('/')
  const canonical = resolvePagePath(path)
  if (canonical !== path) redirect(canonical)
  const snapshot = await getPublicSiteSnapshot(canonical)
  if (snapshot.notFound || !snapshot.page) notFound()
  if (!isNavigationPagePath(canonical, snapshot.global) && !snapshot.page.contentComponent) notFound()
  return <ContentPage slug={canonical} />
}
