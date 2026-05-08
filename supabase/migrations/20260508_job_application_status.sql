-- Add status column to job_applications
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'applied';

-- Status values: applied, viewed, reviewing, decided
COMMENT ON COLUMN job_applications.status IS 'applied=지원완료, viewed=담당자열람, reviewing=검토중, decided=결과확인';
