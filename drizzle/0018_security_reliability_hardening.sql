-- Security and reliability hardening: revocable admin sessions, distributed
-- public API budgets, idempotent donation initiation and receipt retry queue.
ALTER TABLE cms_users
  ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE donations
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64),
  ADD COLUMN IF NOT EXISTS idempotency_fingerprint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS gateway_page_url TEXT,
  ADD COLUMN IF NOT EXISTS gateway_risk_level SMALLINT,
  ADD COLUMN IF NOT EXISTS gateway_risk_title VARCHAR(50);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS donations_idempotency_key_uq
  ON donations (idempotency_key);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public_api_rate_limits (
  scope VARCHAR(60) NOT NULL,
  subject_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, subject_hash)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS public_api_rate_limits_updated_idx
  ON public_api_rate_limits (updated_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS donation_receipt_jobs (
  id BIGSERIAL PRIMARY KEY,
  donation_id INTEGER NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
  recipient_email VARCHAR(254) NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS donation_receipt_jobs_due_idx
  ON donation_receipt_jobs (next_attempt_at)
  WHERE sent_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_public_rate_limits_window_idx
  ON job_public_rate_limits (window_started_at);
