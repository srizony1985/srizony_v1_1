import type { ExternalValue } from '../types/json'
export function serializeJsonForHtmlScript(value: ExternalValue): string
export function safeReturnTo(value: ExternalValue, fallback?: string): string

export function readBoundedRequestText(request: Request, maxBytes: number): Promise<string | null>
export function requiresManualPaymentReview(riskLevel: ExternalValue): boolean
