import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, withDbRetry } from '@/lib/db'
import { configuredAdminUsers } from '@/lib/adminUsers'
import type { AdminRole } from '@/lib/adminAuth'
import { ensureCmsSchema } from './ensureSchema'

type Row = Record<string, any>
export type CmsUser = { id: number | null; email: string; role: AdminRole; status: 'active' | 'disabled'; source: 'environment' | 'database'; lastLoginAt?: string | null; createdAt?: string | null }
export class UserError extends Error { constructor(message: string, public status = 400) { super(message) } }
export const ROLES: AdminRole[] = ['admin', 'editor', 'analyst']
const database = () => { if (!db) throw new UserError('DATABASE_URL is not configured', 503); return db }
const run = (q: ReturnType<typeof sql>) => withDbRetry(() => database().execute(q))

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('base64url')}$${scryptSync(password, salt, 64).toString('base64url')}`
}
export function verifyPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split('$')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
function checkPassword(password: string) {
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new UserError('Password must be at least 10 characters and include a letter and a number.')
}
const iso = (v: unknown) => (v ? (v instanceof Date ? v.toISOString() : String(v)) : null)
const toUser = (r: Row): CmsUser => ({ id: Number(r.id), email: r.email, role: r.role, status: r.status, source: 'database', lastLoginAt: iso(r.last_login_at), createdAt: iso(r.created_at) })

export async function listUsers(): Promise<CmsUser[]> {
  let env: CmsUser[] = []
  try { env = configuredAdminUsers().map((u) => ({ id: null, email: u.email.toLowerCase(), role: u.role || 'admin', status: 'active', source: 'environment' })) } catch { /* invalid env config is reported at login */ }
  if (!db) return env
  await ensureCmsSchema()
  const rows = (await run(sql`SELECT * FROM cms_users ORDER BY created_at DESC`)).rows as Row[]
  return [...env, ...rows.map(toUser)]
}

export async function createUser(input: { email: string; password: string; role: AdminRole }, actor: string) {
  await ensureCmsSchema()
  const email = input.email.trim().toLowerCase()
  if (!ROLES.includes(input.role)) throw new UserError('Unsupported role.')
  checkPassword(input.password)
  if ((await listUsers()).some((u) => u.email === email)) throw new UserError('A CMS user with this email already exists.', 409)
  const r = await run(sql`INSERT INTO cms_users (email, password_hash, role, created_by) VALUES (${email}, ${hashPassword(input.password)}, ${input.role}, ${actor}) RETURNING *`)
  return toUser(r.rows[0] as Row)
}

export async function updateUser(id: number, patch: { role?: AdminRole; status?: 'active' | 'disabled'; password?: string }, actorEmail: string) {
  await ensureCmsSchema()
  const current = (await run(sql`SELECT * FROM cms_users WHERE id = ${id} LIMIT 1`)).rows[0] as Row | undefined
  if (!current) throw new UserError('User not found.', 404)
  if (current.email === actorEmail.toLowerCase() && (patch.status === 'disabled' || (patch.role && patch.role !== 'admin'))) throw new UserError('You cannot disable or demote your own account.')
  if (patch.role && !ROLES.includes(patch.role)) throw new UserError('Unsupported role.')
  if (patch.password) checkPassword(patch.password)
  const r = await run(sql`UPDATE cms_users SET role = ${patch.role ?? current.role}, status = ${patch.status ?? current.status},
    password_hash = ${patch.password ? hashPassword(patch.password) : current.password_hash},
    session_version = COALESCE(session_version, 1) + CASE WHEN ${Boolean(patch.password || patch.role || patch.status)} THEN 1 ELSE 0 END,
    updated_at = now() WHERE id = ${id} RETURNING *`)
  return toUser(r.rows[0] as Row)
}

export async function deleteUser(id: number, actorEmail: string) {
  await ensureCmsSchema()
  const current = (await run(sql`SELECT email FROM cms_users WHERE id = ${id} LIMIT 1`)).rows[0] as Row | undefined
  if (!current) throw new UserError('User not found.', 404)
  if (current.email === actorEmail.toLowerCase()) throw new UserError('You cannot delete your own account.')
  await run(sql`DELETE FROM cms_users WHERE id = ${id}`)
}

/** Credential check against database users (environment users are handled by the login route). */
export async function authenticateDatabaseUser(email: string, password: string): Promise<{ email: string; role: AdminRole; sessionVersion: number } | null> {
  if (!db) return null
  await ensureCmsSchema()
  const row = (await run(sql`SELECT * FROM cms_users WHERE email = ${email.toLowerCase()} LIMIT 1`)).rows[0] as Row | undefined
  if (!row || row.status !== 'active' || !verifyPassword(password, row.password_hash)) return null
  await run(sql`UPDATE cms_users SET last_login_at = now() WHERE id = ${Number(row.id)}`)
  return { email: row.email, role: row.role, sessionVersion: Number(row.session_version ?? 1) }
}
