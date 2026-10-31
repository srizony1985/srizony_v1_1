# Srizony Foundation — Engineering Refinement & Deployment Readiness Assessment

**Assessment date:** 31 October 2026  
**Source baseline:** `srizony_v1_1-main-2.zip`  
**Refined source:** `srizony-foundation-refined-source.zip`  
**Assessment type:** Source-level remediation and provisional deployment-readiness review  
**Decision:** **NO-GO for production until mandatory staging and operational gates pass.**

## 1. Executive assessment

The project has been materially refined. Security-sensitive data flows, admin session revocation, OAuth validation, public API abuse controls, donation state transitions, transactional CMS import, destructive database reset protection, backup configuration, CI configuration and regression coverage have all received source-level changes.

The **provisional engineering/deployment-readiness score is 78/100**, compared with the earlier provisional baseline of 62/100. This is a project-specific weighted estimate, not an ISO score, security certification, audit attestation or proof that the system works in production. The increase reflects source improvements and local tests; it does not replace unavailable full dependency installation, semantic typechecking, framework build, staging integration tests or production recovery evidence.

**Do not represent the project as above 90/100 yet.** Awarding more than 90 would require passing the complete CI pipeline and demonstrating the critical flows in a controlled staging environment. Changing the weighting or counting untested controls as passed would make the score misleading.

### Snapshot

| Measure | Result | Meaning |
|---|---:|---|
| Overall provisional score | **78/100** | Improved source maturity; not a production certification |
| Fully source-remediated findings | **16/20** | Code/config change is in the refined tree; live retest may still be pending |
| Partially source-remediated findings | **3/20** | Source mitigation exists but an important control/workflow remains |
| Open source finding | **1/20** | Resolved package-version alignment remains open |
| Node MJS tests | **111/111 pass** | `node --test tests/*.test.mjs` |
| TS/TSX syntax check | **234 files, 0 syntax diagnostics** | `transpileModule` only; not semantic typechecking |
| JSON/YAML configuration | **Pass** | JSON manifests/journal and workflow YAML parse |
| Full install/build/live tests | **Not verified** | npm registry package unavailable in audit environment |

## 2. Scope and project architecture

The supplied project is a bilingual foundation website and CMS based on Next.js 16 / React 19, Drizzle ORM and Neon PostgreSQL. It includes public content pages, CMS-managed page/navigation/content records, admin functionality, job applications, contact/email verification, donation checkout/callbacks, media storage and scheduled maintenance.

The source discovery counted 44 custom API route files, 62 route/page files, 30 test files and 18 pre-existing Drizzle migration files in the uploaded project. Refinement added migration `0018_security_reliability_hardening.sql` and regression tests. Counts are archive/source inventory, not proof every route or user journey was executed.

**Environment constraints:** the ZIP had no `.git` history, no production `.env` and no staging credentials. The refinement is therefore delivered as a source archive, not a Git branch or production deployment. No live Neon, Google OAuth, Resend, SSLCommerz, storage or production backup was available.

## 3. Refinements implemented

1. **JSON-LD/script output safety:** a shared serializer escapes script-breaking characters and a regression test uses a harmless `</script>` canary.
2. **Admin session revocation:** database-backed admin authorization checks current account status, role and `session_version`; user state/credential changes increment the version. Migration 0018 adds the version column. Existing database-admin cookies with the old version are intentionally invalidated after the migration, requiring re-login.
3. **Google OAuth:** requires `email_verified === true`, uses S256 PKCE, constrains `returnTo` to same-origin paths, checks pending-state age, adds request timeouts and clears temporary cookies on failure/success. Google documents `email_verified` as the verified-email claim and `sub` as the stable account identifier [6].
4. **Rate limiting and IP trust:** public email/OAuth/donation limits use atomic PostgreSQL counters; login attempts use hashed account and account/IP keys. Arbitrary `X-Forwarded-For` is no longer trusted. Per-IP budgets require `TRUSTED_CLIENT_IP_HEADER` to be set only behind a proxy that strips/overwrites that header and where the origin cannot be reached directly.
5. **Donation integrity:** initiation uses a required idempotency key and payload fingerprint, validates allowed methods/amounts, checks gateway URL and timeout, and constrains callback state transitions to server-validated pending payments. Callback amount/currency are checked. Anonymous donations continue to provide the gateway-required contact details while not storing donor name/message in anonymous mode.
6. **High-risk provider response:** SSLCommerz `risk_level=1` is stored as `review` with risk metadata, not automatically marked successful or receipted. SSLCommerz explicitly instructs merchants to hold such a `VALID` transaction and verify the customer [8]. A dedicated CMS approve/reject workflow with an assigned reviewer remains open.
7. **Donation receipts:** added a persistent retry queue with locking, attempts and backoff. The current schedule is daily; adjust the scheduler to the chosen receipt-delivery SLA and verify the host plan's cron limits.
8. **Atomic CMS import:** the multi-table import uses a Neon WebSocket-backed Drizzle transaction. Drizzle's guidance distinguishes HTTP for single non-interactive operations from the WebSocket driver for interactive transactions [7]. Live rollback testing is still required.
9. **Destructive operation guard:** `neon-reset.sql` now requires explicit session confirmation and the exact current database name.
10. **Request body caps:** added a streaming bounded reader, early declared-length rejection and strict UTF-8 handling to security-sensitive routes, including CSP report intake.
11. **CSP visibility:** added report-only CSP and a rate-limited 16 KB streaming-capped report endpoint. **CSP is not yet enforced**; report-only is monitoring, not a protective enforcement state.
12. **Build/dependency process:** added ESLint flat config, PR CI, CodeQL, Dependabot and `.nvmrc` for Node 22.22.0. Backup workflow consumes `PG_DUMP_MAJOR` and checks compatibility.
13. **Configuration/docs:** added a sanitized `.env.example` and corrected documentation to describe Neon as the active CMS data provider.

## 4. Resolution register

The full machine-readable register is included in `srizony-foundation-refinement-register.csv`. The summary below highlights the remaining state.

| ID | Finding | Source status | Remaining evidence/action | Priority |
|---|---|---|---|---|
| SF-001 | JSON-LD script-context injection | Fixed | Browser/staging retest | P0 |
| SF-002 | Stale admin privileges after user changes | Fixed | Apply migration; revoke-cookie E2E | P0 |
| SF-003 | OAuth email verification claim | Fixed | Google staging E2E | P1 |
| SF-004 | OAuth open redirect | Fixed | Full callback E2E | P1 |
| SF-005 | Spoofable forwarded IP | Partial | Trusted ingress configuration and spoof test | P1 |
| SF-006 | Email code abuse limits | Fixed | Live DB concurrency/provider spend test | P1 |
| SF-007 | Donation idempotency/abuse limits | Fixed | SSLCommerz sandbox race/retry test | P1 |
| SF-008 | Unverified donation state transitions | Fixed | Provider callback contract test | P1 |
| SF-009 | Non-atomic CMS import | Fixed | Neon failure-injection rollback test | P1 |
| SF-010 | Backup client version mismatch | Fixed | Backup and restore rehearsal | P1 |
| SF-011 | Missing CI/ESLint configuration | Fixed in source | Run the new CI workflow on GitHub | P0 |
| SF-012 | Environment/provider documentation drift | Fixed | Validate actual host secrets/config | P1 |
| SF-013 | Unguarded destructive reset | Fixed | Execute refusal/approval test on disposable DB | P0 |
| SF-014 | CSP not enforced | Partial | Collect reports, then enforce policy | P1 |
| SF-015 | Public rate-limit retention | Fixed | Verify cleanup on staging DB | P2 |
| SF-016 | Stale Node test assertions | Fixed for MJS suite | Run full configured TS + MJS functional command | P0 |
| SF-017 | Next/ESLint config resolved-version mismatch | Open | Align compatible versions and regenerate lockfile | P2 |
| SF-018 | Donation receipt retry | Fixed in source | Provider timeout/retry + schedule test | P1 |
| SF-019 | SSLCommerz high-risk review | Partial | Authenticated CMS review/approve/reject workflow | P1 |
| SF-020 | Oversized request body buffering | Fixed | Reverse-proxy and endpoint integration test | P1 |

“Fixed” in this table means the source-level mitigation exists. It does **not** mean the live deployment retest has passed.

## 5. Deployment gaps and priority plan

| Priority | Work package | Why it matters | Acceptance evidence |
|---|---|---|---|
| P0 | Complete locked dependency install and CI | Semantic type errors, lint errors, vulnerable dependencies and Next build issues are still unknown | GitHub Actions `npm ci`, `npm audit --audit-level=high`, lint, `tsc`, full tests, `next build` all green |
| P0 | Apply migration 0018 to staging | Session version, rate-limit counters and donation queue/idempotency fields must exist | Migration log; schema assertions; no drift; rollback plan |
| P0 | Admin revocation and OAuth E2E | Authentication/session behavior has not been exercised against the database/provider | Disable/demote/reset/delete invalidates session; Google negative/positive claim cases pass |
| P0 | Donation lifecycle and risk review | Financial state must not be inferred from browser redirects or unverified callback payloads | Sandbox initiation/IPN/success/fail/cancel/duplicate/mismatch/risk-level-1/retry tests; reviewer workflow |
| P0 | Database import atomicity | Partial CMS imports could corrupt content state | Injected failure mid-import leaves no partial changes; sequences remain valid |
| P0 | Backup and restore | A successful dump is not restoration evidence | Restore to isolated database; row/count checks; migration and rollback rehearsal |
| P1 | Trusted proxy configuration | IP limits depend on trustworthy ingress identity | Proxy overwrites trusted header; spoof test fails; origin locked down |
| P1 | Enforce CSP | Report-only CSP does not block script injection | Staging reports reviewed; restrictive CSP enforced; browser regression passes |
| P1 | Receipt queue schedule and operations | Daily cron may be too slow for the promised receipt SLA | Provider failure/recovery test; retry timing, alert and dead-letter owner documented |
| P1 | Align Next and eslint-config-next | Lock resolves Next 16.4.3 but eslint-config-next 16.3.8 | Compatible aligned versions; lock regenerated; CI passes |
| P1 | Review all admin APIs for object/function authorization | Source test suite is not a full BOLA/BFLA assessment | Route-by-route role/ownership matrix and negative tests |
| P2 | Performance and retention baselines | No workload or query performance tests were run | p95 API/page measurements, DB query review, public rate-limit growth and retention evidence |
| P2 | Operational monitoring and DORA baseline | Delivery/reliability behavior cannot be scored from a ZIP | Deployment frequency, change lead time, change failure rate, recovery time and rework tracked [11] |

## 6. Implementation maturity

| Area | Level | Evidence-based assessment |
|---|---:|---|
| Architecture / modular organization | 4/5 | Next.js + Drizzle/Neon structure and CMS modules are present; maintainability still needs semantic analysis |
| Public website and CMS | 4/5 | Broad content/editor/admin implementation; browser journey not exercised in this environment |
| Authentication and authorization | 3/5 | Session revocation and OAuth controls added; database/provider E2E pending |
| Public API security | 3/5 | Rate-limit, input-size and redirect controls improved; full route-by-route DAST/BOLA coverage absent |
| Database/data integrity | 3/5 | Migration, import transaction and reset safeguards added; no live migration/restore test |
| Donation/business workflow | 3/5 | Safer idempotency, validation, review state and receipt retry; CMS reviewer action and sandbox tests remain |
| CI/CD and deployment controls | 3/5 | CI/CodeQL/Dependabot configured; workflow not executed successfully yet |
| Testing assurance | 3/5 | 111 MJS tests pass and syntax transpilation passes; TS tests, tsc, ESLint and Next build not run |
| Performance/operations | 2/5 | Rate/retention support exists; no load test, p95 telemetry or restoration rehearsal |

Maturity levels are internal descriptive ratings, not official OWASP/ISO maturity levels.

## 7. Score and method

The score uses a transparent project-specific weighting inspired by ISO/IEC 25010 product-quality characteristics and secure development practices. ISO/IEC 25010:2023 defines a product quality model with nine characteristics [1]. OWASP ASVS is a testable security requirement standard [2], OWASP SAMM is a maturity-improvement model [3], and NIST SSDF structures secure development practices [4]. These frameworks inform the categories; the following weights are not prescribed by those standards.

| Category | Maximum | Awarded |
|---|---:|---:|
| Architecture and organization | 15 | 13 |
| Public website and CMS implementation | 15 | 14 |
| Security engineering | 15 | 12 |
| Database and data integrity | 15 | 11 |
| Business workflows | 15 | 12 |
| CI/CD and release configuration | 10 | 8 |
| Automated test assurance | 10 | 5 |
| Performance and operations | 5 | 3 |
| **Total** | **100** | **78** |

**Why not above 90?** The full CI workflow has not executed; semantic typecheck and production build are unknown; live Neon migration/transaction behavior is not proven; OAuth, SSLCommerz and Resend integration tests have not been run; CSP is report-only; payment review still lacks an admin decision flow; and database backup restoration has not been demonstrated. A 90+ score before these tests would award credit for unknowns.

Research has noted that quality-assessment models vary in their characteristics and methods [9]. A systematic mapping study also emphasizes combining security approaches throughout the software lifecycle rather than relying on a single coding-stage check [10]. Consequently, treat 78/100 as a provisional engineering estimate, not a benchmarked certification.

## 8. Verification ledger

| Check | Result | Limitation |
|---|---|---|
| `node --test tests/*.test.mjs` | **PASS — 111/111** | Node MJS source/regression tests only |
| TypeScript/TSX `transpileModule` | **PASS — 234 files, 0 syntax errors** | Syntax-only; does not type-check imports or types |
| JSON manifests / migration journal | **PASS** | `package.json`, `package-lock.json`, Drizzle journal parse |
| Workflow YAML | **PASS** | CI, CodeQL, Dependabot and backup workflow syntax parsed |
| Package manifest vs lock root | **PASS** | Root dependency entries match |
| Resolved Next vs ESLint config | **OPEN** | Lock resolves Next 16.4.3 and eslint-config-next 16.3.8 |
| `npm ci --offline` | **BLOCKED** | npm error `ENOTCACHED`: `zod-validation-error@4.0.2` tarball not cached |
| Online package install | **BLOCKED** | Earlier attempt timed out contacting registry |
| `npx tsc --noEmit` | **NOT RUN / BLOCKED** | Required dependencies/type packages unavailable |
| ESLint | **NOT RUN** | Dependencies unavailable |
| `npm audit` | **NOT RUN** | Registry and completed install required |
| Full `npm run test:functional` | **PARTIAL** | MJS half is 111/111; configured TS tests did not execute |
| `next build` | **NOT RUN** | Next dependency install unavailable |
| Neon migration/import rollback | **NOT RUN** | No staging database credentials |
| OAuth/payment/email/storage/browser E2E | **NOT RUN** | No provider credentials/staging environment |
| Backup restoration | **NOT RUN** | No production backup/database supplied |
| OWASP ZAP / authenticated DAST / load test | **NOT RUN** | No authorized staging target supplied |

## 9. Required release checklist

- [ ] Run complete GitHub CI on Node 22.22.0 and resolve every failure.
- [ ] Align Next and eslint-config-next and regenerate the lockfile.
- [ ] Apply migration 0018 to staging after a verified backup.
- [ ] Run admin session revocation tests for disable, role change, password reset and deletion.
- [ ] Run Google OAuth state, PKCE, expiry and verified-email tests.
- [ ] Run SSLCommerz sandbox tests including risk_level=1 and callback content-type.
- [ ] Add authenticated donation review/approval/rejection with audit trail and assigned owner.
- [ ] Verify donation idempotency, duplicate IPN and receipt retry/dead-letter behavior.
- [ ] Verify Neon JSON import rollback and identity sequence behavior.
- [ ] Test destructive reset guard only against disposable database.
- [ ] Restore a backup into an isolated database and verify completeness.
- [ ] Verify trusted ingress IP behavior and direct-origin restrictions.
- [ ] Review report-only CSP and enforce a safe policy after browser tests.
- [ ] Perform route-by-route BOLA/BFLA tests and OWASP ASVS verification.
- [ ] Run staging DAST, performance/load tests, monitoring/alert tests and final regression.
- [ ] Obtain technical owner sign-off before production cutover.

## 10. Real-world lessons

- **GitLab database incident (2017):** accidental removal of primary database data led to service downtime and unrecoverable changes. The lesson for Srizony is to prove backup restoration, not merely successful backup creation [12].
- **Cloudflare outage (2019):** a WAF rule with excessive regex backtracking exhausted CPU; the postmortem discussed missing performance safeguards and staged rollout. The lesson is to combine performance tests with controlled production rollout [13].
- **Knight Capital (2012):** faulty software deployment caused millions of erroneous orders and losses above USD 460 million; the SEC identified inadequate deployment/testing controls and ineffective responses to warnings. The lesson is mandatory CI, change control, monitoring and rollback [14].

These incidents are analogies supporting controls, not evidence that Srizony has the same failure modes.

## 11. References

[1] ISO. *ISO/IEC 25010:2023 — Systems and software engineering: Product quality model.* https://www.iso.org/standard/78176.html

[2] OWASP. *Application Security Verification Standard (ASVS), version 5.0.0* (30 May 2025). https://asvs.owasp.org/

[3] OWASP. *Software Assurance Maturity Model (SAMM), model overview.* https://owaspsamm.org/model/

[4] Souppaya, M., Scarfone, K., & Dodson, D. (2022). *NIST SP 800-218: Secure Software Development Framework (SSDF) Version 1.1.* https://csrc.nist.gov/pubs/sp/800/218/final

[5] OWASP. *API Security Top 10 — 2023.* https://owasp.org/www-project-api-security/

[6] Google for Developers. *OpenID Connect: ID token claims and validation.* https://developers.google.com/identity/openid-connect/openid-connect

[7] Drizzle ORM. *Drizzle <> Neon Postgres: HTTP and WebSocket driver guidance.* https://orm.drizzle.team/docs/connect-neon

[8] SSLCOMMERZ. *Developer Arena — session creation, IPN validation and risk-level handling.* https://developer.sslcommerz.com/

[9] Adewumi, A., Misra, S., Omoregbe, N., Crawford, B., & Soto, R. (2016). A systematic literature review of open source software quality assessment models. *SpringerPlus, 5*, 1936. https://doi.org/10.1186/s40064-016-3612-4

[10] Mohammed, N. M., Niazi, M., Alshayeb, M., & Mahmood, S. (2017). Exploring software security approaches in software development lifecycle: A systematic mapping study. *Computer Standards & Interfaces, 50*, 107–115. https://doi.org/10.1016/j.csi.2016.10.001

[11] DORA. *DORA's software delivery performance metrics.* https://dora.dev/guides/dora-metrics/

[12] GitLab. (10 February 2017). *Postmortem of database outage of January 31.* https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/

[13] Cloudflare. (11 July 2019). *Details of the Cloudflare outage on July 2, 2019.* https://blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/

[14] U.S. Securities and Exchange Commission. (16 October 2013). *SEC Charges Knight Capital With Violations of Market Access Rule.* https://www.sec.gov/newsroom/press-releases/2013-222

---

**Final decision: NO-GO pending the P0/P1 staging and operational gates above.** A score above 90 must be earned by new reproducible evidence, not by changing the scoring weights.
