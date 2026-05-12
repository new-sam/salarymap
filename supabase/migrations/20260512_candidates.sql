-- Candidates table for HR talent pool (FIFA-style)
CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY, -- e.g. '0001', '0002'
  email TEXT,
  phone TEXT,
  name_vi TEXT,
  name_en TEXT,
  gender TEXT,
  birthdate TEXT,
  age INTEGER,
  university TEXT,
  graduation_status TEXT, -- 'graduated', 'upcoming', 'not_yet'
  graduation_date TEXT,
  major TEXT,
  degree_url TEXT,
  location TEXT,
  yoe_raw TEXT, -- raw text like '1 nam 6 thang'
  yoe_months INTEGER, -- parsed months
  position TEXT, -- 'Backend', 'Frontend', 'Fullstack', 'Mobile', 'AI', 'DevOps', etc.
  tech_stack TEXT[], -- array of techs
  projects TEXT, -- free text
  english_level TEXT,
  english_cert TEXT,
  korean_level TEXT,
  korean_cert TEXT,
  cv_url TEXT,
  want_korea TEXT,
  work_preference TEXT,
  motivation TEXT,
  data_source TEXT,
  test_score INTEGER,
  interview_avg NUMERIC(4,2),
  interview_q1 INTEGER,
  interview_q2 INTEGER,
  interview_q3 INTEGER,
  interview_q4 INTEGER,
  interview_q5 INTEGER,
  interview_q6 INTEGER,
  interview_note TEXT,
  final_score NUMERIC(5,2),
  status TEXT, -- overall pipeline status
  -- computed stats (0-99)
  stat_overall INTEGER,
  stat_experience INTEGER,
  stat_tech INTEGER,
  stat_english INTEGER,
  stat_education INTEGER,
  stat_soft INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- HR interest / contact requests
CREATE TABLE IF NOT EXISTS hr_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hr_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, contacted, matched, rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(hr_user_id, candidate_id)
);

ALTER TABLE hr_interests ENABLE ROW LEVEL SECURITY;

-- HR can view their own interests
CREATE POLICY "hr can view own interests"
  ON hr_interests FOR SELECT
  USING (auth.uid() = hr_user_id);

CREATE POLICY "hr can insert own interests"
  ON hr_interests FOR INSERT
  WITH CHECK (auth.uid() = hr_user_id);

-- Approved HR users can view candidates
CREATE POLICY "approved hr can view candidates"
  ON candidates FOR SELECT
  USING (true); -- controlled at API level since admin also needs access
