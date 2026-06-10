-- 일반 사용자 약관/개인정보 동의 기록. 모바일(salary-fyi) 로그인 게이트에서 동의 후 호출.
-- 베트남 PDPL(2026-01-01 시행)은 개인정보 수집 전 '명시적·구체적' 동의를 요구하고, 사전 체크/
-- 간주 동의를 무효로 본다. 따라서 동의 시점·약관 버전을 박제해 법적 증빙으로 남긴다.
-- 엔드포인트(/api/user-consents)는 service_role + Bearer 토큰으로 user.id를 검증한 뒤 upsert한다.
-- (recruiter_users 동의 컬럼과 동일한 취지의 일반 사용자용 테이블)
create table if not exists user_consents (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  terms_agreed_at   timestamptz not null default now(),  -- 이용약관 동의 시점
  privacy_agreed_at timestamptz not null default now(),  -- 개인정보 처리방침 동의 시점
  terms_version     text not null,                       -- 동의한 약관 버전(변경 시 재동의 추적)
  marketing_opt_in  boolean not null default false,      -- 선택: 마케팅/프로모션 수신 동의(묶음 금지라 별도)
  platform          text,                                -- ios | android
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_user_consents_version on user_consents(terms_version);

alter table user_consents enable row level security;
-- INSERT/SELECT/UPDATE 정책 없음 → anon/authenticated 모두 차단.
-- 적재·조회는 서버 service_role로만 수행한다(account_withdrawals와 동일한 운영 패턴).
