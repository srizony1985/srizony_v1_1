import { NextResponse } from 'next/server'
import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations } from '@/lib/db/schema'
import { ensureDonationsSchema } from '@/lib/db/ensureOperationalSchema'
import { enforcePublicRequestLimits } from '@/lib/publicRateLimit'
import { readBoundedRequestText } from '@/lib/securityPrimitives.mjs'

const cfg = () => ({
  storeId: process.env.SSLCOMMERZ_STORE_ID,
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
  baseUrl: (process.env.SSLCOMMERZ_BASE_URL || 'https://sandbox.sslcommerz.com').replace(/\/$/, ''),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
})

const bodySchema = z.object({
  amount: z.number().finite().min(10).max(500000),
  method: z.enum(['all', 'cards', 'bkash', 'nagad', 'rocket', 'mobile', 'internet']).default('all'),
  anonymous: z.boolean().default(true),
  name: z.string().trim().max(120).optional(),
  email: z.email().max(254),
  phone: z.string().trim().min(7).max(30),
  message: z.string().trim().max(1000).optional(),
}).strict()

const methodFilter: Record<string, string | undefined> = {
  all: undefined, cards: 'visacard,mastercard,amexcard,othercard', bkash: 'bkash',
  nagad: 'mobilebank', rocket: 'mobilebank', mobile: 'mobilebank', internet: 'internetbank',
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex')

function safeGatewayUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && (url.hostname === 'sslcommerz.com' || url.hostname.endsWith('.sslcommerz.com')) ? url.toString() : null
  } catch { return null }
}

export async function POST(req: Request) {
  try {
    const raw = await readBoundedRequestText(req, 8_192)
    if (raw === null) return NextResponse.json({ error: 'Request body is too large or invalid.' }, { status: 413 })
    let input: unknown = null
    try { input = JSON.parse(raw) } catch { /* schema validation returns a generic input error */ }
    const parsed = bodySchema.safeParse(input)
    if (!parsed.success) return NextResponse.json({ error: 'Please provide a valid amount and the contact details required by the payment gateway.' }, { status: 400 })
    const body = parsed.data
    if (!body.anonymous && !body.name) return NextResponse.json({ error: 'Please provide the donor name.' }, { status: 400 })

    const rawIdempotencyKey = req.headers.get('idempotency-key')?.trim() || ''
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(rawIdempotencyKey)) {
      return NextResponse.json({ error: 'A valid Idempotency-Key header is required.' }, { status: 400 })
    }

    const normalized = {
      amount: body.amount.toFixed(2), method: body.method, anonymous: body.anonymous,
      name: body.anonymous ? '' : (body.name || '').trim(), email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(), message: body.anonymous ? '' : (body.message || ''),
    }
    const idempotencyKey = digest(rawIdempotencyKey)
    const fingerprint = digest(JSON.stringify(normalized))
    const limits = await enforcePublicRequestLimits({
      request: req, scope: 'donation-initiate', subject: idempotencyKey,
      subjectLimit: 10, subjectWindowSeconds: 3600,
      ipLimit: 8, ipWindowSeconds: 600, globalLimit: 300, globalWindowSeconds: 3600,
    })
    if (!limits.allowed) return NextResponse.json({ error: 'Too many donation attempts. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(limits.retryAfter), 'Cache-Control': 'no-store' } })

    const { storeId, storePassword, baseUrl, siteUrl } = cfg()
    if (!storeId || !storePassword) return NextResponse.json({ error: 'The payment gateway is not configured.' }, { status: 503 })
    const site = new URL(siteUrl)
    if (process.env.NODE_ENV === 'production' && site.protocol !== 'https:') return NextResponse.json({ error: 'The public site URL must use HTTPS in production.' }, { status: 503 })
    if (!db) return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 })
    await ensureDonationsSchema()

    const tranId = `SF-DON-${Date.now()}-${randomBytes(3).toString('hex')}`.slice(0, 30)
    const inserted = await db.insert(donations).values({
      transactionId: tranId,
      amount: normalized.amount,
      status: 'pending',
      donor: { anonymous: body.anonymous, name: normalized.name, email: normalized.email, phone: normalized.phone, message: normalized.message, method: body.method },
      idempotencyKey,
      idempotencyFingerprint: fingerprint,
    }).onConflictDoNothing({ target: donations.idempotencyKey }).returning({
      id: donations.id, transactionId: donations.transactionId,
    })

    let donation = inserted[0]
    if (!donation) {
      const existingRows = await db.select({
        id: donations.id, transactionId: donations.transactionId, amount: donations.amount,
        status: donations.status, gatewayPageUrl: donations.gatewayPageUrl,
        idempotencyFingerprint: donations.idempotencyFingerprint,
      }).from(donations).where(eq(donations.idempotencyKey, idempotencyKey)).limit(1)
      const existing = existingRows[0]
      if (!existing || existing.idempotencyFingerprint?.trim() !== fingerprint) {
        return NextResponse.json({ error: 'This idempotency key was already used for a different donation.' }, { status: 409 })
      }
      if (existing.status === 'pending' && existing.gatewayPageUrl) {
        return NextResponse.json({ url: existing.gatewayPageUrl, tranId: existing.transactionId, reused: true }, { headers: { 'Cache-Control': 'no-store' } })
      }
      return NextResponse.json({ error: 'This donation attempt is already being processed. Please wait or start a new attempt.' }, { status: 409, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } })
    }

    const data = new URLSearchParams({
      store_id: storeId, store_passwd: storePassword, total_amount: normalized.amount, currency: 'BDT', tran_id: tranId,
      success_url: `${siteUrl}/api/donations/callback?status=success`,
      fail_url: `${siteUrl}/api/donations/callback?status=failed`,
      cancel_url: `${siteUrl}/api/donations/callback?status=cancelled`,
      ipn_url: `${siteUrl}/api/donations/callback?status=ipn`,
      product_name: 'Donation to Srizony Foundation', product_category: 'donation', product_profile: 'non-physical-goods', product_amount: normalized.amount,
      cus_name: body.anonymous ? 'Anonymous Donor' : normalized.name || 'Donor', cus_email: normalized.email, cus_phone: normalized.phone,
      cus_add1: 'Bangladesh', cus_city: 'Dhaka', cus_state: 'Dhaka', cus_postcode: '1000', cus_country: 'Bangladesh',
      shipping_method: 'NO', num_of_item: '1', value_a: body.method, value_c: body.anonymous ? 'anonymous' : 'identified',
    })
    if (normalized.message) data.set('value_b', normalized.message.slice(0, 300))
    const filter = methodFilter[body.method]
    if (filter) data.set('multi_card_name', filter)

    let gatewayResponse: Response
    try {
      gatewayResponse = await fetch(`${baseUrl}/gwprocess/v4/api.php`, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: data, cache: 'no-store', signal: AbortSignal.timeout(15000),
      })
    } catch {
      await db.update(donations).set({ status: 'failed' }).where(and(eq(donations.id, donation.id), eq(donations.status, 'pending')))
      return NextResponse.json({ error: 'The payment service could not be reached. Please try again.' }, { status: 502 })
    }

    const gateway = await gatewayResponse.json().catch(() => null) as { status?: string; failedreason?: string; GatewayPageURL?: string } | null
    const gatewayUrl = gateway?.GatewayPageURL ? safeGatewayUrl(gateway.GatewayPageURL) : null
    if (!gatewayResponse.ok || gateway?.status !== 'SUCCESS' || !gatewayUrl) {
      await db.update(donations).set({ status: 'failed' }).where(and(eq(donations.id, donation.id), eq(donations.status, 'pending')))
      return NextResponse.json({ error: 'The payment gateway did not return a valid checkout URL.' }, { status: 502 })
    }

    const saved = await db.update(donations).set({ gatewayPageUrl: gatewayUrl }).where(and(eq(donations.id, donation.id), eq(donations.status, 'pending'))).returning({ transactionId: donations.transactionId })
    if (!saved.length) return NextResponse.json({ error: 'The donation state changed unexpectedly. Please contact support before retrying.' }, { status: 409 })
    return NextResponse.json({ url: gatewayUrl, tranId }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Donation initiation error', error)
    return NextResponse.json({ error: 'Unable to start the payment.' }, { status: 500 })
  }
}
