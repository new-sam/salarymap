-- 2026-06-02 ATS: 불합격 처리
-- status는 그대로 유지(단계/평가 이력 보존). 불합격은 별도 컬럼으로 마킹.

ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS rejected_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at_stage  TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason   TEXT,
  ADD COLUMN IF NOT EXISTS rejection_note     TEXT;

CREATE INDEX IF NOT EXISTS idx_job_applications_rejected_at ON job_applications(rejected_at);

-- 공고 오너만 불합격 컬럼을 수정 가능하게 강제.
-- 면접관(같은 회사이지만 created_by가 아닌 사용자)은 차단.
CREATE OR REPLACE FUNCTION job_applications_owner_only_rejection()
RETURNS TRIGGER AS $$
DECLARE
  owner_id uuid;
BEGIN
  IF NEW.rejected_at      IS DISTINCT FROM OLD.rejected_at
  OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
  OR NEW.rejection_note   IS DISTINCT FROM OLD.rejection_note
  OR NEW.rejected_at_stage IS DISTINCT FROM OLD.rejected_at_stage THEN
    SELECT created_by INTO owner_id FROM jobs WHERE id = NEW.job_id;
    IF owner_id IS NOT NULL AND owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'Only the job owner can change rejection state';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_applications_owner_only_rejection ON job_applications;
CREATE TRIGGER trg_job_applications_owner_only_rejection
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION job_applications_owner_only_rejection();
