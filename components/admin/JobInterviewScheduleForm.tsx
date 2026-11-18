'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Clock3, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { JobSummary, VacancyInterviewDetails } from '@/lib/api/jobs'

type Props = {
  job: JobSummary
  existing?: VacancyInterviewDetails | null
  busy?: boolean
  onCancel: () => void
  onSave: (value: { jobId: number; startsAt: string; endsAt: string; minutesPerApplicant: number }) => void
}

function localInputValue(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function JobInterviewScheduleForm({ job, existing, busy = false, onCancel, onSave }: Props) {
  const shortlistedCount = job.shortlistedCount ?? 0
  const [startsAt, setStartsAt] = useState(() => localInputValue(existing?.startsAt))
  const [endsAt, setEndsAt] = useState(() => localInputValue(existing?.endsAt))
  const [minutes, setMinutes] = useState(existing?.minutesPerApplicant ?? 10)

  const totalMinutes = shortlistedCount * minutes
  const suggestedEnd = useMemo(() => {
    if (!startsAt || !Number.isFinite(totalMinutes) || totalMinutes <= 0) return ''
    const start = new Date(startsAt)
    if (Number.isNaN(start.getTime())) return ''
    start.setMinutes(start.getMinutes() + totalMinutes)
    const offset = start.getTimezoneOffset() * 60_000
    return new Date(start.getTime() - offset).toISOString().slice(0, 16)
  }, [startsAt, totalMinutes])

  function submit() {
    if (!startsAt || !endsAt || shortlistedCount <= 0 || busy) return
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return
    onSave({ jobId: job.id, startsAt: start.toISOString(), endsAt: end.toISOString(), minutesPerApplicant: minutes })
  }

  return <section className="jobs-interview-scheduler" aria-label={existing ? 'Reschedule interview' : 'Schedule interview'}>
    <header><p className="jobs-kicker"><CalendarClock size={13} /> {existing ? 'RESCHEDULE INTERVIEW' : 'INTERVIEW SCHEDULE'}</p><h3>{job.title.en}</h3><p>{job.category.en} · {shortlistedCount} short-listed applicants</p></header>
    <div className="jobs-interview-scheduler-grid">
      <label><span>Interview starts</span><Input type="datetime-local" value={startsAt} onChange={(event) => { setStartsAt(event.target.value); setEndsAt('') }} /></label>
      <label><span>Minutes per applicant</span><Input type="number" min={1} max={240} value={String(minutes)} onChange={(event) => setMinutes(Math.max(1, Math.min(240, Number(event.target.value) || 10)))} /></label>
      <label className="jobs-interview-scheduler-wide"><span>Interview window ends</span><Input type="datetime-local" value={endsAt} min={startsAt || undefined} onChange={(event) => setEndsAt(event.target.value)} /></label>
    </div>
    <div className="jobs-interview-suggestion">
      <Clock3 size={16} />
      <span><strong>Suggested total time: {totalMinutes} minutes</strong><small>{shortlistedCount} applicants × {minutes} minutes each. First applicant receives the first slot, then each applicant follows in application-date order.</small></span>
      {suggestedEnd && <Button type="button" size="sm" variant="outline" onClick={() => setEndsAt(suggestedEnd)}>Use suggested end</Button>}
    </div>
    {shortlistedCount === 0 && <p className="jobs-interview-form-warning"><Users size={14} /> Short-list applicants before creating an interview schedule.</p>}
    <footer><Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button><Button type="button" onClick={submit} disabled={busy || shortlistedCount === 0 || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)}>{busy ? 'Saving schedule…' : existing ? 'Save new schedule & notify applicants' : 'Schedule & notify applicants'}</Button></footer>
  </section>
}
