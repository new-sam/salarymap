-- Track whether a job application came directly from the jobs page ('direct')
-- or after a salary submission ('salary'). Set client-side via a ?from=salary
-- marker on the post-submission CTAs, persisted for the visit in sessionStorage.
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS application_source TEXT DEFAULT 'direct';

COMMENT ON COLUMN job_applications.application_source IS 'Funnel source of the application: ''direct'' (applied straight from jobs page) or ''salary'' (applied after submitting salary data)';
