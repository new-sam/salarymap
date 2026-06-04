-- 2026-06-04 새 회사 가입 시 기본 메일 템플릿 자동 시드
-- recruiter_companies에 새 row가 들어올 때마다 4개 default 템플릿을 자동 생성

CREATE OR REPLACE FUNCTION seed_default_mail_templates_for_new_company()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO recruiter_mail_templates (company_id, created_by, name, subject, body) VALUES
  (NEW.id, NULL, '지원 접수 안내',
   '[{회사명}] {공고명} 지원 접수 안내',
   E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션에 지원해 주셔서 감사합니다.\n제출해 주신 지원서를 잘 받았으며 검토 중입니다. 결과는 확인되는 대로 다시 안내드리겠습니다.\n\n감사합니다.'),
  (NEW.id, NULL, '인터뷰 안내',
   '[{회사명}] {공고명} {차수인터뷰} 제안',
   E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션 검토 결과, {후보이름}님과 {차수인터뷰}을(를) 진행하고 싶습니다.\n아래 가능한 일정 중 회신해 주시면 확정하겠습니다.\n\n{인터뷰일정}\n\n장소와 방식은 일정 확정 후 안내드리겠습니다.\n감사합니다.'),
  (NEW.id, NULL, '합격 안내',
   '[{회사명}] {공고명} 합격 안내',
   E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션에 {후보이름}님을 모시기로 결정했습니다. 축하드립니다.\n입사 절차와 처우 조건은 별도로 안내드리겠습니다.\n\n함께하게 되어 기쁩니다.\n감사합니다.'),
  (NEW.id, NULL, '불합격 안내',
   '[{회사명}] {공고명} 전형 결과 안내',
   E'{후보이름}님, 안녕하세요.\n{회사명} 채용 담당자입니다.\n\n{공고명} 포지션에 관심을 갖고 지원해 주셔서 감사합니다.\n아쉽게도 이번 전형에서는 함께하지 못하게 되었습니다.\n\n지원에 들인 시간과 노력에 깊이 감사드리며, 좋은 기회로 다시 뵙기를 바랍니다.\n\n감사합니다.');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_seed_default_mail_templates ON recruiter_companies;
CREATE TRIGGER trg_seed_default_mail_templates
  AFTER INSERT ON recruiter_companies
  FOR EACH ROW
  EXECUTE FUNCTION seed_default_mail_templates_for_new_company();
