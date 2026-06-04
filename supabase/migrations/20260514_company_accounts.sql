-- FYI for Companies — 기존 companies 테이블 충돌 회피를 위해 recruiter_* 네이밍
-- 2026-05-14 (revised)

-- ── recruiter_companies (채용 주체 회사) ──
CREATE TABLE IF NOT EXISTS recruiter_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email_domain TEXT,
  tax_id TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recruiter_companies_email_domain ON recruiter_companies(email_domain);

-- ── recruiter_users (회사를 관리하는 사용자) ──
CREATE TABLE IF NOT EXISTS recruiter_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES recruiter_companies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_users_company_id ON recruiter_users(company_id);
CREATE INDEX IF NOT EXISTS idx_recruiter_users_email ON recruiter_users(email);

-- ── RLS ──
ALTER TABLE recruiter_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiter_users select own"
  ON recruiter_users FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "recruiter_users insert own"
  ON recruiter_users FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "recruiter_companies select own"
  ON recruiter_companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );

CREATE POLICY "recruiter_companies insert own"
  ON recruiter_companies FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "recruiter_companies update own"
  ON recruiter_companies FOR UPDATE
  USING (created_by = auth.uid());
