-- 2026-05-18
-- 1) jobs DELETE 정책 누락 → 회사 owner의 공고 삭제가 0행 처리되며 조용히 실패하던 문제
-- 2) recruiter_companies SELECT가 멤버/생성자에게만 허용 → 같은 이메일 도메인의
--    다음 직원이 기존 회사를 못 찾고 회사를 중복 생성하던 문제

CREATE POLICY "jobs delete by company owner"
  ON jobs FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "companies select own" ON recruiter_companies;

CREATE POLICY "companies select own"
  ON recruiter_companies FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
    OR email_domain = split_part(lower(auth.jwt() ->> 'email'), '@', 2)
  );
