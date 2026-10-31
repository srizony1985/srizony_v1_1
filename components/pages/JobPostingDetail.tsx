'use client'

import { useEffect, useRef, useState } from 'react'
import { BriefcaseBusiness, CalendarDays, Clock3, MapPin, Users, Wallet } from 'lucide-react'
import { useSite } from '@/components/containers/SiteProvider'
import JobApplicationForm from '@/components/pages/JobApplicationForm'
import SectionRenderer from '@/components/pages/SectionRenderer'
import { getContentRouteParent } from '@/lib/cms/routes'
import type { PageData, Section } from '@/types/entityType'

function formatDate(value: string | undefined, lang: 'en' | 'bn') {
  if (!value) return ''
  const date = new Date(`${value.slice(0, 10)}T12:00:00+06:00`)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(date)
  } catch { return value }
}

type Props = { page: PageData; sections: Section[]; canonicalPath: string }

export default function JobPostingDetail({ page, sections, canonicalPath }: Props) {
  const { lang } = useSite()
  const bn = lang === 'bn'
  const [applicationOpen, setApplicationOpen] = useState(false)
  const applicationPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!applicationOpen) return
    applicationPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    applicationPanelRef.current?.focus({ preventScroll: true })
  }, [applicationOpen])
  const job = page.jobDetails || {}
  const jobSlug = page.contentSlug || canonicalPath.split('/').filter(Boolean).at(-1) || ''
  const facts = [
    job.location?.[lang] ? { key: 'location', label: bn ? 'কর্মস্থল' : 'Location', value: job.location[lang], Icon: MapPin } : null,
    job.employmentType ? { key: 'employment', label: bn ? 'চাকরির ধরন' : 'Employment type', value: job.employmentType, Icon: BriefcaseBusiness } : null,
    job.vacancies ? { key: 'vacancies', label: bn ? 'পদসংখ্যা' : 'Vacancies', value: job.vacancies, Icon: Users } : null,
    job.salary ? { key: 'salary', label: bn ? 'বেতন' : 'Salary', value: job.salary, Icon: Wallet } : null,
    job.deadline ? { key: 'deadline', label: bn ? 'আবেদনের শেষ তারিখ' : 'Application deadline', value: formatDate(job.deadline, lang), Icon: CalendarDays } : null,
    job.postedAt ? { key: 'posted', label: bn ? 'প্রকাশের তারিখ' : 'Posted on', value: formatDate(job.postedAt, lang), Icon: Clock3 } : null,
  ].filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))

  return <div className="sf-job-posting">
    <section className="sf-job-overview sf-card" aria-labelledby="sf-job-overview-title">
      <div className="sf-job-overview-heading">
        <div>
          <p className="sf-eyebrow">{bn ? 'ক্যারিয়ার সুযোগ' : 'CAREER OPPORTUNITY'}</p>
          <h2 id="sf-job-overview-title" className="sf-h2">{bn ? 'পদের বিবরণ' : 'Position overview'}</h2>
        </div>
        <span className="sf-chip sf-job-open-chip"><span aria-hidden="true" />{bn ? 'আবেদন চলমান' : 'Applications open'}</span>
      </div>
      {facts.length > 0 && <dl className="sf-job-facts">{facts.map(({ key, label, value, Icon }) => <div className="sf-job-fact" key={key}>
        <dt><Icon size={17} aria-hidden="true" /> {label}</dt>
        <dd>{value}</dd>
      </div>)}</dl>}
    </section>

    <div className="sf-job-description">
      <SectionRenderer sections={sections} page={page} />
    </div>

    <section className="sf-job-apply-callout" aria-labelledby="sf-job-apply-title">
      <div className="sf-job-apply-copy">
        <h2 id="sf-job-apply-title" className="sf-h3">{bn ? 'এই পদে আবেদন করতে প্রস্তুত?' : 'Ready to apply for this position?'}</h2>
        <p className="sf-body">{bn ? 'আবেদন ফরম খুলতে নিচের বোতামে চাপ দিন। আপনার PDF জীবনবৃত্তান্ত প্রস্তুত রাখুন।' : 'Open the application form when you are ready. Please have your resume in PDF format ready.'}</p>
      </div>
      <button className="sf-btn sf-btn--primary sf-btn--lg sf-job-apply-button" type="button" aria-expanded={applicationOpen} aria-controls="sf-job-application-panel" onClick={() => setApplicationOpen((open) => !open)}>
        {applicationOpen ? (bn ? 'ফরম বন্ধ করুন' : 'Close application form') : (bn ? 'আবেদন করুন' : 'Apply now')}
      </button>
    </section>

    {applicationOpen && <div ref={applicationPanelRef} id="sf-job-application-panel" className="sf-job-application-panel" role="region" tabIndex={-1} aria-label={bn ? 'চাকরির আবেদন ফরম' : 'Job application form'}>
      <JobApplicationForm jobSlug={jobSlug} jobRouteParent={getContentRouteParent(canonicalPath)} />
    </div>}
  </div>
}
