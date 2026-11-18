import { adminRequest, request } from './http'

export type AdminLoginResponse = {
  ok?: boolean
  user?: { email: string; role: 'admin' | 'editor' | 'analyst' }
  error?: string
}

export type AdminLogoutResponse = { ok?: boolean; error?: string }

/** Authenticate an administrator and establish the server-managed session. */
export const adminLogin = (email: string, password: string): Promise<AdminLoginResponse> =>
  adminRequest<AdminLoginResponse>('/api/admin/login', {
    method: 'POST',
    json: { email, password },
  }, 'Login failed')

/** Revoke the current server-managed admin session. */
export const adminLogout = () =>
  request<AdminLogoutResponse>('/api/admin/session', { method: 'DELETE' })
