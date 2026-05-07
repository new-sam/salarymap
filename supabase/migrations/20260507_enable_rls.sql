-- Enable RLS on all public tables
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_targets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- user_profiles: 본인 데이터만 접근
-- ============================================================
CREATE POLICY "users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- submissions: 본인 데이터 읽기 (클라이언트), 쓰기는 서버 API에서 service_role로 처리
-- ============================================================
CREATE POLICY "users can view own submissions"
  ON submissions FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.jwt() ->> 'email' = email
  );

-- ============================================================
-- jobs: 공개 읽기 허용 (채용 공고는 누구나 볼 수 있어야 함)
-- ============================================================
CREATE POLICY "anyone can view jobs"
  ON jobs FOR SELECT
  USING (true);

-- ============================================================
-- companies: 공개 읽기 허용
-- ============================================================
CREATE POLICY "anyone can view companies"
  ON companies FOR SELECT
  USING (true);

-- ============================================================
-- events: 인증된 사용자 INSERT 허용 (트래킹)
-- ============================================================
CREATE POLICY "authenticated users can insert events"
  ON events FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- job_applications, admin_users, experiments, crawl_targets:
-- 클라이언트 직접 접근 불필요 (서버 service_role로만 접근)
-- RLS 활성화만 하고 policy 없음 = anon/authenticated 모두 차단
-- ============================================================

-- Fix: auth_users_exposed 이슈
-- Supabase가 감지한 auth.users를 노출하는 뷰 제거
-- (뷰 이름은 대시보드에서 확인 필요 - 일반적으로 public.users)
DROP VIEW IF EXISTS public.users;
