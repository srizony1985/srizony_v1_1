import { adminRequest } from './http'
import type { JobApplicationFormConfig } from '@/lib/jobApplicationForm'
import type { JobApplicationProcessConfig } from '@/lib/jobApplicationProcess'

export const getJobApplicationFormConfig = () =>
  adminRequest<Partial<JobApplicationFormConfig>>(
    '/api/admin/job-application-form',
    {},
    'Unable to load the form configuration.',
  )

export const saveJobApplicationFormConfig = (config: JobApplicationFormConfig) =>
  adminRequest<{ config?: JobApplicationFormConfig; ok?: boolean }>(
    '/api/admin/job-application-form',
    { method: 'PUT', json: config as unknown as Record<string, unknown> },
    'Unable to save the form configuration.',
  )


export const getJobApplicationProcessConfig = () =>
  adminRequest<JobApplicationProcessConfig>(
    '/api/admin/job-application-process',
    {},
    'Unable to load application process visibility.',
  )

export const saveJobApplicationProcessConfig = (config: JobApplicationProcessConfig) =>
  adminRequest<{ config?: JobApplicationProcessConfig; ok?: boolean }>(
    '/api/admin/job-application-process',
    { method: 'PUT', json: config as unknown as Record<string, unknown> },
    'Unable to save application process visibility.',
  )
