export type JobApplicationProcessStepId = 'details' | 'resume' | 'submit'

export type JobApplicationProcessStep = {
  id: JobApplicationProcessStepId
  visible: boolean
  titleEn: string
  titleBn: string
  descriptionEn: string
  descriptionBn: string
}

export type JobApplicationProcessConfig = {
  version: 1
  visible: boolean
  steps: JobApplicationProcessStep[]
}

export const DEFAULT_JOB_APPLICATION_PROCESS: JobApplicationProcessConfig = {
  version: 1,
  visible: true,
  steps: [
    {
      id: 'details', visible: true,
      titleEn: 'Your details', titleBn: 'তথ্য পূরণ',
      descriptionEn: 'Provide your contact and basic information.', descriptionBn: 'যোগাযোগ ও প্রাথমিক তথ্য দিন।',
    },
    {
      id: 'resume', visible: true,
      titleEn: 'Attach CV', titleBn: 'CV সংযুক্তি',
      descriptionEn: 'Attach your latest resume.', descriptionBn: 'হালনাগাদ জীবনবৃত্তান্ত সংযুক্ত করুন।',
    },
    {
      id: 'submit', visible: true,
      titleEn: 'Submit & track', titleBn: 'জমা ও রেফারেন্স',
      descriptionEn: 'Submit and keep your reference number.', descriptionBn: 'জমা দিয়ে রেফারেন্স নম্বর সংরক্ষণ করুন।',
    },
  ],
}

export function normalizeJobApplicationProcessConfig(value: unknown): JobApplicationProcessConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_JOB_APPLICATION_PROCESS
  const input = value as Partial<JobApplicationProcessConfig>
  const savedSteps = Array.isArray(input.steps) ? input.steps : []
  const steps = DEFAULT_JOB_APPLICATION_PROCESS.steps.map((fallback) => {
    const saved = savedSteps.find((step) => step && typeof step === 'object' && step.id === fallback.id)
    if (!saved) return fallback
    return {
      ...fallback,
      visible: typeof saved.visible === 'boolean' ? saved.visible : fallback.visible,
      titleEn: typeof saved.titleEn === 'string' && saved.titleEn.trim() ? saved.titleEn.trim() : fallback.titleEn,
      titleBn: typeof saved.titleBn === 'string' ? saved.titleBn.trim() : fallback.titleBn,
      descriptionEn: typeof saved.descriptionEn === 'string' ? saved.descriptionEn.trim() : fallback.descriptionEn,
      descriptionBn: typeof saved.descriptionBn === 'string' ? saved.descriptionBn.trim() : fallback.descriptionBn,
    }
  })
  return { version: 1, visible: typeof input.visible === 'boolean' ? input.visible : true, steps }
}
