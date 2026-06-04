-- 공고 오너(jobs.created_by)만 job_applications.status 변경 가능하게 강제.
-- 면접관(같은 회사이지만 created_by가 아닌 사용자)은 admin_note 등 다른 컬럼은
-- 그대로 수정 가능. 단계(status) 이동만 차단.
-- 2026-06-01

CREATE OR REPLACE FUNCTION job_applications_owner_only_status()
RETURNS TRIGGER AS $$
DECLARE
  owner_id uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT created_by INTO owner_id FROM jobs WHERE id = NEW.job_id;
    -- legacy 공고(created_by NULL)는 그대로 허용
    IF owner_id IS NOT NULL AND owner_id <> auth.uid() THEN
      RAISE EXCEPTION 'Only the job owner can change application status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_job_applications_owner_only_status ON job_applications;
CREATE TRIGGER trg_job_applications_owner_only_status
  BEFORE UPDATE ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION job_applications_owner_only_status();
