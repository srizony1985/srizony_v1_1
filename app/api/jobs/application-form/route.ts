import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { readCmsDocument } from '@/lib/cms/document-store'
import { DEFAULT_JOB_APPLICATION_FORM, normalizeJobApplicationFormConfig, type JobApplicationFormConfig } from '@/lib/jobApplicationForm'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getCachedPublicFormConfig = unstable_cache(
  async () => readCmsDocument<JobApplicationFormConfig>('job-application-form.json'),
  ['srizony-public-job-application-form-v2'],
  { revalidate: 300, tags: ['job-application-form'] },
)

export async function GET() {
  try {
    const saved = await getCachedPublicFormConfig()
    return NextResponse.json(normalizeJobApplicationFormConfig(saved || DEFAULT_JOB_APPLICATION_FORM), { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (error) {
    console.error('Unable to load the job application form configuration.', error)
    return NextResponse.json(normalizeJobApplicationFormConfig(DEFAULT_JOB_APPLICATION_FORM), { headers: { 'Cache-Control': 'no-store' } })
  }
}
