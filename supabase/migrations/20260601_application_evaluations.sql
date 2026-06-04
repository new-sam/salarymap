-- 지원자별 단계별 평가 누적 테이블
-- 한 명의 reviewer가 한 단계에 한 번 평가 → 동일 키로 upsert
-- 2026-06-01

CREATE TABLE IF NOT EXISTS application_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  reviewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name text,
  reviewer_role text, -- 'owner' | 'interviewer' (캐시)
  comment text NOT NULL,
  score smallint, -- 0-100, nullable
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, stage, reviewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_app_evals_app_stage
  ON application_evaluations (application_id, stage);

ALTER TABLE application_evaluations ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 회사 멤버 누구나
CREATE POLICY "app_evals select by company"
  ON application_evaluations FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE company_id IN (
        SELECT company_id FROM recruiter_users WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: 본인이 작성자(reviewer_user_id = auth.uid())이고, 같은 회사
CREATE POLICY "app_evals insert by self"
  ON application_evaluations FOR INSERT
  WITH CHECK (
    reviewer_user_id = auth.uid()
    AND job_id IN (
      SELECT id FROM jobs WHERE company_id IN (
        SELECT company_id FROM recruiter_users WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE: 자기 평가만 수정 가능
CREATE POLICY "app_evals update own"
  ON application_evaluations FOR UPDATE
  USING (reviewer_user_id = auth.uid())
  WITH CHECK (reviewer_user_id = auth.uid());

-- DELETE: 자기 평가만 삭제 가능
CREATE POLICY "app_evals delete own"
  ON application_evaluations FOR DELETE
  USING (reviewer_user_id = auth.uid());

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION app_evals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_app_evals_set_updated_at ON application_evaluations;
CREATE TRIGGER trg_app_evals_set_updated_at
  BEFORE UPDATE ON application_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION app_evals_set_updated_at();
