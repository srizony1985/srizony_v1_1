import { adminRequest } from './http'

export type JobSummary = { id: number; slug: string; title: { en: string; bn: string }; category: { en: string; bn: string }; status: string; postedAt: string; deadline: string; applications: number; newApplications: number }
export type JobApplication = { id: number; jobId: number; jobTitle: string; jobSlug: string; jobCategory: { en: string; bn: string }; name: string; email: string; phone: string; coverLetter: string; resumeUrl: string; status: string; createdAt: string }
export type ApplicantNotifications = { total: number; items: JobApplication[] }
export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'] as const

export const getJobs = async () => (await adminRequest<{ items: JobSummary[] }>('/api/admin/jobs', {}, 'Unable to load jobs.')).items
export const getJobApplications = async (jobId?: number) => (await adminRequest<{ items: JobApplication[] }>(`/api/admin/jobs?view=applications${jobId ? `&jobId=${jobId}` : ''}`, {}, 'Unable to load applications.')).items
export const getApplicantNotifications = async () => adminRequest<ApplicantNotifications>('/api/admin/jobs?view=notifications', {}, 'Unable to load applicant notifications.')
export const setApplicationStatus = (id: number, status: string) => adminRequest('/api/admin/jobs', { method: 'PATCH', json: { id, status } }, 'Unable to update the application.')
