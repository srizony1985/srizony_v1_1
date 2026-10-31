import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

export async function enqueueDonationReceipt(donationId: number, recipientEmail: string) {
  if (!db) throw new Error('Database is not configured.')
  await db.execute(sql`
    INSERT INTO donation_receipt_jobs (donation_id, recipient_email)
    VALUES (${donationId}, ${recipientEmail.toLowerCase()})
    ON CONFLICT (donation_id) DO NOTHING
  `)
}

/** Claims jobs atomically so concurrent cron invocations do not send duplicates. */
export async function processDonationReceiptJobs(batchSize = 10) {
  if (!db) throw new Error('Database is not configured.')
  const claim = await db.execute(sql`
    WITH due AS (
      SELECT id FROM donation_receipt_jobs
      WHERE sent_at IS NULL
        AND attempts < 10
        AND next_attempt_at <= now()
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY next_attempt_at ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(50, Math.floor(batchSize)))}
    )
    UPDATE donation_receipt_jobs AS job
    SET locked_until = now() + interval '5 minutes',
        attempts = job.attempts + 1,
        updated_at = now()
    FROM due
    WHERE job.id = due.id
    RETURNING job.id, job.donation_id, job.recipient_email, job.attempts
  `)

  let sent = 0
  let failed = 0
  for (const row of claim.rows as Array<{ id: number; donation_id: number; recipient_email: string; attempts: number }>) {
    try {
      const donation = await db.execute(sql`SELECT transaction_id, amount FROM donations WHERE id = ${row.donation_id} LIMIT 1`)
      const record = donation.rows[0] as { transaction_id: string; amount: string | number } | undefined
      if (!record) throw new Error('Donation record no longer exists.')
      await sendEmail({
        to: row.recipient_email,
        subject: 'Donation confirmation — Srizony Foundation',
        html: `<p>Thank you for supporting Srizony Foundation.</p><p>Transaction: <strong>${record.transaction_id}</strong><br/>Amount: <strong>BDT ${Number(record.amount).toFixed(2)}</strong></p><p>This email confirms that the payment gateway validated your donation.</p>`,
      })
      await db.execute(sql`UPDATE donation_receipt_jobs SET sent_at = now(), locked_until = NULL, last_error = NULL, updated_at = now() WHERE id = ${row.id}`)
      await db.execute(sql`UPDATE donations SET receipt_sent_at = now() WHERE id = ${row.donation_id} AND receipt_sent_at IS NULL`)
      sent += 1
    } catch (error) {
      const delaySeconds = Math.min(86400, 60 * (2 ** Math.max(0, Number(row.attempts) - 1)))
      const message = (error instanceof Error ? error.message : 'Email delivery failed.').slice(0, 500)
      await db.execute(sql`
        UPDATE donation_receipt_jobs
        SET next_attempt_at = now() + make_interval(secs => ${delaySeconds}),
            locked_until = NULL, last_error = ${message}, updated_at = now()
        WHERE id = ${row.id}
      `)
      failed += 1
    }
  }
  return { claimed: claim.rows.length, sent, failed }
}
