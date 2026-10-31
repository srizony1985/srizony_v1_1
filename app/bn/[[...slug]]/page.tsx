import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import ContentPage from '@/components/pages/ContentPage'
import { getCmsMenuIndex, getPublicSiteSnapshot, resolvePagePath } from '@/lib/site'
import { isNavigationPagePath } from '@/lib/cms/routes'

export const dynamic = 'force-dynamic'

const siteUrl = 'https://srizonyfoundation.org.bd'

function canonicalFrom(slug?: string[]) {
  return resolvePagePath(slug?.length ? `/${slug.join('/')}` : '/')
}

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const { slug } = await params
  const canonical = canonicalFrom(slug)
  const snapshot = await getPublicSiteSnapshot(canonical)
  const page = snapshot.page
  if (!page) return {}
  const description = page.metaDescription?.bn || page.subtitle?.bn || `${page.title.bn} — Srizony Foundation.`
  const path = canonical === '/' ? '' : canonical
  return {
    title: page.title.bn,
    description,
    alternates: { canonical: `${siteUrl}/bn${path}`, languages: { en: `${siteUrl}${path}`, bn: `${siteUrl}/bn${path}` } },
    openGraph: { title: page.title.bn, description, url: `${siteUrl}/bn${path}`, type: 'article', images: page.heroImage ? [{ url: page.heroImage }] : undefined },
  }
}

export async function generateStaticParams() {
  const index = await getCmsMenuIndex()
  return [{ slug: undefined }, ...index.availablePages.filter((page) => page.slug !== '/' && page.status !== 'draft' && page.status !== 'archived').map((page) => ({ slug: page.slug.slice(1).split('/') }))]
}

export default async function BanglaSlugPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  const requested = slug?.length ? `/${slug.join('/')}` : '/'
  const canonical = canonicalFrom(slug)
  if (canonical !== requested) redirect(`/bn${canonical === '/' ? '' : canonical}`)
  const snapshot = await getPublicSiteSnapshot(canonical)
  if (snapshot.notFound || !snapshot.page) notFound()
  if (!isNavigationPagePath(canonical, snapshot.global) && !snapshot.page.contentComponent) notFound()
  return <ContentPage slug={canonical} />
}
