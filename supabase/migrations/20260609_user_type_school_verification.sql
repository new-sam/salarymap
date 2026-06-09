-- Community user classification: every user is either a student or a worker.
-- 'worker' proves status via a corporate email (existing company-verification flow);
-- 'student' proves status via a school email (.edu / ac.kr / ...), which grants a
-- verified_school_name + 'verified_school' badge — the student-side mirror of
-- verified_company_name. The same company_email_verifications table + endpoints
-- drive both flows; the domain decides which side a verification lands on.

-- Declared classification (set in onboarding / profile edit). null = not yet chosen.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_type TEXT;  -- 'student' | 'worker'

-- Cache verified school on the profile (mirror of the verified_company_* columns)
-- so community queries avoid an extra join.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS verified_school_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS verified_school_domain TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS school_verified_at TIMESTAMPTZ;

-- Domain -> school mapping. Curated by admin; auto-created on first verify if missing.
-- Mirror of company_domains so school names can be refined after a best-effort guess.
CREATE TABLE IF NOT EXISTS school_domains (
  domain TEXT PRIMARY KEY,           -- 'snu.ac.kr', 'mit.edu'
  school_name TEXT NOT NULL,         -- 'Seoul National University'
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow the new student-side badge. The verify endpoint upserts 'verified_school'
-- the same way it does 'verified_company', so the CHECK must include it.
ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_badge_type_check;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_badge_type_check
  CHECK (badge_type IN ('salary_range', 'high_salary', 'verified_company', 'verified_school', 'top_contributor'));

-- Backfill: anyone who already verified a company email is a worker. The rest stay
-- null until they pick in onboarding (the community label treats null as a student).
UPDATE user_profiles SET user_type = 'worker'
  WHERE user_type IS NULL AND verified_company_name IS NOT NULL;
