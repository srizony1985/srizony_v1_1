import { setDefaultResultOrder } from 'node:dns'

// Neon HTTP uses Node's fetch. Prefer IPv4 first so local development does not
// fail when an IPv6 route/resolver is available but unusable. This mirrors the
// NODE_OPTIONS=--enable-network-family-autoselection workaround while keeping
// the fix inside the application.
setDefaultResultOrder('ipv4first')

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const url = process.env.DATABASE_URL?.trim()

const sql = url ? neon(url) : null
export const db = sql ? drizzle({ client: sql }) : null

export function isTransientDatabaseError(error: unknown): boolean {
  const seen = new Set<object>()
  let current: unknown = error

  while (current) {
    if (typeof current === 'object') {
      if (seen.has(current)) break
      seen.add(current)
    }
    const message = current instanceof Error ? current.message : typeof current === 'string' ? current : ''
    if (/fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|UND_ERR|socket|network|connection (?:terminated|closed|refused|timed out)|server closed the connection|quota (?:exceeded|exhausted)|compute (?:time|quota|limit)|resource exhaustion|too many requests|rate limit|usage limit|credit limit|(?:compute|project|database).*(?:quota|limit|suspend|disabled)|exceeded.*(?:limit|quota)/i.test(message)) {
      return true
    }
    if (typeof current === 'object' && current !== null) {
      const details = current as { code?: unknown; status?: unknown; statusCode?: unknown; cause?: unknown }
      const code = String(details.code || '')
      const status = Number(details.status ?? details.statusCode)
      if (/^08/.test(code) || ['57P01', '57P02', '57P03', '40001', '40P01', '53300', '53400'].includes(code) || [402, 408, 425, 429, 500, 502, 503, 504, 529].includes(status)) return true
      current = details.cause
    } else {
      current = undefined
    }
  }

  return false
}

export async function withDbRetry<T>(operation: () => Promise<T>, retries = 0): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt >= retries || !isTransientDatabaseError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Database request failed.')
}
