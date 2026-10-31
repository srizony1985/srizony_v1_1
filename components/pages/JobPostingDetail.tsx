'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BriefcaseBusiness, CalendarDays, Clock3, MapPin, Users, Wallet, X } from 'lucide-react'
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
  const [portalReady, setPortalReady] = useState(false)
  const applicationPanelRef = useRef<HTMLDivElement>(null)

  // Render the application dialog outside animated page wrappers and all local
  // stacking contexts (sticky navigation, maps, transformed sections, etc.).
  useEffect(() => setPortalReady(true), [])

  useEffect(() => {
    if (!applicationOpen || !portalReady) return

    const root = document.documentElement
    const body = document.body
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth)

    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`
    }

    const panel = applicationPanelRef.current
    panel?.focus()

    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => (
      element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== 'hidden'
    ))

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setApplicationOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusable()
      if (!focusable.length) {
        event.preventDefault()
        panel?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!panel?.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      root.style.overflow = previousRootOverflow
      body.style.overflow = previousBodyOverflow
      body.style.paddingRight = previousBodyPaddingRight
      window.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [applicationOpen, portalReady])
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
        <p className="sf-eyebrow">{bn ? 'পরবর্তী ধাপ' : 'NEXT STEP'}</p>
        <h2 id="sf-job-apply-title" className="sf-h3">{bn ? 'আবেদন শুরু করতে প্রস্তুত?' : 'Ready to take the next step?'}</h2>
        <p className="sf-body">{bn ? 'আপনার তথ্য ও জীবনবৃত্তান্ত জমা দিন। আবেদন সফল হলে একটি রেফারেন্স নম্বর পাবেন।' : 'Submit your details and resume. You will receive a reference number when your application is complete.'}</p>
        <ol className="sf-job-process" aria-label={bn ? 'আবেদনের ধাপ' : 'Application steps'}>
          <li><span>1</span><strong>{bn ? 'তথ্য পূরণ' : 'Your details'}</strong></li>
          <li><span>2</span><strong>{bn ? 'CV সংযুক্তি' : 'Attach CV'}</strong></li>
          <li><span>3</span><strong>{bn ? 'জমা ও রেফারেন্স' : 'Submit & track'}</strong></li>
        </ol>
      </div>
      <button className="sf-btn sf-btn--primary sf-btn--lg sf-job-apply-button" type="button" aria-haspopup="dialog" onClick={() => setApplicationOpen(true)}>
        {bn ? 'এখনই আবেদন করুন' : 'Apply for this role'}
      </button>
    </section>

    {applicationOpen && portalReady && createPortal(
      <div
        className="sf-job-modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setApplicationOpen(false)
        }}
      >
        <div
          ref={applicationPanelRef}
          id="sf-job-application-panel"
          className="sf-job-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sf-job-modal-title"
          tabIndex={-1}
        >
          <header className="sf-job-modal-header">
            <div>
              <p className="sf-eyebrow">{bn ? 'চাকরির আবেদন' : 'JOB APPLICATION'}</p>
              <h2 id="sf-job-modal-title">{bn ? 'আপনার আবেদন জমা দিন' : 'Submit your application'}</h2>
              <p>{page.title?.[lang] || page.title?.en || ''}</p>
            </div>
            <button
              className="sf-job-modal-close"
              type="button"
              aria-label={bn ? 'ফরম বন্ধ করুন' : 'Close application form'}
              onClick={() => setApplicationOpen(false)}
            >
              <X size={20} />
            </button>
          </header>
          <div className="sf-job-modal-progress" aria-label={bn ? 'আবেদনের তিনটি ধাপ' : 'Three-step application process'}>
            <span><b>1</b> {bn ? 'তথ্য' : 'Details'}</span><i />
            <span><b>2</b> {bn ? 'CV' : 'Resume'}</span><i />
            <span><b>3</b> {bn ? 'জমা' : 'Submit'}</span>
          </div>
          <div className="sf-job-modal-body">
            <JobApplicationForm jobSlug={jobSlug} jobRouteParent={getContentRouteParent(canonicalPath)} />
          </div>
        </div>
      </div>,
      document.body,
    )}
  </div>
}
