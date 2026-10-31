import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  cookieBase, AUTH_COOKIE, OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE,
  PENDING_COOKIE, sign, unseal, getSiteOrigin,
} from '@/lib/authSession'
import { upsertFormUser, completeEnquiry } from '@/lib/formFlow'
import { safeReturnTo } from '@/lib/securityPrimitives.mjs'

type GoogleProfile = { sub?: string; email?: string; email_verified?: boolean; name?: string }
type GoogleTokenResponse = { access_token?: string }
type PendingEnquiry = { returnTo?: string; name: string; email: string; phone?: string; message: string; consentAt: string; visitorId?: string; createdAt: number }

function clearTransientCookies(response: NextResponse) {
  const options = { ...cookieBase(), maxAge: 0 }
  response.cookies.set(PENDING_COOKIE, '', options)
  response.cookies.set(OAUTH_STATE_COOKIE, '', options)
  response.cookies.set(OAUTH_VERIFIER_COOKIE, '', options)
  return response
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const jar = await cookies()
  const state = jar.get(OAUTH_STATE_COOKIE)?.value
  const verifier = jar.get(OAUTH_VERIFIER_COOKIE)?.value
  const pending = unseal<PendingEnquiry>(jar.get(PENDING_COOKIE)?.value)
  const back = safeReturnTo(pending?.returnTo, '/contact')

  const redirect = (status: string) => clearTransientCookies(
    NextResponse.redirect(new URL(`${back}?auth=${status}`, url.origin)),
  )

  if (!state || state !== url.searchParams.get('state') || !pending || !verifier
    || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt > 10 * 60 * 1000
    || pending.createdAt > Date.now() + 60 * 1000) return redirect('invalid')
  const code = url.searchParams.get('code')
  if (!code) return redirect('cancelled')

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('Google OAuth is not configured.')

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${getSiteOrigin(url.toString())}/api/auth/callback/google`,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const tokens = await tokenResponse.json() as GoogleTokenResponse
    if (!tokenResponse.ok || !tokens.access_token) throw new Error('Google token exchange failed.')

    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const profile = await profileResponse.json() as GoogleProfile
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) {
      throw new Error('Google account did not return a verified email.')
    }

    const row = await upsertFormUser({
      email: profile.email,
      name: profile.name || pending.name,
      provider: 'google',
      providerId: profile.sub,
      phone: pending.phone,
      verified: true,
    })
    const user = {
      id: row.id,
      email: row.email,
      name: row.name || pending.name,
      provider: 'google' as const,
      providerId: profile.sub,
      phone: row.phone || pending.phone,
    }

    try {
      await completeEnquiry({
        user, name: pending.name, email: pending.email, phone: pending.phone,
        message: pending.message, visitorId: pending.visitorId, consentAt: pending.consentAt,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'DAILY_LIMIT') return redirect('daily-limit')
      throw error
    }

    const response = NextResponse.redirect(new URL(`${back}?auth=success`, url.origin))
    response.cookies.set(AUTH_COOKIE, sign(user), { ...cookieBase(), maxAge: 2592000 })
    return clearTransientCookies(response)
  } catch (error) {
    console.error('Google OAuth callback failed', error)
    return redirect('failed')
  }
}
