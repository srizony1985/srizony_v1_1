import { adminRequest } from './http'

export type JobSummary = { id: number; slug: string; title: { en: string; bn: string }; category: { en: string; bn: string }; status: 'published' | 'draft' | 'hidden'; postedAt: string; deadline: string; applications: number; newApplications: number; workflowStage: VacancyWorkflowStage; shortlistedCount: number; interview: VacancyInterviewSummary | null }
export type JobApplication = { id: number; jobId: number; jobTitle: string; jobSlug: string; jobCategory: { en: string; bn: string }; name: string; email: string; phone: string; coverLetter: string; resumeUrl: string; customFields?: Record<string, string | number | boolean>; customFieldLabels?: Record<string, string>; status: ApplicationStatus; createdAt: string }
export type ApplicantNotifications = { total: number; items: JobApplication[] }
export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export const getJobs = async () => (await adminRequest<{ items: JobSummary[] }>('/api/admin/jobs', {}, 'Unable to load jobs.')).items
export const getJobApplications = async (jobId?: number) => (await adminRequest<{ items: JobApplication[] }>(`/api/admin/jobs?view=applications${jobId ? `&jobId=${jobId}` : ''}`, {}, 'Unable to load applications.')).items
export const getApplicantNotifications = async () => adminRequest<ApplicantNotifications>('/api/admin/jobs?view=notifications', {}, 'Unable to load applicant notifications.')
export const setApplicationStatus = (id: number, status: ApplicationStatus) => adminRequest<{ ok: boolean; changed: boolean; emailDelivery?: string }>('/api/admin/jobs', { method: 'PATCH', json: { action: 'set-application-status', id, status } }, 'Unable to update the application.')

export type VacancyWorkflowStage = 'new' | 'review' | 'interview' | 'processed'
export type VacancyInterviewSummary = {
  id: number
  startsAt: string
  endsAt: string
  minutesPerApplicant: number
  status: 'scheduled' | 'closed'
  shortlistedCount: number
}
export type VacancyInterviewAppointment = {
  applicationId: number
  name: string
  email: string
  status: ApplicationStatus
  startsAt: string
  endsAt: string
}
export type VacancyInterviewDetails = {
  id: number
  jobId: number
  jobTitle: string
  jobRole: string
  startsAt: string
  endsAt: string
  minutesPerApplicant: number
  status: 'scheduled' | 'closed'
  revision: number
  closedAt: string | null
  appointments: VacancyInterviewAppointment[]
}

export const getVacancyInterview = (jobId: number) => adminRequest<VacancyInterviewDetails>(
  `/api/admin/jobs?view=interview&jobId=${jobId}`,
  {},
  'Unable to load the interview schedule.',
)
export const updateVacancyDeadline = (jobId: number, deadline: string) => adminRequest<{ ok: boolean; jobId: number; deadline: string; workflowStage: VacancyWorkflowStage }>(
  '/api/admin/jobs', { method: 'PATCH', json: { action: 'update-deadline', jobId, deadline } }, 'Unable to update the application deadline.',
)
export const scheduleVacancyInterview = (payload: { jobId: number; startsAt: string; endsAt: string; minutesPerApplicant: number }) => adminRequest<{
  ok: boolean
  schedule: { interviewId: number; revision: number; jobId: number; jobTitle: string; jobRole: string; startsAt: string; endsAt: string; minutesPerApplicant: number; rescheduled: boolean; appointments: VacancyInterviewAppointment[] }
  emailDeliveries: string[]
}>(
  '/api/admin/jobs', { method: 'PATCH', json: { action: 'schedule-interview', ...payload } }, 'Unable to schedule the interviews.',
)
export const extendVacancyInterview = (jobId: number, endsAt: string) => adminRequest<{ ok: boolean; jobId: number; endsAt: string }>(
  '/api/admin/jobs', { method: 'PATCH', json: { action: 'extend-interview', jobId, endsAt } }, 'Unable to extend the interview window.',
)
export const closeVacancyInterview = (jobId: number) => adminRequest<{ ok: boolean; jobId: number; status: 'processed' }>(
  '/api/admin/jobs', { method: 'PATCH', json: { action: 'close-interview', jobId } }, 'Unable to close the interview.',
)
