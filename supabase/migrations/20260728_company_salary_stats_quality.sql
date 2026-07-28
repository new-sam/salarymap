-- 회사 카드 연봉 집계에 데이터 품질 필터 적용.
--
-- 제출 폼이 슬라이더(min=5, max=200, 기본값 62)라 세 지점에 가짜 값이 쌓였다.
-- 11,073건 실측 (이웃값 대비 초과분 = 아티팩트 추정):
--   62M   673건 / 이웃(59~61,63~65) 평균 25건  → 초과 630건
--   200M   43건 / 이웃(170~195)    평균 0.5건 → 초과  43건
--   5M    168건 / 이웃(6~9)        평균 86건  → 초과  82건
--
-- 1) 하드범위를 끝값 배타(5 < salary < 200)로. 5M은 2026 지역I 최저임금
--    5.31M/월에도 못 미쳐 정규직 급여로 성립하지 않고, 200M/300M/2000M은
--    슬라이더 최댓값이거나 명백한 장난 입력이다.
-- 2) 62M은 2026-06-20(커밋 4fbb220, salaryTouched 가드 배포) 이전 행만 제외.
--    가드 이후 62M 비율은 0.44%로 이웃값 수준이라 진짜 제출이다.
--
-- JS 쪽 대응 로직: lib/salaryStats.js + lib/salaryQuality.js — 한쪽을 바꾸면 같이 바꿀 것.
-- ⚠️ 수동 적용: Supabase 대시보드 SQL 에디터에서 실행 (db push 금지).
-- ⚠️ 적용 후 /api/cron/refresh-company-cards 를 한 번 돌려 company_cards_cache 갱신 필요.
create or replace function get_company_salary_stats(
  p_role text default null,
  p_experience text default null
)
returns table (
  company text,
  cnt bigint,
  median numeric,
  min_salary numeric,
  max_salary numeric,
  top_role text
)
language sql
stable
as $$
  with f as (
    select
      lower(trim(s.company)) as company,
      s.salary,
      s.role
    from submissions s
    where s.company is not null
      and (p_role is null or s.role = p_role)
      and (p_experience is null or s.experience = p_experience)
      -- 슬라이더 기본값(62) 오염 — 가드 배포(2026-06-20) 이전 제출만
      and not (s.salary = 62 and s.created_at < timestamptz '2026-06-20')
  ),
  hard as (
    select company, salary
    from f
    where salary > 5 and salary < 200
  ),
  bounds as (
    select
      company,
      count(*) as n,
      percentile_cont(0.25) within group (order by salary) as q1,
      percentile_cont(0.75) within group (order by salary) as q3
    from hard
    group by company
  ),
  clean as (
    select h.company, h.salary
    from hard h
    join bounds b on b.company = h.company
    where b.n < 4
       or (h.salary >= b.q1 - 1.5 * (b.q3 - b.q1)
       and h.salary <= b.q3 + 1.5 * (b.q3 - b.q1))
  ),
  sal as (
    select
      company,
      count(*) as cnt,
      percentile_cont(0.5) within group (order by salary) as median,
      min(salary) as min_salary,
      max(salary) as max_salary
    from clean
    group by company
  ),
  roles as (
    select company, role,
      row_number() over (partition by company order by count(*) desc, role asc) as rn
    from f
    where role is not null
    group by company, role
  ),
  top as (
    select company, role from roles where rn = 1
  )
  select
    coalesce(sal.company, top.company) as company,
    coalesce(sal.cnt, 0) as cnt,
    sal.median,
    sal.min_salary,
    sal.max_salary,
    top.role as top_role
  from sal
  full join top on sal.company = top.company
  -- 안정적 정렬 필수: PostgREST가 요청당 1000행으로 잘라 페이지네이션하므로
  -- ORDER BY가 없으면 페이지 간 행이 겹치거나 누락됨.
  order by 1;
$$;
