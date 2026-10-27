'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ChevronRight, Home as HomeIcon } from 'lucide-react'
import { dedupeLandingSections } from '@/data/landingImages'
import type { Bilingual, NavGroup, NavItem, PageData, Section } from '@/types/entityType'
import SafeImage from '@/components/ui/SafeImage'
import { useSite } from '@/components/containers/SiteProvider'
import SectionRenderer from '@/components/pages/SectionRenderer'
import LocationMaps from '@/components/home/LocationMaps'
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

/** Menu group + ancestors leading to `path`, so the breadcrumb mirrors the navigation. */
function findTrail(groups: NavGroup[], path: string): { group: NavGroup; chain: NavItem[] } | null {
  const walk = (items: NavItem[], chain: NavItem[]): NavItem[] | null => {
    for (const item of items) {
      const next = [...chain, item]
      if (item.href === path) return next
      const hit = item.children ? walk(item.children, next) : null
      if (hit) return hit
    }
    return null
  }
  for (const group of groups) {
    const chain = walk(group.items, [])
    if (chain) return { group, chain }
  }
  return null
}

function findPageMenu(items: NavItem[], path: string): NavItem | null {
  for (const item of items) {
    if (item.href === path) return item
    const nested = item.children ? findPageMenu(item.children, path) : null
    if (nested) return nested
  }
  return null
}

export default function PageTemplate({ page, canonicalPath }: { page: PageData; canonicalPath: string }) {
  const { lang, site } = useSite()
  const isContactPage = `/${page.slug.replace(/^\/+|\/+$/g, '')}` === '/contact'
  const navGroups = site?.global.navGroups ?? []
  const ui = site?.global.ui

  const navigationRoots = [...(site?.global.primaryNav ?? []), ...(site?.global.navGroups ?? []).flatMap((group) => group.items)]
  const pageMenu = findPageMenu(navigationRoots, canonicalPath)
  const renderAllowlist = pageMenu?.renderedComponents?.length ? new Set(pageMenu.renderedComponents) : null
  const sections = useMemo(
    () => tidySections(
      dedupeLandingSections(
        page.sections.filter((section) => (section as { visible?: boolean }).visible !== false && (!renderAllowlist || renderAllowlist.has(section.type))),
        page.heroImage ? [{ image: page.heroImage }] : [],
        page.slug,
      ),
      page.title,
      page.subtitle,
    ),
    [page, renderAllowlist],
  )
  if (!site || !ui) return null

  const trail = findTrail(navGroups, canonicalPath)
  const parts = canonicalPath.split('/').filter(Boolean)

  // Breadcrumb shows where you are, not the page title again (the banner already shows it).
  const crumbs: Crumb[] = [{ label: { en: ui.en.home, bn: ui.bn.home }, href: '/' }]
  if (trail) {
    crumbs.push({ label: trail.group.label })
    trail.chain.slice(0, -1).forEach((c) => crumbs.push({ label: c.label, href: c.href }))
  } else if (canonicalPath.startsWith('/enterprise/')) {
    crumbs.push({ label: { en: 'Enterprise Development', bn: 'এন্টারপ্রাইজ উন্নয়ন' }, href: '/enterprise-development' })
  } else if (parts.length > 1) {
    const label = parts[0].replace(/-/g, ' ')
    crumbs.push({ label: { en: label, bn: label }, href: `/${parts[0]}` })
  }

  const subtitle = page.subtitle?.[lang]
  const wrapperClass = [
    'sf-page',
    `sf-page--${page.layout || 'standard'}`,
    page.slug === '/social-development' || page.slug === '/social-enterprise' ? 'social-cards-page' : '',
    page.slug === '/enterprise-development' ? 'enterprise-development-page' : '',
  ].filter(Boolean).join(' ')

  return (
    <Container variant="page" className={wrapperClass}>
      <section className="sf-banner">
        {page.heroImage && <SafeImage src={page.heroImage} alt="" fill sizes="100vw" priority className="sf-cover" />}
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
          <SectionRenderer sections={sections} page={page} />
          {isContactPage && <LocationMaps page={page} variant="contact" />}
        </div>
      </Container>
    </Container>
  )
}
