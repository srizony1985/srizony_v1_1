import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donations } from '@/lib/db/schema'
import { ensureDonationsSchema } from '@/lib/db/ensureOperationalSchema'
import { enqueueDonationReceipt, processDonationReceiptJobs } from '@/lib/donations/receiptQueue'
import { readBoundedRequestText, requiresManualPaymentReview } from '@/lib/securityPrimitives.mjs'

const cfg = () => ({
  storeId: process.env.SSLCOMMERZ_STORE_ID,
  storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD,
  baseUrl: (process.env.SSLCOMMERZ_BASE_URL || 'https://sandbox.sslcommerz.com').replace(/\/$/, ''),
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
})

type Validation = { status?: string; tran_id?: string; amount?: string | number; currency?: string; risk_level?: string; risk_title?: string }

export async function POST(req: Request) {
  const url = new URL(req.url)
  const query = Object.fromEntries(url.searchParams.entries())
  const contentType = req.headers.get('content-type') || ''
  if (!contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    return new NextResponse('Unsupported callback content type', { status: 415 })
  }
  const body = await readBoundedRequestText(req, 16_384)
  if (body === null) return new NextResponse('Callback body too large or invalid', { status: 413 })
  return handle({ ...query, ...Object.fromEntries(new URLSearchParams(body).entries()) }, req)
}

export async function GET(req: Request) {
  return handle(Object.fromEntries(new URL(req.url).searchParams.entries()), req)
}

async function handle(payload: Record<string, FormDataEntryValue | string>, _req: Request) {
  const { storeId, storePassword, baseUrl, siteUrl } = cfg()
  const status = String(payload.status || '').toLowerCase()
  const tranId = String(payload.tran_id || '')
  if (!tranId || tranId.length > 64 || !db) return NextResponse.redirect(`${siteUrl}/donate?donation=failed`, 303)

  await ensureDonationsSchema()

  if (status === 'ipn') {
    if (!payload.val_id || !storeId || !storePassword) return new NextResponse('Missing validation data', { status: 400 })
    const validation = await validate(String(payload.val_id), baseUrl, storeId, storePassword)
    const outcome = await applyValidatedState(validation, tranId)
    if (outcome === 'review') {
      console.warn('SSLCOMMERZ donation held for manual risk review', { tranId, riskTitle: validation?.risk_title || 'High-risk transaction' })
      return new NextResponse('REVIEW', { status: 200 })
    }
    return new NextResponse(outcome === 'success' ? 'OK' : 'Validation rejected', { status: outcome === 'success' ? 200 : 400 })
  }

  let final: 'cancelled' | 'failed' | 'success' | 'review' = status === 'cancelled' ? 'cancelled' : 'failed'
  if ((status === 'success' || status === 'valid' || status === 'validated') && payload.val_id && storeId && storePassword) {
    const validation = await validate(String(payload.val_id), baseUrl, storeId, storePassword)
    const outcome = await applyValidatedState(validation, tranId)
    final = outcome === 'success' ? 'success' : outcome === 'review' ? 'review' : 'failed'
    if (outcome === 'review') console.warn('SSLCOMMERZ donation held for manual risk review', { tranId, riskTitle: validation?.risk_title || 'High-risk transaction' })
  }

  // Unverified fail/cancel browser redirects must never mutate the financial
  // record. Only a gateway-validated state is allowed to become terminal.
  return NextResponse.redirect(`${siteUrl}/donate?donation=${final}&tran_id=${encodeURIComponent(tranId)}`, 303)
}

async function validate(valId: string, baseUrl: string, storeId: string, storePassword: string): Promise<Validation | null> {
  try {
    const url = new URL(`${baseUrl}/validator/api/validationserverAPI.php`)
    url.searchParams.set('val_id', valId)
    url.searchParams.set('store_id', storeId)
    url.searchParams.set('store_passwd', storePassword)
    url.searchParams.set('format', 'json')
    const res = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const data = await res.json() as Validation
    if (data.status !== 'VALID' && data.status !== 'VALIDATED') return null
    return data
  } catch { return null }
}

type ValidatedOutcome = 'success' | 'review' | 'rejected'

async function applyValidatedState(validation: Validation | null, tranId: string): Promise<ValidatedOutcome> {
  if (!validation || validation.tran_id !== tranId || !db) return 'rejected'
  const existing = await db.select({ id: donations.id, amount: donations.amount, status: donations.status, donor: donations.donor }).from(donations).where(eq(donations.transactionId, tranId)).limit(1)
  const row = existing[0]
  if (!row) return 'rejected'
  if (row.status === 'success') {
    // Recover a receipt job if the first callback committed the donation but
    // failed before enqueueing the notification. The unique donation_id makes
    // this safe on every repeated gateway callback.
    if (row.donor && typeof row.donor === 'object') {
      const donor = row.donor as { email?: string }
      if (donor.email) {
        await enqueueDonationReceipt(row.id, donor.email)
        await processDonationReceiptJobs(1)
      }
    }
    return 'success'
  }
  if (row.status === 'review') return 'review'
  if (row.status !== 'pending') return 'rejected'

  const gatewayAmount = Number(validation.amount)
  const storedAmount = Number(row.amount)
  if (!Number.isFinite(gatewayAmount) || !Number.isFinite(storedAmount) || Math.abs(gatewayAmount - storedAmount) > 0.009 || String(validation.currency || '').toUpperCase() !== 'BDT') return 'rejected'

  if (requiresManualPaymentReview(validation.risk_level)) {
    await db.update(donations)
      .set({ status: 'review', gatewayRiskLevel: 1, gatewayRiskTitle: (validation.risk_title || 'High-risk transaction').slice(0, 50) })
      .where(and(eq(donations.transactionId, tranId), eq(donations.status, 'pending')))
    return 'review'
  }

  const updated = await db.update(donations)
    .set({ status: 'success', gatewayRiskLevel: Number(validation.risk_level) === 0 ? 0 : null, gatewayRiskTitle: validation.risk_title?.slice(0, 50) || null })
    .where(and(eq(donations.transactionId, tranId), eq(donations.status, 'pending')))
    .returning({ id: donations.id, donor: donations.donor })
  const saved = updated[0]
  if (!saved) {
    const recheck = await db.select({ status: donations.status }).from(donations).where(eq(donations.transactionId, tranId)).limit(1)
    return recheck[0]?.status === 'success' ? 'success' : 'rejected'
  }

  if (saved.donor && typeof saved.donor === 'object') {
    const donor = saved.donor as { email?: string }
    if (donor.email) {
      await enqueueDonationReceipt(saved.id, donor.email)
      // Best-effort immediate delivery; the authenticated maintenance job retries
      // any failed sends with bounded exponential backoff.
      await processDonationReceiptJobs(1)
    }
  }
  return 'success'
}
