-- Extend user_profiles for HR talent pool
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS yoe_months INTEGER;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS intro TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS skills TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS english_cert TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS korean_cert TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS birthdate TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS university TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS major TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS graduation_year TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary_min BIGINT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS salary_max BIGINT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_type TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS job_signal TEXT DEFAULT 'passive'; -- active | open | passive
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS hr_visible BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS resume_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS experiences JSONB DEFAULT '[]';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS projects JSONB DEFAULT '[]';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS certs TEXT[];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
