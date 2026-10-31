import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { requestIp } from '@/lib/security'

let tableReady: Promise<void> | null = null

async function ensureTable() {
  if (!db) throw new Error('Database is required for public API rate limiting.')
  if (!tableReady) {
    tableReady = db.execute(sql`
      CREATE TABLE IF NOT EXISTS public_api_rate_limits (
        scope VARCHAR(60) NOT NULL,
        subject_hash CHAR(64) NOT NULL,
        window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        attempts INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (scope, subject_hash)
      )
    `).then(() => undefined).catch((error) => { tableReady = null; throw error })
  }
  await tableReady
}

export type RateLimitRule = { scope: string; subject: string; limit: number; windowSeconds: number }
export type RateLimitResult = { allowed: boolean; retryAfter: number }

/** Atomic PostgreSQL counter; safe across serverless instances and concurrent requests. */
export async function enforcePublicRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  if (!db) throw new Error('Database is required for public API rate limiting.')
  if (!/^[a-z0-9:_-]{1,60}$/i.test(rule.scope) || !Number.isInteger(rule.limit) || rule.limit < 1 || !Number.isInteger(rule.windowSeconds) || rule.windowSeconds < 1) {
    throw new Error('Invalid public rate-limit rule.')
  }
  await ensureTable()
  const subjectHash = createHash('sha256').update(rule.subject.trim().toLowerCase()).digest('hex')
  const result = await db.execute(sql`
    INSERT INTO public_api_rate_limits (scope, subject_hash, window_started_at, attempts, updated_at)
    VALUES (${rule.scope}, ${subjectHash}, now(), 1, now())
    ON CONFLICT (scope, subject_hash) DO UPDATE SET
      attempts = CASE
        WHEN public_api_rate_limits.window_started_at <= now() - make_interval(secs => ${rule.windowSeconds}) THEN 1
        ELSE public_api_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN public_api_rate_limits.window_started_at <= now() - make_interval(secs => ${rule.windowSeconds}) THEN now()
        ELSE public_api_rate_limits.window_started_at
      END,
      updated_at = now()
    RETURNING attempts,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_started_at + make_interval(secs => ${rule.windowSeconds}) - now()))))::integer AS retry_after
  `)
  const row = result.rows[0] as { attempts: number; retry_after: number } | undefined
  if (!row) throw new Error('Public rate-limit counter did not return a result.')
  return { allowed: Number(row.attempts) <= rule.limit, retryAfter: Math.max(1, Number(row.retry_after) || rule.windowSeconds) }
}

/** Applies global + trusted-IP + normalized-subject budgets. Unknown proxy IPs are not trusted. */
export async function enforcePublicRequestLimits(input: {
  request: Request
  scope: string
  subject: string
  subjectLimit: number
  subjectWindowSeconds: number
  ipLimit?: number
  ipWindowSeconds?: number
  globalLimit?: number
  globalWindowSeconds?: number
}): Promise<RateLimitResult> {
  const rules: RateLimitRule[] = []
  if (input.globalLimit) rules.push({ scope: `${input.scope}:global`, subject: 'global', limit: input.globalLimit, windowSeconds: input.globalWindowSeconds || 3600 })
  const ip = requestIp(input.request)
  if (ip !== 'unknown' && input.ipLimit) rules.push({ scope: `${input.scope}:ip`, subject: ip, limit: input.ipLimit, windowSeconds: input.ipWindowSeconds || 900 })
  rules.push({ scope: `${input.scope}:subject`, subject: input.subject, limit: input.subjectLimit, windowSeconds: input.subjectWindowSeconds })
  for (const rule of rules) {
    const result = await enforcePublicRateLimit(rule)
    if (!result.allowed) return result
  }
  return { allowed: true, retryAfter: 0 }
}
