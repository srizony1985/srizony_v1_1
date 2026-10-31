/** Shared, dependency-light validation helpers used by the public jobs API and tests. */
export const MAX_RESUME_BYTES = 4 * 1024 * 1024
export const RESUME_TOKEN_TTL_MINUTES = 30

export type JobApplicationFields = {
  name: string
  email: string
  phone?: string
  coverLetter?: string
  website?: string
}

export function hasPdfSignature(bytes: Uint8Array) {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

export function validateJobApplicationFields(input: JobApplicationFields) {
  const errors: Partial<Record<keyof JobApplicationFields, string>> = {}
  const name = input.name.trim()
  const email = input.email.trim()
  if (name.length < 2 || name.length > 160) errors.name = 'Enter your full name (2–160 characters).'
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email address.'
  if ((input.phone || '').trim().length > 40) errors.phone = 'Phone number must be 40 characters or fewer.'
  if ((input.coverLetter || '').trim().length > 5000) errors.coverLetter = 'Cover letter must be 5,000 characters or fewer.'
  if ((input.website || '').trim()) errors.website = 'Automated submission detected.'
  return errors
}

export function isApplicationDeadlineOpen(deadline: string | null | undefined, now = new Date()) {
  if (!deadline) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false
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
