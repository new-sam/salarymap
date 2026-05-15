-- Fix: RLS race condition — creator도 자기가 만든 회사를 즉시 SELECT 가능하게
-- 2026-05-14

DROP POLICY IF EXISTS "companies select own" ON recruiter_companies;

CREATE POLICY "companies select own"
  ON recruiter_companies FOR SELECT
  USING (
    created_by = auth.uid()
    OR id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );

-- Backfill orphan recruiter_users
UPDATE recruiter_users ru
SET company_id = rc.id
FROM recruiter_companies rc
WHERE ru.company_id IS NULL
  AND ru.email LIKE '%@' || rc.email_domain;
