-- jobs 행 잠금: 공개 읽기를 active 공고로 제한 (재실행 안전)
-- 2026-08-25
--
-- 배경: "anyone can view jobs"(USING true) 외에도 레포에 없는 대시보드 수제 정책
-- (public read jobs / public_read_jobs / admin_manage_jobs)이 남아 있어 비활성 1,108건
-- (draft 포함, raw_payload·created_by 노출)이 anon 키로 개별 조회됐다. permissive 정책은
-- OR 로 합쳐지므로 전부 걷어내야 잠긴다.
-- admin_manage_jobs(ALL, public)는 참조하는 코드가 0건 — 어드민은 전부 /api/admin/* ㅠ
-- (service role, RLS 우회) 경유라 드랍해도 안전하고, 남기면 anon 쓰기 구멍이 될 수 있다.
--
-- 공개 피드(/api/jobs)·상세 SSR(jobs/[id])·sitemap·크롤러·모바일 앱(/api/jobs 경유)은
-- 전부 service role 이라 영향 없음. anon 키로 jobs 를 직접 읽는 곳은 리크루터 화면
-- (pages/company/*, lib/company-access.js)뿐이고 전부 로그인 상태(authenticated)다.
--
-- 주의: company_id 가 NULL 인 비활성 크롤 공고는 어드민(service role)에서만 보인다 — 의도.

-- 정책이 있어도 이게 꺼져 있으면 전부 무효(wave3 때 실제로 겪은 패턴) — 명시적으로 켠다
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 레거시·수제 읽기/관리 정책 정리
DROP POLICY IF EXISTS "anyone can view jobs" ON jobs;
DROP POLICY IF EXISTS "public read jobs" ON jobs;
DROP POLICY IF EXISTS "public_read_jobs" ON jobs;
DROP POLICY IF EXISTS "admin_manage_jobs" ON jobs;

-- 공개: active 공고만 (is_active NULL 행은 없음 — 2026-08-25 실측 0건)
DROP POLICY IF EXISTS "jobs public read active" ON jobs;
CREATE POLICY "jobs public read active"
  ON jobs FOR SELECT
  USING (is_active = true);

-- 리크루터: 자기 회사 공고는 draft/비활성 포함 전부.
-- 소유 판별식은 20260514 의 insert/update 정책과 동일하게 유지한다.
DROP POLICY IF EXISTS "jobs owner read all" ON jobs;
CREATE POLICY "jobs owner read all"
  ON jobs FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );
