-- 회사 owner가 자기 공고의 지원자 SELECT/UPDATE 가능
-- 2026-05-14

CREATE POLICY "job_applications select by company owner"
  ON job_applications FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE company_id IN (
        SELECT company_id FROM recruiter_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "job_applications update by company owner"
  ON job_applications FOR UPDATE
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE company_id IN (
        SELECT company_id FROM recruiter_users WHERE user_id = auth.uid()
      )
    )
  );
