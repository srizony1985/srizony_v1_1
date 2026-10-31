'use client'

import SafeImage from '@/components/ui/SafeImage'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, Heart, Menu, Moon, Sun, X } from 'lucide-react'
import { SiFacebook, SiInstagram, SiYoutube } from 'react-icons/si'
import { FaLinkedin } from 'react-icons/fa'
import NavMenuTree from '@/components/ui/NavMenuTree'
import { FALLBACK_HOME_LABEL, FALLBACK_LOGO } from '@/lib/siteFallback'
import LanguageFlag from '@/components/ui/LanguageFlag'
import { useSite } from '@/components/containers/SiteProvider'
import type { NavItem } from '@/types/entityType'

/** Shared responsive navigation for desktop, tablet, and mobile layouts. */

export default function NavBar() {
  const siteContext = useSite()
  const { lang, setLang, mode, setMode, site } = siteContext

  const pathname = usePathname() ?? '/'
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileExpandedItems, setMobileExpandedItems] = useState<Record<string, boolean>>({})
  const [stuck, setStuck] = useState(false)
  const [officialSocials, setOfficialSocials] = useState<Record<string, string>>({ linkedin: 'https://bd.linkedin.com/company/srizonyfoundation' })
  const headerRef = useRef<HTMLElement | null>(null)

  const closeAll = useCallback(() => {
    setOpenGroup(null)
    setMobileOpen(false)
    setMobileExpandedItems({})
  }, [])

  useEffect(() => closeAll(), [pathname, closeAll])

  useEffect(() => {
    let cancelled = false
    fetch('/api/website-essentials', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (!cancelled && payload?.socials) setOfficialSocials(payload.socials)
    }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [mobileOpen])

  // Sub-menus always open to the right; slide the dropdown left just enough that they stay on screen.
  useLayoutEffect(() => {
    const header = headerRef.current
    const panel = header?.querySelector<HTMLElement>('.sf-dd--group.is-open > .sf-group-panel')
    if (!panel) return
    panel.style.translate = '0 0'
    const flyout = panel.querySelector<HTMLElement>('.sf-menu--sub')
    const flyoutWidth = flyout?.getBoundingClientRect().width ?? 0
    const r = panel.getBoundingClientRect()
    const overflow = r.right + flyoutWidth - (window.innerWidth - 16)
    if (overflow > 0) panel.style.translate = `${-Math.min(overflow, Math.max(r.left - 16, 0))}px 0`
  }, [openGroup])

  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return
    const updateHeight = () => header.style.setProperty('--sf-header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [mobileOpen, stuck])

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 24)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) closeAll()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeAll()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [closeAll])

  const data = site?.global
  const tr = (en: string, bn: string) => (lang === 'en' ? en : bn)

  if (!data) {
    return (
      <header className="sf-header" ref={headerRef}>
        <div className="sf-navbar"><div className="sf-container sf-navbar-in"><span className="sf-brand-text"><strong className="sf-brand-name">Srizony</strong><small className="sf-brand-sub">Foundation</small></span></div></div>
      </header>
    )
  }

  const { ui } = data
  const portfolioBrand = (data as any).portfolio?.brandIdentity || {}
  const brandText = (value: any, fallback: string) => typeof value === 'string' ? value : (value?.[lang] || value?.en || value?.bn || fallback)
  const brandName = brandText(portfolioBrand.name, tr('Srizony', 'সৃজনী'))
  const brandDescriptor = brandText(portfolioBrand.descriptor, tr('Foundation', 'ফাউন্ডেশন'))
  const brandLabel = `${brandName} ${brandDescriptor}`.trim()
  const primaryNav = data.primaryNav ?? []
  const logo = data.images?.logo?.trim() || FALLBACK_LOGO
  const home = primaryNav[0] ?? { label: FALLBACK_HOME_LABEL, href: '/' }
  const mainNavigationLinks = (home.children?.length ? home.children : primaryNav.slice(1)).filter((item) => item.href !== '/donate')
  const socialIcons = { facebook: SiFacebook, instagram: SiInstagram, youtube: SiYoutube, linkedin: FaLinkedin }
  const socialLabels: Record<string, { en: string; bn: string }> = { facebook: { en: 'Facebook', bn: 'ফেসবুক' }, instagram: { en: 'Instagram', bn: 'ইনস্টাগ্রাম' }, youtube: { en: 'YouTube', bn: 'ইউটিউব' }, linkedin: { en: 'LinkedIn', bn: 'লিংকডইন' } }
  const activeSocials = Object.entries(officialSocials).filter(([key, url]) => key in socialIcons && typeof url === 'string' && /^https:\/\//i.test(url.trim()))

  const isActive = (href: string) => !href ? false : (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const itemActive = (item: NavItem): boolean => item.menuType === 'folder' ? Boolean(item.children?.some(itemActive)) : isActive(item.href) || Boolean(item.children?.some(itemActive))

  const brand = brandLabel

  const toggleMobileItem = (item: NavItem) => {
    const key = `${item.href}-${item.label.en}`
    setMobileExpandedItems((current) => ({ ...current, [key]: !current[key] }))
  }

  const renderMobileItem = (item: NavItem, depth = 0) => {
    const key = `${item.href}-${item.label.en}`
    const hasChildren = Boolean(item.children?.length)
    const expanded = Boolean(mobileExpandedItems[key])
    const active = itemActive(item)
    const indent = { paddingInlineStart: `${16 + depth * 16}px` }
    const label = <span>{item.label[lang]}</span>
    const toggle = () => toggleMobileItem(item)
    return (
      <div className="sf-drawer-item" key={key}>
        {item.menuType === 'folder' ? (
          <button type="button" className={`sf-drawer-link ${active ? 'is-active' : ''}`} style={indent} aria-expanded={expanded} onClick={toggle}>
            {label}<ChevronDown size={16} className={expanded ? 'is-rot' : ''} aria-hidden="true" />
          </button>
        ) : hasChildren ? (
          <div className="sf-drawer-item-row" style={indent}>
            {item.menuType === 'external' ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer" className={`sf-drawer-link sf-drawer-row-link ${active ? 'is-active' : ''}`} onClick={closeAll}>{label}</a>
            ) : (
              <Link href={item.href} className={`sf-drawer-link sf-drawer-row-link ${active ? 'is-active' : ''}`} aria-current={isActive(item.href) ? 'page' : undefined} onClick={closeAll}>{label}</Link>
            )}
            <button type="button" className="sf-drawer-expand" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label[lang]}`} aria-expanded={expanded} onClick={toggle}>
              <ChevronDown size={16} className={expanded ? 'is-rot' : ''} aria-hidden="true" />
            </button>
          </div>
        ) : item.menuType === 'external' ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" className={`sf-drawer-link ${active ? 'is-active' : ''}`} style={indent} onClick={closeAll}>{label}</a>
        ) : (
          <Link href={item.href} className={`sf-drawer-link ${active ? 'is-active' : ''}`} style={indent} aria-current={isActive(item.href) ? 'page' : undefined} onClick={closeAll}>{label}</Link>
        )}
        {hasChildren && expanded && <div className="sf-drawer-subitems">{item.children!.map((child) => renderMobileItem(child, depth + 1))}</div>}
      </div>
    )
  }

  return (
    <header className={`sf-header ${stuck ? 'is-stuck' : ''}`} ref={headerRef}>
      {activeSocials.length > 0 && <div className="sf-social-topbar"><div className="sf-container sf-social-topbar-in"><span>{tr('Connect with us', 'আমাদের সঙ্গে যুক্ত থাকুন')}</span><div className="sf-social-topbar-links">{activeSocials.map(([key, url]) => { const Icon = socialIcons[key as keyof typeof socialIcons]; return <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={socialLabels[key]?.[lang] || key} title={socialLabels[key]?.[lang] || key}><Icon size={15} aria-hidden="true"/><span className="sf-sr">{socialLabels[key]?.[lang] || key}</span></a> })}</div></div></div>}
      <div className="sf-navbar">
        <div className="sf-container sf-navbar-in">
          <Link href="/" className="sf-brand" aria-label={brand}>
            <span className="sf-brand-logo">
              <SafeImage src={logo} fallbackSrc={FALLBACK_LOGO} alt={brand} fallbackTitle="Srizony Foundation logo" fill priority sizes="80px" showSourceLinks={false} />
            </span>
            <span className="sf-brand-text">
              <strong className="sf-brand-name">{brandName}</strong>
              <small className="sf-brand-sub">{brandDescriptor}</small>
            </span>
          </Link>

          <nav className="sf-nav" aria-label={tr('Primary navigation', 'প্রধান মেনু')}>
            <Link href="/" className={`sf-nav-link ${isActive('/') ? 'is-active' : ''}`} aria-current={isActive('/') ? 'page' : undefined}>
              <span className="sf-nav-label">{home.label[lang]}</span>
            </Link>
            {mainNavigationLinks.map((item) => {
              if (item.menuType === 'folder' && item.children?.length) {
                const key = `menu:${item.label.en}`
                const expanded = openGroup === key
                const active = itemActive(item)
                return <div
                  key={key}
                  className={`sf-dd sf-dd--group ${expanded ? 'is-open' : ''}`}
                  onPointerEnter={(event) => {
                    // CSS also opens the panel on :hover; state keeps ARIA in sync.
                    if (event.pointerType === 'mouse' || event.pointerType === 'pen') setOpenGroup(key)
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
                      if (!event.currentTarget.contains(document.activeElement)) {
                        setOpenGroup((current) => current === key ? null : current)
                      }
                    }
                  }}
                  onFocusCapture={() => setOpenGroup(key)}
                  onBlurCapture={(event) => {
                    const nextTarget = event.relatedTarget as Node | null
                    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
                      setOpenGroup((current) => current === key ? null : current)
                    }
                  }}
                >
                  <button
                    type="button"
                    className={`sf-nav-link sf-nav-group-trigger ${active || expanded ? 'is-active' : ''}`}
                    aria-haspopup="true"
                    aria-expanded={expanded}
                    onClick={() => setOpenGroup((current) => current === key ? null : key)}
                  >
                    <span className="sf-nav-label">{item.label[lang]}</span>
                    <ChevronDown size={14} className={expanded ? 'is-rot' : ''} aria-hidden="true" />
                  </button>
                  {/* Keep the panel mounted: CSS :hover/:focus-within can open it even before React state updates. */}
                  <div className="sf-dd-panel sf-group-panel" aria-label={`${item.label[lang]} submenu`}>
                    <NavMenuTree items={item.children} lang={lang} isActive={isActive} onNavigate={closeAll} />
                  </div>
                </div>
              }
              if (item.menuType === 'external') return <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className="sf-nav-link"><span className="sf-nav-label">{item.label[lang]}</span></a>
              return <Link key={item.href} href={item.href} className={`sf-nav-link ${itemActive(item) ? 'is-active' : ''}`} aria-current={isActive(item.href) ? 'page' : undefined}>
                <span className="sf-nav-label">{item.label[lang]}</span>
              </Link>
            })}
          </nav>

          <div className="sf-navbar-cta">
            {/* Language toggle: flag only */}
            <button
              type="button"
              className="sf-language-toggle sf-ctrl"
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              aria-label={lang === 'en' ? 'বাংলায় দেখুন' : 'Switch to English'}
              title={lang === 'en' ? 'বাংলা' : 'English'}
            >
              {lang === 'en' ? <LanguageFlag country="bd" /> : <LanguageFlag country="gb" />}
            </button>

            {/* Minimal, accessible dark-mode switch: icon only, no visible border or label. */}
            <button
              type="button"
              className="sf-mode-toggle"
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              aria-label={mode === 'dark' ? tr('Switch to light mode', 'লাইট মোড চালু করুন') : tr('Switch to dark mode', 'ডার্ক মোড চালু করুন')}
              aria-pressed={mode === 'dark'}
            >
              {mode === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            </button>

            <Link href="/donate" className="sf-btn sf-btn--accent sf-desktop-donate">
              <Heart size={15} aria-hidden="true" /> {ui[lang].donate}
            </Link>

            <button
              type="button"
              className="sf-burger"
              aria-label={mobileOpen ? tr('Close navigation menu', 'মেনু বন্ধ করুন') : tr('Open navigation menu', 'মেনু খুলুন')}
              aria-expanded={mobileOpen}
              aria-controls="sf-mobile-drawer"
              onClick={() => { setMobileOpen((open) => !open); setOpenGroup(null) }}
            >
              {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
          <>
            <div id="sf-mobile-drawer" className="sf-drawer" role="dialog" aria-modal="true" aria-label={tr('Navigation menu', 'নেভিগেশন মেনু')}>
              <nav className="sf-drawer-nav" aria-label={tr('Mobile navigation', 'মোবাইল নেভিগেশন')}>
                <div className="sf-drawer-landing">
                  <Link href="/" className={`sf-drawer-link ${isActive('/') ? 'is-active' : ''}`} onClick={closeAll}>{home.label[lang]}</Link>
                </div>
                <section className="sf-drawer-menu-section sf-drawer-main-links" aria-label={tr('Navigation links', 'নেভিগেশন লিংক')}>
                  {mainNavigationLinks.map((item) => renderMobileItem(item))}
                </section>
              </nav>
              <div className="sf-drawer-foot">
                <Link href="/donate" className="sf-btn sf-btn--primary sf-btn--block" onClick={closeAll}><Heart size={16} aria-hidden="true" /> {ui[lang].donate}</Link>
              </div>
            </div>
          </>
      )}
    </header>
  )
}
