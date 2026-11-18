ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS job_email_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_key VARCHAR(240) NOT NULL UNIQUE,
  application_id BIGINT REFERENCES job_applications(id) ON DELETE SET NULL,
  recipient_email VARCHAR(254) NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS job_email_outbox_delivery_idx
  ON job_email_outbox(status, next_attempt_at, created_at);

CREATE TABLE IF NOT EXISTS job_vacancy_interviews (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL UNIQUE REFERENCES cms_content_items(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  minutes_per_applicant INTEGER NOT NULL CHECK (minutes_per_applicant > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  revision INTEGER NOT NULL DEFAULT 1,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_application_interviews (
  id BIGSERIAL PRIMARY KEY,
  interview_id BIGINT NOT NULL REFERENCES job_vacancy_interviews(id) ON DELETE CASCADE,
  application_id BIGINT NOT NULL UNIQUE REFERENCES job_applications(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_application_interviews_schedule_idx
  ON job_application_interviews(interview_id, starts_at);
