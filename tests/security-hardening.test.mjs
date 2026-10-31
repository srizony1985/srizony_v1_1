import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('CMS JSON-LD uses an HTML-script-safe serializer', () => {
  const layout = read('app/layout.tsx')
  const helper = read('lib/securityPrimitives.mjs')
  assert.match(layout, /serializeJsonForHtmlScript/)
  assert.match(helper, /replace\(\/</)
  assert.match(helper, /replace\(\/&/)
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/)
})

test('admin session authorization rechecks account status, role and revocation version', () => {
  const auth = read('lib/adminAuth.ts')
  const users = read('lib/cms/users.ts')
  const migration = read('drizzle/0018_security_reliability_hardening.sql')
  assert.match(auth, /SELECT role, status, session_version[\s\S]*FROM cms_users/)
  assert.match(auth, /current\.status !== 'active'/)
  assert.match(auth, /current\.role !== signed\.role/)
  assert.match(auth, /currentVersion !== signed\.sessionVersion/)
  assert.match(users, /session_version = COALESCE\(session_version, 1\)/)
  assert.match(migration, /ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1/)
  assert.match(migration, /gateway_risk_level SMALLINT/)
  assert.equal((migration.match(/statement-breakpoint/g) || []).length, 7)
})

test('Google OAuth requires an explicitly verified email claim', () => {
  const callback = read('app/api/auth/callback/google/route.ts')
  assert.match(callback, /email_verified\?:\s*boolean/)
  assert.match(callback, /profile\.email_verified\s*!==\s*true/)
})

test('OAuth return destinations are constrained to same-origin paths', () => {
  const start = read('app/api/auth/start/route.ts')
  const callback = read('app/api/auth/callback/google/route.ts')
  const helper = read('lib/securityPrimitives.mjs')
  assert.match(start, /safeReturnTo\(pendingInput\.returnTo/)
  assert.match(callback, /safeReturnTo\(pending\?\.returnTo/)
  assert.match(start, /code_challenge_method:\s*'S256'/)
  assert.match(callback, /code_verifier:\s*verifier/)
  assert.match(helper, /value\.startsWith\('\/'\) \|\| value\.startsWith\('\/\/'\)/)
})

test('public email and donation endpoints use shared database-backed rate limits', () => {
  const email = read('app/api/auth/email/route.ts')
  const donation = read('app/api/donations/initiate/route.ts')
  const limiter = read('lib/publicRateLimit.ts')
  const oauthStart = read('app/api/auth/start/route.ts')
  assert.match(email, /enforcePublicRequestLimits/)
  assert.match(oauthStart, /scope:\s*'google-oauth-start'/)
  assert.match(oauthStart, /readBoundedRequestText\(req, 16_384\)/)
  assert.match(email, /readBoundedRequestText\(req, 16_384\)/)
  assert.match(read('app/api/admin/login/route.ts'), /readBoundedRequestText\(req, 16_384\)/)
  assert.match(donation, /readBoundedRequestText\(req, 8_192\)/)
  assert.match(donation, /enforcePublicRequestLimits/)
  assert.match(limiter, /INSERT INTO public_api_rate_limits[\s\S]*ON CONFLICT/)
  assert.match(limiter, /createHash\('sha256'\)/)
})

test('donation initiation requires idempotency and preserves anonymity server-side', () => {
  const donation = read('app/api/donations/initiate/route.ts')
  const form = read('components/ui/DonationForm.tsx')
  const api = read('lib/api/public.ts')
  assert.match(donation, /idempotency-key/)
  assert.match(donation, /onConflictDoNothing\(\{ target: donations\.idempotencyKey \}\)/)
  assert.match(donation, /message: body\.anonymous \? ''/)
  assert.match(form, /initiateDonation\(payload, idempotencyRef\.current\.key\)/)
  assert.match(api, /headers: \{ 'Idempotency-Key': idempotencyKey \}/)
})

test('donation callbacks cannot promote a record without gateway validation', () => {
  const callback = read('app/api/donations/callback/route.ts')
  assert.match(callback, /status !== 'VALID' && data\.status !== 'VALIDATED'/)
  assert.match(callback, /requiresManualPaymentReview\(validation\.risk_level\)/)
  assert.match(callback, /return 'review'/)
  assert.match(callback, /set\(\{ status: 'review', gatewayRiskLevel: 1/)
  assert.match(read('components/ui/DonationForm.tsx'), /Payment under review/)
  assert.match(callback, /validation\.currency \|\| ''\)\.toUpperCase\(\) !== 'BDT'/)
  assert.match(callback, /eq\(donations\.status, 'pending'\)/)
  assert.match(callback, /enqueueDonationReceipt\(row\.id, donor\.email\)/)
})

test('multi-table CMS imports execute inside a Neon WebSocket transaction', () => {
  const route = read('app/api/admin/database/import/route.ts')
  assert.match(route, /new Pool\(\{ connectionString \}\)/)
  assert.match(route, /drizzleNeonWs\(\{ client: transactionPool \}\)/)
  assert.match(route, /transactionalDb\.transaction\(async \(tx\)/)
  assert.match(route, /await transactionPool\.end\(\)/)
})

test('destructive reset SQL requires explicit per-session and database-name confirmation', () => {
  const reset = read('neon-reset.sql')
  assert.match(reset, /srizony\.allow_destructive_reset/)
  assert.match(reset, /srizony\.expected_database/)
  assert.match(reset, /current_database\(\)/)
  assert.match(reset, /RAISE EXCEPTION 'Blocked:/)
})

test('CSP report ingestion is bounded and rate-limited', () => {
  const report = read('app/api/security/csp-report/route.ts')
  assert.match(report, /enforcePublicRequestLimits/ )
  assert.match(report, /MAX_REPORT_BYTES = 16_384/)
  assert.match(report, /readBoundedRequestText\(req, MAX_REPORT_BYTES\)/)
  assert.match(report, /status: 429/)
})

test('public email errors do not disclose internal exception messages', () => {
  const email = read('app/api/auth/email/route.ts')
  assert.match(email, /console\.error\('Public email verification flow failed', error\)/)
  assert.match(email, /The verification service is temporarily unavailable\. Please try again later\./)
  assert.doesNotMatch(email, /message: error instanceof Error \? error\.message/)
})

test('CI runs dependency audit, lint, types, functional tests and production build', () => {
  const ci = read('.github/workflows/ci.yml')
  for (const step of ['npm ci', 'npm audit --audit-level=high', 'npm run lint', 'npx tsc --noEmit', 'npm run test:functional', 'npm run build']) assert.ok(ci.includes(step), `Missing CI step: ${step}`)
  assert.ok(read('.github/workflows/codeql.yml').includes('javascript-typescript'))
  assert.ok(read('.github/dependabot.yml').includes('package-ecosystem: npm'))
})
