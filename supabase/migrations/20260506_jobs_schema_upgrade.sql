-- Jobs 페이지 정보 구조 개선: 새 필드 추가
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS tech_stack text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS benefits text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS hiring_process text,
  ADD COLUMN IF NOT EXISTS deadline date,
  ADD COLUMN IF NOT EXISTS headcount integer,
  ADD COLUMN IF NOT EXISTS apply_url text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_id text;

-- 중복 방지를 위한 유니크 인덱스 (외부 소스 연동 시)
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_source_id
  ON jobs (source, source_id)
  WHERE source_id IS NOT NULL;

-- 기술스택 검색을 위한 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_jobs_tech_stack
  ON jobs USING GIN (tech_stack);

-- 마감일 필터링을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_jobs_deadline
  ON jobs (deadline)
  WHERE deadline IS NOT NULL;
