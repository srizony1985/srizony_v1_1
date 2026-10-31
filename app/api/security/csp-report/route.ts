import { NextResponse } from 'next/server'
import { enforcePublicRequestLimits } from '@/lib/publicRateLimit'
import { readBoundedRequestText } from '@/lib/securityPrimitives.mjs'

export const runtime = 'nodejs'

const MAX_REPORT_BYTES = 16_384

/** Receives bounded CSP report-only events; reports are not trusted input. */
export async function POST(req: Request) {
  const limits = await enforcePublicRequestLimits({ request: req, scope: 'csp-report', subject: 'all-reports', subjectLimit: 1000, subjectWindowSeconds: 3600, ipLimit: 60, ipWindowSeconds: 60, globalLimit: 300, globalWindowSeconds: 60 })
  if (!limits.allowed) return new NextResponse(null, { status: 429, headers: { 'Retry-After': String(limits.retryAfter), 'Cache-Control': 'no-store' } })
  const body = await readBoundedRequestText(req, MAX_REPORT_BYTES)
  if (body === null) return new NextResponse(null, { status: 413 })
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    const report = (parsed['csp-report'] || parsed) as Record<string, unknown>
    const directive = String(report['effective-directive'] || report['violated-directive'] || 'unknown').slice(0, 120)
    const blocked = String(report['blocked-uri'] || 'unknown').slice(0, 300)
    const document = String(report['document-uri'] || 'unknown').slice(0, 300)
    console.warn('CSP report-only violation', { directive, blocked, document })
  } catch {
    // Invalid reports are discarded rather than reflected or persisted.
  }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
