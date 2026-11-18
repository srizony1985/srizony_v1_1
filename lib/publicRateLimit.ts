
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { requestIp } from '@/lib/security'
import { assertRequiredColumns } from '@/lib/db/schema-validation'

let tableReady: Promise<void> | null = null

async function ensureTable() {
  if (!db) {
    throw new Error('Database is required for public API rate limiting.')
  }

  tableReady ??= assertRequiredColumns(
    db,
    {
      public_api_rate_limits: [
        'scope',
        'subject_hash',
        'window_started_at',
        'attempts',
        'updated_at',
      ],
    },
    'Public API rate limiting',
  ).catch((error) => {
    tableReady = null
    throw error
  })

  await tableReady
}

export type RateLimitRule = {
  scope: string
  subject: string
  limit: number
  windowSeconds: number
}

export type RateLimitResult = {
  allowed: boolean
  retryAfter: number
}

/** Atomic PostgreSQL counter; safe across serverless instances and concurrent requests. */
export async function enforcePublicRateLimit(
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  if (!db) {
    throw new Error('Database is required for public API rate limiting.')
  }

  if (
    !/^[a-z0-9:_-]{1,60}$/i.test(rule.scope) ||
    !Number.isInteger(rule.limit) ||
    rule.limit < 1 ||
    !Number.isInteger(rule.windowSeconds) ||
    rule.windowSeconds < 1
  ) {
    throw new Error('Invalid public rate-limit rule.')
  }

  await ensureTable()

  const subjectHash = createHash('sha256')
    .update(rule.subject.trim().toLowerCase())
    .digest('hex')

  const result = await db.execute(sql`
    INSERT INTO public_api_rate_limits (
      scope,
      subject_hash,
      window_started_at,
      attempts,
      updated_at
    )
    VALUES (
      ${rule.scope},
      ${subjectHash},
      now(),
      1,
      now()
    )
    ON CONFLICT (scope, subject_hash) DO UPDATE SET
      attempts = CASE
        WHEN public_api_rate_limits.window_started_at
          <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN 1
        ELSE public_api_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN public_api_rate_limits.window_started_at
          <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN now()
        ELSE public_api_rate_limits.window_started_at
      END,
      updated_at = now()
    RETURNING
      attempts,
      GREATEST(
        1,
        CEIL(
          EXTRACT(
            EPOCH FROM (
              window_started_at
              + make_interval(secs => ${rule.windowSeconds})
              - now()
            )
          )
        )
      )::integer AS retry_after
  `)

  const row = result.rows[0] as
    | { attempts: number; retry_after: number }
    | undefined

  if (!row) {
    throw new Error('Public rate-limit counter did not return a result.')
  }

  return {
    allowed: Number(row.attempts) <= rule.limit,
    retryAfter: Math.max(
      1,
      Number(row.retry_after) || rule.windowSeconds,
    ),
  }
}

/**
 * Strict localhost detection.
 * Only applies to development requests on port 3000.
 */
function isLocalhostRequest(request: Request): boolean {
  try {
    const url = new URL(request.url)

    return (
      url.port === '3000' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

/**
 * Applies global + trusted-IP + normalized-subject budgets.
 *
 * Local development on localhost:3000 bypasses all rate limits.
 * Production and other hosts retain normal rate limiting.
 */
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

  // IMPORTANT: Bypass before database access and counter creation.
  if (
    process.env.NODE_ENV === 'development' &&
    isLocalhostRequest(input.request)
  ) {
    return {
      allowed: true,
      retryAfter: 0,
    }
  }

  const rules: RateLimitRule[] = []

  // Global budget
  if (input.globalLimit) {
    rules.push({
      scope: `${input.scope}:global`,
      subject: 'global',
      limit: input.globalLimit,
      windowSeconds: input.globalWindowSeconds || 3600,
    })
  }

  // Trusted IP budget
  const ip = requestIp(input.request)

  if (ip !== 'unknown' && input.ipLimit) {
    rules.push({
      scope: `${input.scope}:ip`,
      subject: ip,
      limit: input.ipLimit,
      windowSeconds: input.ipWindowSeconds || 900,
    })
  }

  // Normalized subject budget
  rules.push({
    scope: `${input.scope}:subject`,
    subject: input.subject,
    limit: input.subjectLimit,
    windowSeconds: input.subjectWindowSeconds,
  })

  // Enforce all configured budgets
  for (const rule of rules) {
    const result = await enforcePublicRateLimit(rule)

    if (!result.allowed) {
      return result
    }
  }

  return {
    allowed: true,
    retryAfter: 0,
  }
}
