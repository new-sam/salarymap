-- 추천 공고 상단 배치를 위한 is_featured 컬럼 추가
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- featured 공고 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_jobs_featured
  ON jobs (is_featured)
  WHERE is_featured = true;
