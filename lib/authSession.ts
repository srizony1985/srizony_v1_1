import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { requiredSecret } from '@/lib/security'

function secret() { return requiredSecret('AUTH_SECRET') }
function key() { return createHmac('sha256', secret()).update('srizony-foundation-auth').digest() }

function encode(value: string) { return Buffer.from(value).toString('base64url') }
function decode(value: string) { return Buffer.from(value, 'base64url').toString('utf8') }

export type AuthUser = {
  id: number
  email: string
  name: string
  provider: 'google' | 'email'
  providerId: string
  phone?: string | null
}

export function seal(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return `${encode(iv.toString('base64'))}.${encode(ciphertext.toString('base64'))}.${encode(cipher.getAuthTag().toString('base64'))}`
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null
  try {
    const [ivPart, bodyPart, tagPart] = value.split('.')
    if (!ivPart || !bodyPart || !tagPart) return null
    const iv = Buffer.from(decode(ivPart), 'base64')
    const ciphertext = Buffer.from(decode(bodyPart), 'base64')
    const tag = Buffer.from(decode(tagPart), 'base64')
    const decipher = createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as T
  } catch { return null }
}

export function sign(value: unknown, expiresInSeconds = 60 * 60 * 24 * 7) {
  const payloadValue = typeof value === 'object' && value !== null ? { ...(value as Record<string, unknown>), exp: Date.now() + expiresInSeconds * 1000 } : { value, exp: Date.now() + expiresInSeconds * 1000 }
  const payload = encode(JSON.stringify(payloadValue))
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verify<T>(value: string | undefined): T | null {
  if (!value) return null
  const [payload, sig] = value.split('.')
  if (!payload || !sig) return null
  try {
    const expected = createHmac('sha256', secret()).update(payload).digest('base64url')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const parsed = JSON.parse(decode(payload)) as T & { exp?: number }
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null
    return parsed
  } catch { return null }
}

export const AUTH_COOKIE = 'sf-auth'
export const PENDING_COOKIE = 'sf-pending-enquiry'
export const OAUTH_STATE_COOKIE = 'sf-oauth-state'
export const OAUTH_VERIFIER_COOKIE = 'sf-oauth-verifier'
export const VISITOR_COOKIE = 'sf-visitor-id'

export function getSiteOrigin(requestUrl: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) return new URL(configured).origin
  return new URL(requestUrl).origin
}

export function cookieBase(secure = process.env.NODE_ENV === 'production') {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/' }
}
