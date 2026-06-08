-- 회사별 급여 집계를 Postgres에서 직접 수행 (기존: submissions 전체 row를 Node로 끌어와 계산)
-- 반환: 정규화된 회사명(lower+trim) 기준 count / median / min / max / top_role
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
  sal as (
    select
      company,
      count(*) as cnt,
      percentile_cont(0.5) within group (order by salary) as median,
      min(salary) as min_salary,
      max(salary) as max_salary
    from f
    where salary >= 5 and salary <= 200
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
