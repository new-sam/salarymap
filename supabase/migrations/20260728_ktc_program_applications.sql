-- K-Tech College 랜딩(/ktc) 프로그램 지원 — FYI 회원 기준 인재풀 등록.
-- 공고별 지원이 아니라 "프로그램에 지원" 1건이므로 job_applications 를 쓰지 않는다:
--   · job_applications.job_id 는 FYI jobs 를 가리키는데 KTC 공고는 별도 Supabase 에 있고
--     읽기 전용으로만 쓴다(동기화하지 않기로 결정).
--   · 해당 테이블의 RLS 가 job_id 기준 기업 열람 정책이라 job_id 없이 넣으면 정책이 깨진다.
-- ktc_applications / ktc_candidates 와도 다르다 — 그쪽은 구글시트에서 전량 재적재되는
-- 분석용 미러라 여기에 신규 지원을 넣으면 동기화 때 삭제된다.
--
-- 적용: 대시보드 SQL 에디터에서 수동 실행 (db push 금지)

create table if not exists ktc_program_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  full_name text,
  resume_url text not null,        -- 지원 시점의 프로필 이력서 URL 스냅샷
  -- 유입 맥락. KTC 공고는 외부 DB라 FK 를 걸 수 없어 값만 스냅샷으로 남긴다.
  applied_job text,
  applied_company text,
  ktc_job_id text,
  source text default 'ktc-landing',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referrer text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 프로그램 지원은 1인 1건 — 다른 공고를 보고 다시 눌러도 최신 관심 공고로 갱신만 한다.
  unique (user_id)
);

create index if not exists ktc_program_applications_created_at
  on ktc_program_applications(created_at desc);
create index if not exists ktc_program_applications_source
  on ktc_program_applications(source);

alter table ktc_program_applications enable row level security;

-- 본인 지원 내역만 조회 가능. 쓰기는 서버(service_role)만 — API 에서 이력서 보유를
-- 검증한 뒤 넣으므로 클라이언트 직접 insert 는 막는다.
drop policy if exists ktc_program_applications_select_own on ktc_program_applications;
create policy ktc_program_applications_select_own
  on ktc_program_applications for select
  using (auth.uid() = user_id);
