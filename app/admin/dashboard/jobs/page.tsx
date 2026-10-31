'use client'

import { useMemo, useState } from 'react'
import { CirclePlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { APPLICATION_STATUSES, getJobApplications, getJobs, setApplicationStatus, type JobApplication, type JobSummary } from '@/lib/api/jobs'
import { listContent } from '@/lib/api/siteContent'
import type { ContentRecord } from '@/lib/cms/components'
import { AdminErrorState, PageLoading, SectionToolbar, useAdminFetch } from '../_components/AdminCommon'
import { ContentEditor } from '../_components/ContentEditor'

export default function JobsPage() {
  const jobs = useAdminFetch<JobSummary[]>(getJobs)
  const [mode, setMode] = useState<{ kind: 'new' } | { kind: 'edit'; id: number } | { kind: 'applications'; id: number } | null>(null)
  const [record, setRecord] = useState<ContentRecord | null>(null)
  const jobId = mode && mode.kind !== 'new' ? mode.id : 0
  const apps = useAdminFetch<JobApplication[]>(async () => (mode?.kind === 'applications' ? getJobApplications(jobId) : []), [mode?.kind, jobId])
  const selectedJob = useMemo(() => jobs.data?.find((j) => j.id === jobId), [jobs.data, jobId])

  async function openEdit(id: number) {
    try { const all = await listContent('job'); setRecord(all.find((r) => r.id === id) ?? null); setMode({ kind: 'edit', id }) } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to load the job.') }
  }
  async function changeStatus(id: number, status: string) {
    try { await setApplicationStatus(id, status); apps.setData((cur) => (cur ?? []).map((a) => (a.id === id ? { ...a, status } : a))); void jobs.reload() } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to update.') }
  }

  return <>
    <SectionToolbar title="Job Management" description="Create job posts and review applications. New posts are published when saved and appear on the public Career / Jobs page (/carrer-job). Hidden posts and jobs past their deadline are excluded from the public listing."
      count={jobs.data?.length ?? 0} onRefresh={() => void jobs.reload()} refreshing={jobs.loading}
      actions={<Button onClick={() => { setRecord(null); setMode({ kind: 'new' }) }}><CirclePlus size={15} /> Create new job</Button>} />
    {jobs.loading && !jobs.data ? <PageLoading rows={3} /> : jobs.error ? <AdminErrorState message={jobs.error} onRetry={() => void jobs.reload()} /> : (
      <div className="cms-split">
        <aside className="cms-list" aria-label="Job posts">
          {jobs.data?.map((j) => <div key={j.id} className={`cms-list-item ${jobId === j.id ? 'active' : ''}`}>
            <strong>{j.title.en}</strong><small>{j.slug} · deadline {j.deadline || '—'}</small>
            <div className="cms-list-row"><Badge variant={j.status === 'published' ? 'default' : 'outline'}>{j.status}</Badge>
              <Button variant="outline" size="sm" onClick={() => setMode({ kind: 'applications', id: j.id })}><Users size={13} /> {j.applications}{j.newApplications > 0 && ` (${j.newApplications} new)`}</Button>
              <Button variant="outline" size="sm" onClick={() => void openEdit(j.id)}>Edit</Button></div>
          </div>)}
          {!jobs.data?.length && <div className="admin-empty-state">No jobs yet.</div>}
        </aside>
        <section>
          {mode?.kind === 'new' && <ContentEditor key="new-job" component="job" record={null} onSaved={(r) => { setRecord(r); setMode({ kind: 'edit', id: r.id }); void jobs.reload() }} onDeleted={() => undefined} onClose={() => setMode(null)} />}
          {mode?.kind === 'edit' && record && <ContentEditor key={record.id} component="job" record={record} onSaved={(r) => { setRecord(r); void jobs.reload() }} onDeleted={() => { setMode(null); setRecord(null); void jobs.reload() }} onClose={() => setMode(null)} />}
          {mode?.kind === 'applications' && <div className="admin-data-card">
            <div className="cms-form-header"><div><h2>Applications — {selectedJob?.title.en}</h2><small>{apps.data?.length ?? 0} received</small></div><Button variant="outline" size="sm" onClick={() => setMode(null)}>Close</Button></div>
            {apps.loading ? <PageLoading rows={2} /> : apps.error ? <AdminErrorState message={apps.error} onRetry={() => void apps.reload()} /> : (
              <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Applicant</th><th>Contact</th><th>Cover letter</th><th>Resume</th><th>Applied</th><th>Status</th></tr></thead><tbody>
                {apps.data?.map((a) => <tr key={a.id}><td><strong>{a.name}</strong></td><td>{a.email}<br /><small>{a.phone}</small></td><td title={a.coverLetter}>{a.coverLetter.slice(0, 90) || '—'}{a.coverLetter.length > 90 && '…'}</td>
                  <td>{a.resumeUrl ? <a href={a.resumeUrl} target="_blank" rel="noreferrer noopener">Open</a> : '—'}</td><td>{new Date(a.createdAt).toLocaleDateString('en-BD')}</td>
                  <td><select className="ui-select dashboard-status" value={a.status} onChange={(e) => void changeStatus(a.id, e.target.value)}>{APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td></tr>)}
                {!apps.data?.length && <tr><td colSpan={6} className="admin-empty-cell">No applications yet.</td></tr>}
              </tbody></table></div>)}
          </div>}
          {!mode && <div className="admin-empty-state">Create a job, or pick one to edit it or review its applications.</div>}
        </section>
      </div>)}
  </>
}
