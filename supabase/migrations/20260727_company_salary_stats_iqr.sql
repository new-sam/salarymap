-- 카드(/api/companies)와 상세(/api/company-detail) 수치 불일치 해소.
-- 기존 RPC는 salary 5–200 하드필터만 적용해 min/max가 필터 경계(5M–200M)로 수렴하는
-- 무의미한 범위를 보여줬고, 상세는 3–300 + IQR 아웃라이어 제거를 써서
-- count/min/max/median이 서로 어긋났다 (상위 60개사 중 38곳 범위 불일치).
-- 상세와 동일한 정제(하드범위 3–300 + IQR 1.5, 표본 4건 미만은 IQR 생략)로 통일.
-- JS 쪽 대응 로직: lib/salaryStats.js — 한쪽을 바꾸면 같이 바꿀 것.
-- ⚠️ 수동 적용: Supabase 대시보드 SQL 에디터에서 실행 (db push 금지).
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
  ),
  hard as (
    select company, salary
    from f
    where salary >= 3 and salary <= 300
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
