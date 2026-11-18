-- Store additional applicant form responses without adding a new column per CMS field.
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS job_applications_custom_fields_gin_idx
  ON job_applications USING GIN (custom_fields);
