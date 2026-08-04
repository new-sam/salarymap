-- 차단 이메일 패턴 가입 시 자동 밴 (반복 어뷰저 재가입 대응)
-- 패턴 추가는 DDL 없이 blocked_signup_patterns INSERT만 하면 됨 (service_role REST 가능)

create table if not exists public.blocked_signup_patterns (
  id bigint generated always as identity primary key,
  pattern text not null,  -- email ILIKE 패턴 (예: 'killer.com%@gmail.com')
  note text,
  created_at timestamptz not null default now()
);

alter table public.blocked_signup_patterns enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가, service_role만 사용

create or replace function public.ban_blocked_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocked_signup_patterns p
    where new.email ilike p.pattern
  ) then
    new.banned_until := now() + interval '100 years';
  end if;
  return new;
exception when others then
  -- 이 트리거가 죽어도 가입 자체는 막지 않는다
  return new;
end;
$$;

drop trigger if exists ban_blocked_signup_before_insert on auth.users;
create trigger ban_blocked_signup_before_insert
  before insert on auth.users
  for each row execute function public.ban_blocked_signup();

insert into public.blocked_signup_patterns (pattern, note)
  values ('killer.com%@gmail.com', 'Tô Vĩnh Phú 반복 어뷰저 (killer.com02·09 밴 이력)');
