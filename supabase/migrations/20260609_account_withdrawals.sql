-- 회원 탈퇴 사유 수집. 모바일(salary-fyi) withdrawAccount 계약에 대응.
-- 엔드포인트(/api/account/withdraw)는 service_role 클라이언트 + Bearer 토큰으로
-- user.id를 검증한 뒤, ① 여기에 사유를 적재하고 → ② auth.users 행을 삭제한다.
--
-- user_id를 on delete set null로 둔 이유: 계정(auth.users)이 삭제돼도 사유 통계는
-- 남아야 한다. 삭제 직후 cascade로 user_id만 null이 되고, email 스냅샷·사유는 보존된다.
-- (탈퇴자 추적/문의 대비해 탈퇴 시점 이메일을 별도 컬럼에 박제)

create table if not exists account_withdrawals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,                 -- 탈퇴 시점 이메일 스냅샷(계정 삭제 후에도 남음)
  reason text not null,       -- 사유 코드(no_longer_use | found_job | privacy | too_many_notifications | not_useful | bug | other)
  detail text,                -- 자유 입력(선택, 최대 1000자)
  platform text,              -- ios | android
  app_version text,
  created_at timestamptz default now()
);
create index if not exists idx_account_withdrawals_created on account_withdrawals(created_at desc);
create index if not exists idx_account_withdrawals_reason on account_withdrawals(reason);

alter table account_withdrawals enable row level security;
-- INSERT/SELECT 정책 없음 → anon/authenticated 모두 차단.
-- 적재·조회는 서버 service_role로만 수행한다(app_feedback과 동일한 운영 패턴).
