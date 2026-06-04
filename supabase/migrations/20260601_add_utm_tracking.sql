-- Add UTM tracking columns to job_applications
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

COMMENT ON COLUMN job_applications.utm_source IS 'UTM source parameter (e.g. facebook, linkedin, newsletter)';
COMMENT ON COLUMN job_applications.utm_medium IS 'UTM medium parameter (e.g. cpc, social, email)';
COMMENT ON COLUMN job_applications.utm_campaign IS 'UTM campaign parameter (e.g. summer2026, dev-hiring)';
