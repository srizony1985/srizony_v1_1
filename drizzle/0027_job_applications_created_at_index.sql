-- Support bounded application-history scans used by the admin dashboard.
CREATE INDEX IF NOT EXISTS job_applications_created_idx
  ON job_applications (created_at DESC);
