-- Private, one-time resume uploads and hashed public-form rate limits.
CREATE TABLE IF NOT EXISTS job_resume_uploads (
  token_hash CHAR(64) PRIMARY KEY,
  media_id BIGINT NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_resume_uploads_expiry_idx ON job_resume_uploads(expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS job_public_rate_limits (
  rate_key VARCHAR(100) PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0
);
