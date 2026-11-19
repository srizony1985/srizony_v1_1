'use client'

import type { JsonValue } from '@/types/json'

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import { ChevronRight, Home as HomeIcon } from 'lucide-react'
import type { Bilingual, NavItem, PageData, Section } from '@/types/entityType'
import type { FeedItem } from '@/lib/cms/components'
import { toCmsTypographyStyle } from '@/lib/cms/typography'
import { shouldRenderLocationMap } from '@/lib/cms/locationMap'
import SafeImage from '@/components/ui/SafeImage'
import { useSite } from '@/components/containers/SiteProvider'
import SectionRenderer from '@/components/pages/SectionRenderer'
import LocationMaps from '@/components/home/LocationMaps'
import JobPostingDetail from '@/components/pages/JobPostingDetail'
import ManagementStaffContent from '@/components/pages/ManagementStaffContent'
import ResourcesContent from '@/components/pages/ResourcesContent'
import Container from '@/components/containers/Container'
import { plainSectionTitle } from '@/lib/sectionTitle'

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
    let s = section as Section & { heading?: Bilingual; body?: Bilingual | Bilingual[]; items?: JsonValue[] }
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
  const showContactMap = shouldRenderLocationMap(page)
  const primaryNav = site?.global.primaryNav ?? []
  const ui = site?.global.ui

  const isContentDetail = Boolean(page.contentComponent && page.contentSlug)
  const canShowContentImage = !isContentDetail || page.cmsMediaManaged === true
  const heroImage = isContentDetail && !canShowContentImage ? undefined : page.heroImage
  const sections = useMemo(() => {
    const visible = page.sections.filter((section) => section.homeComponent === 'locations' ? (section as { visible?: boolean }).visible === true : (section as { visible?: boolean }).visible !== false)
    // Page sections are rendered from the persisted CMS document. Never synthesize
    // missing images or section copy from bundled landing-page data.
    const prepared = isContentDetail && !canShowContentImage
      ? visible.map(withoutUnmanagedDetailImages).filter((section): section is Section => section !== null)
      : visible
    return tidySections(prepared, page.title, page.subtitle)
  }, [page, isContentDetail, canShowContentImage])
  const resourceReports = useMemo<FeedItem[]>(() => sections.flatMap((section) => (
    section.type === 'contentFeed' && section.components.includes('report') ? section.items : []
  )), [sections])
  if (!site || !ui) return null

  const trail = findTrail(primaryNav, canonicalPath)
  const parts = canonicalPath.split('/').filter(Boolean)

  // Breadcrumb shows where you are, not the page title again (the banner already shows it).
  const crumbs: Crumb[] = [{ label: { en: ui.en.home, bn: ui.bn.home }, href: '/' }]
  if (trail) {
    trail.slice(0, -1).filter((item) => item.href !== '/').forEach((item) => crumbs.push({ label: item.label, href: item.menuType === 'folder' ? undefined : item.href }))
  } else if (parts.length > 1) {
    const label = parts[0].replace(/-/g, ' ')
    crumbs.push({ label: { en: label, bn: label }, href: `/${parts[0]}` })
  }

  const subtitle = page.subtitle?.[lang]
  const wrapperClass = [
    'sf-page',
    `sf-page--${page.layout || 'standard'}`,
    `sf-page--padding-${page.contentPadding || 'normal'}`,
    page.cardStyle === 'social' ? 'social-cards-page' : '',
    page.cardStyle === 'enterprise' ? 'enterprise-development-page' : '',
    `sf-page--card-style-${page.cardStyle || 'default'}`,
    `sf-page--view-${page.pageView || 'default'}`,
  ].filter(Boolean).join(' ')

  return (
    <div className="cms-typography-scope" style={toCmsTypographyStyle(page.typography) as CSSProperties}>
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
          <h1 className="sf-h1 sf-h1--page">{plainSectionTitle(page.title[lang])}</h1>
        </Container>
      </section>

      <Container className="sf-page-grid">
        <div className="sf-page-main">
          {subtitle && <h3 className="sf-sec-head--center">{subtitle}</h3>}
          {page.contentComponent === 'job' && page.contentSlug
            ? <JobPostingDetail page={page} sections={sections} canonicalPath={canonicalPath} processConfig={site.jobApplicationProcess} />
            : <>
                <SectionRenderer
                  sections={sections.filter((section) => !(section.type === 'contentFeed' && (
                    (page.pageView === 'staff-directory' && section.components?.includes('team')) ||
                    (page.pageView === 'resource-library' && section.components?.includes('report'))
                  )))}
                  page={page}
                />
                {page.pageView === 'staff-directory' && <ManagementStaffContent page={page} />}
                {page.pageView === 'resource-library' && <ResourcesContent reports={resourceReports} page={page} />}
                {children}
              </>}
          {showContactMap && <LocationMaps page={page} variant="contact" />}
        </div>
      </Container>
    </Container>
    </div>
  )
}
