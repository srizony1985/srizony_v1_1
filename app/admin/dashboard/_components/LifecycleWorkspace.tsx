'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  PencilIcon,
  Plus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import JobInterviewScheduleForm from '@/components/admin/JobInterviewScheduleForm'
import {
  closeVacancyInterview,
  extendVacancyInterview,
  getVacancyInterview,
  scheduleVacancyInterview,
  setApplicationStatus,
  updateVacancyDeadline,
  type ApplicationStatus,
  type JobSummary,
  type VacancyInterviewDetails,
  type VacancyWorkflowStage,
} from '@/lib/api/jobs'
import { listContent } from '@/lib/api/siteContent'
import type { ContentRecord } from '@/lib/cms/components'
import { AdminErrorState, AdminSectionTabs, PageLoading, SectionToolbar } from './AdminCommon'
import { ContentEditor } from './ContentEditor'
import { AdminDataContainer, AdminWorkspaceGrid } from '@/components/admin/cms'

type Props = {
  jobs: JobSummary[]
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
  onApplicants: (jobId: number) => void
}

type EditorMode = 'new' | 'edit' | null

const STAGES: {
  value: VacancyWorkflowStage
  label: string
  description: string
  icon: ReactNode
}[] = [
  { value: 'new', label: 'New', description: 'Vacancies accepting applications', icon: <BriefcaseBusiness size={14} /> },
  { value: 'review', label: 'Review', description: 'Application deadline has passed', icon: <AlertTriangle size={14} /> },
  { value: 'interview', label: 'Interview', description: 'Vacancies with scheduled interviews', icon: <CalendarClock size={14} /> },
  { value: 'processed', label: 'Processed', description: 'Closed recruitment processes', icon: <CheckCircle2 size={14} /> },
]

const FIELD_CARD_CLASS = 'grid min-w-0 gap-1.5 rounded-xl border border-border bg-background p-3'
const FIELD_LABEL_CLASS = 'text-xs font-medium text-muted-foreground'

function localDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(date)
}

function localDate(value: string | null | undefined) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeZone: 'Asia/Dhaka',
  }).format(date)
}

function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function VacancyIdentity({ job }: { job: JobSummary }) {
  return (
    <div className="grid min-w-0 gap-2">
      <h2 className="m-0 wrap-break-word text-xl font-bold tracking-tight">
        {job.title.en || 'Untitled vacancy'}
      </h2>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary" className="font-medium">
          {job.category.en || 'Position'}
        </Badge>
        <span aria-hidden="true" className="text-border">/</span>
        <code className="break-all text-xs text-muted-foreground">{job.slug}</code>
      </div>
    </div>
  )
}

function MetricCard({ label, value, hint, icon }: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
}) {
  return (
    <div className={FIELD_CARD_CLASS}>
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="shrink-0 text-primary">{icon}</span>}
        <strong className="min-w-0 wrap-break-word text-2xl font-bold tabular-nums text-primary">
          {value}
        </strong>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

export default function LifecycleWorkspace({ jobs, loading, error, onRefresh, onApplicants }: Props) {
  const [stage, setStage] = useState<VacancyWorkflowStage>('new')
  const [search, setSearch] = useState('')
  const [editorMode, setEditorMode] = useState<EditorMode>(null)
  const [record, setRecord] = useState<ContentRecord | null>(null)
  const [deadlineDraft, setDeadlineDraft] = useState('')
  const [deadlineSaving, setDeadlineSaving] = useState(false)
  const [interview, setInterview] = useState<VacancyInterviewDetails | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [interviewError, setInterviewError] = useState<string | null>(null)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [extendEndDraft, setExtendEndDraft] = useState('')
  const [extendSaving, setExtendSaving] = useState(false)
  const [busyApplicationId, setBusyApplicationId] = useState<number | null>(null)
  const [closeSaving, setCloseSaving] = useState(false)
  const interviewRequestRef = useRef(0)

  const counts = useMemo(
    () => Object.fromEntries(
      STAGES.map((item) => [item.value, jobs.filter((job) => job.workflowStage === item.value).length]),
    ) as Record<VacancyWorkflowStage, number>,
    [jobs],
  )

  const visibleJobs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return jobs.filter((job) => {
      const searchable = `${job.title.en} ${job.title.bn} ${job.category.en} ${job.category.bn} ${job.slug} ${job.status}`.toLocaleLowerCase()
      return job.workflowStage === stage && (!query || searchable.includes(query))
    })
  }, [jobs, search, stage])

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  const activeJobId = selectedJobId !== null && visibleJobs.some((job) => job.id === selectedJobId)
    ? selectedJobId
    : null

  const selectedJob = visibleJobs.find((job) => job.id === activeJobId) ?? null

  const loadInterviewDetails = useCallback((jobId: number) => {
    const requestId = ++interviewRequestRef.current
    return Promise.resolve()
      .then(() => {
        if (requestId !== interviewRequestRef.current) return null
        setInterviewLoading(true)
        setInterviewError(null)
        return getVacancyInterview(jobId)
      })
      .then((details) => {
        if (!details || requestId !== interviewRequestRef.current) return
        setInterview(details)
        setExtendEndDraft(toLocalInput(details.endsAt))
      })
      .catch((cause: unknown) => {
        if (requestId !== interviewRequestRef.current) return
        setInterview(null)
        setInterviewError(cause instanceof Error ? cause.message : 'Unable to load the interview schedule.')
      })
      .finally(() => {
        if (requestId === interviewRequestRef.current) setInterviewLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedJob || (stage !== 'interview' && stage !== 'processed')) {
      interviewRequestRef.current += 1
      queueMicrotask(() => {
        setInterview(null)
        setInterviewError(null)
        setInterviewLoading(false)
      })
      return
    }
    void loadInterviewDetails(selectedJob.id)
  }, [selectedJob, stage, loadInterviewDetails])

  function openEditor(id: number) {
    setSelectedJobId(id)
    return listContent('job')
      .then((content) => {
        const selected = content.find((item) => item.id === id)
        if (!selected) throw new Error('The selected vacancy could not be found.')
        setRecord(selected)
        setEditorMode('edit')
        setSchedulerOpen(false)
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to load the vacancy.'))
  }

  function createVacancy() {
    setRecord(null)
    setEditorMode('new')
    setSchedulerOpen(false)
  }

  function editorSaved(saved: ContentRecord) {
    setRecord(saved)
    setEditorMode('edit')
    void onRefresh()
  }

  function saveDeadline() {
    if (!selectedJob || !deadlineDraft || deadlineSaving) return
    setDeadlineSaving(true)
    updateVacancyDeadline(selectedJob.id, deadlineDraft)
      .then(() => {
        toast.success('Application deadline extended. This vacancy is back in New.')
        setStage('new')
        return onRefresh()
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to update the deadline.'))
      .finally(() => setDeadlineSaving(false))
  }

  function saveSchedule(value: { jobId: number; startsAt: string; endsAt: string; minutesPerApplicant: number }) {
    if (scheduleSaving) return
    setScheduleSaving(true)
    scheduleVacancyInterview(value)
      .then((result) => {
        const sent = result.emailDeliveries.filter((delivery) => delivery === 'sent' || delivery === 'already-sent').length
        const queued = result.emailDeliveries.filter((delivery) => delivery === 'queued' || delivery === 'not-configured').length
        const missing = result.emailDeliveries.filter((delivery) => delivery === 'missing-recipient').length
        toast.success(result.schedule.rescheduled
          ? `Interview rescheduled. ${sent} emails sent; ${queued} queued; ${missing} missing email addresses.`
          : `Interview scheduled. ${sent} emails sent; ${queued} queued; ${missing} missing email addresses.`)
        setSchedulerOpen(false)
        setStage('interview')
        setSelectedJobId(value.jobId)
        return onRefresh().then(() => {
          setSelectedJobId(value.jobId)
          return loadInterviewDetails(value.jobId)
        })
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to save the interview schedule.'))
      .finally(() => setScheduleSaving(false))
  }

  function extendInterviewTime() {
    if (!selectedJob || !extendEndDraft || extendSaving) return
    setExtendSaving(true)
    extendVacancyInterview(selectedJob.id, new Date(extendEndDraft).toISOString())
      .then(() => loadInterviewDetails(selectedJob.id))
      .then(() => {
        toast.success('Interview window extended.')
        return onRefresh()
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to extend the interview.'))
      .finally(() => setExtendSaving(false))
  }

  function updateApplicant(applicationId: number, status: Extract<ApplicationStatus, 'hired' | 'rejected'>) {
    if (busyApplicationId !== null) return
    setBusyApplicationId(applicationId)
    setApplicationStatus(applicationId, status)
      .then((result) => {
        setInterview((current) => current ? {
          ...current,
          appointments: current.appointments.map((appointment) => appointment.applicationId === applicationId
            ? { ...appointment, status }
            : appointment),
        } : current)
        toast.success(result.emailDelivery === 'sent'
          ? `Applicant marked ${status}; notification email sent.`
          : result.emailDelivery === 'missing-recipient'
            ? `Applicant marked ${status}; no email address is stored for this applicant.`
            : result.emailDelivery === 'not-configured'
              ? `Applicant marked ${status}; mail credentials are not configured, so the email remains queued.`
              : `Applicant marked ${status}; notification email queued.`)
        return onRefresh()
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to update the applicant.'))
      .finally(() => setBusyApplicationId(null))
  }

  function closeInterview() {
    if (!selectedJob || closeSaving) return
    if (!window.confirm('Close this interview and move the vacancy to Processed? All short-listed applicants must be marked Hired or Rejected first.')) return
    setCloseSaving(true)
    closeVacancyInterview(selectedJob.id)
      .then(() => {
        toast.success('Interview closed. Vacancy moved to Processed.')
        setStage('processed')
        return onRefresh()
      })
      .catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Unable to close the interview.'))
      .finally(() => setCloseSaving(false))
  }

  const stageDescription = STAGES.find((item) => item.value === stage)?.description ?? ''
  const stageTabs = (
    <AdminSectionTabs
      label="Vacancy workflow stage"
      value={stage}
      onChange={(next) => {
        setStage(next as VacancyWorkflowStage)
        setEditorMode(null)
        setSchedulerOpen(false)
      }}
      items={STAGES.map((item) => ({
        value: item.value,
        label: item.label,
        icon: item.icon,
        count: counts[item.value],
      }))}
    />
  )

  const detailTitle = editorMode === 'new'
    ? 'Create vacancy'
    : editorMode === 'edit'
      ? 'Edit vacancy'
      : selectedJob?.title.en || 'Vacancy details'

  return (
    <div className="admin-page-stack min-w-0" role="tabpanel" aria-label="Vacancy lifecycle">
      {loading && !jobs.length ? (
        <PageLoading rows={4} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => void onRefresh()} />
      ) : (
        <AdminWorkspaceGrid
          layout="split"
          columns="minmax(0, 0.85fr) minmax(0, 1.15fr)"
          className="jobs-lifecycle-workspace-grid min-w-0"
          ariaLabel="Vacancy lifecycle list and selected vacancy details"
        >
          {/* Vacancy register */}
          <section className="min-w-0" aria-label="Vacancy register">
            <AdminDataContainer
              label="Vacancy lifecycle"
              height="76vh"
              bodyScroll="auto"
              headerContent={
                <SectionToolbar
                  title="Vacancy lifecycle"
                  search={search}
                  onSearch={setSearch}
                  searchPlaceholder="Search vacancies by title, category or slug…"
                  tabs={stageTabs}
                />
              }
              footer={
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  <span>{visibleJobs.length} shown · {counts[stage]} in {stage}</span>
                  <span>{jobs.length} total vacancies</span>
                </div>
              }
            >
              <div className="grid min-w-0 gap-2 p-3">
                <p className="m-0 text-xs text-muted-foreground">{stageDescription}</p>
                {visibleJobs.map((job) => {
                  const isSelected = selectedJobId === job.id
                  return (
                    <article
                      key={job.id}
                      className={`grid min-w-0 gap-2 overflow-hidden rounded-xl border p-3 transition-colors ${isSelected
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:bg-muted/30'}`}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto min-w-0 justify-start whitespace-normal p-1 text-left hover:bg-transparent"
                        onClick={() => {
                          setSelectedJobId(job.id)
                          setEditorMode(null)
                          setSchedulerOpen(false)
                        }}
                        aria-pressed={isSelected}
                      >
                        <span className="grid min-w-0 gap-1">
                          <strong className="wrap-break-word text-sm font-semibold text-primary">{job.title.en || 'Untitled vacancy'}</strong>
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <BriefcaseBusiness size={12} />
                            <span>{job.category.en || 'Position'}</span>
                            <span aria-hidden="true">·</span>
                            <code className="break-all">{job.slug}</code>
                          </span>
                        </span>
                      </Button>

                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant={job.status === 'published' ? 'default' : 'outline'}>{job.status}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Users size={12} />
                            <strong className="tabular-nums text-primary">{job.applications.toLocaleString()}</strong>
                            applicants
                          </span>
                        </div>
                        {job.workflowStage === 'new' ? (
                          <Button variant="outline" size="sm" onClick={() => void openEditor(job.id)}>View & edit</Button>
                        ) : job.workflowStage === 'review' ? (
                          <Button variant="outline" size="sm" onClick={() => setSelectedJobId(job.id)}>Review actions</Button>
                        ) : job.workflowStage === 'interview' ? (
                          <Button variant="outline" size="sm" onClick={() => setSelectedJobId(job.id)}>View schedule</Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setSelectedJobId(job.id)}>View details</Button>
                        )}
                      </div>
                    </article>
                  )
                })}

                {!visibleJobs.length && (
                  <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border bg-background p-5 text-center">
                    <div className="grid justify-items-center gap-2">
                      <BriefcaseBusiness size={22} className="text-muted-foreground" />
                      <strong className="text-sm font-semibold text-primary">No vacancies found</strong>
                      <span className="text-xs text-muted-foreground">
                        {search.trim() ? 'Try another search term or clear the search.' : `There are no vacancies in the ${stage} stage.`}
                      </span>
                      {search.trim() && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setSearch('')}>Clear search</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AdminDataContainer>
          </section>

          {/* Selected vacancy workspace */}
          <section className="min-w-0" aria-label="Selected vacancy workspace" aria-live="polite">
            <AdminDataContainer
              label="Selected vacancy details"
              height="76vh"
              bodyScroll="auto"
              headerContent={
                <SectionToolbar
                  title={detailTitle}
                  onRefresh={() => {
                    void onRefresh()
                    if (selectedJob && (stage === 'interview' || stage === 'processed')) void loadInterviewDetails(selectedJob.id)
                  }}
                  refreshing={loading || interviewLoading}
                  actions={
                    <div className="flex gap-2">
                    {editorMode ? undefined : selectedJob ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => onApplicants(selectedJob.id)}>
                        <Users size={14} /> View applicants
                      </Button>
                      {stage === 'new' && (
                        <Button size="sm" variant="secondary" onClick={() => void openEditor(selectedJob.id)}>
                          <PencilIcon size={14} /> Edit vacancy
                        </Button>
                      )}
                    </div>
                  ) : undefined}
                    <Button size="sm" onClick={createVacancy}>
                      <Plus size={14} /> Create vacancy
                    </Button>
                  </div>}
                />
              }
              footer={
                <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  {editorMode
                    ? 'Save or close the vacancy editor to return to recruitment actions.'
                    : selectedJob
                      ? `${selectedJob.applications.toLocaleString()} applications · ${selectedJob.workflowStage} stage`
                      : 'Select a vacancy from the list to view its recruitment actions.'}
                </div>
              }
            >
              <div className="grid min-w-0 gap-4 p-2">
                {editorMode === 'new' && (
                  <ContentEditor
                    key="new-job"
                    component="job"
                    record={null}
                    onSaved={editorSaved}
                    onDeleted={() => undefined}
                    onClose={() => setEditorMode(null)}
                  />
                )}

                {editorMode === 'edit' && record && (
                  <ContentEditor
                    key={record.id}
                    component="job"
                    record={record}
                    onSaved={editorSaved}
                    onDeleted={() => {
                      setEditorMode(null)
                      setRecord(null)
                      void onRefresh()
                    }}
                    onClose={() => setEditorMode(null)}
                  />
                )}

                {!editorMode && !selectedJob && (
                  <div className="grid min-h-64 place-content-center justify-items-center gap-2 rounded-xl border border-dashed border-border bg-background p-6 text-center">
                    <BriefcaseBusiness size={28} className="text-muted-foreground" />
                    <strong className="text-sm font-semibold text-primary">Select a vacancy</strong>
                    <span className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                      Choose a vacancy from the {stage} list to view its recruitment details and actions.
                    </span>
                  </div>
                )}

                {!editorMode && selectedJob && stage === 'new' && (
                  <section aria-label="Open vacancy details" className="group relative grid min-w-0 gap-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                    <div className="h-1 w-full bg-primary" />
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <BriefcaseBusiness size={21} />
                        </div>
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-bold tracking-wide text-primary">OPEN VACANCY</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Recruitment overview</p>
                        </div>
                      </div>
                      <Badge variant="default" className="shrink-0 gap-1.5 rounded-full px-3 py-1">
                        <span className="size-1.5 rounded-full bg-current" /> Accepting applications
                      </Badge>
                    </div>

                    <div className="grid gap-2 px-4 py-5 sm:px-5">
                      <VacancyIdentity job={selectedJob} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 px-4 pb-5 sm:grid-cols-2 sm:px-5">
                      <MetricCard label="Application posted" value={localDate(selectedJob.postedAt)} icon={<FileText size={16} />} />
                      <MetricCard label="Application deadline" value={localDate(selectedJob.deadline)} icon={<Clock3 size={16} />} />
                    </div>

                    <div className="mx-4 mb-5 grid grid-cols-1 gap-3 sm:mx-5 sm:grid-cols-2">
                      <MetricCard label="Applications received" value={selectedJob.applications.toLocaleString()} hint="Total applicants" icon={<Users size={17} />} />
                      <MetricCard label="New applicants" value={selectedJob.newApplications.toLocaleString()} hint="Awaiting review" icon={<Users size={17} />} />
                    </div>

                    <div className="mt-auto flex flex-col gap-2 border-t border-border bg-muted/20 p-4 sm:flex-row">
                      <Button className="w-full flex-1" onClick={() => void openEditor(selectedJob.id)}>
                        <Eye size={15} /> View & edit vacancy
                      </Button>
                      <Button variant="outline" className="w-full flex-1" onClick={() => onApplicants(selectedJob.id)}>
                        <Users size={15} /> View applicants
                      </Button>
                    </div>
                  </section>
                )}

                {!editorMode && selectedJob && stage === 'review' && (
                  <section aria-label="Vacancy review actions" className="grid min-w-0 gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
                        <AlertTriangle size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge variant="outline" className="mb-2">Deadline passed · Review required</Badge>
                        <VacancyIdentity job={selectedJob} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <MetricCard label="Previous deadline" value={localDate(selectedJob.deadline)} />
                      <MetricCard label="Total applications" value={selectedJob.applications.toLocaleString()} icon={<Users size={16} />} />
                      <MetricCard label="Short-listed" value={selectedJob.shortlistedCount.toLocaleString()} icon={<CheckCircle2 size={16} />} />
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" className="flex-1" onClick={() => void openEditor(selectedJob.id)}>
                        <Eye size={14} /> View vacancy details
                      </Button>
                      <Button className="flex-1" onClick={() => onApplicants(selectedJob.id)}>
                        <Users size={14} /> View applicants
                      </Button>
                    </div>

                    <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-4">
                      <div>
                        <h3 className="m-0 text-sm font-semibold text-primary">Extend application deadline</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Setting a new deadline returns this vacancy to the New stage.</p>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-medium text-primary">
                          New application deadline
                          <Input type="date" value={deadlineDraft} onChange={(event) => setDeadlineDraft(event.target.value)} />
                        </label>
                        <Button onClick={() => void saveDeadline()} disabled={deadlineSaving || !deadlineDraft || deadlineDraft === selectedJob.deadline}>
                          {deadlineSaving ? 'Saving…' : 'Save deadline & reopen'}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="m-0 text-sm font-semibold text-primary">Interview scheduling</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Schedule interview slots for short-listed applicants.</p>
                        </div>
                        <Button onClick={() => setSchedulerOpen((open) => !open)} disabled={selectedJob.shortlistedCount < 1}>
                          <CalendarClock size={15} /> {schedulerOpen ? 'Hide scheduler' : 'Set interview schedule'}
                        </Button>
                      </div>
                      {selectedJob.shortlistedCount < 1 && <p className="m-0 text-xs text-muted-foreground">At least one applicant must be short-listed before an interview can be scheduled.</p>}
                      {schedulerOpen && <JobInterviewScheduleForm job={selectedJob} busy={scheduleSaving} onCancel={() => setSchedulerOpen(false)} onSave={(value) => void saveSchedule(value)} />}
                    </div>
                  </section>
                )}

                {!editorMode && selectedJob && stage === 'interview' && (
                  <section aria-label="Interview schedule" className="grid min-w-0 gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <CalendarClock size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge variant="default" className="mb-2">Interview scheduled</Badge>
                        <VacancyIdentity job={selectedJob} />
                      </div>
                    </div>

                    {interviewLoading ? (
                      <PageLoading rows={2} />
                    ) : interviewError ? (
                      <AdminErrorState message={interviewError} onRetry={() => void loadInterviewDetails(selectedJob.id)} />
                    ) : interview ? (
                      <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <MetricCard label="Interview starts" value={localDateTime(interview.startsAt)} icon={<CalendarClock size={16} />} />
                          <MetricCard label="Interview ends" value={localDateTime(interview.endsAt)} icon={<Clock3 size={16} />} />
                          <MetricCard label="Time per applicant" value={`${interview.minutesPerApplicant} min`} icon={<Clock3 size={16} />} />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button variant="outline" className="flex-1" onClick={() => setSchedulerOpen((open) => !open)}>
                            <CalendarClock size={14} /> {schedulerOpen ? 'Hide rescheduler' : 'Reschedule & notify'}
                          </Button>
                          <Button variant="outline" className="flex-1" onClick={() => onApplicants(selectedJob.id)}>
                            <Users size={14} /> All applicants
                          </Button>
                        </div>
                        {schedulerOpen && (
                          <JobInterviewScheduleForm
                            key={`${interview.id}-${interview.revision}`}
                            job={selectedJob}
                            existing={interview}
                            busy={scheduleSaving}
                            onCancel={() => setSchedulerOpen(false)}
                            onSave={(value) => void saveSchedule(value)}
                          />
                        )}

                        <div className="grid gap-2 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-primary">
                            Extend interview end time
                            <Input type="datetime-local" value={extendEndDraft} onChange={(event) => setExtendEndDraft(event.target.value)} />
                          </label>
                          <Button size="sm" variant="outline" onClick={() => void extendInterviewTime()} disabled={extendSaving || !extendEndDraft}>
                            {extendSaving ? 'Saving…' : 'Extend time'}
                          </Button>
                        </div>

                        <div className="grid min-w-0 gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="m-0 text-sm font-semibold text-primary">Applicant appointments</h3>
                            <Badge variant="secondary">{interview.appointments.length} scheduled</Badge>
                          </div>
                          {interview.appointments.map((appointment) => (
                            <article key={appointment.applicationId} className="grid min-w-0 gap-3 rounded-xl border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <div className="grid min-w-0 gap-1">
                                <strong className="wrap-break-word text-sm font-semibold text-primary">{appointment.name || 'Unnamed applicant'}</strong>
                                <span className="break-all text-xs text-muted-foreground">{appointment.email || 'No email provided'}</span>
                                <small className="text-xs text-muted-foreground">
                                  {localDateTime(appointment.startsAt)} – {localDateTime(appointment.endsAt)}
                                </small>
                              </div>
                              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                                <Badge variant={appointment.status === 'hired' ? 'default' : appointment.status === 'rejected' ? 'destructive' : 'outline'}>{appointment.status}</Badge>
                                {appointment.status === 'shortlisted' && (
                                  <div className="flex flex-wrap gap-1.5">
                                    <Button size="sm" onClick={() => void updateApplicant(appointment.applicationId, 'hired')} disabled={busyApplicationId !== null}>
                                      Hire
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => void updateApplicant(appointment.applicationId, 'rejected')} disabled={busyApplicationId !== null}>
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </article>
                          ))}
                          {!interview.appointments.length && (
                            <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                              No scheduled applicants remain.
                            </div>
                          )}
                        </div>

                        <div className="grid gap-2 border-t border-border pt-4">
                          <Button variant="destructive" onClick={() => void closeInterview()} disabled={closeSaving}>
                            {closeSaving ? 'Closing…' : 'Complete hiring & close interview'}
                          </Button>
                          <p className="m-0 text-xs text-muted-foreground">
                            All short-listed applicants must be marked Hired or Rejected before this recruitment process can be closed.
                          </p>
                        </div>
                      </>
                    ) : null}
                  </section>
                )}

                {!editorMode && selectedJob && stage === 'processed' && (
                  <section aria-label="Completed recruitment" className="grid min-w-0 gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Badge variant="success" className="mb-2">Recruitment completed</Badge>
                        <VacancyIdentity job={selectedJob} />
                      </div>
                    </div>

                    {interviewLoading ? (
                      <PageLoading rows={2} />
                    ) : interviewError ? (
                      <AdminErrorState message={interviewError} onRetry={() => void loadInterviewDetails(selectedJob.id)} />
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <MetricCard label="Total applications" value={selectedJob.applications.toLocaleString()} icon={<Users size={16} />} />
                        <MetricCard label="Interview closed" value={interview?.closedAt ? localDateTime(interview.closedAt) : 'Closed'} icon={<CheckCircle2 size={16} />} />
                        <div className="sm:col-span-2">
                          <MetricCard
                            label="Final interview window"
                            value={interview ? `${localDateTime(interview.startsAt)} – ${localDateTime(interview.endsAt)}` : 'Not available'}
                            icon={<CalendarClock size={16} />}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="outline" className="flex-1" onClick={() => void openEditor(selectedJob.id)}>
                        <Eye size={14} /> View vacancy details
                      </Button>
                      <Button className="flex-1" onClick={() => onApplicants(selectedJob.id)}>
                        <Users size={14} /> View applicants
                      </Button>
                    </div>
                  </section>
                )}
              </div>
            </AdminDataContainer>
          </section>
        </AdminWorkspaceGrid>
      )}
    </div>
  )
}
