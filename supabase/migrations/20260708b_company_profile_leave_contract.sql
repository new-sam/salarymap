-- Company Profile 2차: Paid Leave / Contract 도 회사 단위로 편집 가능하게.
-- (Insurance 는 베트남 4대보험이 사실상 표준이라 하드코딩 유지)
-- work_days/hours 와 동일한 스냅샷 패턴: 프로필에 기본값 저장, 공고 저장 시 job 행에 복사.

alter table recruiter_companies
  add column if not exists paid_leave text,
  add column if not exists contract_type text;

alter table jobs
  add column if not exists paid_leave text,
  add column if not exists contract_type text;
