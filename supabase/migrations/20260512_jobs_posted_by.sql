-- HR 유저가 직접 공고를 등록할 수 있도록 posted_by 컬럼 추가
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS company_logo_url text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS salary_min bigint,
  ADD COLUMN IF NOT EXISTS salary_max bigint,
  ADD COLUMN IF NOT EXISTS salary_currency text DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS job_type text DEFAULT 'full-time',
  ADD COLUMN IF NOT EXISTS experience_level text;

-- posted_by 인덱스
CREATE INDEX IF NOT EXISTS idx_jobs_posted_by ON jobs (posted_by) WHERE posted_by IS NOT NULL;
