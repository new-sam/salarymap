-- Profile redesign: nationality, awards/languages sections, and per-section visibility flags.
-- Used by the mobile app's Wanted-style profile (edit screen = identity + visibility,
-- profile page = inline section editing).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS awards JSONB DEFAULT '[]';      -- [{title, year, desc}]
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[]';   -- [{name, level}]

-- Per-section visibility (public profile / HR view). Default visible.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS career_public BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS education_public BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS skills_public BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS awards_public BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS languages_public BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS projects_public BOOLEAN DEFAULT true;
