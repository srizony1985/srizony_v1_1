import { createHash, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { adminAuditLog } from '@/lib/db/schema'

export function requiredSecret(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required security environment variable: ${name}`)
  return value
}

export function safeEqual(left: string, right: string) {
  const a = createHash('sha256').update(left).digest()
  const b = createHash('sha256').update(right).digest()
  return timingSafeEqual(a, b)
}

export function requestIp(request: Request) {
  // Never trust an arbitrary client-supplied X-Forwarded-For chain. Configure
  // exactly one ingress header that the hosting proxy strips and overwrites.
  const configuredHeader = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase()
  const allowedHeaders = new Set(['x-vercel-forwarded-for', 'cf-connecting-ip', 'x-real-ip'])
  if (!configuredHeader || !allowedHeaders.has(configuredHeader)) return 'unknown'
  const raw = request.headers.get(configuredHeader)?.split(',')[0]?.trim() || ''
  return isIP(raw) ? raw : 'unknown'
}

export async function auditAdminAction(input: { actorEmail: string; action: string; entity?: string; entityId?: string; metadata?: unknown; request?: Request }) {
  if (!db) return
  try {
    await db.insert(adminAuditLog).values({
      actorEmail: input.actorEmail.toLowerCase(),
      action: input.action,
      entity: input.entity || null,
      entityId: input.entityId || null,
      metadata: input.metadata ?? null,
      ipAddress: input.request ? requestIp(input.request) : null,
      userAgent: input.request?.headers.get('user-agent') || null,
    })
  } catch (error) {
    console.error('Audit log write failed', error)
  }
}

let loginRateLimitTableReady: Promise<void> | null = null

async function ensureLoginRateLimitTable() {
  if (!db) throw new Error('Database is required for login rate limiting.')
  if (!loginRateLimitTableReady) {
    loginRateLimitTableReady = db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_login_attempts (
        key VARCHAR(255) PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        locked_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `).then(() => undefined).catch((error) => {
      loginRateLimitTableReady = null
      throw error
    })
  }
  await loginRateLimitTableReady
}

export async function enforceLoginRateLimit(key: string) {
  await ensureLoginRateLimitTable()
  if (!db) throw new Error('Database is required for login rate limiting.')
  const result = await db.execute(sql`
    INSERT INTO admin_login_attempts (key, attempts, first_attempt_at, locked_until, updated_at)
    VALUES (${key}, 0, now(), NULL, now())
    ON CONFLICT (key) DO UPDATE SET updated_at = now()
    RETURNING attempts, locked_until
  `)
  const row = result.rows[0] as { attempts: number; locked_until: string | null } | undefined
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) return false
  return true
}

export async function recordLoginFailure(key: string, lockAfter = 5) {
  const threshold = Math.max(3, Math.min(30, Math.floor(lockAfter)))
  if (!db) return
  await ensureLoginRateLimitTable()
  await db.execute(sql`
    INSERT INTO admin_login_attempts (key, attempts, first_attempt_at, locked_until, updated_at)
    VALUES (${key}, 1, now(), NULL, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN now() - admin_login_attempts.first_attempt_at > interval '15 minutes' THEN 1 ELSE admin_login_attempts.attempts + 1 END,
      first_attempt_at = CASE WHEN now() - admin_login_attempts.first_attempt_at > interval '15 minutes' THEN now() ELSE admin_login_attempts.first_attempt_at END,
      locked_until = CASE WHEN (CASE WHEN now() - admin_login_attempts.first_attempt_at > interval '15 minutes' THEN 1 ELSE admin_login_attempts.attempts + 1 END) >= ${threshold} THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now()
  `)
}

export async function clearLoginFailures(key: string) {
  if (!db) return
  await ensureLoginRateLimitTable()
  await db.execute(sql`DELETE FROM admin_login_attempts WHERE key = ${key}`)
}

