import { cookies } from 'next/headers'
import { createHash, randomInt } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { authEmailChallenges, cookieConsents, enquiryDailyLimits, formUsers, submissions } from '@/lib/db/schema'
import type { AuthUser } from '@/lib/authSession'
import { requiredSecret } from '@/lib/security'
import { AUTH_COOKIE, verify } from '@/lib/authSession'
import { sendEmail } from '@/lib/email'

export async function getCurrentFormUser(): Promise<AuthUser | null> {
  const jar = await cookies()
  const session = verify<AuthUser>(jar.get(AUTH_COOKIE)?.value)
  if (!session) return null
  if (!db) return null
  try {
    const rows = await db.select({ id: formUsers.id, name: formUsers.name, phone: formUsers.phone, provider: formUsers.provider, providerId: formUsers.providerId, emailVerifiedAt: formUsers.emailVerifiedAt }).from(formUsers).where(eq(formUsers.email, session.email.toLowerCase())).limit(1)
    const profile = rows[0]
    if (!profile || !profile.emailVerifiedAt) return null
    return { ...session, id: profile.id, name: profile.name || session.name, phone: profile.phone || session.phone || null, provider: (profile.provider || session.provider) as AuthUser['provider'], providerId: profile.providerId || session.providerId }
  } catch {
    return null
  }
}

export async function upsertFormUser(input: { email: string; name: string; provider: 'google' | 'email'; providerId: string; phone?: string; verified?: boolean }) {
  if (!db) throw new Error('DATABASE_URL is not configured')
  const existing = await db.select({ provider: formUsers.provider, providerId: formUsers.providerId, emailVerifiedAt: formUsers.emailVerifiedAt }).from(formUsers).where(eq(formUsers.email, input.email.toLowerCase())).limit(1)
  const current = existing[0]
  const rows = await db.insert(formUsers).values({ email: input.email.toLowerCase(), name: input.name || null, provider: input.provider, providerId: input.providerId, phone: input.phone || null, emailVerifiedAt: input.verified ? new Date() : current?.emailVerifiedAt || null })
    .onConflictDoUpdate({
      target: formUsers.email,
      set: {
        name: input.name || null,
        provider: current?.provider === 'google' ? 'google' : input.provider,
        providerId: current?.provider === 'google' ? current.providerId : input.providerId,
        ...(input.phone ? { phone: input.phone } : {}),
        ...(input.verified ? { emailVerifiedAt: new Date() } : {}),
        updatedAt: new Date(),
      },
    }).returning()
  return rows[0]
}

function codeHash(email: string, code: string) {
  return createHash('sha256').update(`${email.toLowerCase()}:${code}:${requiredSecret('AUTH_SECRET')}`).digest('hex')
}

export async function requestEmailVerification(email: string, purpose: 'enquiry') {
  if (!db) throw new Error('DATABASE_URL is not configured')
  const normalized = email.toLowerCase()
  const recent = await db.execute(sql`SELECT created_at FROM auth_email_challenges WHERE email = ${normalized} AND purpose = ${purpose} AND created_at > now() - interval '5 minutes' ORDER BY created_at DESC LIMIT 1`)
  if (recent.rows.length) throw new Error('CODE_COOLDOWN')
  const code = String(randomInt(100000, 1000000))
  await db.execute(sql`DELETE FROM auth_email_challenges WHERE email = ${normalized} AND purpose = ${purpose}`)
  await db.insert(authEmailChallenges).values({ email: normalized, codeHash: codeHash(normalized, code), purpose, expiresAt: new Date(Date.now() + 10 * 60 * 1000) })

  const subject = 'Verify your Srizony Foundation enquiry email'
  const body = `<p>Use this verification code to continue your Srizony Foundation enquiry:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request this, ignore this email.</p>`
  await sendEmail({ to: normalized, subject, html: body })
}

export async function verifyEmailCode(email: string, purpose: 'enquiry', code: string) {
  if (!db) throw new Error('DATABASE_URL is not configured')
  const normalized = email.toLowerCase()
  const rows = await db.select().from(authEmailChallenges).where(eq(authEmailChallenges.email, normalized)).limit(10)
  const challenge = rows.find((x) => x.purpose === purpose && !x.consumedAt && x.expiresAt.getTime() > Date.now())
  if (!challenge) throw new Error('CODE_INVALID')
  if (challenge.attempts >= 5) throw new Error('CODE_LOCKED')
  const valid = challenge.codeHash === codeHash(normalized, code)
  if (!valid) {
    await db.update(authEmailChallenges).set({ attempts: sql`${authEmailChallenges.attempts} + 1` }).where(eq(authEmailChallenges.id, challenge.id))
    throw new Error('CODE_INVALID')
  }
  await db.update(authEmailChallenges).set({ consumedAt: new Date() }).where(eq(authEmailChallenges.id, challenge.id))
  return true
}

export async function completeEnquiry(input: { user: AuthUser; name: string; email: string; phone?: string; message: string; visitorId?: string; consentAt: string }) {
  if (!db) throw new Error('DATABASE_URL is not configured')
  const email = input.email.toLowerCase()
  const payload = JSON.stringify({ consent: true, consentAt: input.consentAt, visitorId: input.visitorId || null, provider: input.user.provider })
  const result = await db.execute(sql`
    WITH gate AS (
      INSERT INTO enquiry_daily_limits (email, submission_date)
      VALUES (${email}, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dhaka')::date)
      ON CONFLICT (email, submission_date) DO NOTHING
      RETURNING id
    ), created AS (
      INSERT INTO submissions (type, name, email, phone, message, payload, status)
      SELECT 'query', ${input.name}, ${email}, ${input.phone || null}, ${input.message}, ${payload}::jsonb, 'new'
      FROM gate
      RETURNING id
    ), linked AS (
      UPDATE enquiry_daily_limits limit_row
      SET submission_id = created.id
      FROM gate JOIN created ON TRUE
      WHERE limit_row.id = gate.id
      RETURNING limit_row.id
    )
    SELECT created.id FROM created JOIN linked ON TRUE
  `)
  if (!result.rows.length) throw new Error('DAILY_LIMIT')
  const row = result.rows[0] as { id: number }
  try { await db.insert(cookieConsents).values({ visitorId: input.visitorId || null, email, purpose: 'enquiry', consented: true }) } catch { /* history should not invalidate an accepted enquiry */ }
  return Number(row.id)
}
