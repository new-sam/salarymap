-- recruiter_users 에 UPDATE 정책 추가 (본인 row 만 수정 가능)
-- 2026-05-14

CREATE POLICY "recruiter_users update own"
  ON recruiter_users FOR UPDATE
  USING (auth.uid() = user_id);
