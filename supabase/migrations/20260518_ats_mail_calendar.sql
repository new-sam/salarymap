-- 2026-05-18 ATS: 면접 일정 구조화 + 메일 발송 이력

-- 면접 일정 (캘린더 뷰용 구조화 컬럼)
ALTER TABLE job_applications
  ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS interview_location TEXT,
  ADD COLUMN IF NOT EXISTS interview_interviewer TEXT;

CREATE INDEX IF NOT EXISTS idx_job_applications_interview_at ON job_applications(interview_at);

-- 메일 발송 이력
CREATE TABLE IF NOT EXISTS recruiter_mail_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  template_key TEXT,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiter_mail_log_application ON recruiter_mail_log(application_id);

ALTER TABLE recruiter_mail_log ENABLE ROW LEVEL SECURITY;

-- 회사 owner가 자기 회사 공고의 메일 발송 이력을 조회 (INSERT는 서버가 service role로 처리)
CREATE POLICY "mail_log select by company owner"
  ON recruiter_mail_log FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM job_applications WHERE job_id IN (
        SELECT id FROM jobs WHERE company_id IN (
          SELECT company_id FROM recruiter_users WHERE user_id = auth.uid()
        )
      )
    )
  );
