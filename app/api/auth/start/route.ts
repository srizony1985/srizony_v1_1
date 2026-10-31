import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { cookieBase, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE, PENDING_COOKIE, seal, getSiteOrigin } from '@/lib/authSession'
import { safeReturnTo } from '@/lib/securityPrimitives.mjs'
import { enforcePublicRequestLimits } from '@/lib/publicRateLimit'
import { readBoundedRequestText } from '@/lib/securityPrimitives.mjs'

const schema = z.object({
  provider: z.literal('google'),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().max(30).optional(),
  message: z.string().trim().min(5).max(5000),
  consentAt: z.string().datetime(),
  visitorId: z.string().max(128).optional(),
  returnTo: z.string().max(2048).optional(),
})

export async function POST(req: Request) {
  const raw = await readBoundedRequestText(req, 16_384)
  if (raw === null) return NextResponse.json({ error: 'Request body is too large or invalid.' }, { status: 413 })
  let input: unknown = null
  try { input = JSON.parse(raw) } catch { /* schema validation returns a generic input error */ }
  const parsed = schema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: 'Please complete the enquiry form first.' }, { status: 400 })

  const limits = await enforcePublicRequestLimits({ request: req, scope: 'google-oauth-start', subject: parsed.data.email.toLowerCase(), subjectLimit: 5, subjectWindowSeconds: 900, ipLimit: 20, ipWindowSeconds: 900, globalLimit: 300, globalWindowSeconds: 3600 })
  if (!limits.allowed) return NextResponse.json({ error: 'Too many sign-in attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(limits.retryAfter), 'Cache-Control': 'no-store' } })

  const { provider: _provider, ...pendingInput } = parsed.data
  const pending = { ...pendingInput, returnTo: safeReturnTo(pendingInput.returnTo, '/contact') }
  const state = randomBytes(24).toString('base64url')
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const origin = getSiteOrigin(req.url)
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return NextResponse.json({ error: 'Google sign-in is not configured yet.' }, { status: 503 })

  const redirectUri = `${origin}/api/auth/callback/google`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const response = NextResponse.json({ ok: true, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
  const opts = { ...cookieBase(), maxAge: 600 }
  response.cookies.set(PENDING_COOKIE, seal({ ...pending, createdAt: Date.now() }), opts)
  response.cookies.set(OAUTH_STATE_COOKIE, state, opts)
  response.cookies.set(OAUTH_VERIFIER_COOKIE, codeVerifier, opts)
  return response
}
