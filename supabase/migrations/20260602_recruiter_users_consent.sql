-- 기업 회원가입 약관 동의 기록
-- 2026-06-02
-- 성공보수(계약연봉 7%) 계약 동의의 증빙을 위해 동의 시각·약관 버전을 보존한다.

ALTER TABLE recruiter_users
  ADD COLUMN IF NOT EXISTS terms_agreed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version     TEXT,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marketing_opt_in  BOOLEAN NOT NULL DEFAULT false;
