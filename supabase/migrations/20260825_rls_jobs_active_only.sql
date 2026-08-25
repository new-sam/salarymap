-- jobs 행 잠금: 공개 읽기를 active 공고로 제한
-- 2026-08-25
--
-- 배경: 20260507 의 "anyone can view jobs" 가 USING (true) 라서 비활성 1,108건
-- (draft 포함, raw_payload·created_by 노출)이 anon 키로 개별 조회됐다.
-- 공개 피드(/api/jobs)·상세 SSR(jobs/[id])·sitemap·크롤러·모바일 앱(/api/jobs 경유)은
-- 전부 service role 이라 영향 없음. anon 키로 jobs 를 직접 읽는 곳은 리크루터 화면
-- (pages/company/*, lib/company-access.js)뿐이고 전부 로그인 상태(authenticated)다.
--
-- 주의: company_id 가 NULL 인 비활성 크롤 공고는 어드민(service role)에서만 보인다 — 의도.

DROP POLICY IF EXISTS "anyone can view jobs" ON jobs;

-- 공개: active 공고만 (is_active NULL 행은 없음 — 2026-08-25 실측 0건)
CREATE POLICY "jobs public read active"
  ON jobs FOR SELECT
  USING (is_active = true);

-- 리크루터: 자기 회사 공고는 draft/비활성 포함 전부.
-- 소유 판별식은 20260514 의 insert/update 정책과 동일하게 유지한다.
CREATE POLICY "jobs owner read all"
  ON jobs FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );
