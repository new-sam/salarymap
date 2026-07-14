-- /cv 이력서 등록 STEP1에서 고른 "찾는 직무"(복수)를 저장.
-- 등록 완료 모달의 공고 매칭 + 인재 공급/매칭 분석에 사용.
-- 수동 적용: Supabase 대시보드 SQL 에디터에서 실행(db push 금지 — 히스토리 미동기).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS desired_roles text[];
