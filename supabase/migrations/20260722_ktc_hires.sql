-- KTC 입사자 (KTC Ops 시트 Employee 탭 + 매출현황 탭 병합 동기화)
-- 용도: KTC 소싱 탭의 "채널별 입사 귀속" — 이메일로 지원 채널과 조인해 채널→입사→매출 추적.
-- 동기화: lib/ktcCandidatesSync syncKtcHires — 전량 삭제 후 재적재 (시트가 원본, ~45행).
-- 적용: 대시보드 SQL 에디터에서 수동 실행 (db push 금지)

create table if not exists ktc_hires (
  id uuid primary key default gen_random_uuid(),

  -- Employee 탭
  code text,               -- R15 등
  category text,           -- Remote 등
  status text,             -- Ing 등
  company text,
  position1 text,
  position2 text,
  full_name text not null,
  email text,
  interview_month text,    -- "03/2026" 원문
  onboarding_raw text,     -- "04/01" 원문 (형식 비정형이라 raw 보존)
  salary_usd numeric,

  -- 매출현황 탭 (이름+회사 매칭)
  hired_at date,
  contract_end date,
  left_at date,
  revenue_usd numeric,     -- 시트 "총 매출액" (월 기준으로 보임 — 시트 정의 따름)
  profit_usd numeric,

  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists ktc_hires_email on ktc_hires(email);

-- 어드민 전용: RLS 활성화 + 정책 없음 → service_role 만 접근 가능 (급여/매출 민감정보)
alter table ktc_hires enable row level security;
