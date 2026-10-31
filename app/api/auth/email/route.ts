import { NextResponse } from 'next/server'
import { z } from 'zod'
import { completeEnquiry, requestEmailVerification, upsertFormUser, verifyEmailCode } from '@/lib/formFlow'
import { AUTH_COOKIE, cookieBase, sign } from '@/lib/authSession'

const baseSchema = z.object({
  email: z.email().max(254),
})

const requestSchema = baseSchema.extend({ action: z.literal('request'), purpose: z.literal('enquiry') })
const verifySchema = baseSchema.extend({
  action: z.literal('verify'),
  purpose: z.literal('enquiry'),
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10).max(5000).optional(),
  consentAt: z.string().datetime().optional(),
  visitorId: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    const request = requestSchema.safeParse(body)
    if (request.success) {
      await requestEmailVerification(request.data.email, request.data.purpose)
      return NextResponse.json({ ok: true, status: 'verification_sent' }, { status: 202 })
    }

    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ ok: false, error: { code: 'INVALID_INPUT', message: 'Please check the verification details.' } }, { status: 400 })
    await verifyEmailCode(parsed.data.email, parsed.data.purpose, parsed.data.code)

    if (!parsed.data.name || !parsed.data.message || !parsed.data.consentAt) return NextResponse.json({ ok: false, error: { code: 'MISSING_ENQUIRY_DATA', message: 'The enquiry details are incomplete.' } }, { status: 400 })

    const row = await upsertFormUser({ email: parsed.data.email, name: parsed.data.name, provider: 'email', providerId: parsed.data.email.toLowerCase(), phone: parsed.data.phone, verified: true })
    const user = {
      id: row.id,
      email: row.email,
      name: row.name || parsed.data.name,
      provider: (row.provider || 'email') as 'google' | 'email',
      providerId: row.providerId || parsed.data.email.toLowerCase(),
      phone: row.phone || parsed.data.phone || null,
    }
    const id = await completeEnquiry({ user, name: parsed.data.name, email: row.email, phone: parsed.data.phone, message: parsed.data.message, visitorId: parsed.data.visitorId, consentAt: parsed.data.consentAt })
    const response = NextResponse.json({ ok: true, status: 'submitted', id, verified: true }, { status: 201 })
    response.cookies.set(AUTH_COOKIE, sign(user, 60 * 60 * 24 * 30), { ...cookieBase(), maxAge: 2592000 })
    return response
  } catch (error) {
    if (error instanceof Error && error.message === 'DAILY_LIMIT') return NextResponse.json({ ok: false, error: { code: 'DAILY_LIMIT', message: 'You have already sent an enquiry today. Please try again tomorrow.' } }, { status: 429 })
    if (error instanceof Error && error.message === 'CODE_COOLDOWN') return NextResponse.json({ ok: false, error: { code: 'CODE_COOLDOWN', message: 'A verification code was already sent recently. Please check your email.' } }, { status: 429 })
    if (error instanceof Error && (error.message === 'CODE_INVALID' || error.message === 'CODE_LOCKED')) return NextResponse.json({ ok: false, error: { code: error.message, message: error.message === 'CODE_LOCKED' ? 'Too many incorrect codes. Request a new code later.' : 'The verification code is invalid or expired.' } }, { status: 400 })
    return NextResponse.json({ ok: false, error: { code: 'AUTH_SERVICE_UNAVAILABLE', message: error instanceof Error ? error.message : 'The verification service is temporarily unavailable.' } }, { status: 503 })
  }
}
