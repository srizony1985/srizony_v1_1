import { adminRequest } from './http'

export type Role = 'admin' | 'editor' | 'analyst'
export type CmsUser = { id: number | null; email: string; role: Role; status: 'active' | 'disabled'; source: 'environment' | 'database'; lastLoginAt?: string | null; createdAt?: string | null }
export type Theme = Record<string, unknown>
export type DatabaseInfo = { tables: { name: string; label: string; count: number | null }[]; apis: { method: string; path: string; access: string; description: string }[]; connected: boolean }

export const getUsers = async () => (await adminRequest<{ users: CmsUser[] }>('/api/admin/users', {}, 'Unable to load users.')).users
export const createUser = (input: { email: string; password: string; role: Role }) => adminRequest('/api/admin/users', { method: 'POST', json: input }, 'Unable to create the user.')
export const updateUser = (id: number, patch: { role?: Role; status?: 'active' | 'disabled'; password?: string }) => adminRequest('/api/admin/users', { method: 'PATCH', json: { id, ...patch } }, 'Unable to update the user.')
export const deleteUser = (id: number) => adminRequest(`/api/admin/users?id=${id}`, { method: 'DELETE' }, 'Unable to delete the user.')

export const getThemes = async () => ((await adminRequest<{ themes: Record<string, Theme> }>('/api/admin/theme', {}, 'Unable to load themes.')).themes || {})
export const saveTheme = async (name: string, palette: Theme) => ((await adminRequest<{ themes: Record<string, Theme> }>('/api/admin/theme', { method: 'PUT', json: { name, palette } }, 'Unable to save theme.')).themes || {})

export const getDatabaseInfo = () => adminRequest<DatabaseInfo>('/api/admin/database', {}, 'Unable to read database status.')
