export function serializeJsonForHtmlScript(value: unknown): string
export function safeReturnTo(value: unknown, fallback?: string): string

export function readBoundedRequestText(request: Request, maxBytes: number): Promise<string | null>
export function requiresManualPaymentReview(riskLevel: unknown): boolean
