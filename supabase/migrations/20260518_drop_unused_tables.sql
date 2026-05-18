-- 2026-05-18 미사용 테이블/뷰 정리
-- 코드 전체 .from() 참조 및 마이그레이션 교차검증 결과 어디에서도 사용되지 않음.
-- candidates(3,706행)는 데이터가 있어 이번 정리 대상에서 제외.

-- KTC — 버려진 기능 (마이그레이션에 없음, 대시보드에서 직접 생성, 코드 참조 0)
DROP TABLE IF EXISTS ktc_interview_slots CASCADE;
DROP TABLE IF EXISTS ktc_mentoring_sessions CASCADE;
DROP TABLE IF EXISTS ktc_profiles CASCADE;
DROP TABLE IF EXISTS ktc_registrations CASCADE;
DROP TABLE IF EXISTS ktc_simple_submissions CASCADE;
DROP TABLE IF EXISTS ktc_submissions CASCADE;
DROP TABLE IF EXISTS ktc_team_members CASCADE;
DROP TABLE IF EXISTS ktc_teams CASCADE;
DROP TABLE IF EXISTS ktc_users CASCADE;

-- 구 HR 회사기능 — recruiter_users / recruiter_companies 로 대체됨
DROP TABLE IF EXISTS hr_interests CASCADE;
DROP TABLE IF EXISTS hr_users CASCADE;

-- 미사용 뷰
DROP VIEW IF EXISTS recruiter_jobs CASCADE;
