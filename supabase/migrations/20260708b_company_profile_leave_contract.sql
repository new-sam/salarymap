-- Company Profile 2차 + 공고별 계약형태.
-- paid_leave: 회사 단위 정책이라 회사 프로필 + 공고 스냅샷 둘 다.
-- contract_type: 같은 회사도 공고마다 다름(정규직/계약직/인턴) → 회사 프로필엔 두지 않고
--                공고 단위 필드로만. (Insurance 는 베트남 표준이라 하드코딩 유지)

alter table recruiter_companies
  add column if not exists paid_leave text;

alter table jobs
  add column if not exists paid_leave text,
  add column if not exists contract_type text;
