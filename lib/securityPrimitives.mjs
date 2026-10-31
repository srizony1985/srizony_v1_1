/** Shared primitives that are safe to use at server-render and request boundaries. */
export function serializeJsonForHtmlScript(value) {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) return 'null'
  return serialized
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

/** Accept only same-origin, application-relative destinations. */
export function safeReturnTo(value, fallback = '/contact') {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  if (/%(?:2f|5c|00|0a|0d)/i.test(value)) return fallback

  try {
    const target = new URL(value, 'https://srizony.invalid')
    if (target.origin !== 'https://srizony.invalid' || target.username || target.password) return fallback
    if (target.pathname.startsWith('//') || target.pathname.includes('\\')) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}

/** Read request text while enforcing a byte limit before buffering the full body. */
export async function readBoundedRequestText(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('Invalid request body limit.')
  const declaredLength = Number(request.headers.get('content-length') || 0)
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null
  if (!request.body) return ''

  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel('Request body exceeds configured size limit.')
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return null }
}

/** SSLCOMMERZ risk_level=1 transactions must be held for merchant review. */
export function requiresManualPaymentReview(riskLevel) {
  return String(riskLevel ?? '') === '1'
}
