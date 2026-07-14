-- 실험 런타임 플래그 — 어드민 원클릭 롤백용 (재배포 없이 on/off).
-- 적용: Supabase 대시보드 SQL 에디터에서 직접 실행 (db push 금지 — 히스토리 미동기).
create table if not exists app_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into app_flags (key, enabled) values
  ('hero_wizard', true),
  ('hard_gate', true),
  ('one_tap', true)
on conflict (key) do nothing;

-- 읽기/쓰기 모두 service role 경유(/api/flags, /api/admin/flags)만 — 클라 직접 접근 차단
alter table app_flags enable row level security;
