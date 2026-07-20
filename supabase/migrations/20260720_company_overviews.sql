-- 회사 소개(AI 웹검색 기반) 캐시 테이블.
-- 회사당 1회 생성해 저장하고 상세 페이지에서 읽는다. COMPANY_PROFILES(수기)에 없는 회사만 채운다.
create table if not exists company_overviews (
  company text primary key,
  overview text not null,
  lang text not null default 'vi',
  model text,
  source text,                         -- 'web_search' 등 생성 근거
  generated_at timestamptz not null default now()
);

alter table company_overviews enable row level security;

-- 공개 읽기(상세 페이지). 쓰기는 service_role만.
drop policy if exists "public read company_overviews" on company_overviews;
create policy "public read company_overviews" on company_overviews for select using (true);
