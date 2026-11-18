import { NextResponse } from 'next/server'
import { getAdminSession, hasAdminRole, type AdminRole } from '@/lib/adminAuth'

type Session = NonNullable<Awaited<ReturnType<typeof getAdminSession>>>

/** Resolves the admin session or a ready-to-return error response. */
export async function requireAdmin(...roles: AdminRole[]): Promise<{ admin: Session; denied?: undefined } | { admin?: undefined; denied: NextResponse }> {
  const admin = await getAdminSession()
  if (!admin) return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (roles.length && !hasAdminRole(admin, ...roles)) return { denied: NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 }) }
  return { admin }
}

export function failure(error: unknown, fallback = 'Request failed.') {
  // Values thrown by JavaScript APIs and drivers are not guaranteed to be Error
  // instances. Read optional HTTP metadata only after narrowing the value.
  const detail = error !== null && typeof error === 'object'
    ? error as { status?: unknown; field?: unknown }
    : null
  const candidateStatus = detail?.status
  const status = typeof candidateStatus === 'number'
    && Number.isInteger(candidateStatus)
    && candidateStatus >= 400
    && candidateStatus <= 599
    ? candidateStatus
    : 500
  const message = error instanceof Error && (status < 500 || status === 503)
    ? error.message
    : fallback
  if (status >= 500) console.error(fallback, error)
  return NextResponse.json({ error: message, ...(typeof detail?.field === 'string' ? { field: detail.field } : {}) }, { status })
}
