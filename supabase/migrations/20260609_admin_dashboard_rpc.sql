-- 어드민 대시보드 성능: events 테이블 전량 fetch(수만 행) 대신 DB에서 집계해 반환
-- 1) 날짜(VN, UTC+7)×이벤트 일별 카운트
create or replace function admin_event_daily(p_start timestamptz, p_end timestamptz)
returns table(d date, event text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as d, event, count(*)::bigint as cnt
  from events
  where created_at >= p_start and created_at <= p_end
    and event in (
      'click_jobs_cta','click_job_card','view_jobs_page','click_apply_button','save_job',
      'click_for_companies','click_contact_owner','click_post_job','landing'
    )
  group by 1, 2
$$;

-- 2) page_view/view_jobs_page 의 날짜(VN)×UTM 차원별 카운트
create or replace function admin_utm_pageviews(p_start timestamptz, p_end timestamptz)
returns table(d date, utm_source text, utm_campaign text, utm_content text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $$
  select (created_at at time zone 'Asia/Ho_Chi_Minh')::date as d,
         meta->>'utm_source', meta->>'utm_campaign', meta->>'utm_content', count(*)::bigint as cnt
  from events
  where created_at >= p_start and created_at <= p_end
    and event in ('page_view','view_jobs_page')
  group by 1, 2, 3, 4
$$;

-- 조회 성능용 인덱스 (이벤트+시간)
create index if not exists idx_events_event_created_at on events(event, created_at);

grant execute on function admin_event_daily(timestamptz, timestamptz) to service_role;
grant execute on function admin_utm_pageviews(timestamptz, timestamptz) to service_role;
