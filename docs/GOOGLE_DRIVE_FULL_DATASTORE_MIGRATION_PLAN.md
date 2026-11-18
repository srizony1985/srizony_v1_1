# Full Google Drive datastore migration — Srizony v1.2

## Status

**Not implemented in this release.** The current release provides Google Drive as a validated, read-only runtime failover and backup/recovery provider. Neon PostgreSQL remains the transactional primary. This document defines the work required to make Google Drive the writable source of truth for both the public site and CMS.

Do not set a configuration flag that treats the current per-table JSON mirror as a writable database. The mirror writer is a backup operation; the runtime reader validates immutable snapshots and does not implement transactions, row-level locking, foreign-key enforcement, unique constraints, or cross-instance conflict handling.

## Why the existing JSON snapshots are insufficient

The source audit found approximately 37 TypeScript/TSX service and API files coupled to the SQL layer. Their operations include joins, filters, ordering, transactions, foreign-key relationships, unique constraints, counters, sessions, audit logging, and payment/application workflows.

A Google Drive `files.update` replaces a file's content. It is not a relational transaction. Two Vercel/serverless instances can read the same JSON revision, independently modify it, and overwrite each other's updates. A process-local mutex cannot coordinate separate instances. Updating several table files also cannot provide one atomic commit across those files.

The most sensitive affected operations include:

- CMS create, edit, delete, publishing and navigation changes.
- CMS user provisioning, role changes, session creation and revocation.
- Public contact, enquiry, job application and resume workflows.
- Donation creation, payment callbacks and idempotency records.
- Media metadata, image/document uploads and object cleanup.
- Audit history, visitor counters, form submissions and reporting aggregates.

## Required target architecture

### 1. Storage contract

Replace route-level Drizzle queries with domain repositories. Each repository should expose typed operations such as `getPage`, `savePage`, `publishPage`, `createJobApplication`, `recordDonation`, `updateNavigation`, and `changeCmsRole`. API handlers must not know whether a record is stored in PostgreSQL or Drive.

### 2. Central transaction coordinator

All Drive writes must pass through one authenticated coordinator service. The coordinator must provide a distributed lock or single-writer queue shared by all app instances; an in-process lock is not sufficient.

A write request must include:

- A unique idempotency key.
- The authenticated actor and authorization scope.
- The expected current revision for optimistic conflict detection.
- A typed domain command, never an arbitrary table/column patch.
- A validation result and audit metadata.

The coordinator must serialize commands and reject stale revisions instead of silently overwriting newer data.

### 3. Write-ahead journal and replay

Use an append-only transaction journal. Each committed event must contain the complete atomic change set for that domain transaction, a monotonic sequence/revision, idempotency key, actor, timestamp, and integrity hash. A commit must be durable before the operation is acknowledged.

On startup or recovery, replay committed journal events after the last compacted snapshot. Snapshot compaction must be versioned, checksum-verified, and restartable. Journal retention and compaction must not delete the only recoverable copy of a committed event.

The coordinator must explicitly handle a crash between journal creation, manifest update, and snapshot compaction. It must never acknowledge an operation that cannot be replayed.

### 4. Consistency and data rules

Implement application-level equivalents for:

- Primary keys and unique indexes.
- Foreign-key validation and cascade/restrict rules.
- Atomic multi-record transactions.
- Monotonic counters and sequence allocation.
- Idempotent payment callbacks and submission handling.
- Revision checks and concurrent edit conflicts.
- Referential validation for navigation/page/content relationships.
- Audit events for all privileged changes.

Do not emulate arbitrary SQL by string parsing. Translate existing SQL workflows into typed repository operations and test each operation against the current PostgreSQL behavior before switching its storage provider.

### 5. Media and private files

Use Drive for media only after defining separate private and public storage policies. Public images may be delivered through authenticated application routes with safe content-type handling and immutable cache keys. Resumes, application documents, and other personal data must remain private; never expose a Drive sharing URL or public permission for these objects. Enforce upload size/type limits, malware scanning where available, signed/short-lived download access, retention and deletion policies.

### 6. Authentication and authorization

CMS authentication must remain secure without trusting stale user-role snapshots. The new coordinator must support active-session checks, immediate revocation, password hashing, role/scope validation, brute-force protection, and auditable admin changes. A fallback admin credential should be a controlled break-glass path, not a substitute for a functioning identity store.

### 7. Quota, latency and availability

Google Drive API has request quotas and file-size/throughput constraints. A writable design must include bounded retries with exponential backoff and jitter, request coalescing, per-user write limits, bounded journal sizes, compaction, cache invalidation and monitoring. Quota exhaustion must produce explicit retryable errors; it must not accept writes into process memory and pretend they were persisted.

For a high-write public site, Drive-only writes may have materially higher latency and lower throughput than a transactional database. Load testing is a release requirement, not an optional optimization.

## Migration sequence

1. Inventory every SQL query and write path; group them into domain repositories and document existing transaction boundaries.
2. Define versioned Drive document schemas and repository contracts, including migration/version support.
3. Implement and deploy the coordinator, distributed serialization, idempotency, journal, replay, compaction, authorization and audit trail.
4. Convert one low-risk domain (for example, CMS footer/settings) and run dual-read comparison against Neon. Keep all writes on Neon until parity and recovery tests pass.
5. Convert CMS pages, content, navigation, theme, jobs and media metadata domain by domain.
6. Convert users, roles, sessions, form submissions, job applications, donations and payment callbacks only after the coordinator passes concurrency, idempotency, security and failure-injection testing.
7. Perform a full historical import from Neon to Drive, preserving IDs, timestamps, relationships and numeric precision. Generate and verify row counts and checksums.
8. Run shadow reads and compare output hashes/semantics. Then enable Drive writes for a controlled staging cohort.
9. Perform fault-injection tests: simultaneous edits, coordinator restart, Drive quota errors, partial failures, duplicate payment callbacks, stale revisions, expired sessions, corrupt snapshots, missing media, and recovery/replay.
10. Switch production traffic only after all acceptance criteria below pass. Preserve a tested rollback and export path.

## Go-live acceptance criteria

- All public page and CMS read/write routes use repositories, with no route bypassing the coordinator for Drive writes.
- No acknowledged mutation is lost during coordinator restart or Drive/API interruption tests.
- Concurrent updates cannot silently overwrite each other.
- Repeated idempotency keys return the original result and do not duplicate payments, forms or applications.
- Referential integrity and authorization tests pass for every domain.
- CMS role/session revocation is immediate and survives restart.
- Private files cannot be fetched anonymously or by another applicant.
- Snapshot restore and journal replay reproduce an identical logical database checksum.
- API quota exhaustion is visible and recoverable without false success responses.
- Representative peak-load testing meets agreed latency and request-volume targets.

## Recommended production decision

For this application, the safer high-availability design is a transactional PostgreSQL primary plus a second transactional database or managed failover database, with Google Drive retained for versioned backups and read-only public/CMS failover. If Google Drive must be the only persistence layer, complete the coordinator and repository migration above before enabling writes. The current read-only failover release must not be represented as a fully writable Drive CMS.
