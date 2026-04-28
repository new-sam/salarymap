-- Adds claim_token_hash to submissions for ownership verification on
-- /api/submit-rating, /api/intent, /api/link-submission.
-- See pages/api/submit.js for token issuance and lib/verifyClaim.js for verification.
--
-- Apply via Supabase SQL editor.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS claim_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_claim_token_hash
  ON submissions(claim_token_hash);
