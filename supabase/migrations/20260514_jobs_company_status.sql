-- Phase 2: jobs에 회사 연결 + 공고 상태 컬럼 추가
-- 2026-05-14

-- ── company_id (소유 회사) ──
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES recruiter_companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);

-- ── status (draft / pending_review / live / paused / closed) ──
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT;
UPDATE jobs SET status = 'live' WHERE status IS NULL;
ALTER TABLE jobs ALTER COLUMN status SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN status SET DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- ── 회사 owner RLS ──
CREATE POLICY "jobs insert by company owner"
  ON jobs FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );

CREATE POLICY "jobs update by company owner"
  ON jobs FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );
