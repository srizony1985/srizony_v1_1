'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { ChevronRight, Home as HomeIcon } from 'lucide-react'
import type { Bilingual, NavItem, PageData, Section } from '@/types/entityType'
import SafeImage from '@/components/ui/SafeImage'
import { useSite } from '@/components/containers/SiteProvider'
import SectionRenderer from '@/components/pages/SectionRenderer'
import LocationMaps from '@/components/home/LocationMaps'
import JobPostingDetail from '@/components/pages/JobPostingDetail'
import ManagementStaffContent from '@/components/pages/ManagementStaffContent'
import ResourcesContent from '@/components/pages/ResourcesContent'
import Container from '@/components/containers/Container'

type Crumb = { label: Bilingual; href?: string }

const norm = (v?: string) => (v ?? '').toLowerCase().replace(/[\s\u00a0]+/g, ' ').trim()
const sameText = (a?: Bilingual, b?: Bilingual) => Boolean(a && b) && norm(a!.en) === norm(b!.en) && norm(a!.bn) === norm(b!.bn)

/**
 * Remove content the banner already shows, so nothing is presented twice on a page:
 *  - a first-section heading identical to the page title
 *  - a first paragraph that just repeats the subtitle
 *  - sections / cards that are exact repeats of an earlier one
 */
function tidySections(sections: Section[], title: Bilingual, subtitle?: Bilingual): Section[] {
  const seen = new Set<string>()
  const out: Section[] = []
  sections.forEach((section, index) => {
    let s = section as Section & { heading?: Bilingual; body?: Bilingual | Bilingual[]; items?: unknown[] }
    if (index === 0 && s.heading && sameText(s.heading, title)) s = { ...s, heading: undefined } as typeof s
    if (index === 0 && subtitle && Array.isArray(s.body) && s.body[0] && norm(s.body[0].en).startsWith(norm(subtitle.en).slice(0, 60))) {
      s = { ...s, body: s.body.slice(1) } as typeof s
    }
    if (Array.isArray(s.items)) {
      const keys = new Set<string>()
      const unique = (s.items as Array<{ title?: Bilingual; body?: Bilingual }>).filter((it) => {
        const k = `${norm(it.title?.en)}|${norm(it.body?.en)}`
        if (k === '|') return true
        if (keys.has(k)) return false
        keys.add(k)
        return true
      })
      if (unique.length !== s.items.length) s = { ...s, items: unique } as typeof s
    }
    const fingerprint = JSON.stringify(s)
    if (seen.has(fingerprint)) return
    seen.add(fingerprint)
    out.push(s as Section)
  })
  return out
}

/** Strip bundled/demo media from legacy content-detail snapshots; only CMS-selected media is shown. */
function withoutUnmanagedDetailImages(section: Section): Section | null {
  switch (section.type) {
    case 'richText': return { ...section, image: undefined }
    case 'cards': return { ...section, items: section.items.map((item) => ({ ...item, image: undefined })) }
    case 'gallery':
    case 'carousel':
    case 'video': return null
    default: return section
  }
}

/** Finds the page in the one navigation tree; URL-less folders remain breadcrumb labels. */
function findTrail(items: NavItem[], path: string): NavItem[] | null {
  const walk = (nodes: NavItem[], chain: NavItem[]): NavItem[] | null => {
    for (const item of nodes) {
      const next = [...chain, item]
      if (item.menuType !== 'folder' && item.href === path) return next
      const found = item.children ? walk(item.children, next) : null
      if (found) return found
    }
    return null
  }
  return walk(items, [])
}

export default function PageTemplate({ page, canonicalPath, children }: { page: PageData; canonicalPath: string; children?: ReactNode }) {
  const { lang, site } = useSite()
  const isContactPage = `/${page.slug.replace(/^\/+|\/+$/g, '')}` === '/contact'
  const primaryNav = site?.global.primaryNav ?? []
  const ui = site?.global.ui

  const isContentDetail = Boolean(page.contentComponent && page.contentSlug)
  const canShowContentImage = !isContentDetail || page.cmsMediaManaged === true
  const heroImage = isContentDetail && !canShowContentImage ? undefined : page.heroImage
  const sections = useMemo(() => {
    const visible = page.sections.filter((section) => (section as { visible?: boolean }).visible !== false)
    // Page sections are rendered from the persisted CMS document. Never synthesize
    // missing images or section copy from bundled landing-page data.
    const prepared = isContentDetail && !canShowContentImage
      ? visible.map(withoutUnmanagedDetailImages).filter((section): section is Section => section !== null)
      : visible
    return tidySections(prepared, page.title, page.subtitle)
  }, [page, isContentDetail, canShowContentImage, heroImage])
  if (!site || !ui) return null

  const trail = findTrail(primaryNav, canonicalPath)
  const parts = canonicalPath.split('/').filter(Boolean)

  // Breadcrumb shows where you are, not the page title again (the banner already shows it).
  const crumbs: Crumb[] = [{ label: { en: ui.en.home, bn: ui.bn.home }, href: '/' }]
  if (trail) {
    trail.slice(0, -1).filter((item) => item.href !== '/').forEach((item) => crumbs.push({ label: item.label, href: item.menuType === 'folder' ? undefined : item.href }))
  } else if (canonicalPath.startsWith('/enterprise-development/')) {
    crumbs.push({ label: { en: 'Enterprise Development', bn: 'এন্টারপ্রাইজ উন্নয়ন' }, href: '/enterprise-development' })
  } else if (parts.length > 1) {
    const label = parts[0].replace(/-/g, ' ')
    crumbs.push({ label: { en: label, bn: label }, href: `/${parts[0]}` })
  }

  const subtitle = page.subtitle?.[lang]
  const wrapperClass = [
    'sf-page',
    `sf-page--${page.layout || 'standard'}`,
    `sf-page--padding-${page.contentPadding || 'normal'}`,
    page.slug === '/social-development' || page.slug === '/enterprise-development' ? 'social-cards-page' : '',
    page.slug === '/enterprise-development' ? 'enterprise-development-page' : '',
  ].filter(Boolean).join(' ')

  return (
    <Container variant="page" className={wrapperClass}>
      <section className={`sf-banner ${heroImage ? '' : 'sf-banner--plain'}`}>
        {heroImage && <SafeImage src={heroImage} alt="" fill sizes="100vw" priority className="sf-cover" />}
        <div className="sf-banner-shade" />
        <Container className="sf-banner-in">
          <nav className="sf-crumbs" aria-label={lang === 'en' ? 'Breadcrumb' : 'ব্রেডক্রাম্ব'}>
            <ol>
              {crumbs.map((c, i) => (
                <li key={i}>
                  {i === 0 && <HomeIcon size={13} aria-hidden="true" />}
                  {c.href ? <Link href={c.href}>{c.label[lang]}</Link> : <span>{c.label[lang]}</span>}
                  {i < crumbs.length - 1 && <ChevronRight size={13} className="sf-crumb-sep" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="sf-h1 sf-h1--page">{page.title[lang]}</h1>
          {subtitle && <p className="sf-banner-sub">{subtitle}</p>}
        </Container>
      </section>

      <Container className="sf-page-grid">
        <div className="sf-page-main">
          {page.contentComponent === 'job' && page.contentSlug
            ? <JobPostingDetail page={page} sections={sections} canonicalPath={canonicalPath} />
            : <>
                <SectionRenderer
                  sections={sections.filter((section) => !(section.type === 'contentFeed' && (
                    (page.slug === '/management-staff' && section.components?.includes('team')) ||
                    (page.slug === '/resources' && section.components?.includes('report'))
                  )))}
                  page={page}
                />
                {page.slug === '/management-staff' && <ManagementStaffContent />}
                {page.slug === '/resources' && <ResourcesContent />}
                {children}
              </>}
          {isContactPage && <LocationMaps page={page} variant="contact" />}
        </div>
      </Container>
    </Container>
  )
}
