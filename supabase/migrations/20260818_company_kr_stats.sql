-- 한국 법인 공공데이터 캐시 (국민연금 사업장 + DART 재무).
-- 회사 페이지 정보 탭에서 SSR(service_role)로만 읽는다 — 공개 정책 없음.
-- 적재는 scripts/kr-company-stats.mjs (수동 실행, 월 1회 갱신 권장).
create table if not exists company_kr_stats (
  id bigint generated always as identity primary key,
  company text not null unique,        -- jobs.company 영문 표기 (매칭 키)
  kr_name text,                        -- 국민연금 등록 사업장명 (예: 주식회사 넥사코드)
  bzowr_rgst_no text,                  -- 사업자등록번호 (API 마스킹 형식 그대로, 예: 326870****)
  address text,
  industry text,
  registered_at date,                  -- 국민연금 사업장 적용일 (설립 근사치)
  established_at date,                 -- DART est_dt (있으면 설립 표기에 우선)
  dart_corp_code text,
  headcount int,                       -- 최신 가입자수
  monthly jsonb,                       -- [{ym:'202607', headcount, joined, left}] 최근 12개월
  financials jsonb,                    -- [{year, revenue, operating_income, net_income}] 원 단위
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

alter table company_kr_stats enable row level security;
