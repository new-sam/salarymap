-- 어드민 인재풀 → 공고 추천 메일 발송 로그.
-- 지원 여부는 job_applications 를 (user_id|email)+job_id 로 조인해 판별하므로
-- 여기엔 발송 사실만 기록한다. service_role 전용 (RLS on, 정책 없음).
create table if not exists public.job_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  to_email text not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_title text,
  job_company text,
  sent_by text,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

-- 같은 사람에게 같은 공고 중복 발송 방지
create unique index if not exists job_recommendations_user_job_uniq
  on public.job_recommendations (user_id, job_id);
create index if not exists job_recommendations_job_idx
  on public.job_recommendations (job_id);

alter table public.job_recommendations enable row level security;
