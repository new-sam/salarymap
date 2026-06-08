-- 푸시 알림 토큰 + 카테고리 선호 저장 테이블.
-- 모바일 앱(salary-fyi)이 /api/notifications/register 로 업서트하고,
-- lib/push.js 가 발송 시 enabled + prefs[category] 로 대상을 필터링한다.
-- service_role(API 경유)만 접근. RLS enable, 익명/authenticated 정책 없음.
create table if not exists push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text,
  prefs jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on push_tokens(user_id);

alter table push_tokens enable row level security;
