import type { ExternalValue, JsonObject, JsonValue } from '@/types/json'
/**
 * Shared HTTP helpers. Components never call fetch() directly: every request
 * lives in a module under /lib/api and components import those functions.
 */
export type ApiResult<T = JsonValue> = { ok: boolean; status: number; data: T }

export async function request<T = JsonValue>(url: string, init: Omit<RequestInit, 'body'> & { json?: ExternalValue; body?: BodyInit | null } = {}): Promise<ApiResult<T>> {
  const { json, headers, ...rest } = init
  const response = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'content-type': 'application/json', ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const data = (await response.json().catch(() => ({}))) as T
  return { ok: response.ok, status: response.status, data }
}

export function messageOf(data: JsonObject, fallback: string): string {
  const error = data.error
  if (typeof error === 'string' && error.trim()) return error
  if (error !== null && typeof error === 'object' && !Array.isArray(error)) {
    const message = error.message
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

/** Admin request: redirects to login on 401, throws Error(message) on failure, returns parsed data. */
export async function adminRequest<T = JsonValue>(url: string, init: Parameters<typeof request>[1] = {}, fallback = 'Request failed.'): Promise<T> {
  const result = await request<T>(url, { cache: 'no-store', ...init })
  if (result.status === 401 && typeof window !== 'undefined') { window.location.assign('/admin/login'); throw new Error('Session expired.') }
  if (!result.ok) {
    const errorData = result.data !== null && typeof result.data === 'object' && !Array.isArray(result.data)
      ? result.data as JsonObject
      : {}
    const field = typeof errorData.field === 'string' ? errorData.field : undefined
    throw Object.assign(new Error(messageOf(errorData, fallback)), { field, status: result.status })
  }
  return result.data
}
