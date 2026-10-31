import type { AdminRole } from './adminAuth'

export type AdminUserConfig = { email: string; password: string; role?: AdminRole }
const allowedRoles = new Set<AdminRole>(['admin', 'editor', 'analyst'])
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254

export function configuredAdminUsers(): AdminUserConfig[] {
  const raw = process.env.CMS_ADMIN_USERS_JSON?.trim()
  if (raw) {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('CMS_ADMIN_USERS_JSON must be an array.')
    const users = parsed.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`CMS_ADMIN_USERS_JSON item ${index + 1} is invalid.`)
      const candidate = item as Record<string, unknown>
      const email = typeof candidate.email === 'string' ? candidate.email.trim().toLowerCase() : ''
      const password = typeof candidate.password === 'string' ? candidate.password : ''
      const role = candidate.role === undefined ? 'admin' : candidate.role
      if (!validEmail(email) || password.length < 12 || typeof role !== 'string' || !allowedRoles.has(role as AdminRole)) {
        throw new Error(`CMS_ADMIN_USERS_JSON item ${index + 1} must have a valid email, a password of at least 12 characters and an allowed role.`)
      }
      return { email, password, role: role as AdminRole }
    })
    if (new Set(users.map((user) => user.email)).size !== users.length) throw new Error('CMS_ADMIN_USERS_JSON cannot contain duplicate email addresses.')
    return users
  }
  const email = process.env.CMS_ADMIN_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim()
  const password = process.env.CMS_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
  if (!email && !password) return []
  if (!email || !validEmail(email) || !password || password.length < 12) throw new Error('CMS_ADMIN_EMAIL and a password of at least 12 characters must be configured together.')
  return [{ email: email.toLowerCase(), password, role: 'admin' }]
}
