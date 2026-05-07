-- 크롤링 타겟 기업 관리 테이블
CREATE TABLE IF NOT EXISTS crawl_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  slug text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('greenhouse', 'lever')),
  career_url text,
  is_active boolean DEFAULT true,
  last_crawled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crawl_targets_slug_source
  ON crawl_targets (slug, source_type);
