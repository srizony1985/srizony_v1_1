import type { JsonObject } from '@/types/json'
import { NextResponse } from 'next/server'
import { enforcePublicRequestLimits } from '@/lib/publicRateLimit'
import { readBoundedRequestText } from '@/lib/securityPrimitives.mjs'

export const runtime = 'nodejs'

const MAX_REPORT_BYTES = 16_384

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
}

function respondNoContent() {
  return new NextResponse(null, {
    status: 204,
    headers: NO_STORE_HEADERS,
  })
}

function isRecord(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function getReportString(
  report: JsonObject,
  keys: string[],
  maxLength: number,
): string {
  for (const key of keys) {
    const value = report[key]

    if (typeof value === 'string' && value.length > 0) {
      return value.slice(0, maxLength)
    }
  }

  return 'unknown'
}

/**
 * Receives bounded CSP report-only events.
 *
 * Reports are untrusted telemetry. They are never persisted,
 * reflected to clients, or allowed to interfere with page rendering.
 */
export async function POST(req: Request) {
  // 1. Production rate limiting only.
  // Development reloads and HMR can generate many CSP reports.
  if (process.env.NODE_ENV === 'production') {
    try {
      const limits = await enforcePublicRequestLimits({
        request: req,
        scope: 'csp-report',
        subject: 'all-reports',
        subjectLimit: 1000,
        subjectWindowSeconds: 3600,
        ipLimit: 60,
        ipWindowSeconds: 60,
        globalLimit: 300,
        globalWindowSeconds: 60,
      })

      // CSP reporting is best-effort telemetry.
      // Acknowledge and discard excess reports instead of returning 429.
      if (!limits.allowed) {
        return respondNoContent()
      }
    } catch (error) {
      // Fail closed for report processing if rate-limit infrastructure fails.
      // Do not expose internal errors to the reporting client.
      console.error('[CSP Report] Rate-limit infrastructure failed:', error)

      return respondNoContent()
    }
  }

  // 2. Read a strictly bounded request body.
  let body: string | null

  try {
    body = await readBoundedRequestText(req, MAX_REPORT_BYTES)
  } catch (error) {
    console.error('[CSP Report] Failed to read request body:', error)

    return respondNoContent()
  }

  // Oversized or unreadable reports are discarded.
  if (body === null) {
    return respondNoContent()
  }

  // 3. Parse and validate untrusted JSON.
  try {
    const parsed: unknown = JSON.parse(body)

    if (!isRecord(parsed)) {
      return respondNoContent()
    }

    // Supports both legacy csp-report and direct report objects.
    const report = isRecord(parsed['csp-report'])
      ? parsed['csp-report']
      : parsed

    const directive = getReportString(
      report,
      ['effective-directive', 'violated-directive'],
      120,
    )

    const blocked = getReportString(
      report,
      ['blocked-uri'],
      300,
    )

    const document = getReportString(
      report,
      ['document-uri'],
      300,
    )

    // Next.js/Turbopack development HMR uses eval. It is explicitly allowed
    // by the development-only report policy, so suppress that expected noise.
    // Never apply this exception in production or to any other blocked resource.
    const expectedDevelopmentEval = process.env.NODE_ENV === 'development'
      && directive.startsWith('script-src')
      && blocked === 'eval'
      && /^https?:\/\/localhost(?::\d+)?\//i.test(document)

    // Enable detailed logging explicitly when troubleshooting:
    // CSP_REPORT_LOG=true
    if (process.env.CSP_REPORT_LOG === 'true' && !expectedDevelopmentEval) {
      console.warn('[CSP Report] Violation:', {
        directive,
        blocked,
        document,
      })
    }
  } catch {
    // Invalid JSON is discarded.
    // No request contents are reflected to the client.
    if (process.env.CSP_REPORT_LOG === 'true') {
      console.warn('[CSP Report] Invalid JSON discarded.')
    }
  }

  // 4. Always acknowledge successfully processed reports.
  return respondNoContent()
}