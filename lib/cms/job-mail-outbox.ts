import { sql } from 'drizzle-orm'
import { db, withDbRetry } from '@/lib/db'
import { deliverJobMail, isJobMailConfigured, type JobMailMessage } from '@/lib/mail/job-mailer'

function database() {
  if (!db) throw new Error('DATABASE_URL is not configured; job email cannot be queued.')
  return db
}
const run = (query: ReturnType<typeof sql>) => withDbRetry(() => database().execute(query))

type QueueInput = JobMailMessage & {
  eventKey: string
  applicationId?: number | null
}
export type JobMailQueueResult = { delivery: 'sent' | 'queued' | 'already-sent' | 'not-configured' }

async function attemptOutboxMessage(id: number): Promise<JobMailQueueResult> {
  if (!isJobMailConfigured()) return { delivery: 'not-configured' }

  const claimed = await run(sql`
    UPDATE job_email_outbox
    SET status = 'sending', attempts = attempts + 1, updated_at = now()
    WHERE id = ${id}
      AND status = 'pending'
      AND next_attempt_at <= now()
    RETURNING id, recipient_email, subject, text_body, html_body, attempts
  `)
  const message = claimed.rows[0] as Record<string, unknown> | undefined
  if (!message) {
    const current = await run(sql`SELECT status FROM job_email_outbox WHERE id = ${id} LIMIT 1`)
    const status = String((current.rows[0] as Record<string, unknown> | undefined)?.status || '')
    return { delivery: status === 'sent' ? 'already-sent' : 'queued' }
  }

  try {
    const result = await deliverJobMail({
      to: String(message.recipient_email),
      subject: String(message.subject),
      text: String(message.text_body),
      html: String(message.html_body),
    })
    if (!result.configured) {
      await run(sql`UPDATE job_email_outbox SET status = 'pending', last_error = 'Gmail mailbox or App Password is not configured.', updated_at = now() WHERE id = ${id}`)
      return { delivery: 'not-configured' }
    }
    await run(sql`
      UPDATE job_email_outbox SET status = 'sent', sent_at = now(),
        provider_message_id = ${result.messageId || null}, last_error = NULL, updated_at = now()
      WHERE id = ${id}
    `)
    return { delivery: 'sent' }
  } catch (error) {
    const attempt = Number(message.attempts || 1)
    const safeMessage = (error instanceof Error ? error.message : 'Unknown email delivery error').slice(0, 1000)
    const delayMinutes = Math.min(60, 2 ** Math.min(attempt, 6))
    await run(sql`
      UPDATE job_email_outbox SET
        status = CASE WHEN attempts >= 12 THEN 'failed' ELSE 'pending' END,
        next_attempt_at = now() + (${delayMinutes} * interval '1 minute'),
        last_error = ${safeMessage}, updated_at = now()
      WHERE id = ${id}
    `)
    console.error('Job email delivery deferred.', { outboxId: id, attempt, message: safeMessage })
    return { delivery: 'queued' }
  }
}

/** Store first, then attempt immediate delivery. A queued email remains retryable. */
export async function queueJobEmail(input: QueueInput): Promise<JobMailQueueResult> {
  if (!input.to.trim()) return { delivery: 'not-configured' }
  const inserted = await run(sql`
    INSERT INTO job_email_outbox (
      event_key, application_id, recipient_email, subject, text_body, html_body, status
    ) VALUES (
      ${input.eventKey}, ${input.applicationId ?? null}, ${input.to.trim().toLowerCase()},
      ${input.subject}, ${input.text}, ${input.html}, 'pending'
    )
    ON CONFLICT (event_key) DO NOTHING
    RETURNING id
  `)

  const id = Number((inserted.rows[0] as Record<string, unknown> | undefined)?.id)
  if (!id) {
    const existing = await run(sql`SELECT id, status FROM job_email_outbox WHERE event_key = ${input.eventKey} LIMIT 1`)
    const row = existing.rows[0] as Record<string, unknown> | undefined
    if (!row) throw new Error('The job email could not be persisted.')
    if (row.status === 'sent') return { delivery: 'already-sent' }
    if (row.status === 'pending') return attemptOutboxMessage(Number(row.id))
    return { delivery: 'queued' }
  }
  return attemptOutboxMessage(id)
}

/** Called by the protected maintenance route. UPDATE claims each row atomically. */
export async function processJobEmailOutbox(limit = 20) {
  if (!isJobMailConfigured()) return { processed: 0, pending: true }
  await run(sql`
    UPDATE job_email_outbox SET status = 'pending', updated_at = now()
    WHERE status = 'sending' AND updated_at < now() - interval '15 minutes'
  `)
  const candidates = await run(sql`
    SELECT id FROM job_email_outbox
    WHERE status = 'pending' AND next_attempt_at <= now()
    ORDER BY created_at ASC LIMIT ${Math.max(1, Math.min(100, Math.floor(limit)))}
  `)
  const rows = candidates.rows as Array<Record<string, unknown>>
  let cursor = 0
  let processed = 0
  const workerCount = Math.min(4, rows.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++]
      await attemptOutboxMessage(Number(row.id))
      processed += 1
    }
  }))
  return { processed, pending: false }
}
