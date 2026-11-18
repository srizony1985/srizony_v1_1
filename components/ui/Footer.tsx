'use client'

import SafeImage from '@/components/ui/SafeImage'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Mail, MapPin, Phone } from 'lucide-react'
import { localizeDigits } from '@/lib/utils'
import { FALLBACK_CONTACT, FALLBACK_LOGO } from '@/lib/siteFallback'
import { useSite } from '@/components/containers/SiteProvider'
import SocialLinks from '@/components/ui/SocialLinks'
import { useWebsiteEssentials } from '@/components/hooks/useWebsiteEssentials'
import { plainSectionTitle } from '@/lib/sectionTitle'
import { DEFAULT_FOOTER_CONFIG, normalizeFooterConfig, splitFooterColumns, type FooterLink, type FooterSection } from '@/lib/footerConfig'
import { buildThemeCssVariables, ensureThemeContrast, type RuntimeThemeMap } from '@/lib/themeRuntime'
import type { ContactInfo, NavItem } from '@/types/entityType'
import type { PortfolioText } from '@/types/portfolio'

function flattenNavigation(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => item.menuType === 'folder'
    ? flattenNavigation(item.children ?? [])
    : [item, ...flattenNavigation(item.children ?? [])])
}

function localizedLabel(label: NavItem['label'], lang: 'en' | 'bn') {
  return typeof label === 'string' ? label : label?.[lang] || label?.en || label?.bn || ''
}

function FooterLinkView({ link, lang }: { link: FooterLink; lang: 'en' | 'bn' }) {
  const label = (lang === 'bn' ? link.labelBn : link.labelEn) || link.labelEn || link.labelBn
  if (!label || !link.href || link.href === '#') return null
  const content = <span>{label}</span>
  if (/^(https?:|mailto:|tel:)/i.test(link.href)) {
    return <a href={link.href} target={/^https?:/i.test(link.href) ? '_blank' : undefined} rel={/^https?:/i.test(link.href) ? 'noopener noreferrer' : undefined}>{content}</a>
  }
  return <Link href={link.href}>{content}</Link>
}

function FooterSectionView({
  section, lang, navigation, contactInfo,
}: {
  section: FooterSection
  lang: 'en' | 'bn'
  navigation: NavItem[]
  contactInfo: ContactInfo
}) {
  const title = plainSectionTitle((lang === 'bn' ? section.titleBn : section.titleEn) || section.titleEn || section.titleBn)
  if (section.kind === 'contact') {
    const phones = section.showPhones ? Array.from(new Set((contactInfo.phones ?? []).map((phone) => phone.replace(/\s+/g, '')))).slice(0, 4) : []
    return <section className="sf-footer-col sf-footer-contact" aria-label={title}>
      {title && <h3>{title}</h3>}
      <ul>
        {section.showAddress && contactInfo.address?.[lang] && <li><MapPin size={16} aria-hidden="true" /><span>{contactInfo.address[lang]}</span></li>}
        {phones.map((phone) => <li key={phone}><Phone size={16} aria-hidden="true" /><a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{localizeDigits(phone, lang)}</a></li>)}
        {section.showEmail && contactInfo.email && <li><Mail size={16} aria-hidden="true" /><a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a></li>}
      </ul>
    </section>
  }

  const links: FooterLink[] = section.kind === 'navigation'
    ? flattenNavigation(navigation).filter((item) => item.href && item.href !== '/' && item.href !== '/donate').map((item) => ({
      id: `nav-${item.href}`,
      labelEn: localizedLabel(item.label, 'en'),
      labelBn: localizedLabel(item.label, 'bn'),
      href: item.href,
    }))
    : section.links
  const columns = splitFooterColumns(links, section.columns)
  return <section className="sf-footer-col sf-footer-link-section" aria-label={title || 'Footer links'}>
    {title && <h3>{title}</h3>}
    {columns.length > 0 && <div className="sf-footer-link-columns" data-columns={columns.length} style={{ '--sf-footer-section-columns': columns.length } as CSSProperties}>
      {columns.map((column, index) => <ul key={`${section.id}-column-${index}`}>
        {column.map((link) => <li key={link.id}><FooterLinkView link={link} lang={lang} /></li>)}
      </ul>)}
    </div>}
  </section>
}

export default function Footer() {
  const { lang, site, theme, mode, shape, tokens } = useSite()
  const { essentials } = useWebsiteEssentials()
  const data = site?.global
  if (!data) return null

  const footer = normalizeFooterConfig(data.footer ?? DEFAULT_FOOTER_CONFIG)
  if (!footer.enabled) return null

  const ui = data.ui
  const primaryNav = data.primaryNav ?? []
  const home = primaryNav.find((item) => item.href === '/')
  const navigationItems = home?.children ?? primaryNav.filter((item) => item.href !== '/')
  const contactInfo = data.contactInfo ?? FALLBACK_CONTACT
  const logo = data.images?.logo ?? FALLBACK_LOGO
  const tr = (en: string, bn: string) => (lang === 'en' ? en : bn)
  const identity = data.portfolio?.brandIdentity
  const biText = (value: PortfolioText | undefined, fallback: string) => typeof value === 'string' ? value : value?.[lang] || value?.en || value?.bn || fallback
  const brandName = biText(identity?.name, tr('Srizony', 'সৃজনী'))
  const brandDescriptor = biText(identity?.descriptor, tr('Foundation', 'ফাউন্ডেশন'))
  const brandLabel = `${brandName} ${brandDescriptor}`.trim()
  const brandTagline = biText(identity?.tagline, ui[lang].footerNote)
  const brandSummary = biText(identity?.summary, '')
  const visibleSections = footer.sections.filter((section) => section.enabled)
  const populatedAreas = (footer.showBrand ? 1 : 0) + visibleSections.length
  if (populatedAreas === 0 && !footer.showCopyright) return null
  const effectiveColumns = Math.max(1, Math.min(footer.layoutColumns, populatedAreas || 1))
  const gridStyle = { '--sf-footer-columns': effectiveColumns } as CSSProperties
  const fontMap: Record<string, string> = { inherit: 'inherit', system: 'system-ui, sans-serif', arial: 'Arial, sans-serif', georgia: 'Georgia, serif', times: '"Times New Roman", serif', inter: 'Inter, sans-serif', roboto: 'Roboto, sans-serif', 'noto-sans-bengali': '"Noto Sans Bengali", sans-serif' }
  const runtimeThemeVars = buildThemeCssVariables((data.themes || {}) as RuntimeThemeMap, theme, mode, tokens, shape)
  const footerBackground = runtimeThemeVars['--sf-footer-bg'] || (mode === 'light' ? '#111f2b' : '#081018')
  const footerStyle = {
    '--sf-footer-title-font-family': fontMap[footer.typography.titleFontFamily] || 'var(--sf-font-display)', '--sf-footer-body-font-family': fontMap[footer.typography.bodyFontFamily] || 'var(--sf-font-body)',
    '--sf-footer-heading-size': `${footer.typography.titleSize}px`, '--sf-footer-heading-weight': footer.typography.titleWeight, '--sf-footer-heading-color': ensureThemeContrast(footer.typography.titleColor, [footerBackground], 7),
    '--sf-footer-link-size': `${footer.typography.linkSize}px`, '--sf-footer-link-weight': footer.typography.linkWeight, '--sf-footer-link-color': ensureThemeContrast(footer.typography.linkColor, [footerBackground], 4.5),
    '--sf-footer-body-size': `${footer.typography.bodySize}px`, '--sf-footer-body-color': ensureThemeContrast(footer.typography.bodyColor, [footerBackground], 4.5),
  } as CSSProperties

  return (
    <footer className="sf-footer" style={footerStyle}>
      {populatedAreas > 0 && <div className="sf-container sf-footer-grid" data-columns={effectiveColumns} style={gridStyle}>
        {footer.showBrand && <section className="sf-footer-col sf-footer-brand" aria-label={brandLabel}>
          <Link href="/" className="sf-brand sf-brand--footer" aria-label={brandLabel}>
            {footer.showLogo && <SafeImage src={logo} alt={brandLabel} width={56} height={56} className="sf-brand-logo" fallbackTitle="Srizony Foundation logo" />}
            <span className="sf-brand-name">{brandLabel}</span>
          </Link>
          {footer.showTagline && brandTagline && <p>{brandTagline}</p>}
          {footer.showSummary && brandSummary && <p>{brandSummary}</p>}
          {footer.showSocial && <SocialLinks socials={essentials.socials} lang={lang} size={18} className="sf-footer-socials" />}
        </section>}

        {visibleSections.map((section) => (
          <FooterSectionView
            key={section.id}
            section={section}
            lang={lang}
            navigation={navigationItems}
            contactInfo={contactInfo}
          />
        ))}
      </div>}

      {footer.showCopyright && <div className="sf-footer-bottom">
        <div className="sf-container">
          <span>© {localizeDigits(new Date().getFullYear(), lang)} {`${brandLabel}. ${tr('All rights reserved.', 'সর্বস্বত্ব সংরক্ষিত।')}`}</span>
        </div>
      </div>}
    </footer>
  )
}
