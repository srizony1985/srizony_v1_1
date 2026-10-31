import { adminRequest } from './http'
import { getJobApplications } from './jobs'
import { listContent } from './siteContent'

export type ReportKey = 'visitors' | 'submissions' | 'donations' | 'applications' | 'content'
export type ReportRow = Record<string, unknown>

/** Table definitions shared by report pages and the CSV export in Settings. */
export const REPORTS: Record<ReportKey, { title: string; description: string }> = {
  visitors: { title: 'Visitors', description: 'Individual visitor records and latest activity.' },
  submissions: { title: 'Contact Requests', description: 'Messages received through the public contact form.' },
  donations: { title: 'Donations', description: 'Donation transactions recorded by the payment flow.' },
  applications: { title: 'Job applications', description: 'Applications received for job posts.' },
  content: { title: 'Managed content', description: 'Projects, products, team, notices, reports and jobs.' },
}
const ENDPOINT: Partial<Record<ReportKey, string>> = { visitors: '/api/admin/visitors', submissions: '/api/admin/submissions', donations: '/api/admin/donations' }

export async function getReportRows(key: ReportKey): Promise<ReportRow[]> {
  if (key === 'applications') return (await getJobApplications()) as unknown as ReportRow[]
  if (key === 'content') return (await listContent('all')).map((r) => ({ id: r.id, component: r.component, slug: r.slug, status: r.status, publishedAt: r.publishedAt, ...r.values })) as ReportRow[]
  const body = await adminRequest<{ items?: ReportRow[] }>(ENDPOINT[key]!, {}, 'Unable to load report.')
  return Array.isArray(body.items) ? body.items : []
}
