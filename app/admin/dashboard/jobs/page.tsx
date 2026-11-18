'use client'

import { useEffect, useMemo, useState } from 'react'
import { BriefcaseBusiness, Eye, FileText, Save, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { NativeSelect } from '@/components/ui/native-select'
import { AdminTable, AdminWorkspaceGrid, AdminDataContainer, type AdminTableColumn } from '@/components/admin/cms'
import {
  getJobApplications, getJobs, setApplicationStatus,
  type ApplicationStatus, type JobApplication, type JobSummary,
} from '@/lib/api/jobs'
import { getJobApplicationProcessConfig, saveJobApplicationProcessConfig } from '@/lib/api/adminJobs'
import { DEFAULT_JOB_APPLICATION_PROCESS, type JobApplicationProcessConfig } from '@/lib/jobApplicationProcess'
import { AdminErrorState, AdminSectionTabs, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import LifecycleWorkspace from '../_components/LifecycleWorkspace'
import JobApplicationFormBuilder from '@/components/admin/JobApplicationFormBuilder'

type JobsTab = 'vacancies' | 'applications' | 'process' | 'form'
type ApplicantStatusFilter = ApplicationStatus

type ApplicationSort = 'newest' | 'oldest' | 'name'

const APPLICATION_FILTERS: { value: ApplicantStatusFilter; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Short-listed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'hired', label: 'Hired' },
]
const RECRUITMENT_STATUS_FILTERS = APPLICATION_FILTERS

const dateLabel = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium', timeZone: 'Asia/Dhaka' }).format(date)
}

const statusLabel = (status: ApplicantStatusFilter) =>
  status === 'shortlisted' ? 'Short-listed' : status.charAt(0).toUpperCase() + status.slice(1)

function ApplicationProcessTab() {
  const process = useAdminFetch<JobApplicationProcessConfig>(getJobApplicationProcessConfig)

  const config = process.data ?? DEFAULT_JOB_APPLICATION_PROCESS

  return (
    <section className="jobs-process-page min-w-0" aria-label="Application process visibility">
      <AdminDataContainer
        label="Application process visibility"
        bodyScroll="auto"
        headerContent={
          <SectionToolbar
            title="Application process visibility"
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {process.data && JSON.stringify(config) !== JSON.stringify(process.data) && <Badge variant="outline">Unsaved changes</Badge>}
                <Button variant="outline" size="sm" onClick={() => void process.reload()} disabled={process.loading}>
                  Reload
                </Button>
                <Button size="sm" onClick={() => {}} disabled>
                  <Save size={14} /> Save visibility
                </Button>
              </div>
            }
          />
        }
      >
        {process.loading && !process.data ? (
          <PageLoading rows={2} />
        ) : process.error ? (
          <AdminErrorState message={process.error} onRetry={() => void process.reload()} />
        ) : (
          <ApplicationProcessEditor key={JSON.stringify(config)} config={config} process={process} />
        )}
      </AdminDataContainer>
    </section>
  )
}

function ApplicationProcessEditor({
  config,
  process,
}: {
  config: JobApplicationProcessConfig
  process: ReturnType<typeof useAdminFetch<JobApplicationProcessConfig>>
}) {
  const [draft, setDraft] = useState<JobApplicationProcessConfig>(config)
  const [saving, setSaving] = useState(false)

  const dirty = JSON.stringify(draft) !== JSON.stringify(config)
  const visibleCount = draft.steps.filter((step) => step.visible).length

  function updateStep(id: JobApplicationProcessConfig['steps'][number]['id'], visible: boolean) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step) => step.id === id ? { ...step, visible } : step),
    }))
  }

  function save() {
    if (saving || !dirty) return
    setSaving(true)
    saveJobApplicationProcessConfig(draft)
      .then((result) => {
        const saved = result.config || draft
        setDraft(saved)
        process.setData(saved)
        toast.success('Application process visibility saved.')
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to save application process settings.'))
      .finally(() => setSaving(false))
  }

  return (
    <>
      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {draft.visible
          ? `${visibleCount} of ${draft.steps.length} steps visible publicly.`
          : 'The entire application process is hidden from public vacancy pages.'}
      </div>
      <div className="jobs-process-content grid min-w-0 gap-4 p-4">
        <label className="jobs-process-master-toggle flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/20 p-4">
          <Checkbox
            checked={draft.visible}
            onChange={(event) => setDraft((current) => ({ ...current, visible: event.target.checked }))}
            disabled={saving}
          />
          <span className="jobs-process-toggle-copy grid min-w-0 flex-1 gap-1">
            <strong className="text-sm font-semibold">Show application process on vacancy pages</strong>
            <small className="text-xs leading-relaxed text-muted-foreground">
              Hide the complete process section without changing its individual step settings.
            </small>
          </span>
          <Badge variant={draft.visible ? 'default' : 'outline'}>{draft.visible ? 'Visible' : 'Hidden'}</Badge>
        </label>

        <div className={`jobs-process-step-list grid min-w-0 gap-2 ${draft.visible ? '' : 'is-disabled'}`}>
          {draft.steps.map((step, index) => (
            <article className="jobs-process-step-row flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-4" key={step.id}>
              <span className="jobs-process-step-number grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div className="jobs-process-step-text grid min-w-0 flex-1 gap-1">
                <strong className="text-sm font-semibold">{step.titleEn}</strong>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">{step.descriptionEn}</p>
                <small className="text-xs text-muted-foreground">{step.titleBn}</small>
              </div>
              <label className="jobs-process-step-toggle flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
                <Checkbox
                  checked={step.visible}
                  onChange={(event) => updateStep(step.id, event.target.checked)}
                  disabled={!draft.visible || saving}
                />
                <span>{step.visible ? 'Visible' : 'Hidden'}</span>
              </label>
            </article>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 p-4 pt-0">
        {dirty && <Badge variant="outline">Unsaved changes</Badge>}
        <Button variant="outline" size="sm" onClick={() => void process.reload()} disabled={saving || process.loading}>
          Reload
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || saving || process.loading}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save visibility'}
        </Button>
      </div>
    </>
  )
}

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<JobsTab>('vacancies')
  const jobs = useAdminFetch<JobSummary[]>(getJobs)
  const applications = useAdminFetch<JobApplication[]>(
    () => activeTab === 'applications' ? getJobApplications() : Promise.resolve([]),
    [activeTab],
  )

  const [applicationSearch, setApplicationSearch] = useState('')
  const [applicationSort, setApplicationSort] = useState<ApplicationSort>('newest')
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<ApplicantStatusFilter>('new')
  const [selectedJobFilter, setSelectedJobFilter] = useState('all')
  const [busyApplicationIds, setBusyApplicationIds] = useState<Set<number>>(() => new Set())
  const [selectedApplicantId, setSelectedApplicantId] = useState<number | null>(null)

  const applicationCount = useMemo(
    () => (jobs.data ?? []).reduce((total, job) => total + job.applications, 0),
    [jobs.data],
  )
  const newApplicantCount = useMemo(
    () => (jobs.data ?? []).reduce((total, job) => total + job.newApplications, 0),
    [jobs.data],
  )

  useEffect(() => {
    if (activeTab !== 'vacancies') return

    const refreshVisibleJobs = () => {
      if (document.visibilityState === 'visible') void jobs.reload()
    }

    window.addEventListener('focus', refreshVisibleJobs)
    const interval = window.setInterval(refreshVisibleJobs, 60_000)

    return () => {
      window.removeEventListener('focus', refreshVisibleJobs)
      window.clearInterval(interval)
    }
  }, [activeTab, jobs.reload, jobs])

  const applicationStatusCounts = useMemo(() => {
    const list = (applications.data ?? []).filter(
      (app) => selectedJobFilter === 'all' || String(app.jobId) === selectedJobFilter,
    )

    return {
      new: list.filter((app) => app.status === 'new').length,
      reviewing: list.filter((app) => app.status === 'reviewing').length,
      shortlisted: list.filter((app) => app.status === 'shortlisted').length,
      rejected: list.filter((app) => app.status === 'rejected').length,
      hired: list.filter((app) => app.status === 'hired').length,
    }
  }, [applications.data, selectedJobFilter])

  const visibleApplications = useMemo(() => {
    const query = applicationSearch.trim().toLocaleLowerCase()
    const filtered = (applications.data ?? []).filter((app) => {
      const matchesJob = selectedJobFilter === 'all' || String(app.jobId) === selectedJobFilter
      const matchesStatus = app.status === applicationStatusFilter
      const customText = Object.entries(app.customFields ?? {})
        .map(([key, value]) => `${app.customFieldLabels?.[key] ?? key} ${String(value)}`)
        .join(' ')
      const searchable = `${app.name} ${app.email} ${app.phone} ${app.coverLetter} ${app.jobTitle} ${app.jobCategory?.en ?? ''} ${customText}`.toLocaleLowerCase()
      return matchesJob && matchesStatus && (!query || searchable.includes(query))
    })

    return [...filtered].sort((a, b) => {
      if (applicationSort === 'name') return a.name.localeCompare(b.name)
      const aTime = Date.parse(a.createdAt) || 0
      const bTime = Date.parse(b.createdAt) || 0
      return applicationSort === 'oldest' ? aTime - bTime : bTime - aTime
    })
  }, [applications.data, selectedJobFilter, applicationStatusFilter, applicationSearch, applicationSort])

  const selectedApplicant = visibleApplications.find((applicant) => applicant.id === selectedApplicantId)
    ?? visibleApplications[0]
    ?? null

  function changeSection(next: string) {
    if (!['vacancies', 'applications', 'process', 'form'].includes(next)) return
    setActiveTab(next as JobsTab)
    setSelectedApplicantId(null)
  }

  function reviewJobApplications(jobId: number) {
    setSelectedJobFilter(String(jobId))
    setApplicationStatusFilter('new')
    setApplicationSearch('')
    setActiveTab('applications')
    setSelectedApplicantId(null)
  }

  function changeStatus(id: number, status: ApplicationStatus) {
    if (busyApplicationIds.has(id)) return Promise.resolve()

    setBusyApplicationIds((current) => new Set(current).add(id))

    return setApplicationStatus(id, status)
      .then((result) => {
        applications.setData((current) => (current ?? []).map((app) => app.id === id ? { ...app, status } : app))
        setApplicationStatusFilter(status)
        void jobs.reload()

        toast.success(result.emailDelivery === 'sent' || result.emailDelivery === 'already-sent'
          ? 'Applicant status updated and email notification sent.'
          : result.emailDelivery === 'not-configured'
            ? 'Applicant status updated. Email delivery is not configured; the message remains queued.'
            : result.emailDelivery === 'missing-recipient'
              ? 'Applicant status updated, but no valid email address is stored for this applicant.'
              : result.emailDelivery === 'queue-error'
                ? 'Applicant status updated, but the email could not be queued. Check server logs.'
                : 'Applicant status updated. Email notification queued.')
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to update the application.'))
      .finally(() => setBusyApplicationIds((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      }))
  }

  const applicationColumns: AdminTableColumn<JobApplication>[] = [
    {
      key: 'candidate',
      label: 'Applicant',
      accessor: (applicant) => applicant.name,
      width: '34%',
      render: (applicant) => (
        <Button
          type="button"
          variant={selectedApplicant?.id === applicant.id ? 'secondary' : 'ghost'}
          className="h-auto w-full min-w-0 justify-start gap-2 whitespace-normal rounded-md px-2 py-2 text-left"
          onClick={() => setSelectedApplicantId(applicant.id)}
          aria-label={`Open application ${applicant.id} from ${applicant.name}`}
          aria-pressed={selectedApplicant?.id === applicant.id}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-primary" aria-hidden="true">
            {applicant.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'A'}
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <strong className="truncate text-sm font-semibold">{applicant.name || 'Unnamed applicant'}</strong>
            <span className="truncate text-xs text-muted-foreground">{applicant.email || 'No email provided'}</span>
          </span>
        </Button>
      ),
    },
    {
      key: 'vacancy',
      label: 'Vacancy',
      accessor: (applicant) => applicant.jobTitle,
      width: '25%',
      render: (applicant) => (
        <div className="grid min-w-0 gap-0.5">
          <strong className="text-sm font-medium">{applicant.jobTitle}</strong>
          <span className="text-xs text-muted-foreground">{applicant.jobCategory?.en || 'Uncategorized'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      accessor: (applicant) => statusLabel(applicant.status),
      width: '16%',
      render: (applicant) => (
        <Badge variant={applicant.status === 'hired' || applicant.status === 'shortlisted'
          ? 'success'
          : applicant.status === 'rejected'
            ? 'destructive'
            : applicant.status === 'reviewing'
              ? 'secondary'
              : 'outline'}>
          {statusLabel(applicant.status)}
        </Badge>
      ),
    },
    {
      key: 'applied',
      label: 'Applied',
      accessor: (applicant) => Date.parse(applicant.createdAt) || 0,
      width: '16%',
      render: (applicant) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{dateLabel(applicant.createdAt)}</span>
      ),
    },
    {
      key: 'resume',
      label: 'CV',
      accessor: (applicant) => applicant.resumeUrl ? 'Attached' : 'Not attached',
      sortable: false,
      width: '9%',
      render: (applicant) => applicant.resumeUrl
        ? <Badge variant="outline">Attached</Badge>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
  ]

  return (
    <div className="admin-page-stack min-w-0">
      <SectionToolbar
        title="Job & Applications"
        tabs={
          <AdminSectionTabs
            label="Job and application sections"
            value={activeTab}
            onChange={changeSection}
            items={[
              { value: 'vacancies', label: 'Vacancies', icon: <BriefcaseBusiness size={15} /> },
              { value: 'applications', label: 'Applications', icon: <Users size={15} />, count: newApplicantCount, countPosition: 'corner' },
              { value: 'process', label: 'Application Process', icon: <Eye size={15} /> },
              { value: 'form', label: 'Application Form', icon: <FileText size={15} /> },
            ]}
          />
        }
      />

      <div className={`jobs-page-root jobs-page-root--${activeTab} flex min-w-0 flex-col gap-4`}>
        {activeTab === 'vacancies' && (
          <LifecycleWorkspace
            jobs={jobs.data ?? []}
            loading={jobs.loading}
            error={jobs.error || null}
            onRefresh={jobs.reload}
            onApplicants={reviewJobApplications}
          />
        )}

        {activeTab === 'applications' && (
          <AdminWorkspaceGrid
            layout="split"
            columns="minmax(0, 0.86fr) minmax(0, 1.14fr)"
            className="jobs-applications-workspace min-w-0"
            ariaLabel="Selected applicant and application register"
          >
            <section className="jobs-applicant-detail-panel min-w-0">
              <AdminDataContainer
                label="Applicant profile"
                height="75vh"
                bodyScroll="auto"
                headerContent={
                  <SectionToolbar
                    title="Applicant profile"
                    actions={selectedApplicant ? <Badge variant="outline">{statusLabel(selectedApplicant.status)}</Badge> : undefined}
                  />
                }
                footer={
                  <div className="grid gap-2 border-t border-border px-3 py-3">
                    <span className="text-xs font-semibold text-muted-foreground">Change recruitment status</span>
                    <div className="jobs-applicant-status-actions flex min-w-0 flex-wrap gap-2" role="group" aria-label="Set applicant recruitment status">
                      {RECRUITMENT_STATUS_FILTERS.map((status) => (
                        <Button
                          key={status.value}
                          type="button"
                          variant={selectedApplicant?.status === status.value ? 'default' : 'outline'}
                          className="jobs-applicant-status-action"
                          aria-pressed={selectedApplicant?.status === status.value}
                          disabled={!selectedApplicant || busyApplicationIds.has(selectedApplicant.id) || selectedApplicant.status === status.value}
                          onClick={() => selectedApplicant && void changeStatus(selectedApplicant.id, status.value)}
                        >
                          {status.label}
                        </Button>
                      ))}
                    </div>
                    {selectedApplicant && busyApplicationIds.has(selectedApplicant.id) && (
                      <small className="jobs-status-saving text-xs text-muted-foreground" role="status">Saving status…</small>
                    )}
                  </div>
                }
              >
                <div className="min-w-0 p-4">
                  {selectedApplicant ? (
                    <div className="grid min-w-0 gap-4">
                      <div className="jobs-applicant-detail-grid grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="grid min-w-0 gap-1 rounded-xl border border-border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground">Email</span>
                          <a className="break-all text-sm text-primary underline-offset-4 hover:underline" href={`mailto:${selectedApplicant.email}`}>
                            {selectedApplicant.email || 'Not provided'}
                          </a>
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-xl border border-border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground">Phone</span>
                          {selectedApplicant.phone
                            ? <a className="break-all text-sm text-primary underline-offset-4 hover:underline" href={`tel:${selectedApplicant.phone}`}>{selectedApplicant.phone}</a>
                            : <strong className="text-sm font-medium">Not provided</strong>}
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-xl border border-border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground">Applied for</span>
                          <strong className="wrap-break-word text-sm font-medium">{selectedApplicant.jobTitle}</strong>
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-xl border border-border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground">Category</span>
                          <strong className="text-sm font-medium">{selectedApplicant.jobCategory?.en || 'Uncategorized'}</strong>
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-xl border border-border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground">Applied on</span>
                          <strong className="text-sm font-medium">{dateLabel(selectedApplicant.createdAt)}</strong>
                        </div>
                        <div className="grid min-w-0 gap-1 rounded-xl border border-border bg-muted/20 p-3">
                          <span className="text-xs font-medium text-muted-foreground">Resume</span>
                          {selectedApplicant.resumeUrl
                            ? <a className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline" href={selectedApplicant.resumeUrl} target="_blank" rel="noreferrer noopener">Open private CV <FileText size={13} /></a>
                            : <strong className="text-sm font-medium">Not attached</strong>}
                        </div>
                      </div>

                      <section className="jobs-applicant-detail-section grid gap-2 rounded-xl border border-border p-4">
                        <h3 className="m-0 text-sm font-semibold">Cover letter</h3>
                        <p className="jobs-applicant-cover-letter m-0 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-muted-foreground">
                          {selectedApplicant.coverLetter?.trim() || 'No cover letter submitted.'}
                        </p>
                      </section>

                      {Object.keys(selectedApplicant.customFields ?? {}).length > 0 && (
                        <section className="jobs-applicant-detail-section grid gap-3 rounded-xl border border-border p-4">
                          <h3 className="m-0 text-sm font-semibold">Additional responses</h3>
                          <dl className="jobs-applicant-custom-responses m-0 grid gap-3">
                            {Object.entries(selectedApplicant.customFields ?? {}).map(([key, value]) => (
                              <div key={key} className="grid gap-1">
                                <dt className="text-xs font-medium text-muted-foreground">{selectedApplicant.customFieldLabels?.[key] || key}</dt>
                                <dd className="m-0 break-words text-sm text-primary">{String(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        </section>
                      )}
                    </div>
                  ) : (
                    <div className="grid min-h-56 place-content-center justify-items-center gap-2 text-center text-sm text-muted-foreground">
                      <Users size={24} />
                      <strong className="text-sm font-semibold text-primary">No applicant selected</strong>
                      <span className="max-w-[280px] text-xs leading-relaxed">
                        Choose an application from the register to see contact details, submitted answers and recruitment actions here.
                      </span>
                    </div>
                  )}
                </div>
              </AdminDataContainer>
            </section>

            <section className="min-w-0">
              <AdminDataContainer
                label="Job application register"
                height="75vh"
                bodyScroll="auto"
                headerContent={
                  <SectionToolbar
                    title="Application register"
                    search={applicationSearch}
                    onSearch={setApplicationSearch}
                    searchPlaceholder="Search applicant, vacancy, email or phone…"
                    filters={
                      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        <NativeSelect
                          className="w-full min-w-0"
                          value={selectedJobFilter}
                          onChange={(event) => setSelectedJobFilter(event.target.value)}
                          aria-label="Filter by vacancy"
                        >
                          <option value="all">All vacancies ({applicationCount})</option>
                          {(jobs.data ?? []).map((job) => (
                            <option key={job.id} value={String(job.id)}>{job.title.en}</option>
                          ))}
                        </NativeSelect>
                        <NativeSelect
                          className="w-full min-w-0"
                          value={applicationSort}
                          onChange={(event) => setApplicationSort(event.target.value as ApplicationSort)}
                          aria-label="Sort applications"
                        >
                          <option value="newest">Newest first</option>
                          <option value="oldest">Oldest first</option>
                          <option value="name">Applicant name</option>
                        </NativeSelect>
                      </div>
                    }
                    tabs={
                      <div className="flex min-w-0 flex-wrap items-center gap-1" role="tablist" aria-label="Filter applications by status">
                        {APPLICATION_FILTERS.map((filter) => (
                          <Button
                            key={filter.value}
                            type="button"
                            role="tab"
                            size="sm"
                            variant={applicationStatusFilter === filter.value ? 'secondary' : 'ghost'}
                            aria-selected={applicationStatusFilter === filter.value}
                            className="gap-2"
                            onClick={() => setApplicationStatusFilter(filter.value)}
                          >
                            {filter.label}
                            <span className="rounded-full bg-background px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                              {applicationStatusCounts[filter.value]}
                            </span>
                          </Button>
                        ))}
                      </div>
                    }
                    actions={selectedJobFilter !== 'all' ? (
                      <Button variant="outline" size="sm" onClick={() => setSelectedJobFilter('all')}>
                        Clear vacancy filter
                      </Button>
                    ) : undefined}
                  />
                }
                footer={
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                    <span>
                      Showing {visibleApplications.length.toLocaleString()} of {applicationStatusCounts[applicationStatusFilter].toLocaleString()} {statusLabel(applicationStatusFilter).toLowerCase()} applications
                    </span>
                    {applications.error && (
                      <span className="flex min-w-0 flex-wrap items-center gap-2 text-destructive" role="alert">
                        <span>{applications.error}</span>
                        <Button variant="outline" size="sm" onClick={() => void applications.reload()}>Retry</Button>
                      </span>
                    )}
                  </div>
                }
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  {applications.error && (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm text-destructive" role="alert">
                      <span>{applications.error}</span>
                      <Button variant="outline" size="sm" onClick={() => void applications.reload()}>Retry</Button>
                    </div>
                  )}
                  <AdminTable
                    rows={visibleApplications}
                    columns={applicationColumns}
                    getRowId={(applicant) => applicant.id}
                    caption="Job applications"
                    emptyMessage={applications.error
                      ? 'Applications could not be loaded. Use Retry above.'
                      : `No ${statusLabel(applicationStatusFilter).toLowerCase()} applications match these filters.`}
                    exportable
                    selectable={false}
                    exportImportable={false}
                    fileName="job-applications.csv"
                    loading={applications.loading && !applications.data}
                    height="100%"
                    minHeight="0px"
                    rowClassName={(applicant) => selectedApplicant?.id === applicant.id
                      ? 'bg-primary/5 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-primary'
                      : undefined}
                    className="min-h-0 flex-1 rounded-none border-0 shadow-none"
                    tableClassName="min-w-[720px]"
                  />
                </div>
              </AdminDataContainer>
            </section>
          </AdminWorkspaceGrid>
        )}

        {activeTab === 'process' && (
          <div role="tabpanel" aria-label="Application Process" className="jobs-process-workspace min-w-0">
            <ApplicationProcessTab />
          </div>
        )}

        {activeTab === 'form' && (
          <div role="tabpanel" aria-label="Application Form" className="jobs-form-workspace min-w-0">
            <AdminDataContainer
              label="Job application form builder"
              height="75vh"
              footer={<div className="footer text-xs text-muted-foreground">Configure the fields applicants complete when submitting a vacancy application.</div>}
            >
              <JobApplicationFormBuilder />
            </AdminDataContainer>
          </div>
        )}
      </div>
    </div>
  )
}
