/** Shared, dependency-light validation helpers used by the public jobs API and tests. */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024
export const RESUME_TOKEN_TTL_MINUTES = 30

export function hasPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

export function isApplicationDeadlineOpen(deadline: string | null | undefined, now = new Date()) {
  if (!deadline) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false
  const [year, month, day] = deadline.split('-').map(Number)
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return false
  const end = new Date(`${deadline}T23:59:59.999+06:00`)
  return Number.isFinite(end.getTime()) && end.getTime() >= now.getTime()
}

export function safeResumeFileName(name: string) {
  const basename = (name.split(/[\\/]/).pop() || 'resume.pdf').normalize('NFKC')
  // Strip the last extension before sanitizing so spaces in "My CV final.pdf"
  // do not corrupt the required PDF suffix, and force every output to .pdf.
  const stem = basename.replace(/\.[^.]*$/, '')
  const safeStem = stem
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim()
    .replace(/[ .]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 76)
  return `${safeStem || 'resume'}.pdf`
}
