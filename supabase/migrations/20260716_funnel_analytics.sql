-- ─────────────────────────────────────────────────────────────────────────────
-- 퍼널 분석 (Amplitude 의미론) — 원본 events 위에서 조회 시점 계산. 집계 테이블 없음.
-- 접근 경로: 어드민 Next API(service_role)만 호출. anon/authenticated 는 실행 불가.
-- 스키마가 바뀌면 ev 뷰만 고치면 된다 — 아래 모든 함수는 ev 만 참조.
-- ⚠ 수동 적용: Supabase 대시보드 SQL 에디터에 전체 붙여넣기 (db push 금지 환경)
-- ─────────────────────────────────────────────────────────────────────────────

-- [1] 어댑터 뷰 ---------------------------------------------------------------
-- user_key 식은 아래 인덱스 식과 글자까지 동일해야 플래너가 인덱스를 탄다.
create or replace view public.ev with (security_invoker = on) as
select
  e.created_at                              as ts,
  e.event::text                             as event_name,
  coalesce(e.user_id::text, e.client_id)    as user_key,
  coalesce(e.meta, '{}'::jsonb)
    || jsonb_build_object('page', e.page)   as props
from public.events e;

-- [2] 인덱스 ------------------------------------------------------------------
-- 퍼널의 상관 서브쿼리 패턴 (user_key = ? and event = ? and ts range) 전용.
-- (event, created_at) 은 idx_events_event_created_at 로 이미 존재.
-- props GIN 은 뷰가 meta||{page} 합성 식이라 어차피 못 타므로 만들지 않는다 —
-- prop 필터가 느려지면 그때 meta 단독 식 인덱스를 검토.
create index if not exists idx_events_userkey_event_ts
  on public.events ((coalesce(user_id::text, client_id)), event, created_at);

-- [3] 필터 조각 빌더 (내부용) ---------------------------------------------------
-- [{"k":"path","op":"=","v":"/pricing"}] → " and (alias.props->>'path' = '/pricing')"
-- 값은 전부 %L, 식별자성 입력은 화이트리스트 검증. 문자열 이어붙이기 없음.
create or replace function public._funnel_where(p_filters jsonb, p_alias text)
returns text language plpgsql immutable as $$
declare f jsonb; k text; op text; frag text; vals text; out_sql text := '';
begin
  if p_filters is null or jsonb_typeof(p_filters) <> 'array' then return ''; end if;
  if p_alias !~ '^[a-z][a-z0-9_]{0,10}$' then raise exception 'bad alias'; end if;
  for f in select * from jsonb_array_elements(p_filters) loop
    k := f ->> 'k'; op := f ->> 'op';
    if k is null or op is null then continue; end if;
    case op
      when '='  then frag := format('%s.props ->> %L = %L', p_alias, k, f ->> 'v');
      when '!=' then frag := format('%s.props ->> %L is distinct from %L', p_alias, k, f ->> 'v');
      when 'in' then
        select string_agg(format('%L', x.value #>> '{}'), ',') into vals
          from jsonb_array_elements(f -> 'v') x;
        frag := format('%s.props ->> %L in (%s)', p_alias, k, coalesce(vals, 'null'));
      when 'contains'     then frag := format('%s.props ->> %L ilike %L', p_alias, k, '%' || (f ->> 'v') || '%');
      when 'not_contains' then frag := format('coalesce(%s.props ->> %L, '''') not ilike %L', p_alias, k, '%' || (f ->> 'v') || '%');
      when 'exists'       then frag := format('%s.props ->> %L is not null', p_alias, k);
      when 'not_exists'   then frag := format('%s.props ->> %L is null', p_alias, k);
      when '>' then frag := format('(%s.props ->> %L)::numeric > %L::numeric', p_alias, k, f ->> 'v');
      when '<' then frag := format('(%s.props ->> %L)::numeric < %L::numeric', p_alias, k, f ->> 'v');
      else raise exception 'unsupported op: %', op;
    end case;
    out_sql := out_sql || ' and (' || frag || ')';
  end loop;
  return out_sql;
end $$;

-- [4] 핵심: 유저 1명당 1행, 각 단계 도달 시각 배열 (내부용) -----------------------
-- 의미론 (Amplitude):
--  · t0 = [from, to) 안의 1단계 최초 발생. 유저당 하나.
--  · 모든 후속 단계는 t0 + window 안 (직전 단계 기준 아님, t0 기준 누적).
--  · 후속 단계는 조회 기간 밖이어도 됨 (1단계만 기간 안이면 카운트).
--  · this: ts >= t[i-1] / any: ts >= t0 (순서 무관) / exact: this + 사이에 퍼널 밖 이벤트 금지.
--  · 각 단계는 조건을 만족하는 가장 이른 발생 (earliest path).
--  · 이전 단계 NULL → 하한 비교가 NULL → min()이 NULL로 자동 전파 (중간에 거르지 않음).
--  · seg(group by) 값은 t0 행의 props 기준으로 고정.
create or replace function public._funnel_rows(
  p_steps    jsonb,
  p_from     timestamptz,
  p_to       timestamptz,
  p_window   interval default interval '1 day',
  p_order    text     default 'this',
  p_segment  jsonb    default '[]'::jsonb,
  p_group_by text     default null,
  p_exclude  text     default null
) returns table (user_key text, seg text, t timestamptz[], tx timestamptz)
language plpgsql stable as $$
declare
  n int; i int; names text[]; win interval;
  seg_expr text; lower_ref text; exact_cond text;
  arr_elems text := 's1.t1'; laterals text := ''; excl text; q text;
begin
  n := coalesce(jsonb_array_length(p_steps), 0);
  if n < 1 or n > 10 then raise exception 'p_steps must have 1..10 steps'; end if;
  if p_order not in ('this', 'any', 'exact') then raise exception 'p_order must be this|any|exact'; end if;
  win := greatest(interval '1 second', least(coalesce(p_window, interval '1 day'), interval '366 days'));

  select array_agg(s ->> 'event') into names from jsonb_array_elements(p_steps) s;
  if exists (select 1 from unnest(names) x where x is null or x !~ '^[a-zA-Z0-9_.:-]{1,64}$') then
    raise exception 'bad event name in p_steps';
  end if;
  if p_exclude is not null and p_exclude !~ '^[a-zA-Z0-9_.:-]{1,64}$' then
    raise exception 'bad p_exclude';
  end if;

  seg_expr := case when p_group_by is null then 'null::text'
                   else format('e.props ->> %L', p_group_by) end;

  for i in 2..n loop
    lower_ref := case when p_order = 'any' or i = 2 then 's1.t1' else format('s%s.t', i - 1) end;
    exact_cond := case when p_order = 'exact' then
      format(' and not exists (select 1 from public.ev x where x.user_key = s1.user_key'
             || ' and x.ts > %s and x.ts < e.ts and x.event_name <> all (%L::text[]))',
             case when i = 2 then 's1.t1' else format('s%s.t', i - 1) end, names)
      else '' end;
    laterals := laterals || format(
      ' cross join lateral (select min(e.ts) as t from public.ev e'
      || ' where e.user_key = s1.user_key and e.event_name = %L'
      || ' and e.ts >= %s and e.ts <= s1.t1 + %L::interval%s%s) s%s',
      names[i], lower_ref, win, exact_cond,
      public._funnel_where(p_steps -> (i - 1) -> 'where', 'e'), i);
    arr_elems := arr_elems || format(', s%s.t', i);
  end loop;

  excl := case when p_exclude is null
    then ' left join lateral (select null::timestamptz as tx) ex on true'
    else format(' left join lateral (select min(e.ts) as tx from public.ev e'
                || ' where e.user_key = s1.user_key and e.event_name = %L'
                || ' and e.ts > s1.t1 and e.ts <= s1.t1 + %L::interval) ex on true',
                p_exclude, win) end;

  q := format(
    'with s1 as (select distinct on (e.user_key) e.user_key, e.ts as t1, %s as seg'
    || ' from public.ev e where e.user_key is not null and e.event_name = %L'
    || ' and e.ts >= %L and e.ts < %L%s%s'
    || ' order by e.user_key, e.ts asc)'
    || ' select s1.user_key, s1.seg, array[%s]::timestamptz[] as t, ex.tx from s1%s%s',
    seg_expr, names[1], p_from, p_to,
    public._funnel_where(p_steps -> 0 -> 'where', 'e'),
    public._funnel_where(p_segment, 'e'),
    arr_elems, laterals, excl);

  return query execute q;
end $$;

-- [5] 공개용: 단계별 집계 --------------------------------------------------------
-- p_bucket 은 진입 시각 t0 기준 버킷 (완료 시각 아님). median 은 유저 첫 전환 기준.
create or replace function public.funnel(
  p_steps    jsonb,
  p_from     timestamptz,
  p_to       timestamptz,
  p_window   interval default interval '1 day',
  p_order    text     default 'this',
  p_segment  jsonb    default '[]'::jsonb,
  p_group_by text     default null,
  p_bucket   text     default null,
  p_exclude  text     default null
) returns table (
  bucket timestamptz, segment text, step_index int, step_name text,
  users bigint, median_sec double precision, avg_sec double precision
) language plpgsql stable as $$
declare n int; names text[];
begin
  n := coalesce(jsonb_array_length(p_steps), 0);
  if p_bucket is not null and p_bucket not in ('hour', 'day', 'week', 'month') then
    raise exception 'p_bucket must be hour|day|week|month';
  end if;
  select array_agg(s ->> 'event') into names from jsonb_array_elements(p_steps) s;

  return query
  with r as (
    select fr.user_key, fr.seg, fr.t, fr.tx
      from public._funnel_rows(p_steps, p_from, p_to, p_window, p_order, p_segment, p_group_by, p_exclude) fr
  ), r2 as (
    -- 제외 이벤트 적용: tx 이후 도달한 단계(2단계~)는 무효
    select r.user_key, r.seg,
           (select array_agg(case when u.ti is null then null
                                   when u.i > 1 and r.tx is not null and u.ti >= r.tx then null
                                   else u.ti end order by u.i)
              from unnest(r.t) with ordinality u(ti, i)) as t
      from r
  )
  select case when p_bucket is null then null::timestamptz else date_trunc(p_bucket, r2.t[1]) end,
         r2.seg,
         gs.i::int,
         names[gs.i],
         count(*) filter (where r2.t[gs.i] is not null),
         percentile_cont(0.5) within group (order by extract(epoch from (r2.t[gs.i] - r2.t[gs.i - 1]))::double precision)
            filter (where gs.i > 1 and r2.t[gs.i] is not null),
         (avg(extract(epoch from (r2.t[gs.i] - r2.t[gs.i - 1])))
           filter (where gs.i > 1 and r2.t[gs.i] is not null))::double precision
    from r2 cross join generate_series(1, n) gs(i)
   group by 1, 2, 3, 4
   order by 1 nulls first, 2 nulls first, 3;
end $$;

-- [6] 이탈자 코호트 (Microscope) --------------------------------------------------
-- p_reached 단계는 도달, p_but_not 단계는 미도달인 유저 목록.
create or replace function public.funnel_users(
  p_steps   jsonb,
  p_from    timestamptz,
  p_to      timestamptz,
  p_window  interval default interval '1 day',
  p_order   text     default 'this',
  p_segment jsonb    default '[]'::jsonb,
  p_exclude text     default null,
  p_reached int      default 1,
  p_but_not int      default null,
  p_limit   int      default 500
) returns table (user_key text, entered_at timestamptz, last_step_at timestamptz)
language plpgsql stable as $$
declare n int;
begin
  n := coalesce(jsonb_array_length(p_steps), 0);
  if p_reached < 1 or p_reached > n then raise exception 'p_reached out of range'; end if;
  if p_but_not is not null and (p_but_not < 1 or p_but_not > n) then raise exception 'p_but_not out of range'; end if;

  return query
  with r as (
    select fr.user_key, fr.t, fr.tx
      from public._funnel_rows(p_steps, p_from, p_to, p_window, p_order, p_segment, null, p_exclude) fr
  ), r2 as (
    select r.user_key,
           (select array_agg(case when u.ti is null then null
                                   when u.i > 1 and r.tx is not null and u.ti >= r.tx then null
                                   else u.ti end order by u.i)
              from unnest(r.t) with ordinality u(ti, i)) as t
      from r
  )
  select r2.user_key, r2.t[1], r2.t[p_reached]
    from r2
   where r2.t[p_reached] is not null
     and (p_but_not is null or r2.t[p_but_not] is null)
   order by r2.t[1] desc
   limit greatest(1, least(coalesce(p_limit, 500), 5000));
end $$;

-- [7] 전환 소요시간 분포 (로그 스케일 히스토그램) ----------------------------------
create or replace function public.funnel_ttc(
  p_steps     jsonb,
  p_from      timestamptz,
  p_to        timestamptz,
  p_window    interval default interval '1 day',
  p_order     text     default 'this',
  p_segment   jsonb    default '[]'::jsonb,
  p_exclude   text     default null,
  p_step_from int      default 1,
  p_step_to   int      default 2,
  p_buckets   int      default 20
) returns table (lo double precision, hi double precision, users bigint, median_sec double precision)
language plpgsql stable as $$
declare n int;
begin
  n := coalesce(jsonb_array_length(p_steps), 0);
  if p_step_from < 1 or p_step_to > n or p_step_from >= p_step_to then
    raise exception 'bad step range';
  end if;
  p_buckets := greatest(2, least(coalesce(p_buckets, 20), 100));

  return query
  with r as (
    select fr.t from public._funnel_rows(p_steps, p_from, p_to, p_window, p_order, p_segment, null, p_exclude) fr
  ), d as (
    select extract(epoch from (r.t[p_step_to] - r.t[p_step_from]))::double precision as sec
      from r
     where r.t[p_step_from] is not null and r.t[p_step_to] is not null
       and r.t[p_step_to] >= r.t[p_step_from]
  ), b as (
    select min(d.sec) as mn, max(d.sec) as mx,
           (percentile_cont(0.5) within group (order by d.sec))::double precision as med
      from d
  )
  select exp(ln(b.mn + 1) + (k.k    ) * (ln(b.mx + 1) - ln(b.mn + 1)) / p_buckets) - 1,
         exp(ln(b.mn + 1) + (k.k + 1) * (ln(b.mx + 1) - ln(b.mn + 1)) / p_buckets) - 1,
         count(d.sec) filter (where
           least(p_buckets - 1, floor((ln(d.sec + 1) - ln(b.mn + 1))
             / (nullif(ln(b.mx + 1) - ln(b.mn + 1), 0) / p_buckets)))::int = k.k
           or (b.mx = b.mn and k.k = 0)),
         b.med
    from b cross join generate_series(0, p_buckets - 1) k(k)
    left join d on true
   group by k.k, b.mn, b.mx, b.med
   order by k.k;
end $$;

-- [8] UI 드롭다운용 (하드코딩 제거) ------------------------------------------------
create or replace function public.list_events(p_from timestamptz, p_to timestamptz)
returns table (event_name text, cnt bigint) language sql stable as $$
  select e.event_name, count(*) from public.ev e
   where e.ts >= p_from and e.ts < p_to
   group by 1 order by 2 desc
$$;

-- 최근 5만 건 샘플링 — 전체 스캔 방지
create or replace function public.list_props(p_event text, p_from timestamptz, p_to timestamptz)
returns table (key text, n bigint) language sql stable as $$
  select k, count(*) from (
    select e.props from public.ev e
     where e.event_name = p_event and e.ts >= p_from and e.ts < p_to
     order by e.ts desc limit 50000
  ) s, lateral jsonb_object_keys(s.props) k
  group by 1 order by 2 desc
$$;

create or replace function public.list_prop_values(p_event text, p_key text, p_from timestamptz, p_to timestamptz)
returns table (val text, n bigint) language sql stable as $$
  select s.props ->> p_key, count(*) from (
    select e.props from public.ev e
     where e.event_name = p_event and e.ts >= p_from and e.ts < p_to
     order by e.ts desc limit 50000
  ) s
  where s.props ->> p_key is not null
  group by 1 order by 2 desc limit 100
$$;

-- [8b] 이탈 후 다음 행동 분포 (Pathfinder-lite) --------------------------------------
-- 이탈 코호트(p_reached 도달·p_but_not 미도달)가 마지막 도달 직후 p_gap 안에
-- "처음 한 행동"의 분포. 아무 이벤트도 없으면 '(no further events)' = 세션 종료로 집계.
create or replace function public.funnel_next_actions(
  p_steps   jsonb,
  p_from    timestamptz,
  p_to      timestamptz,
  p_window  interval default interval '1 day',
  p_order   text     default 'this',
  p_segment jsonb    default '[]'::jsonb,
  p_exclude text     default null,
  p_reached int      default 1,
  p_but_not int      default null,
  p_gap     interval default interval '1 hour',
  p_limit   int      default 20
) returns table (event_name text, users bigint)
language plpgsql stable as $$
declare n int;
begin
  n := coalesce(jsonb_array_length(p_steps), 0);
  if p_reached < 1 or p_reached > n then raise exception 'p_reached out of range'; end if;
  if p_but_not is not null and (p_but_not < 1 or p_but_not > n) then raise exception 'p_but_not out of range'; end if;

  return query
  with r as (
    select fr.user_key, fr.t, fr.tx
      from public._funnel_rows(p_steps, p_from, p_to, p_window, p_order, p_segment, null, p_exclude) fr
  ), r2 as (
    select r.user_key,
           (select array_agg(case when u.ti is null then null
                                   when u.i > 1 and r.tx is not null and u.ti >= r.tx then null
                                   else u.ti end order by u.i)
              from unnest(r.t) with ordinality u(ti, i)) as t
      from r
  ), cohort as (
    select r2.user_key, r2.t[p_reached] as t_last
      from r2
     where r2.t[p_reached] is not null
       and (p_but_not is null or r2.t[p_but_not] is null)
  ), nxt as (
    select c.user_key,
           (select e.event_name from public.ev e
             where e.user_key = c.user_key and e.ts > c.t_last and e.ts <= c.t_last + p_gap
             order by e.ts asc limit 1) as ev
      from cohort c
  )
  select coalesce(nxt.ev, '(no further events)'), count(*)::bigint
    from nxt
   group by 1 order by 2 desc
   limit greatest(1, least(coalesce(p_limit, 20), 100));
end $$;

-- [8c] 유저 타임라인 (Amplitude User Timeline) --------------------------------------
create or replace function public.user_timeline(
  p_user_key text,
  p_from     timestamptz,
  p_to       timestamptz,
  p_limit    int default 300
) returns table (ts timestamptz, event_name text, props jsonb)
language sql stable as $$
  select e.ts, e.event_name, e.props from public.ev e
   where e.user_key = p_user_key and e.ts >= p_from and e.ts < p_to
   order by e.ts asc
   limit greatest(1, least(coalesce(p_limit, 300), 2000))
$$;

-- [9] 권한 -----------------------------------------------------------------------
-- 호출 경로는 어드민 Next API(service_role, bypass)뿐 — 클라이언트 롤은 전부 차단.
revoke all on function public._funnel_where(jsonb, text) from public, anon, authenticated;
revoke all on function public._funnel_rows(jsonb, timestamptz, timestamptz, interval, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.funnel(jsonb, timestamptz, timestamptz, interval, text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.funnel_users(jsonb, timestamptz, timestamptz, interval, text, jsonb, text, int, int, int) from public, anon, authenticated;
revoke all on function public.funnel_ttc(jsonb, timestamptz, timestamptz, interval, text, jsonb, text, int, int, int) from public, anon, authenticated;
revoke all on function public.funnel_next_actions(jsonb, timestamptz, timestamptz, interval, text, jsonb, text, int, int, interval, int) from public, anon, authenticated;
revoke all on function public.user_timeline(text, timestamptz, timestamptz, int) from public, anon, authenticated;
revoke all on function public.list_events(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.list_props(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.list_prop_values(text, text, timestamptz, timestamptz) from public, anon, authenticated;
revoke select on public.ev from anon, authenticated;
