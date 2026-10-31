'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, BriefcaseBusiness, CalendarDays, FileText, MapPin, Paperclip, Users } from 'lucide-react'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Reveal from '@/components/containers/Reveal'
import SafeImage from '@/components/ui/SafeImage'
import type { Lang } from '@/types/entityType'
import type { FeedItem } from '@/lib/cms/components'
import { localizeDigits } from '@/lib/utils'

type Props = { item: FeedItem; lang: Lang; index?: number }

const copy = (lang: Lang, en: string, bn: string) => lang === 'en' ? en : bn

function formatDate(value: string | undefined, lang: Lang) {
  if (!value) return ''
  const date = new Date(`${value.slice(0, 10)}T12:00:00+06:00`)
  if (Number.isNaN(date.getTime())) return localizeDigits(value, lang)
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka',
    }).format(date)
  } catch {
    return localizeDigits(value, lang)
  }
}

function statusLabel(value: string | undefined, lang: Lang) {
  const key = (value ?? '').trim().toLowerCase()
  if (key === 'ongoing') return copy(lang, 'Ongoing', 'চলমান')
  if (key === 'completed') return copy(lang, 'Completed', 'সম্পন্ন')
  if (key === 'planned') return copy(lang, 'Planned', 'পরিকল্পিত')
  return value || ''
}

function FeedLink({ href, className, delay, children }: {
  href: string
  className: string
  delay: number
  children: ReactNode
}) {
  return <Reveal delay={delay} className="sf-feed-grid-item">
    <Link href={href} className={`clickable-card sf-feed-card ${className}`}>
      {children}
    </Link>
  </Reveal>
}

/**
 * Use the card designs that already belong to SF: carousel-card for projects,
 * notice-card for notices, and the shared Card primitives for job posts. Project
 * and job images are shown only when the CMS has an approved image URL.
 */
export default function ContentFeedCard({ item, lang, index = 0 }: Props) {
  const title = item.title?.[lang] || item.title?.en || item.slug
  const summary = item.summary?.[lang] || item.summary?.en || ''
  const date = formatDate(item.date, lang)
  const fallbackParents: Partial<Record<FeedItem['component'], string>> = {
    project: '/projects', news: '/news', enterprise: '/enterprise-development', notice: '/notice',
    'partner-agency': '/about-us/partners-networks', 'health-service': '/social-development/health-program',
    'loan-product': '/organizational-development', product: '/enterprise-development', team: '/management-staff',
    report: '/resources', job: '/carrer-job', 'success-story': '/success-stories',
  }
  const fallbackParent = fallbackParents[item.component] || '/'
  const href = item.href || `${fallbackParent === '/' ? '' : fallbackParent}/${item.slug}`

  if (item.component === 'project') {
    return <FeedLink href={href} delay={index * 35} className="carousel-card sf-feed-card--project">
      <figure className={`media-image sf-feed-project-media ${item.image ? '' : 'sf-feed-media-placeholder'}`}>
        {item.image ? <SafeImage src={item.image} alt={title} fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw" className="sf-feed-project-image" /> : <span aria-hidden="true"><FileText size={30}/></span>}
      </figure>
      <div className="carousel-card-body">
        <h3>{title}</h3>
        {summary && <p className="sf-feed-summary sf-clamp-2">{summary}</p>}
        {(item.projectStatus || date) && <div className="sf-feed-card-tags">
          {item.projectStatus && <span className="pill">{statusLabel(item.projectStatus, lang)}</span>}
          {!item.projectStatus && date && <time>{date}</time>}
        </div>}
        <span className="sf-feed-card-more">{copy(lang, 'View project', 'প্রকল্প দেখুন')} <ArrowRight size={14} aria-hidden="true" /></span>
      </div>
    </FeedLink>
  }

  if (item.component === 'notice') {
    return <FeedLink href={href} delay={index * 25} className="notice-card sf-feed-card--notice">
      <time className="notice-date">{date || copy(lang, 'Notice', 'নোটিশ')}</time>
      <div className="sf-feed-notice-copy">
        <h3>{title}</h3>
        {summary && <p className="sf-feed-summary sf-clamp-2">{summary}</p>}
        {item.attachment && <small className="sf-feed-attachment"><Paperclip size={12} aria-hidden="true" /> {copy(lang, 'Attachment', 'সংযুক্তি')}</small>}
      </div>
      <ArrowRight size={17} aria-hidden="true" className="sf-feed-card-arrow" />
    </FeedLink>
  }

  if (item.component === 'job') {
    const vacancies = item.vacancies ? Number(item.vacancies) : 0
    const location = item.location?.[lang] || ''
    const facts = [
      location ? { key: 'location', icon: MapPin, label: location } : null,
      item.employmentType ? { key: 'employment', icon: BriefcaseBusiness, label: item.employmentType } : null,
      vacancies > 0 ? { key: 'vacancies', icon: Users, label: copy(lang, `${vacancies} ${vacancies === 1 ? 'vacancy' : 'vacancies'}`, `${localizeDigits(String(vacancies), lang)}টি পদ`) } : null,
    ].filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))

    return <FeedLink href={href} delay={index * 25} className="sf-feed-card--job">
      <Card className="sf-job-feed-card">
        {item.image ? <div className="sf-job-feed-media">
          <SafeImage src={item.image} alt={title} fill sizes="(max-width: 640px) 100vw, 120px" className="sf-job-feed-image" />
        </div> : <div className="sf-job-feed-media sf-job-feed-media--placeholder" aria-hidden="true"><BriefcaseBusiness size={28} /></div>}
        <div className="sf-job-feed-content">
          <CardHeader className="sf-job-feed-header">
            <span className="sf-job-feed-kicker">{copy(lang, 'Career opportunity', 'ক্যারিয়ার সুযোগ')}</span>
            <CardTitle className="sf-job-feed-title">{title}</CardTitle>
            {summary && <CardDescription className="sf-job-feed-summary">{summary}</CardDescription>}
            {facts.length > 0 && <div className="sf-job-feed-facts">{facts.map(({ key, icon: Icon, label }) => <span key={key}><Icon size={13} aria-hidden="true" />{label}</span>)}</div>}
          </CardHeader>
          <CardFooter className="sf-job-feed-footer">
            <div className="sf-job-feed-meta">
              {item.deadline ? <span className="sf-job-feed-deadline"><CalendarDays size={14} aria-hidden="true" /> <span>{copy(lang, 'Apply by', 'আবেদনের শেষ তারিখ')} <strong>{formatDate(item.deadline, lang)}</strong></span></span> : <span className="sf-job-feed-open"><span aria-hidden="true" />{copy(lang, 'Applications open', 'আবেদন চলছে')}</span>}
            </div>
            <span className="ui-button ui-button-default ui-button-sm sf-job-feed-action">{copy(lang, 'View position', 'পদের বিবরণ')} <ArrowRight size={14} aria-hidden="true" /></span>
          </CardFooter>
        </div>
      </Card>
    </FeedLink>
  }

  return <FeedLink href={href} delay={index * 25} className="content-card sf-feed-card--generic">
    {item.image ? <figure className="sf-feed-generic-media"><SafeImage src={item.image} alt={title} fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw" /></figure> : <span className="card-icon sf-feed-card-icon" aria-hidden="true"><FileText size={18} /></span>}
    <span className="card-tag sf-feed-card-kicker">{item.category?.[lang] || item.component.replaceAll('-', ' ')}</span>
    <div className="content-card-copy">
      <h3>{title}</h3>
      {summary && <p className="sf-feed-summary sf-clamp-2">{summary}</p>}
    </div>
    {date && <time className="sf-feed-date">{date}</time>}
    <span className="sf-feed-card-more">{copy(lang, 'Read more', 'আরও পড়ুন')} <ArrowRight size={14} aria-hidden="true" /></span>
  </FeedLink>
}
