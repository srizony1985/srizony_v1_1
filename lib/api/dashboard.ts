import type { JsonObject, JsonValue } from '@/types/json'
import { adminRequest } from './http'

export const getDashboard = <T = JsonValue>(days: number) => adminRequest<T>(`/api/admin/dashboard?days=${days}`, {}, 'Unable to load dashboard data.')
export const getRecentSubmissions = async () => (await adminRequest<{ items?: JsonObject[] }>('/api/admin/submissions', {}, 'Unable to load contact requests.')).items ?? []
export const getRecentDonations = async () => (await adminRequest<{ items?: JsonObject[] }>('/api/admin/donations', {}, 'Unable to load donations.')).items ?? []
export const setSubmissionStatus = (id: number, status: string) => adminRequest('/api/admin/submissions', { method: 'PATCH', json: { id, status } }, 'Unable to update request.')
