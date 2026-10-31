'use client'

import SafeImage from '@/components/ui/SafeImage'
import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { FaLinkedin } from 'react-icons/fa'
import { localizeDigits } from '@/lib/utils'
import { FALLBACK_CONTACT, FALLBACK_LOGO } from '@/lib/siteFallback'
import { useSite } from '@/components/containers/SiteProvider'

export default function Footer() {
  const { lang, site } = useSite()
  const data = site?.global
  if (!data) return null

  const { ui } = data
  const primaryNav = data.primaryNav ?? []
  const home = primaryNav.find((item) => item.href === '/')
  const navigationItems = home?.children ?? primaryNav.filter((item) => item.href !== '/')
  const flattenPages = (items: typeof navigationItems): typeof navigationItems => items.flatMap((item) => item.menuType === 'folder' ? flattenPages(item.children ?? []) : [item, ...flattenPages(item.children ?? [])])
  const primaryLinks = flattenPages(navigationItems).filter((item) => Boolean(item.href) && item.href !== '/donate')
  const contactInfo = data.contactInfo ?? FALLBACK_CONTACT
  const logo = data.images?.logo ?? FALLBACK_LOGO
  const tr = (en: string, bn: string) => (lang === 'en' ? en : bn)
  const portfolio = (data as any).portfolio || {}
  const identity = portfolio.brandIdentity || {}
  const biText = (value: any, fallback: string) => typeof value === 'string' ? value : (value?.[lang] || value?.en || value?.bn || fallback)
  const brandName = biText(identity.name, tr('Srizony', 'সৃজনী'))
  const brandDescriptor = biText(identity.descriptor, tr('Foundation', 'ফাউন্ডেশন'))
  const brandLabel = `${brandName} ${brandDescriptor}`.trim()
  const brandTagline = biText(identity.tagline, ui[lang].footerNote)
  const brandSummary = biText(identity.summary, '')
  const dial = (p: string) => `tel:${p.replace(/[^\d+]/g, '')}`

  // Every link appears once in the footer: one shared set of hrefs already placed in a column.
  const placed = new Set<string>(['/', '/donate'])
  const claim = <T extends { href: string }>(items: T[], max = 99) =>
    items.filter((i) => (placed.has(i.href) ? false : (placed.add(i.href), true))).slice(0, max)

  const useful = claim(primaryLinks.filter((i) => i.href !== '/donate'), 12)
  const phones = Array.from(new Set((contactInfo.phones ?? []).map((p) => p.replace(/\s+/g, '')))).slice(0, 3)

  return (
    <footer className="sf-footer">
      <div className="sf-container sf-footer-grid">
        <div className="sf-footer-col sf-footer-brand">
          <Link href="/" className="sf-brand sf-brand--footer" aria-label={brandLabel}>
            <SafeImage src={logo} alt={brandLabel} width={56} height={56} className="sf-brand-logo" fallbackTitle="Srizony Foundation logo" showSourceLinks={false} />
            <span className="sf-brand-name">{brandLabel}</span>
          </Link>
          <p>{brandTagline}</p>
          {brandSummary && <p>{brandSummary}</p>}
          {contactInfo.socials?.linkedin && (
            <a className="sf-social" href={contactInfo.socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <FaLinkedin size={18} />
            </a>
          )}
        </div>

        <div className="sf-footer-col">
          <h3>{tr('Useful Links', 'প্রয়োজনীয় লিংক')}</h3>
          <ul>
            {useful.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label[lang]}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="sf-footer-col sf-footer-contact">
          <h3>{tr('Contact', 'যোগাযোগ')}</h3>
          <ul>
            <li>
              <MapPin size={16} aria-hidden="true" />
              <span>{contactInfo.address[lang]}</span>
            </li>
            {phones.map((p) => (
              <li key={p}>
                <Phone size={16} aria-hidden="true" />
                <a href={dial(p)}>{localizeDigits(p, lang)}</a>
              </li>
            ))}
            <li>
              <Mail size={16} aria-hidden="true" />
              <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
            </li>
          </ul>
        </div>
      </div>


      <div className="sf-footer-bottom">
        <div className="sf-container">
          <span>
            © {localizeDigits(new Date().getFullYear(), lang)} {`${brandLabel}. ${tr('All rights reserved.', 'সর্বস্বত্ব সংরক্ষিত।')}`}
          </span>
        </div>
      </div>
    </footer>
  )
}
