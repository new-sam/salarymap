-- Extend job_applications source tracking with utm_content + original referrer.
-- (utm_source/medium/campaign were added in 20260601_add_utm_tracking.sql.)
-- Lets FYI measure channel performance per JD, including non-UTM traffic via referrer.
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT;

COMMENT ON COLUMN job_applications.utm_content IS 'UTM content parameter (e.g. ad variant, link position)';
COMMENT ON COLUMN job_applications.referrer IS 'Original landing referrer URL — channel attribution when no UTM is present';
