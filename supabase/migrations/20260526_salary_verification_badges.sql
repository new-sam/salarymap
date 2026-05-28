-- Salary Verification Requests
CREATE TABLE salary_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('payslip', 'contract', 'tax_return', 'other')),
  salary_amount BIGINT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User Badges
CREATE TABLE user_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN ('high_salary', 'verified_company', 'top_contributor')),
  is_active BOOLEAN DEFAULT false,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_type)
);

-- Indexes
CREATE INDEX idx_salary_verifications_user ON salary_verifications(user_id);
CREATE INDEX idx_salary_verifications_status ON salary_verifications(status);
CREATE INDEX idx_user_badges_user ON user_badges(user_id);

-- RLS
ALTER TABLE salary_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Salary verifications: users can read/insert their own
CREATE POLICY "sv_select" ON salary_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sv_insert" ON salary_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Badges: anyone can read (for display), users can update their own (toggle active)
CREATE POLICY "badges_select" ON user_badges FOR SELECT USING (true);
CREATE POLICY "badges_update" ON user_badges FOR UPDATE USING (auth.uid() = user_id);

-- Storage bucket for verification documents
-- Run in Supabase dashboard: INSERT INTO storage.buckets (id, name, public) VALUES ('salary-docs', 'salary-docs', false);
