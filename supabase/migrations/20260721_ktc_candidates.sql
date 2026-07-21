-- KTC 채용 파이프라인 후보자 (ktc-support Supabase candidates 테이블에서 동기화)
-- 용도: 어드민 소싱 채널 비교 탭 (ITviec/LinkedIn/landing/TopDev/... vs FYI)
-- 동기화: scripts/sync-ktc-candidates.mjs 가 upsert (하루 1회 cron)
-- 적용: 대시보드 SQL 에디터에서 수동 실행 (db push 금지)

create table if not exists ktc_candidates (
  id uuid primary key default gen_random_uuid(),

  -- 원본 식별 (ktc-support candidates 와 동일 키, upsert 기준)
  sheet_source text not null,          -- 시트 탭 = 플랫폼 (ITviec-api, landing-page, LinkedIn, top-dev, jobs-go, top-cv, glint, YBOX, FYI, legacy-sheet)
  sheet_row_identifier text not null,  -- email 또는 이름+폰 (탭 내 유니크 지원자)

  -- 기본 정보
  full_name text not null,
  email text,
  phone text,
  city text,
  university text,
  position text,
  yoe text,

  -- 지원 정보
  source text,                         -- 세부 유입 (job-detail, homepage 등. 대부분 sheet_source 와 동일)
  applied_job text,                    -- 원본 공고 문자열 (예: "LM1001 - Fullstack Developer (ReactJS, NodeJS)")
  applied_company text,
  job_code text,                       -- 동기화 시 applied_job 에서 추출한 공고코드 (예: LM1001)
  applied_date_raw text,               -- 원본 날짜 문자열 (탭별 포맷 상이)
  applied_at timestamptz,              -- 동기화 시 파싱한 날짜 (파싱 실패 시 null)

  -- 파이프라인 상태 (질 비교용)
  pipeline_status text,                -- new / rejected / screening_failed / ai_interview_sent / ai_interview_done / ai_interview_passed / passed / final_passed

  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

-- upsert 기준 유니크 키 (ktc-support 원본과 동일)
create unique index if not exists ktc_candidates_origin_unique
  on ktc_candidates(sheet_source, sheet_row_identifier);

create index if not exists ktc_candidates_job_code on ktc_candidates(job_code);
create index if not exists ktc_candidates_applied_at on ktc_candidates(applied_at);

-- 어드민 전용: RLS 활성화 + 정책 없음 → service_role 만 접근 가능
alter table ktc_candidates enable row level security;
