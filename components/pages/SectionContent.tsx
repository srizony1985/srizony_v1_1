
'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Briefcase, Building2, CheckCircle2, Coins, Download, Droplets, Heart, Leaf, Mail, MapPin, Megaphone, Phone, Play, Scale, ShieldCheck, Sprout, Store, Sun, Users } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import AnimatedCard from '@/components/ui/AnimatedCard'
import Button from '@/components/ui/ActionButton'
import Diagram from '@/components/pages/Diagram'
import DonationForm from '@/components/ui/DonationForm'
import SafeImage from '@/components/ui/SafeImage'
import SectionHeading from '@/components/ui/SectionHeading'
import Stats from '@/components/ui/Stats'
import VideoPlayer from '@/components/pages/VideoPlayer'
import type { IconName, PageData, PageSection, Section } from '@/types/entityType'
import { localizeDigits } from '@/lib/utils'
import { fallbackCardImage } from '@/data/landingImages'

const ICONS: Record<IconName | 'sprout' | 'store', typeof Heart> = { heart: Heart, leaf: Leaf, book: BookOpen, scale: Scale, users: Users, sun: Sun, droplets: Droplets, briefcase: Briefcase, coins: Coins, building: Building2, megaphone: Megaphone, shield: ShieldCheck, play: Play, arrow: ArrowRight, check: CheckCircle2, sprout: Sprout, store: Store }
const dial = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

type Localized = { en: string; bn: string }

/** One prop-driven renderer keeps CMS section behavior in one place and shares the same UI primitives. */
export default function SectionContent({ section, page }: { section: Section; page?: PageData }) {
  const { lang, site } = useSite()
  const readMore = site?.global.ui[lang]?.readMore ?? (lang === 'en' ? 'Read more' : 'আরও পড়ুন')
  const t = (en: string, bn: string) => lang === 'en' ? en : bn
  const isContactPage = page?.slug ? `/${page.slug.replace(/^\/+|\/+$/g, '')}` === '/contact' : false

  switch (section.type) {
    case 'richText':
      return <section className={`sf-block sf-split ${section.image ? '' : 'sf-split--single'} ${section.reverse ? 'is-reverse' : ''}`}>
        <div className="sf-split-copy">
          <SectionHeading eyebrow={section.eyebrow} heading={section.heading} lang={lang} />
          {section.body.map((paragraph, index) => <p key={index} className="sf-body">{paragraph[lang]}</p>)}
        </div>
        {section.image && <figure className="sf-split-media">
          <div className="sf-ratio"><SafeImage src={section.image.src} alt={section.image.alt[lang]} fill sizes="(max-width: 900px) 100vw, 40vw" className="sf-cover" /></div>
          {section.image.caption && <figcaption>{section.image.caption[lang]}</figcaption>}
        </figure>}
      </section>

    case 'stats':
      return <section className="sf-block"><Stats items={section.items} lang={lang} animated /></section>

    case 'cards': {
      const profiles = section.items.length > 0 && section.items.every((item) => item.image && item.tag)
      return <section className="sf-block">
        <SectionHeading eyebrow={section.eyebrow} heading={section.heading} lang={lang} />
        <div className={`sf-grid ${profiles ? 'sf-grid--people' : ''} ${section.variant === 'impact' ? 'sf-grid--impact' : ''}`} style={{ '--cols': section.columns ?? 3 } as CSSProperties}>
          {section.items.map((item, index) => {
            const Icon = ICONS[item.icon ?? 'check']
            // Linked programme/content cards always get a relevant image even when older CMS data omitted one.
            // People cards intentionally require editor-supplied portraits and are not given synthetic photos.
            const imageSrc = item.image?.src || (!profiles && item.href ? fallbackCardImage(item.title, item.href) : '')
            const imageAlt = item.image?.alt?.[lang] || item.title[lang]
            return <AnimatedCard key={`${item.title.en}-${index}`} href={item.href} delay={index * 70} className={profiles ? 'sf-user-card' : ''}>
              {imageSrc && <div className={profiles ? 'sf-person-media' : 'sf-card-media'}>
                <SafeImage src={imageSrc} alt={imageAlt} fill sizes="(max-width: 700px) 100vw, 33vw" className="sf-cover" />
                {!profiles && item.tag && <span className="sf-chip sf-chip--float">{item.tag[lang]}</span>}
              </div>}
              {!profiles && !imageSrc && <span className="sf-card-icon" aria-hidden="true"><Icon size={26} /></span>}
              <div className="sf-card-body">
                {item.tag && (profiles || !imageSrc) && <span className="sf-chip">{item.tag[lang]}</span>}
                <h3 className="sf-h3">{item.title[lang]}</h3>
                {item.body && <p className="sf-body">{item.body[lang]}</p>}
                {item.chips?.length ? <ul className="sf-chips">{item.chips.map((chip, chipIndex) => <li key={chipIndex} className="sf-chip">{chip[lang]}</li>)}</ul> : null}
              </div>
            </AnimatedCard>
          })}
        </div>
      </section>
    }

    case 'gallery':
      return <section className="sf-block">
        <SectionHeading heading={section.heading} lang={lang} />
        <div className="sf-grid sf-grid--gallery" style={{ '--cols': section.columns ?? 3 } as CSSProperties}>
          {section.items.map((media, index) => <figure key={`${media.src}-${index}`} className="sf-gallery-item">
            <div className="sf-ratio sf-ratio--43"><SafeImage src={media.src} alt={media.alt[lang]} fill sizes="(max-width: 700px) 100vw, 33vw" className="sf-cover" /></div>
            {media.caption && <figcaption>{media.caption[lang]}</figcaption>}
          </figure>)}
        </div>
      </section>

    case 'timeline':
      return <section className="sf-block">
        <SectionHeading heading={section.heading} lang={lang} />
        <ol className={`sf-timeline ${section.variant === 'journey' ? 'sf-timeline--journey' : ''}`}>
          {section.items.map((item, index) => <li key={`${item.year}-${item.title.en}-${index}`}>
            <span className="sf-timeline-year">{localizeDigits(item.year, lang)}</span>
            <div className="sf-card"><h3 className="sf-h3">{item.title[lang]}</h3><p className="sf-body">{item.body[lang]}</p>
              {item.details && <ul className="sf-chips">{item.details.map((detail, detailIndex) => <li key={detailIndex} className="sf-chip">{detail[lang]}</li>)}</ul>}
            </div>
          </li>)}
        </ol>
      </section>

    case 'table':
      return <section className="sf-block">
        <SectionHeading heading={section.heading} lang={lang} />
        <div className="sf-table-wrap" tabIndex={0} role="region" aria-label={section.heading?.[lang] || t('Table', 'টেবিল')}>
          <table className="sf-table">
            <thead><tr>{section.headers.map((header, index) => <th key={index} scope="col">{header[lang]}</th>)}</tr></thead>
            <tbody>{section.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, columnIndex) => columnIndex === 0 ? <th key={columnIndex} scope="row">{cell[lang]}</th> : <td key={columnIndex}>{cell[lang]}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>

    case 'video':
      return <VideoPlayer section={section} lang={lang} />

    case 'cta': {
      const settings = (section as PageSection).buttonConfig
      const showPrimary = settings ? settings.visible && (settings.mode === 'primary' || settings.mode === 'both') : true
      const showSecondary = settings ? settings.visible && (settings.mode === 'secondary' || settings.mode === 'both') : Boolean(section.secondary)
      const primaryLabel = settings?.label || section.primary?.label
      const primaryHref = settings?.href || section.primary?.href
      const secondaryLabel = settings?.secondaryLabel || section.secondary?.label
      const secondaryHref = settings?.secondaryHref || section.secondary?.href
      return <section className="sf-block"><div className="sf-cta">
        <div><h2 className="sf-h2">{section.heading[lang]}</h2><p>{section.body[lang]}</p></div>
        <div className="sf-cta-actions">
          {showPrimary && primaryLabel && primaryHref && <Button href={primaryHref} action={settings?.action} variant="accent" animated>{primaryLabel[lang]}</Button>}
          {showSecondary && secondaryLabel && secondaryHref && <Button href={secondaryHref} action={settings?.secondaryAction} variant="outline-light">{secondaryLabel[lang]}</Button>}
        </div>
      </div></section>
    }

    case 'noticeList':
      return <section className="sf-block"><SectionHeading heading={section.heading} lang={lang} />
        <ul className="sf-notices">{section.items.map((item, index) => {
          const content = <><time className="sf-notice-date">{item.date}</time><div><strong>{item.title[lang]}</strong>{item.body && <p>{item.body[lang]}</p>}</div>{item.href && <ArrowRight size={18} aria-hidden="true" />}</>
          return <li key={`${item.date}-${item.title.en}-${index}`}>{item.href ? <Link href={item.href} className="sf-notice">{content}</Link> : <div className="sf-notice">{content}</div>}</li>
        })}</ul>
      </section>

    case 'contact': {
      const mapUrl = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
      return <section className="sf-block"><SectionHeading heading={section.heading} lang={lang} />
        <div className="sf-contact">
          <div className="sf-card sf-contact-main"><ul>
            <li><MapPin size={18} aria-hidden="true" /><span>{section.address[lang]}</span></li>
            {section.phones.map((phone) => <li key={phone}><Phone size={18} aria-hidden="true" /><a href={dial(phone)}>{localizeDigits(phone, lang)}</a></li>)}
            {section.emails.map((email) => <li key={email}><Mail size={18} aria-hidden="true" /><a href={`mailto:${email}`}>{email}</a></li>)}
          </ul>{section.phones[0] && <a className="sf-btn sf-btn--primary" href={dial(section.phones[0])}><Phone size={16} aria-hidden="true" /> {t('Call us', 'কল করুন')}</a>}</div>
          {!isContactPage && section.locations?.length ? <ul className="sf-contact-locs">{section.locations.map((location, index) => <li key={`${location.name.en}-${index}`} className="sf-card">
            <strong>{location.name[lang]}</strong><span>{location.address[lang]}</span>
            <div className="sf-contact-loc-actions"><a href={mapUrl(location.mapQuery)} target="_blank" rel="noopener noreferrer"><MapPin size={14} aria-hidden="true" /> {section.mapLabel?.[lang] ?? t('Open in Maps', 'ম্যাপে দেখুন')}</a>
              {location.phone && <a href={dial(location.phone)}><Phone size={14} aria-hidden="true" /> {localizeDigits(location.phone, lang)}</a>}
            </div>
          </li>)}</ul> : null}
        </div>
      </section>
    }

    case 'carousel':
      return <section className="sf-block"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} lead={section.body} lang={lang} />
        <div className={section.presentation === 'scroller' ? 'sf-scroller' : 'sf-grid'} style={{ '--cols': 3 } as CSSProperties}>
          {section.items.map((item, index) => <AnimatedCard key={`${item.title.en}-${index}`} href={item.href} className="sf-news-card">
            <div className="sf-card-media"><SafeImage src={item.image?.src || fallbackCardImage(item.title, item.href)} alt={item.image?.alt?.[lang] || item.title[lang]} fill sizes="(max-width: 700px) 85vw, 33vw" className="sf-cover" />
              {item.tag && <span className="sf-chip sf-chip--float">{item.tag[lang]}</span>}</div>
            <div className="sf-card-body"><h3 className="sf-h3">{item.title[lang]}</h3>{item.body && <p className="sf-body sf-clamp-3">{item.body[lang]}</p>}
              {item.href && <span className="sf-more">{readMore} <span aria-hidden="true">→</span></span>}
            </div>
          </AnimatedCard>)}
        </div>
      </section>

    case 'reports': {
      const items = section.items.filter((item) => item.title?.en || item.title?.bn || item.file)
      return <section className="sf-block"><SectionHeading eyebrow={section.eyebrow} heading={section.heading} lead={section.body} lang={lang} />
        <ul className="sf-notices">{items.map((item, index) => <li key={`${item.title.en}-${index}`}>
          {item.file ? <a className="sf-notice" href={item.file} target="_blank" rel="noopener noreferrer"><time className="sf-notice-date">{localizeDigits(item.publishedAt ?? item.category?.[lang] ?? '', lang)}</time><div><strong>{item.title[lang]}</strong>{item.description && <p>{item.description[lang]}</p>}</div><Download size={18} aria-hidden="true" /></a>
            : <div className="sf-notice"><time className="sf-notice-date">{localizeDigits(item.publishedAt ?? item.category?.[lang] ?? '', lang)}</time><div><strong>{item.title[lang]}</strong>{item.description && <p>{item.description[lang]}</p>}</div></div>}
        </li>)}</ul>
        {!items.length && <p>{t('Official reports will appear here after publication through the CMS.', 'CMS-এর মাধ্যমে প্রকাশের পর অফিসিয়াল রিপোর্ট এখানে দেখা যাবে।')}</p>}
      </section>
    }

    case 'diagram':
      return <div className="sf-block"><Diagram section={section} /></div>

    case 'donation':
      return <section className="sf-block"><SectionHeading heading={section.heading} lead={section.body} lang={lang} /><DonationForm /></section>

    case 'contentFeed': {
      const labels: Record<string, Localized> = {
        project: { en: 'Project', bn: 'প্রকল্প' }, news: { en: 'News', bn: 'সংবাদ' }, enterprise: { en: 'Enterprise', bn: 'উদ্যোগ' },
        'partner-agency': { en: 'Partner agency', bn: 'অংশীদার সংস্থা' }, 'health-service': { en: 'Health service', bn: 'স্বাস্থ্যসেবা' },
        'loan-product': { en: 'Loan product', bn: 'ঋণ পণ্য' }, product: { en: 'Product / service', bn: 'পণ্য ও সেবা' }, team: { en: 'Team', bn: 'টিম' },
        notice: { en: 'Notice', bn: 'নোটিশ' }, report: { en: 'Report', bn: 'প্রতিবেদন' }, job: { en: 'Job', bn: 'চাকরি' },
      }
      return <section className="sf-block"><SectionHeading heading={section.heading} lang={lang} />
        <div className="sf-grid" style={{ '--cols': 2 } as CSSProperties}>
          {section.items.map((item) => <AnimatedCard key={`${item.component}-${item.id}`} href={item.href} className="sf-feed-card">
            <div className="sf-card-media"><SafeImage src={item.image || fallbackCardImage(item.title, item.href)} alt={item.title[lang]} fill sizes="(max-width: 700px) 100vw, 50vw" className="sf-cover" /></div>
            <div className="sf-card-body"><small>{labels[item.component]?.[lang] ?? item.component}{item.deadline ? ` · ${item.deadline}` : ''}</small><h3 className="sf-h3">{item.title[lang]}</h3>
              {item.summary[lang] && <p className="sf-body">{item.summary[lang]}</p>}<time>{item.date}</time>
            </div>
          </AnimatedCard>)}
          {section.items.length === 0 && <p>{t('Nothing to show yet.', 'এখনও কিছু নেই।')}</p>}
        </div>
      </section>
    }

    default:
      return null
  }
}

