-- 유사공고 추천 캠페인 지원.
-- 1) kind: 발송 성격 구분 (recruiter=담당자 추천 / similar=유사공고 자동추천)
-- 2) user_id nullable: 계정 없이 이메일로만 지원한 사람(applicant_email)에게도 발송/기록 가능하게.
--    중복발송 방지는 (user_id, job_id) unique + 코드단 email 조인으로 처리.
alter table public.job_recommendations
  add column if not exists kind text not null default 'recruiter';
생
alter table public.job_recommendations
  alter column user_id drop not null;
