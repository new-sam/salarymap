-- 2026-06-02 채용 담당자용 메일 템플릿 — 회사별 저장
-- 회사 멤버는 모두 SELECT 가능. INSERT/UPDATE/DELETE는 본인 생성분만.
-- 시스템 기본 템플릿(created_by NULL)은 마이그레이션 시 일회성 시드.

CREATE TABLE IF NOT EXISTS recruiter_mail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES recruiter_companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mail_templates_company ON recruiter_mail_templates(company_id);

ALTER TABLE recruiter_mail_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail_templates select by company"
  ON recruiter_mail_templates FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
  );

CREATE POLICY "mail_templates insert by self in company"
  ON recruiter_mail_templates FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM recruiter_users WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "mail_templates update own"
  ON recruiter_mail_templates FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "mail_templates delete own"
  ON recruiter_mail_templates FOR DELETE
  USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION mail_templates_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mail_templates_updated_at ON recruiter_mail_templates;
CREATE TRIGGER trg_mail_templates_updated_at
  BEFORE UPDATE ON recruiter_mail_templates
  FOR EACH ROW EXECUTE FUNCTION mail_templates_set_updated_at();

-- 기본 4개 템플릿 시드 (시스템 기본, created_by NULL → 누구도 삭제 못 함)
WITH defaults(name, subject, body) AS (
  VALUES
    ('지원 접수 안내',
     '[{회사명}] {공고명} 지원 접수 안내',
     E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션에 지원해 주셔서 감사합니다.\n제출해 주신 지원서를 잘 받았으며 검토 중입니다. 결과는 확인되는 대로 다시 안내드리겠습니다.\n\n감사합니다.'),
    ('인터뷰 안내',
     '[{회사명}] {공고명} {차수인터뷰} 제안',
     E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션 검토 결과, {후보이름}님과 {차수인터뷰}을(를) 진행하고 싶습니다.\n아래 가능한 일정 중 회신해 주시면 확정하겠습니다.\n\n{인터뷰일정}\n\n장소와 방식은 일정 확정 후 안내드리겠습니다.\n감사합니다.'),
    ('합격 안내',
     '[{회사명}] {공고명} 합격 안내',
     E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션에 {후보이름}님을 모시기로 결정했습니다. 축하드립니다.\n입사 절차와 처우 조건은 별도로 안내드리겠습니다.\n\n함께하게 되어 기쁩니다.\n감사합니다.'),
    ('불합격 안내',
     '[{회사명}] {공고명} 전형 결과 안내',
     E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션에 관심을 갖고 지원해 주셔서 감사합니다.\n아쉽게도 이번 전형에서는 함께하지 못하게 되었습니다.\n\n지원에 들인 시간과 노력에 깊이 감사드리며, 좋은 기회로 다시 뵙기를 바랍니다.\n\n감사합니다.')
)
INSERT INTO recruiter_mail_templates (company_id, created_by, name, subject, body)
SELECT c.id, NULL, d.name, d.subject, d.body
FROM recruiter_companies c
CROSS JOIN defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM recruiter_mail_templates t
  WHERE t.company_id = c.id AND t.name = d.name AND t.created_by IS NULL
);
