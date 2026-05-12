-- Add role column to user_profiles
-- Existing users default to 'seeker' (job seeker)
-- HR users will have role = 'hr'
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'seeker';

-- Index for filtering by role (admin queries)
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- HR company mapping table
-- Links HR users to their company for admin management
CREATE TABLE IF NOT EXISTS hr_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT, -- admin email
  UNIQUE(user_id)
);

ALTER TABLE hr_users ENABLE ROW LEVEL SECURITY;

-- HR users can view their own record
CREATE POLICY "hr users can view own record"
  ON hr_users FOR SELECT
  USING (auth.uid() = user_id);
