-- Company email verification (work-email ownership → verified_company badge)

-- Tracks code send/verify attempts. Server-only (service_role); no client access.
CREATE TABLE company_email_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  code_hash TEXT NOT NULL,          -- sha256(code + pepper); plaintext code never stored
  expires_at TIMESTAMPTZ NOT NULL,  -- now() + 10 min
  attempts INT DEFAULT 0,           -- invalidated once attempts >= 5
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cev_user ON company_email_verifications(user_id);

-- One work email can verify only one account.
CREATE UNIQUE INDEX uniq_cev_verified_email
  ON company_email_verifications(lower(email)) WHERE verified_at IS NOT NULL;

-- Domain -> company mapping. Curated by admin; auto-created on first verify if missing.
CREATE TABLE company_domains (
  domain TEXT PRIMARY KEY,          -- 'vng.com.vn'
  company_name TEXT NOT NULL,       -- 'VNG Corporation'
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cache verified company on the profile so community queries avoid an extra join.
ALTER TABLE user_profiles ADD COLUMN verified_company_name TEXT;
ALTER TABLE user_profiles ADD COLUMN verified_company_domain TEXT;
ALTER TABLE user_profiles ADD COLUMN company_verified_at TIMESTAMPTZ;

-- Server-only table: enable RLS with no policies so the anon/auth client can't read codes.
ALTER TABLE company_email_verifications ENABLE ROW LEVEL SECURITY;
