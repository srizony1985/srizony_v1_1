import test from 'node:test'
import assert from 'node:assert/strict'
import { readBoundedRequestText, requiresManualPaymentReview, safeReturnTo, serializeJsonForHtmlScript } from '../lib/securityPrimitives.mjs'

test('JSON-LD serializer prevents script termination and preserves valid JSON', () => {
  const payload = { name: '</script><script>window.pwned=true</script>', amp: '&', separators: '\u2028\u2029' }
  const serialized = serializeJsonForHtmlScript(payload)
  assert.equal(serialized.includes('<'), false)
  assert.equal(serialized.includes('>'), false)
  assert.equal(serialized.includes('&'), false)
  assert.deepEqual(JSON.parse(serialized), payload)
})

test('JSON-LD serializer handles undefined values safely', () => {
  assert.equal(serializeJsonForHtmlScript(undefined), 'null')
})

test('safeReturnTo accepts only same-origin application paths', () => {
  assert.equal(safeReturnTo('/contact?sent=1#form'), '/contact?sent=1#form')
  assert.equal(safeReturnTo('/bn/about-us'), '/bn/about-us')
  assert.equal(safeReturnTo('//attacker.example/path'), '/contact')
  assert.equal(safeReturnTo('https://attacker.example/path'), '/contact')
  assert.equal(safeReturnTo('/\\\\attacker.example'), '/contact')
  assert.equal(safeReturnTo('/%2f%2fattacker.example'), '/contact')
  assert.equal(safeReturnTo('/%5c%5cattacker.example'), '/contact')
  assert.equal(safeReturnTo('/contact%0d%0aLocation:https://attacker.example'), '/contact')
})


test('bounded request reader rejects oversized declared and streamed bodies', async () => {
  const declared = new Request('https://example.test/report', { method: 'POST', headers: { 'content-length': '12' }, body: '012345678901' })
  assert.equal(await readBoundedRequestText(declared, 8), null)

  const streamed = new Request('https://example.test/report', {
    method: 'POST',
    duplex: 'half',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('12345'))
        controller.enqueue(new TextEncoder().encode('67890'))
        controller.close()
      },
    }),
  })
  assert.equal(await readBoundedRequestText(streamed, 8), null)
})

test('bounded request reader accepts valid UTF-8 within the byte budget', async () => {
  const request = new Request('https://example.test/report', { method: 'POST', body: JSON.stringify({ report: 'ok' }) })
  assert.equal(await readBoundedRequestText(request, 128), '{"report":"ok"}')
})

test('SSLCOMMERZ risk level 1 is routed to manual review, not automatic success', () => {
  assert.equal(requiresManualPaymentReview('1'), true)
  assert.equal(requiresManualPaymentReview(1), true)
  assert.equal(requiresManualPaymentReview('0'), false)
  assert.equal(requiresManualPaymentReview(undefined), false)
})
