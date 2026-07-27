-- 어드민 인재풀 카드 요약 양식 개편: AI 파싱 요약(한국어 호칭·학위·주요이력 3줄) 저장.
-- { "name_ko": "항", "degree": "Bachelor", "bullets": ["...", "...", "..."] }
-- ⚠️ 수동 적용: Supabase 대시보드 SQL 에디터에서 실행 (db push 금지 — 히스토리 미동기)
alter table user_profiles add column if not exists resume_summary jsonb;
