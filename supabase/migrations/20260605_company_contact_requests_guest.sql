-- 기업 상담 폼: 비로그인(게스트) 리드 허용 + 채용 포지션 수집
-- 2026-06-05
-- user_id를 nullable로 (게스트는 로그인 없이 상담 요청), position 컬럼 추가.

ALTER TABLE company_contact_requests ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE company_contact_requests ADD COLUMN IF NOT EXISTS position TEXT;
