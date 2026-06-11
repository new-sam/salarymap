-- 회사 팔로우. 사용자가 회사(이름 문자열, lower(trim) 정규화)를 팔로우하면
-- 그 회사 페이지의 새 소식/연봉 알림 대상이 된다. job_bookmarks/community_blocks와
-- 동일하게 엔드포인트가 service_role + Bearer 토큰으로 user.id를 검증하므로
-- (RLS 우회) 아래 정책은 안전망이고 실제 권한 체크는 핸들러 코드에서 수행한다.

create table if not exists company_follows (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,          -- lower(trim()) 정규화해 저장
  created_at timestamptz default now(),
  unique (user_id, company_name)
);
create index if not exists idx_company_follows_user on company_follows(user_id);
create index if not exists idx_company_follows_company on company_follows(company_name);

alter table company_follows enable row level security;
create policy "company_follows_select" on company_follows for select using (auth.uid() = user_id);
create policy "company_follows_insert" on company_follows for insert with check (auth.uid() = user_id);
create policy "company_follows_delete" on company_follows for delete using (auth.uid() = user_id);
