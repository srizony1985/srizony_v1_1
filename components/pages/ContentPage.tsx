'use client'

import { usePathname } from 'next/navigation'
import { useSite } from '@/components/containers/SiteProvider'
import HomePage from '@/components/home/HomePage'
import PageTemplate from '@/components/pages/PageTemplate'
import LogoLoader from '@/components/ui/LogoLoader'
import StatePage from '@/components/pages/StatePage'

export default function ContentPage({ slug }: { slug: string }) {
  const pathname = usePathname() || slug || '/'
  const { lang, site, loading, error, refresh } = useSite()

  const canonicalPath =
    pathname === '/bn'
      ? '/'
      : pathname.startsWith('/bn/')
        ? pathname.slice(3) || '/'
        : pathname

  if (loading || !site || (site.canonicalSlug !== canonicalPath && !error)) {
    return (
      <LogoLoader
        fullScreen
        size="lg"
        label={
          lang === 'en'
            ? 'Loading content'
            : 'কনটেন্ট লোড হচ্ছে'
        }
      />
    )
  }

  if (error) {
    return <StatePage
      title={lang === 'en' ? 'Page Load Failed' : 'এই পেজটি লোড করা যায়নি'}
      message={error}
      actionLabel={lang === 'en' ? 'Try again' : 'আবার চেষ্টা করুন'}
      onAction={() => void refresh()}
    />
  }

  if (site.notFound || !site.page) {
    return <StatePage
      title={lang === 'en' ? 'Page not found' : 'পেজ পাওয়া যায়নি'}
      message={lang === 'en' ? 'The requested page does not exist or has moved.' : 'অনুরোধ করা পেজটি নেই অথবা সরানো হয়েছে।'}
      actionLabel={lang === 'en' ? 'Back home' : 'হোমে ফিরুন'}
      actionHref="/"
    />
  }

  const page = site.page

  // The route decides which template renders, so navigating back to / never shows the previous page.
  if (canonicalPath === '/') return <HomePage page={page} />
  return <PageTemplate page={page} canonicalPath={canonicalPath} />
}
