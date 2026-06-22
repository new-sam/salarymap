-- resume_platform (app | web) 위에 한 단계 더 세분화된 유입 출처 컬럼.
-- 웹 하나만 봐도 광고 랜딩(/cv) · 프로필 직접등록(/profile) · 채용공고 지원
-- 후 동의(/jobs) 등 경로가 다양해 운영 의사결정(광고 효율, 깔때기 누수)에
-- 도움이 안 됨. 클라이언트가 X-Resume-Source 헤더로 명시한 값을 그대로 기록.
--
-- 값: 'cv'         — /cv 광고 랜딩에서 업로드
--     'profile'    — /profile 프로필 페이지에서 직접 업로드
--     'jobs'       — /jobs 지원 후 AI 프로필 동의로 등록
--     'app'        — salary-fyi 모바일 앱
--     NULL         — 마이그레이션 이전 기존 행 / 헤더 누락

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS resume_source text;

COMMENT ON COLUMN user_profiles.resume_source IS
  '이력서 유입 출처: cv | profile | jobs | app | NULL(미상)';

CREATE INDEX IF NOT EXISTS idx_user_profiles_resume_source
  ON user_profiles (resume_source)
  WHERE resume_source IS NOT NULL;
