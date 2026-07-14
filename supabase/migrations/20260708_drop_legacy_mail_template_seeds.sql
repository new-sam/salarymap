-- 2026-07-08 legacy 한국어 시스템 시드 템플릿 제거.
-- 배경: components/company/CandidateDetail.js 의 MAIL_PRESETS 가 이미 베트남어로
-- 하드코딩되어 있어 리크루터 UI 는 vi 프리셋을 사용한다. 그런데 회사 생성 시
-- 20260602_mail_templates.sql / 20260604_mail_templates_auto_seed.sql 트리거가 계속
-- 한국어 4종 (created_by IS NULL) 을 auto-seed 해서 "커스텀 템플릿" 목록에 한국어가
-- 노출되는 문제가 있었다. 베트남 로컬 기업 대상 서비스이므로 이 legacy seed 를 걷어낸다.
--
-- 조치:
-- 1) auto-seed 트리거 제거 (신규 회사에 더 이상 seed 되지 않음).
-- 2) 기존에 seed 된 created_by IS NULL 4종 삭제.
--    (리크루터가 직접 만든 커스텀 템플릿 = created_by IS NOT NULL 은 건드리지 않음)

DROP TRIGGER IF EXISTS trg_seed_default_mail_templates ON recruiter_companies;
DROP FUNCTION IF EXISTS seed_default_mail_templates_for_new_company();

DELETE FROM recruiter_mail_templates
WHERE created_by IS NULL
  AND name IN ('지원 접수 안내', '인터뷰 안내', '합격 안내', '불합격 안내');
