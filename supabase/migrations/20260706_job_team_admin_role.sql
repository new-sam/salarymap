-- 공고 관리자 (admin) / 면접관 (interviewer) 두 개 역할을 job_team.role 에 명시적으로 표현한다.
--
-- 이전: role 이 항상 'interviewer' 로 하드코딩되어 있었고, 공고 오너 여부는
-- jobs.created_by 로만 판단했음. 여러 명의 공고 관리자가 있을 수 없었다.
--
-- 이후: role IN ('admin','interviewer'). 각 공고 생성자는 자동으로 그 공고의
-- admin 이 되고, 이후 admin 이 다른 사람을 admin/interviewer 로 초대할 수 있다.
--
-- 이 마이그레이션은 idempotent — 여러 번 실행해도 안전하다.
-- (CHECK constraint 확장은 프로브 결과 필요 없음이 확인되어 생략.)

INSERT INTO public.job_team (job_id, user_id, role, added_by)
SELECT id, created_by, 'admin', created_by
FROM public.jobs
WHERE created_by IS NOT NULL
ON CONFLICT (job_id, user_id) DO UPDATE SET role = 'admin';
