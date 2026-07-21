-- KTC 소싱 "지원 건" 원본 (구글시트 행 그대로 — 중복 포함, ktc-support의 전역 중복제거를 우회)
-- ktc_candidates(유니크 지원자·최초 채널 귀속)와 쌍: 어드민 KTC 소싱 탭의 지원자/지원 건 이중 기준용.
-- 동기화: lib/ktcCandidatesSync syncKtcApplications — 탭 단위 전량 삭제 후 재적재 (시트가 원본).
-- 적용: 대시보드 SQL 에디터에서 수동 실행 (db push 금지)

create table if not exists ktc_applications (
  id uuid primary key default gen_random_uuid(),
  sheet_source text not null,      -- 시트 탭 = 채널
  full_name text,
  email text,
  applied_job text,
  job_code text,                   -- applied_job 에서 추출한 공고코드
  applied_company text,
  position text,
  applied_date_raw text,
  applied_at timestamptz,
  synced_at timestamptz default now()
);

create index if not exists ktc_applications_source on ktc_applications(sheet_source);
create index if not exists ktc_applications_applied_at on ktc_applications(applied_at);
create index if not exists ktc_applications_job_code on ktc_applications(job_code);

-- 어드민 전용: RLS 활성화 + 정책 없음 → service_role 만 접근 가능
alter table ktc_applications enable row level security;
