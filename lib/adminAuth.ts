import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { sql } from 'drizzle-orm'
import { safeEqual } from '@/lib/security'
import { db } from '@/lib/db'
import { configuredAdminUsers } from '@/lib/adminUsers'

const COOKIE = 'sf-cms-session'
const MAX_AGE = 60 * 60 * 12

export type AdminRole = 'admin' | 'editor' | 'analyst'
export type AdminSession = { email: string; role: AdminRole; sessionVersion: number }

function secret() {
  const value = process.env.CMS_SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim()
  if (!value) throw new Error('Missing required security environment variable: CMS_SESSION_SECRET or AUTH_SECRET')
  return value
}
function encode(value: string) { return Buffer.from(value).toString('base64url') }
function sign(value: string) { return createHmac('sha256', secret()).update(value).digest('base64url') }

export function createAdminSession(email: string, role: AdminRole = 'admin', sessionVersion = 0) {
  const payload = `${email.toLowerCase()}|${role}|${Date.now()}|${sessionVersion}`
  return `${encode(payload)}.${sign(payload)}`
}

export function verifyAdminSession(token?: string | null): AdminSession | null {
  if (!token) return null
  const [encoded, signature, ...extra] = token.split('.')
  if (!encoded || !signature || extra.length) return null
  try {
    const payload = Buffer.from(encoded, 'base64url').toString('utf8')
    const expected = sign(payload)
    const signatureBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) return null
    const [email, role, stamp, version] = payload.split('|')
    const issuedAt = Number(stamp)
    const sessionVersion = Number(version ?? 0) // Older environment-admin cookies remain valid only for their short lifetime.
    if (!email || !['admin', 'editor', 'analyst'].includes(role) || !Number.isSafeInteger(sessionVersion) || sessionVersion < 0 || !Number.isFinite(issuedAt) || issuedAt > Date.now() || Date.now() - issuedAt > MAX_AGE * 1000) return null
    return { email: email.toLowerCase(), role: role as AdminRole, sessionVersion }
  } catch {
    return null
  }
}

/**
 * Revalidates the signed cookie against the current account on every protected
 * request. Database status, role and session_version changes therefore revoke
 * previously issued cookies immediately after the database write commits.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies()
  const signed = verifyAdminSession(store.get(COOKIE)?.value)
  if (!signed) return null

  let configured: ReturnType<typeof configuredAdminUsers> = []
  try { configured = configuredAdminUsers() } catch { /* malformed env config must not authenticate anyone */ }
  const envUser = configured.find((candidate) => candidate.email.toLowerCase() === signed.email)

  if (db) {
    try {
      const result = await db.execute(sql`
        SELECT role, status, session_version
        FROM cms_users
        WHERE lower(email) = ${signed.email}
        LIMIT 1
      `)
      const current = result.rows[0] as { role: string; status: string; session_version: number | string } | undefined
      if (current) {
        const currentVersion = Number(current.session_version)
        if (current.status !== 'active' || current.role !== signed.role || currentVersion !== signed.sessionVersion) return null
        return signed
      }
    } catch {
      // DB-backed sessions fail closed if current authorization state cannot be checked.
      if (!envUser) return null
    }
  } else if (!envUser) {
    return null
  }

  if (!envUser || signed.sessionVersion !== 0 || (envUser.role || 'admin') !== signed.role) return null
  return signed
}

export function compareAdminCredential(input: string, configured: string) {
  return safeEqual(input, configured)
}

export const adminCookie = { name: COOKIE, maxAge: MAX_AGE }

export function hasAdminRole(session: AdminSession | null | undefined, ...allowed: AdminRole[]) {
  return Boolean(session && allowed.includes(session.role))
}
