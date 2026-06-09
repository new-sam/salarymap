-- 앱 버그 리포트 / 문의. 모바일(salary-fyi) submitFeedback 계약에 대응.
-- 엔드포인트는 service_role 클라이언트 + Bearer 토큰으로 user.id를 직접 검증하므로
-- (RLS 우회) 아래 정책은 안전망이고 실제 권한 체크는 핸들러 코드에서 수행한다.

create table if not exists app_feedback (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  category text not null default 'bug' check (category in ('bug','feature','other')),
  message text not null,
  contact_email text,
  platform text,        -- ios | android
  app_version text,
  created_at timestamptz default now()
);
create index if not exists idx_app_feedback_created on app_feedback(created_at desc);

alter table app_feedback enable row level security;
create policy "feedback_insert" on app_feedback for insert with check (auth.uid() = user_id);
-- SELECT 정책 없음 → 일반 클라이언트는 조회 불가. 운영자는 service_role로 조회.
