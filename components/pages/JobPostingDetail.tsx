'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Check, Clock3, Download, FileText, MapPin, Share2, Users, Wallet, X } from 'lucide-react'
import ProcessSteps from '@/components/ui/ProcessSteps'
import { useSite } from '@/components/containers/SiteProvider'
import JobApplicationForm from '@/components/pages/JobApplicationForm'
import SectionRenderer from '@/components/pages/SectionRenderer'
import { getContentRouteParent } from '@/lib/cms/routes'
import type { PageData, Section } from '@/types/entityType'
import { DEFAULT_JOB_APPLICATION_PROCESS, type JobApplicationProcessConfig } from '@/lib/jobApplicationProcess'
import { isApplicationDeadlineOpen } from '@/lib/jobApplicationValidation'

const subscribeToClient = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

function formatDate(value: string | undefined, lang: 'en' | 'bn') {
  if (!value) return ''
  const date = new Date(`${value.slice(0, 10)}T12:00:00+06:00`)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(date)
  } catch { return value }
}

type Props = { page: PageData; sections: Section[]; canonicalPath: string; processConfig?: JobApplicationProcessConfig }

export default function JobPostingDetail({ page, sections, canonicalPath, processConfig = DEFAULT_JOB_APPLICATION_PROCESS }: Props) {
  const { lang } = useSite()
  const bn = lang === 'bn'
  const [applicationOpen, setApplicationOpen] = useState(false)
  const portalReady = useSyncExternalStore(subscribeToClient, getClientSnapshot, getServerSnapshot)
  const [shareMessage, setShareMessage] = useState('')
  const applicationPanelRef = useRef<HTMLDivElement>(null)

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
  const applicationDeadlineOpen = isApplicationDeadlineOpen(job.deadline)
  const jobSlug = page.contentSlug || canonicalPath.split('/').filter(Boolean).at(-1) || ''
  const facts = [
    job.location?.[lang] ? { key: 'location', label: bn ? 'কর্মস্থল' : 'Location', value: job.location[lang], Icon: MapPin } : null,
    job.employmentType ? { key: 'employment', label: bn ? 'চাকরির ধরন' : 'Employment type', value: job.employmentType, Icon: BriefcaseBusiness } : null,
    job.vacancies ? { key: 'vacancies', label: bn ? 'পদসংখ্যা' : 'Vacancies', value: job.vacancies, Icon: Users } : null,
    job.salary ? { key: 'salary', label: bn ? 'বেতন' : 'Salary', value: job.salary, Icon: Wallet } : null,
    job.deadline ? { key: 'deadline', label: bn ? 'আবেদনের শেষ তারিখ' : 'Application deadline', value: formatDate(job.deadline, lang), Icon: CalendarDays } : null,
    job.postedAt ? { key: 'posted', label: bn ? 'প্রকাশের তারিখ' : 'Posted on', value: formatDate(job.postedAt, lang), Icon: Clock3 } : null,
  ].filter((fact): fact is NonNullable<typeof fact> => Boolean(fact))

  const shareJob = () => {
    const shareData = {
      title: page.title?.[lang] || page.title?.en || (bn ? 'চাকরির বিজ্ঞপ্তি' : 'Job opportunity'),
      text: page.subtitle?.[lang] || '',
      url: window.location.href,
    }
    const sharing = typeof navigator.share === 'function'
      ? navigator.share(shareData).then(() => {
          setShareMessage(bn ? 'শেয়ার মেনু খোলা হয়েছে' : 'Share options opened')
        })
      : navigator.clipboard?.writeText
        ? navigator.clipboard.writeText(shareData.url).then(() => {
            setShareMessage(bn ? 'লিংক কপি হয়েছে' : 'Link copied')
          })
        : Promise.resolve().then(() => {
            setShareMessage(bn ? 'এই ব্রাউজারে শেয়ার সুবিধা নেই' : 'Sharing is not available in this browser')
          })

    void sharing.catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return
      setShareMessage(bn ? 'লিংক শেয়ার করা যায়নি' : 'Unable to share this link')
    })
  }

  return <div className="sf-job-posting">
    <div className="sf-job-detail-layout">
      <main className="sf-job-detail-main">
        <section className="sf-job-overview sf-card" aria-labelledby="sf-job-overview-title">
          <div className="sf-job-overview-heading">
            <div className="sf-job-overview-title">
              <p className="sf-eyebrow">{bn ? 'ক্যারিয়ার সুযোগ' : 'CAREER OPPORTUNITY'}</p>
              <h2 id="sf-job-overview-title" className="sf-h2">{bn ? 'পদের বিবরণ' : 'Position overview'}</h2>
            </div>
            <div className="sf-job-overview-actions">
              <span className={`sf-chip sf-job-open-chip ${applicationDeadlineOpen ? '' : 'is-closed'}`}><span aria-hidden="true" />{applicationDeadlineOpen ? (bn ? 'আবেদন চলমান' : 'Applications open') : (bn ? 'আবেদন বন্ধ' : 'Applications closed')}</span>
              <button className="sf-btn sf-btn--secondary sf-job-share" type="button" onClick={() => void shareJob()}>
                <Share2 size={16} aria-hidden="true" />{bn ? 'শেয়ার' : 'Share'}
              </button>
              {job.attachmentUrl && <a className="sf-btn sf-btn--secondary sf-job-circular-link" href={job.attachmentUrl} target="_blank" rel="noopener noreferrer">
                <Download size={16} aria-hidden="true" />{bn ? 'বিজ্ঞপ্তি' : 'Circular PDF'}<ArrowUpRight size={14} aria-hidden="true" />
              </a>}
            </div>
          </div>
          {shareMessage && <p className="sf-job-share-status" role="status"><Check size={14} aria-hidden="true" />{shareMessage}</p>}
          {facts.length > 0 && <dl className="sf-job-facts">{facts.map(({ key, label, value, Icon }) => <div className={`sf-job-fact ${key === 'deadline' ? 'sf-job-fact--deadline' : ''}`} key={key}>
            <dt><Icon size={17} aria-hidden="true" /> {label}</dt>
            <dd>{key === 'deadline' && job.deadline ? <time dateTime={job.deadline}>{value}</time> : value}</dd>
            {key === 'deadline' && <span className="sf-job-deadline-note">{bn ? 'আবেদনের শেষ সময়' : 'Submit before this date'}</span>}
          </div>)}</dl>}
        </section>

        <section className="sf-job-description" aria-label={bn ? 'পদের বিস্তারিত বিবরণ' : 'Full position description'}>
          <SectionRenderer sections={sections} page={page} />
        </section>
      </main>

      <aside className="sf-job-detail-aside" aria-label={bn ? 'আবেদন সম্পর্কিত তথ্য' : 'Application information'}>
        <section className="sf-job-apply-sidebar sf-card" aria-labelledby="sf-job-apply-sidebar-title">
          <p className="sf-eyebrow">{bn ? 'আবেদন শুরু করুন' : 'APPLICATION'}</p>
          <h2 id="sf-job-apply-sidebar-title">{bn ? 'এই পদে আবেদন করতে প্রস্তুত?' : 'Ready to apply for this role?'}</h2>
          <p>{bn ? 'যোগ্যতা ও পদের বিবরণ ভালোভাবে পড়ে অনলাইন আবেদন ফরম পূরণ করুন।' : 'Review the role requirements, then complete the secure online application form.'}</p>
          <button
            className="sf-btn sf-btn--primary sf-job-overview-apply"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={applicationOpen}
            aria-controls="sf-job-application-panel"
            disabled={!applicationDeadlineOpen}
            onClick={() => { if (applicationDeadlineOpen) setApplicationOpen(true) }}
          >
            {applicationDeadlineOpen ? (bn ? 'এখনই আবেদন করুন' : 'Apply now') : (bn ? 'আবেদনের সময় শেষ' : 'Applications closed')} {applicationDeadlineOpen && <ArrowUpRight size={17} aria-hidden="true" />}
          </button>
          {job.deadline && <div className="sf-job-sidebar-deadline">
            <CalendarDays size={17} aria-hidden="true" />
            <span><small>{bn ? 'আবেদনের শেষ তারিখ' : 'Application deadline'}</small><strong>{formatDate(job.deadline, lang)}</strong></span>
          </div>}
          <div className="sf-job-sidebar-note"><FileText size={16} aria-hidden="true" /><span>{bn ? 'জীবনবৃত্তান্ত PDF ফরম্যাটে প্রস্তুত রাখুন।' : 'Keep your latest resume ready in PDF format.'}</span></div>
        </section>
      </aside>
    </div>

    {processConfig.visible && processConfig.steps.some((step) => step.visible) && <section className="sf-job-apply-callout" aria-labelledby="sf-job-apply-title">
      <div className="sf-job-apply-copy">
        <p className="sf-eyebrow">{bn ? 'আবেদনের প্রক্রিয়া' : 'APPLICATION PROCESS'}</p>
        <h2 id="sf-job-apply-title" className="sf-h3">{bn ? 'আবেদন সম্পন্ন করার ধাপ' : 'What happens next'}</h2>
        <p className="sf-body">{bn ? 'আপনার আবেদনটি সম্পন্ন করতে নিচের ধাপগুলো অনুসরণ করুন।' : 'Complete these steps to submit your application and receive a reference number.'}</p>
      </div>
      <ProcessSteps
        className="sf-job-process-steps"
        ariaLabel={bn ? 'আবেদনের ধাপ' : 'Application steps'}
        steps={processConfig.steps.filter((step) => step.visible).map((step) => ({
          title: bn ? step.titleBn || step.titleEn : step.titleEn,
          description: bn ? step.descriptionBn || step.descriptionEn : step.descriptionEn,
        }))}
      />
    </section>}

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
