'use client'

import './jobs.css'
import { useMemo, useState } from 'react'
import {
  ArrowLeft, Bell, BriefcaseBusiness, ChevronRight, CirclePlus,
  Clock3, FileText, Inbox, Mail, Phone, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  APPLICATION_STATUSES, getApplicantNotifications, getJobApplications, getJobs,
  setApplicationStatus, type ApplicantNotifications, type JobApplication, type JobSummary,
} from '@/lib/api/jobs'
import { listContent } from '@/lib/api/siteContent'
import type { ContentRecord } from '@/lib/cms/components'
import { AdminErrorState, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import { ContentEditor } from '../_components/ContentEditor'

type JobsMode = { kind: 'new' } | { kind: 'edit'; id: number } | { kind: 'applications'; id: number } | { kind: 'notifications' } | null
type JobVisibilityFilter = 'all' | 'published' | 'draft' | 'hidden'
type ApplicantStatusFilter = 'all' | typeof APPLICATION_STATUSES[number]

const JOB_FILTERS: { value: JobVisibilityFilter; label: string }[] = [
  { value: 'all', label: 'All jobs' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'hidden', label: 'Hidden' },
]
const APPLICATION_FILTERS: { value: ApplicantStatusFilter; label: string }[] = [
  { value: 'all', label: 'All applicants' },
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hired', label: 'Hired' },
]

const dateLabel = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(date)
}

export default function JobsPage() {
  const jobs = useAdminFetch<JobSummary[]>(getJobs)
  const [mode, setMode] = useState<JobsMode>(null)
  const [record, setRecord] = useState<ContentRecord | null>(null)
  const [jobVisibilityFilter, setJobVisibilityFilter] = useState<JobVisibilityFilter>('all')
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<ApplicantStatusFilter>('all')
  const [notificationCategoryFilter, setNotificationCategoryFilter] = useState('all')
  const jobId = mode && (mode.kind === 'applications' || mode.kind === 'edit') ? mode.id : 0
  const apps = useAdminFetch<JobApplication[]>(async () => mode?.kind === 'applications' ? getJobApplications(jobId) : [], [mode?.kind, jobId])
  const notifications = useAdminFetch<ApplicantNotifications>(async () => mode?.kind === 'notifications' ? getApplicantNotifications() : { total: 0, items: [] }, [mode?.kind])
  const selectedJob = useMemo(() => jobs.data?.find((job) => job.id === jobId), [jobs.data, jobId])
  const newApplicantCount = useMemo(() => (jobs.data ?? []).reduce((total, job) => total + job.newApplications, 0), [jobs.data])

  const jobsByVisibility = useMemo(() => {
    const list = jobs.data ?? []
    return {
      all: list.length,
      published: list.filter((job) => job.status === 'published').length,
      draft: list.filter((job) => job.status === 'draft').length,
      hidden: list.filter((job) => job.status === 'hidden').length,
    }
  }, [jobs.data])
  const visibleJobs = useMemo(() => (jobs.data ?? []).filter((job) => jobVisibilityFilter === 'all' || job.status === jobVisibilityFilter), [jobs.data, jobVisibilityFilter])

  const applicationStatusCounts = useMemo(() => {
    const list = apps.data ?? []
    return {
      all: list.length,
      new: list.filter((app) => app.status === 'new').length,
      reviewing: list.filter((app) => app.status === 'reviewing').length,
      shortlisted: list.filter((app) => app.status === 'shortlisted').length,
      rejected: list.filter((app) => app.status === 'rejected').length,
      hired: list.filter((app) => app.status === 'hired').length,
    }
  }, [apps.data])
  const visibleApplications = useMemo(() => (apps.data ?? []).filter((app) => applicationStatusFilter === 'all' || app.status === applicationStatusFilter), [apps.data, applicationStatusFilter])

  const notificationGroups = useMemo(() => {
    const groups = new Map<string, { name: string; jobs: Map<number, { id: number; title: string; count: number; applicants: JobApplication[] }> }>()
    for (const applicant of notifications.data?.items ?? []) {
      const category = applicant.jobCategory?.en?.trim() || 'Uncategorized'
      if (!groups.has(category)) groups.set(category, { name: category, jobs: new Map() })
      const group = groups.get(category)!
      if (!group.jobs.has(applicant.jobId)) group.jobs.set(applicant.jobId, { id: applicant.jobId, title: applicant.jobTitle, count: 0, applicants: [] })
      const job = group.jobs.get(applicant.jobId)!
      job.count += 1
      job.applicants.push(applicant)
    }
    return [...groups.values()].map((group) => ({
      ...group,
      count: [...group.jobs.values()].reduce((sum, job) => sum + job.count, 0),
      jobs: [...group.jobs.values()].sort((a, b) => b.applicants[0].createdAt.localeCompare(a.applicants[0].createdAt)),
    })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [notifications.data])
  const notificationCategories = useMemo(() => ['all', ...notificationGroups.map((group) => group.name)], [notificationGroups])
  const visibleNotificationGroups = useMemo(() => notificationCategoryFilter === 'all' ? notificationGroups : notificationGroups.filter((group) => group.name === notificationCategoryFilter), [notificationGroups, notificationCategoryFilter])

  async function openEdit(id: number) {
    try {
      const all = await listContent('job')
      setRecord(all.find((item) => item.id === id) ?? null)
      setMode({ kind: 'edit', id })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load the job.')
    }
  }

  async function changeStatus(id: number, status: string) {
    try {
      await setApplicationStatus(id, status)
      apps.setData((current) => (current ?? []).map((app) => app.id === id ? { ...app, status } : app))
      void jobs.reload()
      if (mode?.kind === 'notifications') void notifications.reload()
      toast.success('Applicant status updated.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update the application.')
    }
  }

  return <>
    <SectionToolbar
      title="Job Management"
      description="Manage vacancies, review applications and track each applicant through the recruitment workflow."
      count={jobs.data?.length ?? 0}
      onRefresh={() => { void jobs.reload(); if (mode?.kind === 'applications') void apps.reload(); if (mode?.kind === 'notifications') void notifications.reload() }}
      refreshing={jobs.loading}
      actions={<>
        <Button variant="outline" className="job-notification-trigger" onClick={() => { setNotificationCategoryFilter('all'); setMode({ kind: 'notifications' }) }}>
          <Bell size={15} />
          <span>New applicants</span>
          <span className="job-notification-count" aria-label={`${newApplicantCount} new applicants`}>{newApplicantCount.toLocaleString()}</span>
        </Button>
        <Button onClick={() => { setRecord(null); setMode({ kind: 'new' }) }}><CirclePlus size={15} /> Create new job</Button>
      </>}
    />

    {jobs.loading && !jobs.data ? <PageLoading rows={3} /> : jobs.error ? <AdminErrorState message={jobs.error} onRetry={() => void jobs.reload()} /> : (
      <div className={`jobs-workspace ${mode?.kind === 'notifications' ? 'is-notifications' : ''}`}>
        <aside className="jobs-list-panel" aria-label="Job posts">
          <div className="jobs-panel-heading"><div><h2>Vacancies</h2><p>Filter by publishing status</p></div><Badge variant="outline">{visibleJobs.length}</Badge></div>
          <div className="job-filter-tabs" role="tablist" aria-label="Filter job posts by status">
            {JOB_FILTERS.map((filter) => <button key={filter.value} type="button" role="tab" aria-selected={jobVisibilityFilter === filter.value} className={jobVisibilityFilter === filter.value ? 'active' : ''} onClick={() => setJobVisibilityFilter(filter.value)}>
              {filter.label}<span>{jobsByVisibility[filter.value]}</span>
            </button>)}
          </div>
          <div className="jobs-list-items">
            {visibleJobs.map((job) => <article key={job.id} className={`jobs-list-item ${jobId === job.id ? 'active' : ''}`}>
              <button type="button" className="jobs-list-item-main" onClick={() => { setApplicationStatusFilter('all'); setMode({ kind: 'applications', id: job.id }) }}>
                <span className="jobs-list-item-title">{job.title.en}</span>
                <span className="jobs-list-item-meta"><BriefcaseBusiness size={12} /> {job.category?.en || 'Uncategorized'} <span>·</span> {job.slug}</span>
              </button>
              <div className="jobs-list-item-footer">
                <Badge variant={job.status === 'published' ? 'default' : 'outline'}>{job.status}</Badge>
                <span className="jobs-list-count"><Users size={12} /> {job.applications} applicants</span>
                {job.newApplications > 0 && <button type="button" className="jobs-new-count" onClick={() => { setNotificationCategoryFilter('all'); setMode({ kind: 'notifications' }) }}>{job.newApplications} new</button>}
                <Button variant="ghost" size="sm" onClick={() => void openEdit(job.id)}>Edit</Button>
              </div>
            </article>)}
            {!visibleJobs.length && <div className="admin-empty-state">No {jobVisibilityFilter === 'all' ? '' : `${jobVisibilityFilter} `}jobs found.</div>}
          </div>
        </aside>

        <section className="jobs-detail-panel" aria-live="polite">
          {mode?.kind === 'new' && <ContentEditor key="new-job" component="job" record={null} onSaved={(saved) => { setRecord(saved); setMode({ kind: 'edit', id: saved.id }); void jobs.reload() }} onDeleted={() => undefined} onClose={() => setMode(null)} />}
          {mode?.kind === 'edit' && record && <ContentEditor key={record.id} component="job" record={record} onSaved={(saved) => { setRecord(saved); void jobs.reload() }} onDeleted={() => { setMode(null); setRecord(null); void jobs.reload() }} onClose={() => setMode(null)} />}

          {mode?.kind === 'notifications' && <div className="admin-data-card jobs-notification-inbox">
            <div className="jobs-detail-heading">
              <div><p className="jobs-kicker"><Inbox size={13} /> APPLICANT INBOX</p><h2>New applicant notifications</h2><p>{notifications.data?.total ?? newApplicantCount} new applications across all vacancies</p></div>
              <Button variant="outline" size="sm" onClick={() => setMode(null)}><ArrowLeft size={14} /> Back to jobs</Button>
            </div>
            {notifications.loading && !notifications.data ? <PageLoading rows={3} /> : notifications.error ? <AdminErrorState message={notifications.error} onRetry={() => void notifications.reload()} /> : (
              <>
                <div className="jobs-inbox-summary"><strong>{(notifications.data?.total ?? 0).toLocaleString()}</strong><span>new applications</span><small>Grouped by the job category set in each vacancy. Open a vacancy to review and update applicant statuses.</small></div>
                {(notifications.data?.total ?? 0) > (notifications.data?.items.length ?? 0) && <p className="jobs-inbox-limit-note">Showing the latest 2,000 applications. The total count includes all new applications.</p>}
                {notificationGroups.length > 0 && <div className="job-category-tabs" role="tablist" aria-label="Filter notifications by job category">
                  {notificationCategories.map((category) => <button key={category} type="button" role="tab" aria-selected={notificationCategoryFilter === category} className={notificationCategoryFilter === category ? 'active' : ''} onClick={() => setNotificationCategoryFilter(category)}>
                    {category === 'all' ? 'All categories' : category}
                    <span>{category === 'all' ? notifications.data?.items.length ?? 0 : notificationGroups.find((group) => group.name === category)?.count ?? 0}</span>
                  </button>)}
                </div>}
                <div className="job-notification-groups">
                  {visibleNotificationGroups.map((group) => <section key={group.name} className="job-notification-category">
                    <header><div><h3>{group.name}</h3><small>{group.jobs.length} {group.jobs.length === 1 ? 'vacancy' : 'vacancies'}</small></div><Badge>{group.count} new</Badge></header>
                    {group.jobs.map((job) => <div key={job.id} className="job-notification-job">
                      <div className="job-notification-job-heading"><div><h4>{job.title}</h4><span>{job.count} new applicants</span></div><Button size="sm" onClick={() => { setApplicationStatusFilter('new'); setMode({ kind: 'applications', id: job.id }) }}>Review applicants <ChevronRight size={14} /></Button></div>
                      <div className="job-notification-applicants">
                        {job.applicants.map((applicant) => <article key={applicant.id} className="job-notification-applicant">
                          <div className="job-applicant-avatar" aria-hidden="true">{applicant.name.trim().slice(0, 1).toUpperCase()}</div>
                          <div className="job-applicant-copy"><strong>{applicant.name}</strong><span><Mail size={12} /> {applicant.email}</span>{applicant.phone && <span><Phone size={12} /> {applicant.phone}</span>}</div>
                          <time dateTime={applicant.createdAt}><Clock3 size={12} /> {dateLabel(applicant.createdAt)}</time>
                          {applicant.resumeUrl && <a className="job-applicant-resume" href={applicant.resumeUrl} target="_blank" rel="noreferrer noopener"><FileText size={13} /> CV</a>}
                        </article>)}
                      </div>
                    </div>)}
                  </section>)}
                  {!notificationGroups.length && <div className="admin-empty-state"><Bell size={22} /><strong>No new applicants</strong><span>New job applications will appear here as notifications.</span></div>}
                </div>
              </>
            )}
          </div>}

          {mode?.kind === 'applications' && <div className="admin-data-card jobs-applications-card">
            <div className="jobs-detail-heading">
              <div><p className="jobs-kicker"><Users size={13} /> RECRUITMENT WORKFLOW</p><h2>Applications — {selectedJob?.title.en || 'Selected vacancy'}</h2><p>{selectedJob?.category?.en || 'Uncategorized'} · {apps.data?.length ?? 0} received</p></div>
              <Button variant="outline" size="sm" onClick={() => setMode(null)}><ArrowLeft size={14} /> Back to jobs</Button>
            </div>
            <div className="application-status-tabs" role="tablist" aria-label="Filter applicants by recruitment status">
              {APPLICATION_FILTERS.map((filter) => <button key={filter.value} type="button" role="tab" aria-selected={applicationStatusFilter === filter.value} className={applicationStatusFilter === filter.value ? 'active' : ''} onClick={() => setApplicationStatusFilter(filter.value)}>
                {filter.label}<span>{applicationStatusCounts[filter.value]}</span>
              </button>)}
            </div>
            {apps.loading ? <PageLoading rows={2} /> : apps.error ? <AdminErrorState message={apps.error} onRetry={() => void apps.reload()} /> : (
              <div className="admin-table-scroll"><table className="admin-table jobs-applications-table"><thead><tr><th>Applicant</th><th>Contact</th><th>Cover letter</th><th>Resume</th><th>Applied</th><th>Status</th></tr></thead><tbody>
                {visibleApplications.map((applicant) => <tr key={applicant.id}>
                  <td><strong>{applicant.name}</strong><small>{applicant.jobCategory?.en || selectedJob?.category?.en || 'Uncategorized'}</small></td>
                  <td><a href={`mailto:${applicant.email}`}>{applicant.email}</a><small>{applicant.phone || 'No phone provided'}</small></td>
                  <td className="jobs-cover-letter" title={applicant.coverLetter}>{applicant.coverLetter.slice(0, 120) || '—'}{applicant.coverLetter.length > 120 && '…'}</td>
                  <td>{applicant.resumeUrl ? <a href={applicant.resumeUrl} target="_blank" rel="noreferrer noopener">Open CV</a> : '—'}</td>
                  <td>{dateLabel(applicant.createdAt)}</td>
                  <td><select className="ui-select dashboard-status" value={applicant.status} onChange={(event) => void changeStatus(applicant.id, event.target.value)} aria-label={`Update status for ${applicant.name}`}>{APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                </tr>)}
                {!visibleApplications.length && <tr><td colSpan={6} className="admin-empty-cell">No applicants in this status.</td></tr>}
              </tbody></table></div>
            )}
          </div>}
          {!mode && <div className="jobs-placeholder"><BriefcaseBusiness size={26} /><strong>Select a vacancy</strong><span>Choose a job to review its applications, or open the new applicant inbox to see recent submissions by category.</span></div>}
        </section>
      </div>
    )}
  </>
}
